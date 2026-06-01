const mongoose = require("mongoose");

const galleryModel = new mongoose.Schema(
  {
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      default: null,
    },
    tourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
      default: null,
    },
    stateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "State",
      default: null,
    },
    banner: {
      type: String,
      trim: true,
    },
    images: [
      {
        url: {
          type: String,
          required: true,
          trim: true,
        },
        caption: {
          type: String,
          trim: true,
        },
        altText: {
          type: String,
          trim: true,
        },
        order: {
          type: Number,
          default: 0,
        },
      },
    ],
    videos: [
      {
        url: {
          type: String,
          required: true,
          trim: true,
        },
        title: {
          type: String,
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        thumbnail: {
          type: String,
          trim: true,
        },

        duration: {
          type: String,
          trim: true,
        },
        order: {
          type: Number,
          default: 0,
        },
      },
    ],
    isDisabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

galleryModel.index({ packageId: 1 });
galleryModel.index({ tourId: 1 });
// galleryModel.pre('save', function(next) {
//     if (!this.packageId && !this.tourId) {
//         next(new Error('Either packageId or tourId must be provided'));
//     } else if (this.packageId && this.tourId) {
//         next(new Error('Cannot have both packageId and tourId'));
//     } else {
//         next();
//     }
// });

const GalleryModel = mongoose.model("Gallery", galleryModel);
module.exports = GalleryModel;
