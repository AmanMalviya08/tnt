const { ScratchCoupon } = require("../models/scratchCouponModel");
const { CouponRewardConfig } = require("../models/couponRewardConfigModel");
const {
  DEFAULT_REWARD_POOL,
  COUPON_EXPIRY_DAYS,
} = require("../constants/couponConstants");

const CONFIG_KEY = "scratch_reward_pool";

async function getRewardConfig() {
  let config = await CouponRewardConfig.findOne({ key: CONFIG_KEY }).lean();
  if (!config) {
    config = await CouponRewardConfig.create({
      key: CONFIG_KEY,
      rewardPool: DEFAULT_REWARD_POOL,
      expiryDays: COUPON_EXPIRY_DAYS,
    }).then((doc) => doc.toObject());
  }
  return config;
}

async function getActiveRewardPool() {
  const config = await getRewardConfig();
  const pool = (config.rewardPool || []).filter((item) => item.isActive !== false);
  return pool.length ? pool : DEFAULT_REWARD_POOL;
}

async function updateRewardPool(payload = {}, adminUserId) {
  const { rewardPool, expiryDays } = payload;
  const update = { updatedBy: adminUserId };

  if (Array.isArray(rewardPool)) {
    update.rewardPool = rewardPool.map((item) => ({
      rewardType: item.rewardType,
      rewardLabel: String(item.rewardLabel || "").trim(),
      rewardValue: Number(item.rewardValue) || 0,
      weight: Math.max(0, Number(item.weight) || 0),
      isActive: item.isActive !== false,
    })).filter((item) => item.rewardLabel && item.rewardType);
  }

  if (expiryDays != null) {
    update.expiryDays = Math.max(1, parseInt(expiryDays, 10) || COUPON_EXPIRY_DAYS);
  }

  const config = await CouponRewardConfig.findOneAndUpdate(
    { key: CONFIG_KEY },
    { $set: update, $setOnInsert: { key: CONFIG_KEY, rewardPool: DEFAULT_REWARD_POOL } },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  return config;
}

function pickRewardFromPool(pool = DEFAULT_REWARD_POOL) {
  const totalWeight = pool.reduce((sum, item) => sum + (item.weight || 1), 0);
  let roll = Math.random() * totalWeight;

  for (const item of pool) {
    roll -= item.weight || 1;
    if (roll <= 0) {
      return {
        rewardType: item.rewardType,
        rewardLabel: item.rewardLabel,
        rewardValue: item.rewardValue ?? 0,
      };
    }
  }

  const fallback = pool[0];
  return {
    rewardType: fallback.rewardType,
    rewardLabel: fallback.rewardLabel,
    rewardValue: fallback.rewardValue ?? 0,
  };
}

function buildExpiryDate(days = COUPON_EXPIRY_DAYS) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
}

async function generateCouponForBooking(booking) {
  if (!booking?.userId || !booking?._id) return null;

  const existing = await ScratchCoupon.findOne({
    userId: booking.userId,
    bookingId: booking._id,
  }).lean();

  if (existing) return existing;

  const [pool, config] = await Promise.all([getActiveRewardPool(), getRewardConfig()]);
  const reward = pickRewardFromPool(pool);
  const coupon = await ScratchCoupon.create({
    userId: booking.userId,
    bookingId: booking._id,
    rewardType: reward.rewardType,
    rewardLabel: reward.rewardLabel,
    rewardValue: reward.rewardValue,
    expiresAt: buildExpiryDate(config?.expiryDays || COUPON_EXPIRY_DAYS),
  });

  return coupon;
}

async function generateCouponsForBookings(bookings = []) {
  const results = [];
  for (const booking of bookings) {
    try {
      const coupon = await generateCouponForBooking(booking);
      if (coupon) results.push(coupon);
    } catch (err) {
      if (err?.code === 11000) continue;
      console.error("[scratchCoupon] generate failed:", err.message);
    }
  }
  return results;
}

async function getUserCoupons(userId) {
  return ScratchCoupon.find({ userId })
    .populate("bookingId", "bookingId bookingStatus paymentStatus")
    .sort({ createdAt: -1 })
    .lean();
}

async function scratchCoupon(couponId, userId) {
  const coupon = await ScratchCoupon.findOne({ _id: couponId, userId });
  if (!coupon) {
    const err = new Error("Coupon not found");
    err.statusCode = 404;
    throw err;
  }

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    const err = new Error("Coupon has expired");
    err.statusCode = 400;
    throw err;
  }

  if (coupon.isScratched) {
    return coupon;
  }

  coupon.isScratched = true;
  coupon.scratchedAt = new Date();
  await coupon.save();
  return coupon;
}

async function redeemCouponByUser(couponId, userId) {
  const coupon = await ScratchCoupon.findOne({ _id: couponId, userId });
  if (!coupon) {
    const err = new Error("Coupon not found");
    err.statusCode = 404;
    throw err;
  }

  if (!coupon.isScratched) {
    const err = new Error("Scratch the coupon before redeeming");
    err.statusCode = 400;
    throw err;
  }

  if (coupon.isRedeemed) {
    const err = new Error("Coupon already redeemed");
    err.statusCode = 400;
    throw err;
  }

  coupon.isRedeemed = true;
  coupon.redeemedAt = new Date();
  await coupon.save();
  return coupon;
}

async function listAdminCoupons({ rewardType, isRedeemed } = {}) {
  const filter = {};

  if (rewardType) filter.rewardType = rewardType;
  if (isRedeemed !== undefined && isRedeemed !== null && isRedeemed !== "") {
    filter.isRedeemed = isRedeemed === true || isRedeemed === "true";
  }

  return ScratchCoupon.find(filter)
    .populate("userId", "firstName lastName phone name")
    .populate("bookingId", "bookingId")
    .sort({ createdAt: -1 })
    .lean();
}

async function markCouponRedeemedByAdmin(couponId, adminUserId) {
  const coupon = await ScratchCoupon.findById(couponId);
  if (!coupon) {
    const err = new Error("Coupon not found");
    err.statusCode = 404;
    throw err;
  }

  if (coupon.isRedeemed) {
    return coupon;
  }

  coupon.isRedeemed = true;
  coupon.redeemedAt = new Date();
  coupon.redeemedBy = adminUserId;
  await coupon.save();

  return ScratchCoupon.findById(couponId)
    .populate("userId", "firstName lastName phone name")
    .populate("bookingId", "bookingId")
    .lean();
}

module.exports = {
  pickRewardFromPool,
  getRewardConfig,
  getActiveRewardPool,
  updateRewardPool,
  generateCouponForBooking,
  generateCouponsForBookings,
  getUserCoupons,
  scratchCoupon,
  redeemCouponByUser,
  listAdminCoupons,
  markCouponRedeemedByAdmin,
};
