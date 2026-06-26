const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const couponController = require("../controller/couponController");

const router = express.Router();

router.get("/mine", protect, couponController.getMyCoupons);
router.get("/promo-mine", protect, couponController.getMyPromoCoupons);
router.post("/:id/scratch", protect, couponController.scratchCoupon);
router.post("/:id/redeem", protect, couponController.redeemCoupon);

module.exports = router;
