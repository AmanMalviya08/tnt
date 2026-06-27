const mongoose = require("mongoose");

const tourBroadcastSchema = new mongoose.Schema(
  {
    tourId: { type: mongoose.Schema.Types.ObjectId, ref: "Tour", required: true },
    allocationId: { type: mongoose.Schema.Types.ObjectId, ref: "GuideAllocation" },
    guideId: { type: mongoose.Schema.Types.ObjectId, ref: "Guide" },
    message: { type: String, required: true, trim: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sentByRole: { type: String, enum: ["Guide", "Admin", "SubAdmin"], default: "Guide" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TourBroadcast", tourBroadcastSchema);
