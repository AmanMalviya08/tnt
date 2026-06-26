const mongoose = require("mongoose");

const MAX_PHOTOS_PER_USER_PER_TOUR = 10;

const tripPhotoSchema = new mongoose.Schema(
  {
    tourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
      required: true,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      default: null,
    },
    caption: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

tripPhotoSchema.index({ tourId: 1, isApproved: 1, uploadedAt: -1 });
tripPhotoSchema.index({ uploadedBy: 1, tourId: 1 });

const TripPhoto =
  mongoose.models.TripPhoto || mongoose.model("TripPhoto", tripPhotoSchema);

module.exports = { TripPhoto, tripPhotoSchema, MAX_PHOTOS_PER_USER_PER_TOUR };
