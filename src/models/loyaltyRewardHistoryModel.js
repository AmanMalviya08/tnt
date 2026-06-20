const mongoose = require("mongoose");

const loyaltyEventTypes = [
  "progress_increment",
  "milestone_unlocked",
  "reward_applied",
  "reward_expired",
];

const loyaltyRewardHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: loyaltyEventTypes,
      required: true,
    },
    completedGroupYatras: { type: Number, min: 0 },
    requiredYatras: { type: Number, min: 1, default: 4 },
    discountType: { type: String, enum: ["flat", "free"] },
    discountValue: { type: Number, min: 0 },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    bookingRef: { type: String, trim: true },
    message: { type: String, trim: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

loyaltyRewardHistorySchema.index({ userId: 1, createdAt: -1 });

const loyaltyRewardHistoryModel = mongoose.model(
  "LoyaltyRewardHistory",
  loyaltyRewardHistorySchema
);

module.exports = {
  loyaltyRewardHistoryModel,
  loyaltyEventTypes,
};
