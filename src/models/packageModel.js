const mongoose = require("mongoose");
const { generateSlug, ensureUniqueSlug } = require("../utils/slugHelper");

const packageTypes = ["Single City", "Multi-City"];
const packageCategories = ["Temple", "Honeymoon", "Popular Packages", "Other"];
const mealOptions = [];
// const mealOptions = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const transportOptions = ["Bus", "Car", "Flight", "Train", "Cruise", "Tempo Traveller", "Boat", "Mixed"];
const generatePlaceId = async (Package, currentDocId) => {
  // const basePlaceId = `${placeName.toLowerCase().replace(/\s+/g, '-')}-${cityName.toLowerCase().replace(/\s+/g, '-')}`;
  //  const basePlaceId='0';
  let packageIdUnique = '1';
  let counter = 1;

  while (await Package.findOne({
    packageIdUnique,
    _id: { $ne: currentDocId }
  })) {
    packageIdUnique = `${counter}`;
    counter++;
  }

  return packageIdUnique;
};
const itinerarySchema = new mongoose.Schema(
  {
    dayNumber: {
      type: Number,
      min: 1,
    },
    dayTitle: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    placeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Place",
      },
    ],
    mealsIncluded: [
      {
        type: String,
        // enum: mealOptions,
      },
    ],
    hotelDetails: {
      type: String,
      trim: true,
    },
    transportInfo: [{
      type: String,
      trim: true,
    }],
  },
  { _id: false }
);

const addOnSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      min: 0,
    },
    optional: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const groupDiscountSchema = new mongoose.Schema(
  {
    minPersons: {
      type: Number,
      min: 1,
    },
    discountPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

const packageSchema = new mongoose.Schema(
  {
    packageIdUnique: {
      type: String,
      trim: true,
      uppercase: true,
    },
    packageName: {
      type: String,
      required: true,
      trim: true,
    },
    packageType: {
      type: String,
      enum: packageTypes,
      required: true,
    },
    tagline: {
      type: String,
      trim: true,
    },
    cityIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
        required: true,
      },
    ],
    durationDays: {
      type: Number,
      required: true,
      min: 1,
    },
    durationNights: {
      type: Number,
      required: true,
      min: 0,
    },
    bestSeason: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      enum: packageCategories,
      default: "Other",
      index: true,
    },
    isPopular: {
      type: Boolean,
      default: false,
      index: true,
    },
    bookingCountLast30Days: {
      type: Number,
      default: 0,
      min: 0,
    },
    demandFactor: {
      type: Number,
      default: 1,
      min: 0,
      max: 2,
    },
    itinerary: {
      type: [itinerarySchema],
      default: [],
    },
    basePricePerPerson: {
      type: Number,
      required: true,
      min: 0,
    },
    childPrice: {
      type: Number,
      min: 0,
    },
    groupDiscounts: {
      type: [groupDiscountSchema],
      default: [],
    },
    customAddOns: {
      type: [addOnSchema],
      default: [],
    },
    currency: {
      type: String,
      uppercase: true,
      default: "INR",
    },
    taxPercent: {
      type: Number,
      min: 0,
    },
    inclusions: {
      type: [String],
      default: [],
    },
    exclusions: {
      type: [String],
      default: [],
    },
    optionalAddOns: {
      type: [addOnSchema],
      default: [],
    },
    coverImage: {
      type: String,
      trim: true,
    },
    galleryImages: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
    brochureUrl: {
      type: String,
      trim: true,
    },
    videoLink: {
      type: String,
      trim: true,
    },
    pickupPoint: {
      type: String,
      trim: true,
    },
    dropPoint: {
      type: String,
      trim: true,
    },
    transportType: {
      type: String,
      enum: transportOptions,
    },
    insuranceOptions: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
    },
    metaTitle: {
      type: String,
      trim: true,
    },
    metaDescription: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    totalBookings: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
    ratings: {
      location: { type: Number, default: 0 },
      price: { type: Number, default: 0 },
      services: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 }
    },
    highlights: {
      type: [String],
      default: [],
    },

  },
  { timestamps: true }
);
packageSchema.virtual('wishlist', {
  ref: 'Wishlist',
  localField: '_id',
  foreignField: 'packageId',
});
packageSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'packageId'
});
packageSchema.set('toObject', { virtuals: true });
packageSchema.set('toJSON', { virtuals: true });
async function ensureUniqueField(model, field, value, attempt = 0) {
  const candidate = attempt === 0 ? value : `${value}-${attempt}`;
  const exists = await model.exists({ [field]: candidate });
  if (exists) {
    return ensureUniqueField(model, field, value, attempt + 1);
  }
  return candidate;
}
function generateUniqueCode(prefix = "BK") {
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase();
  return `${prefix}-${unique}`;
}

packageSchema.pre("save", async function (next) {
  try {

    if (!this.placeIdUnique) {
      const package = this.constructor;
      const rawId = generateUniqueCode("PK");
      this.packageIdUnique = await ensureUniqueField(package, "packageIdUnique", rawId);
    }
    if (this.isModified("packageName") || this.isModified("slug") || !this.slug) {
      const rawSlug = this.slug ? generateSlug(this.slug) : generateSlug(this.packageName);
      const Package = this.constructor;
      this.slug = await ensureUniqueSlug(Package, rawSlug, this._id);
    }

    if (!this.durationNights && this.durationDays) {
      this.durationNights = Math.max(this.durationDays - 1, 0);
    }

    next();
  } catch (error) {
    next(error);
  }
});

packageSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) {
      return next();
    }

    // const payload = update.$set ? update.$set : update;
    const payload = { ...update };
    delete payload.$set;
    delete payload.$setOnInsert;

    
    if (payload.packageName || payload.slug) {
      const Package = mongoose.model("Package");
      const rawSlug = payload.slug
        ? generateSlug(payload.slug)
        : generateSlug(payload.packageName);
      const uniqueSlug = await ensureUniqueSlug(Package, rawSlug, this.getQuery()._id);

      if (update.$set) {
        update.$set.slug = uniqueSlug;
      } else {
        update.slug = uniqueSlug;
      }
    }

    if (!payload.durationNights && payload.durationDays) {
      const nights = Math.max(payload.durationDays - 1, 0);
      if (update.$set) {
        update.$set.durationNights = nights;
      } else {
        update.durationNights = nights;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});
const packageModel = mongoose.model("Package", packageSchema);

packageSchema.index({ category: 1, isDisabled: 1 });
packageSchema.index({ isPopular: 1, bookingCountLast30Days: -1 });

module.exports = {
  packageModel,
  packageTypes,
  packageCategories,
  mealOptions,
  transportOptions,
};
