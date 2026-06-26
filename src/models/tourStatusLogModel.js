// FEATURE: Tour Live Status | Added: 2026-06-26 | Status: NEW

const mongoose = require("mongoose");
const { TOUR_STATUS_CODES } = require("../constants/tourStatusConstants");

const tourStatusLogSchema = new mongoose.Schema(
  {
    tourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
      required: true,
      index: true,
    },
    statusCode: {
      type: String,
      enum: TOUR_STATUS_CODES,
      required: true,
    },
    label: {
      type: String,
      trim: true,
      required: true,
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

tourStatusLogSchema.index({ tourId: 1, timestamp: -1 });
tourStatusLogSchema.index({ tourId: 1, statusCode: 1 });

const tourStatusLogModel = mongoose.model("TourStatusLog", tourStatusLogSchema);

module.exports = { tourStatusLogModel };
