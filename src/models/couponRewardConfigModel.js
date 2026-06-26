const mongoose = require("mongoose");
const { DEFAULT_REWARD_POOL, COUPON_EXPIRY_DAYS } = require("../constants/couponConstants");

const rewardPoolItemSchema = new mongoose.Schema(
  {
    rewardType: { type: String, required: true },
    rewardLabel: { type: String, required: true, trim: true },
    rewardValue: { type: Number, default: 0 },
    weight: { type: Number, default: 1, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const couponRewardConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "scratch_reward_pool" },
    rewardPool: { type: [rewardPoolItemSchema], default: () => DEFAULT_REWARD_POOL },
    expiryDays: { type: Number, default: COUPON_EXPIRY_DAYS, min: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

const CouponRewardConfig =
  mongoose.models.CouponRewardConfig ||
  mongoose.model("CouponRewardConfig", couponRewardConfigSchema);

module.exports = { CouponRewardConfig };
