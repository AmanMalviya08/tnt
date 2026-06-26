const scratchCouponService = require("../services/scratchCouponService");

const ADMIN_ROLES = ["Admin", "SubAdmin"];

function handleError(res, error, fallback = "Request failed") {
  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error.message || fallback,
    error: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
}

exports.getMyCoupons = async (req, res) => {
  try {
    const data = await scratchCouponService.getUserCoupons(req.user.userId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Failed to fetch coupons");
  }
};

exports.scratchCoupon = async (req, res) => {
  try {
    const data = await scratchCouponService.scratchCoupon(
      req.params.id,
      req.user.userId
    );
    return res.status(200).json({
      success: true,
      message: "Coupon revealed",
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to scratch coupon");
  }
};

exports.redeemCoupon = async (req, res) => {
  try {
    const data = await scratchCouponService.redeemCouponByUser(
      req.params.id,
      req.user.userId
    );
    return res.status(200).json({
      success: true,
      message: "Coupon redeemed",
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to redeem coupon");
  }
};

exports.getAdminCoupons = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { rewardType, isRedeemed } = req.query;
    const data = await scratchCouponService.listAdminCoupons({
      rewardType,
      isRedeemed,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Failed to list coupons");
  }
};

exports.markCouponRedeemed = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const data = await scratchCouponService.markCouponRedeemedByAdmin(
      req.params.id,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: "Coupon marked as fulfilled",
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to mark coupon redeemed");
  }
};

exports.getRewardPoolConfig = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    const data = await scratchCouponService.getRewardConfig();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Failed to load reward pool");
  }
};

exports.updateRewardPoolConfig = async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    const data = await scratchCouponService.updateRewardPool(req.body, req.user.userId);
    return res.status(200).json({
      success: true,
      message: "Reward pool updated",
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update reward pool");
  }
};

exports.getMyPromoCoupons = async (req, res) => {
  try {
    const OfferController = require("../controller/offerController");
    const offerController = new OfferController();
    const [offersResult, scratchCoupons] = await Promise.all([
      offerController.getAllOffers({ active: true, limit: 100 }, {}),
      scratchCouponService.getUserCoupons(req.user.userId),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        offers: offersResult.data || [],
        scratchCoupons: scratchCoupons || [],
        pendingScratchCount: (scratchCoupons || []).filter(
          (c) => !c.isScratched && (!c.expiresAt || new Date(c.expiresAt) >= new Date())
        ).length,
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch promo coupons");
  }
};
