const mongoose = require("mongoose");

const missingPassengerAlertSchema = new mongoose.Schema(
  {
    tourId: { type: mongoose.Schema.Types.ObjectId, ref: "Tour", required: true },
    allocationId: { type: mongoose.Schema.Types.ObjectId, ref: "GuideAllocation", required: true },
    guideId: { type: mongoose.Schema.Types.ObjectId, ref: "Guide", required: true },
    passengerName: { type: String, required: true, trim: true },
    passengerPhone: { type: String, trim: true },
    emergencyContactPhone: { type: String, trim: true },
    note: { type: String, trim: true },
    status: {
      type: String,
      enum: ["Open", "Resolved"],
      default: "Open",
    },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MissingPassengerAlert", missingPassengerAlertSchema);
