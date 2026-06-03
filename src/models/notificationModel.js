const mongoose = require("mongoose");

const notificationTypes = [
  "admin",
  "booking",
  "deal",
  "reward",
  "tour",
  "system",
];

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: notificationTypes,
      default: "admin",
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    redirectScreen: {
      type: String,
      trim: true,
    },
    redirectParams: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

const notificationModel = mongoose.model("Notification", notificationSchema);

module.exports = {
  notificationModel,
  notificationTypes,
};
