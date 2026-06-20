const mongoose = require("mongoose");

const guideTourLogSchema = new mongoose.Schema(
  {
    guideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guide",
      required: true,
      index: true,
    },
    allocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GuideAllocation",
      default: null,
    },
    albumName: {
      type: String,
      required: true,
      trim: true,
    },
    images: [
      {
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    feedback: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const guideTourLogModel = mongoose.model("GuideTourLog", guideTourLogSchema);

module.exports = { guideTourLogModel };
