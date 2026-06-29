const mongoose = require("mongoose");

const userTourLocationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    guideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guide",
      index: true,
    },
    location: {
      lat: Number,
      lng: Number,
      address: String,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

userTourLocationSchema.index({ userId: 1, tourId: 1 }, { unique: true });
userTourLocationSchema.index({ guideId: 1, lastUpdated: -1 });

const userTourLocationModel = mongoose.model("UserTourLocation", userTourLocationSchema);

module.exports = { userTourLocationModel };
