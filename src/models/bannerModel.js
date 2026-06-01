const mongoose = require('mongoose')
const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    redirectUrl: { type: String, trim: true },
    images: [{ type: String, trim: true }],
    type: {
      type: String,
      enum: ["HERO", "SIDEBAR", "POPUP", "CATEGORY", "OFFER", "PROMOTIONAL", "DISCOVER_SECTION", "TESTIMONIALS", "APP_DOWNLOAD", "DESTINATION_GRID", "FEATURES", "STATS_SECTION"],
      trim: true,
    },
    role: {
      type: String,
      enum: ["All", "Agent", "Traveler"],
      default: "All",
      trim: true
    },
    badge: {
      text: { type: String, trim: true },
      icon: { type: String, trim: true },
      url: { type: String, trim: true }
    },

    // offerId: { type: mongoose.Schema.Types.ObjectId ,ref:'Offer'},
    percentDiscount: {
      type: Number,
      default: 0
    },
    description: { type: String, trim: true },
    items: [
      {
        title: { type: String, trim: true },
        subtitle: { type: String, trim: true },
        description: { type: String, trim: true },
        image: { type: String, trim: true },
        images: [{ type: String, trim: true }],
        url: { type: String, trim: true },
        icon: { type: String, trim: true },
        badge: { type: String, trim: true },
        rating: { type: Number },
        price: { type: Number },
        discount: { type: Number },
        ctaText: { type: String, trim: true },
        ctaUrl: { type: String, trim: true }
      }
    ],
    ctaButton: {
      text: { type: String, trim: true },
      url: { type: String, trim: true }
    },
    startDate: { type: Date },
    endDate: { type: Date },
    displayOrder: { type: Number, default: 0 },
    isDisabled: { type: Boolean, default: false },
    // priority: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);



const bannerModel = mongoose.model("Banner", bannerSchema);

module.exports = bannerModel


