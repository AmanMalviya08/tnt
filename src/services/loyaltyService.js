/**
 * Loyalty service — wraps Yatra Rewards with history tracking and FCM push.
 */

const { userModel } = require("../models/userModel");
const {
  loyaltyRewardHistoryModel,
} = require("../models/loyaltyRewardHistoryModel");
const { notifyUser } = require("./notificationDispatchService");
const CompanyModel = require("../models/companyModel");

const REQUIRED_YATRAS = 4;

async function getLoyaltyConfig() {
  const company = await CompanyModel.findOne({}).lean();
  return {
    discountType: company?.yatraLoyaltyDiscountType || "flat",
    discountValue: company?.yatraLoyaltyDiscountValue ?? 50,
  };
}

async function recordLoyaltyEvent(payload) {
  try {
    await loyaltyRewardHistoryModel.create(payload);
  } catch (err) {
    console.error("[LoyaltyService] History record failed:", err.message);
  }
}

async function sendMilestoneNotification(userId, required, config) {
  const discountText =
    config.discountType === "free"
      ? "FREE 5th Group Yatra"
      : `₹${config.discountValue} discount on your next Group Yatra`;

  await notifyUser(userId, {
    title: "🎉 Yatra Reward Unlocked!",
    message: `You completed ${required} Group Yatras! Enjoy ${discountText} on your next booking.`,
    type: "yatra_loyalty",
    redirectScreen: "RewardsBenefits",
    redirectParams: { tab: "rewards" },
    meta: { discountType: config.discountType, discountValue: config.discountValue },
  });
}

function isEligibleGroupBooking(booking) {
  return (
    booking?.bookingType === "Group Tour" &&
    (booking?.numberOfTravelers > 1 || (booking?.adults || 0) > 1)
  );
}

async function getRewardHistory(userId, options = {}) {
  const page = Math.max(parseInt(options.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    loyaltyRewardHistoryModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("bookingId", "bookingId bookingStatus finalAmount travelStartDate")
      .lean(),
    loyaltyRewardHistoryModel.countDocuments({ userId }),
  ]);

  return {
    data: items,
    pagination: {
      totalItems: total,
      currentPage: page,
      pageSize: limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

module.exports = {
  REQUIRED_YATRAS,
  getLoyaltyConfig,
  recordLoyaltyEvent,
  sendMilestoneNotification,
  isEligibleGroupBooking,
  getRewardHistory,
};
