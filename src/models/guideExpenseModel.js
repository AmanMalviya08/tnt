const mongoose = require("mongoose");

const guideExpenseSchema = new mongoose.Schema(
  {
    tourId: { type: mongoose.Schema.Types.ObjectId, ref: "Tour", required: true },
    allocationId: { type: mongoose.Schema.Types.ObjectId, ref: "GuideAllocation", required: true },
    guideId: { type: mongoose.Schema.Types.ObjectId, ref: "Guide", required: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true },
    receiptUrl: { type: String, trim: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewNote: { type: String, trim: true },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GuideExpense", guideExpenseSchema);
