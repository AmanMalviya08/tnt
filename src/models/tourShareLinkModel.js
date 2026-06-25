const mongoose = require("mongoose");
const crypto = require("crypto");

const tourShareLinkSchema = new mongoose.Schema(
  {
    tourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
      required: true,
      index: true,
    },
    shareToken: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
    lastAccessedAt: Date,
  },
  { timestamps: true }
);

tourShareLinkSchema.statics.generateToken = function () {
  return crypto.randomBytes(24).toString("hex");
};

const tourShareLinkModel = mongoose.model("TourShareLink", tourShareLinkSchema);

module.exports = { tourShareLinkModel };
