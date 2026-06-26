const mongoose = require("mongoose");
const { REWARD_TYPES } = require("../constants/couponConstants");

const scratchCouponSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    rewardType: {
      type: String,
      enum: REWARD_TYPES,
      required: true,
    },
    rewardLabel: {
      type: String,
      trim: true,
      required: true,
    },
    rewardValue: {
      type: Number,
      default: 0,
    },
    isScratched: {
      type: Boolean,
      default: false,
    },
    scratchedAt: {
      type: Date,
      default: null,
    },
    isRedeemed: {
      type: Boolean,
      default: false,
    },
    redeemedAt: {
      type: Date,
      default: null,
    },
    redeemedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

scratchCouponSchema.index({ userId: 1, bookingId: 1 }, { unique: true });

const ScratchCoupon =
  mongoose.models.ScratchCoupon ||
  mongoose.model("ScratchCoupon", scratchCouponSchema);

module.exports = { ScratchCoupon, scratchCouponSchema };
