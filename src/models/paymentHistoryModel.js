const mongoose = require("mongoose");

const paymentHistoryTypes = ["advance", "balance", "full", "refund"];

const paymentHistorySchema = new mongoose.Schema(
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
      index: true,
    },
    bookingRef: { type: String, trim: true, index: true },
    orderId: { type: String, trim: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    paymentType: {
      type: String,
      enum: paymentHistoryTypes,
      required: true,
    },
    paymentMethod: { type: String, trim: true },
    transactionId: { type: String, trim: true, sparse: true },
    status: {
      type: String,
      enum: ["Pending", "Completed", "Failed", "Refunded"],
      default: "Completed",
    },
    notes: { type: String, trim: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

paymentHistorySchema.index({ userId: 1, createdAt: -1 });

const paymentHistoryModel = mongoose.model("PaymentHistory", paymentHistorySchema);

module.exports = {
  paymentHistoryModel,
  paymentHistoryTypes,
};
