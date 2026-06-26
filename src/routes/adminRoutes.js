const express = require("express");
const adminController = require("../controller/adminController");
const { protect } = require("../middleware/authMiddleware");
const notificationController = require("../controller/notificationController");
const couponController = require("../controller/couponController");
const tripPhotoController = require("../controller/tripPhotoController");

const router = express.Router();

router.get("/analytics", protect, adminController.getDashboardAnalytics);
router.get("/diagnose", adminController.diagnoseSystem);
router.post("/notifications/send", protect, notificationController.sendAdminNotification);
router.get("/tours/:tourId/status-board", protect, (req, res) => {
  const tourStatusController = require("../controller/tourStatusController");
  return tourStatusController.getAdminStatusBoard(req, res);
});

// Scratch coupon management (admin)
router.get("/coupons/reward-pool", protect, couponController.getRewardPoolConfig);
router.put("/coupons/reward-pool", protect, couponController.updateRewardPoolConfig);
router.get("/coupons", protect, couponController.getAdminCoupons);
router.patch("/coupons/:id/redeem", protect, couponController.markCouponRedeemed);

// Trip photo moderation (UGC — separate from CMS /api/gallery)
router.get("/gallery/pending", protect, tripPhotoController.getPendingPhotos);
router.patch("/gallery/bulk-approve", protect, tripPhotoController.bulkApprovePhotos);
router.patch("/gallery/:id/approve", protect, tripPhotoController.approvePhoto);
router.delete("/gallery/:id", protect, tripPhotoController.rejectPhoto);

module.exports = router;
