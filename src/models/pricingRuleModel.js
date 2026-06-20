const mongoose = require("mongoose");

const pricingRuleTypes = [
  "weekend",
  "festival",
  "demand",
  "seat_availability",
  "custom",
];

const adjustmentTypes = ["flat", "percent"];

const pricingRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    ruleType: {
      type: String,
      enum: pricingRuleTypes,
      required: true,
      index: true,
    },
    adjustmentType: {
      type: String,
      enum: adjustmentTypes,
      default: "flat",
    },
    adjustmentValue: { type: Number, required: true, min: 0 },
    priority: { type: Number, default: 100, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    validFrom: { type: Date },
    validTo: { type: Date },
    conditions: {
      minOccupancyPercent: { type: Number, min: 0, max: 100 },
      maxRemainingSeats: { type: Number, min: 0 },
      festivalDates: [{ type: Date }],
      weekendDays: [{ type: Number, min: 0, max: 6 }],
      packageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Package" }],
      tourIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tour" }],
      minTravelers: { type: Number, min: 1 },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const pricingRuleModel = mongoose.model("PricingRule", pricingRuleSchema);

module.exports = {
  pricingRuleModel,
  pricingRuleTypes,
  adjustmentTypes,
};
