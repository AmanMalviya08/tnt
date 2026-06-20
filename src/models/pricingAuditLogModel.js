const mongoose = require("mongoose");

const pricingAuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
    tourId: { type: mongoose.Schema.Types.ObjectId, ref: "Tour" },
    baseAmount: { type: Number, min: 0, required: true },
    finalAmount: { type: Number, min: 0, required: true },
    breakdown: [
      {
        label: { type: String, trim: true },
        amount: { type: Number },
        type: { type: String, trim: true },
        ruleId: { type: mongoose.Schema.Types.ObjectId, ref: "PricingRule" },
      },
    ],
    appliedRuleIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "PricingRule" },
    ],
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

pricingAuditLogSchema.index({ createdAt: -1 });

const pricingAuditLogModel = mongoose.model(
  "PricingAuditLog",
  pricingAuditLogSchema
);

module.exports = { pricingAuditLogModel };
