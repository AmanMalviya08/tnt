const mongoose = require("mongoose");
const { generateSlug, ensureUniqueSlug } = require("../utils/slugHelper");

const accessibilityOptions = ["Walking", "Vehicle", "Public Transport"];
const crowdLevels = ["Low", "Medium", "High"];
 
const placeSchema = new mongoose.Schema(
  {
    placeIdUnique: {
      type: String,
      trim: true,
      uppercase: true,
    },
    placeName: {
      type: String,
      required: true,
      trim: true,
    },
    cityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
      required: true,
    },
    category: {
      type: String,
      trim: true,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    highlights: {
      type: [String],
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
    virtualTourLink: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
   latitude: {
  type: Number,
  min: [-90, "Latitude must be ≥ -90"],
  max: [90, "Latitude must be ≤ 90"],
},

longitude: {
  type: Number,
  min: [-180, "Longitude must be ≥ -180"],
  max: [180, "Longitude must be ≤ 180"],
}
,
    nearbyLandmarks: {
      type: [String],
      default: [],
    },
    accessibility: {
      type: [
        {
          type: String,
          enum: accessibilityOptions,
        },
      ],
      default: [],
    },
    bestTimeToVisit: {
      type: String,
      trim: true,
    },
    openingHours: {
      type: String,
      trim: true,
    },
    entryFee: {
      type: String,
      trim: true,
    },
    averageVisitDuration: {
      type: String,
      trim: true,
    },
    crowdLevel: {
      type: String,
      enum: crowdLevels,
    },
    facilities: {
      parking: {
        type: Boolean,
        default: false,
      },
      restroom: {
        type: Boolean,
        default: false,
      },
      food: {
        type: Boolean,
        default: false,
      },
      drinkingWater: {
        type: Boolean,
        default: false,
      },
      guideAvailability: {
        type: Boolean,
        default: false,
      },
      souvenirShops: {
        type: Boolean,
        default: false,
      },
      wheelchairAccessibility: {
        type: Boolean,
        default: false,
      },
    },
    importanceNotes: {
      type: String,
      trim: true,
    },
    rules: {
      type: String,
      trim: true,
    },
    nearbyAttractions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Place",
      },
    ],
    safetyNotes: {
      type: String,
      trim: true,
    },
    seoTitle: {
      type: String,
      trim: true,
    },
    seoKeywords: {
      type: [String],
      default: [],
    },
    seoDescription: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    featured: {
      type: Boolean,
      default: false,
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
    },

    // packageId:{
    //   type:mongoose.Schema.Types.ObjectId,
    //   ref:'Package'

    // },
    averageRating: {
      type: Number,
      default: 1
    },
    totalReviews: {
      type: Number,
      default: 0
    },
    ratings: {
      location: { type: Number, default: 1 },
      price: { type: Number, default: 1 },
      services: { type: Number, default: 1 },
      averageRating: { type: Number, default: 1 },
      totalReviews:{type:Number,default:0}
    }
    ,
    adultPrice: {
      type: Number,
      default: 0

    },
    childPrice: {
      type: Number,
      default: 0
    },
    historicalImportance: {
      type: String
    },
    localRules: {
      type: String
    }
  },
  { timestamps: true }
);
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
placeSchema.pre("save", async function (next) {
  try {
     if (!this.placeIdUnique) {
      const Place = this.constructor;
      const rawId = generateUniqueCode("PL");
      this.placeIdUnique = await ensureUniqueField(Place, "placeIdUnique", rawId);
    }
    if ( this.isModified("placeName") || this.isModified("cityId")) {
      const City = mongoose.model("City");
      const city = await City.findById(this.cityId);
      const cityName = city ? city.cityName : "unknown";

    }
    if (this.isModified("placeName") || this.isModified("slug") || !this.slug) {
      const rawSlug = this.slug ? generateSlug(this.slug) : generateSlug(this.placeName);
      const Place = this.constructor;
      this.slug = await ensureUniqueSlug(Place, rawSlug, this._id);
    }
    next();
  } catch (error) {
    next(error);
  }
});

placeSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) {
      return next();
    }

    // const payload = update.$set ? update.$set : update;

    const payload = { ...update };
    delete payload.$set;
    delete payload.$setOnInsert;


     
    if (payload.placeName || payload.slug) {
      const Place = mongoose.model("Place");
      const rawSlug = payload.slug
        ? generateSlug(payload.slug)
        : generateSlug(payload.placeName);
      const uniqueSlug = await ensureUniqueSlug(Place, rawSlug, this.getQuery()._id);

      if (update.$set) {
        update.$set.slug = uniqueSlug;
      } else {
        update.slug = uniqueSlug;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});
placeSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'placeId'
});
placeSchema.virtual('wishlist', {
  ref: 'Wishlist',
  localField: '_id',
  foreignField: 'placeId',
});
placeSchema.virtual('package', {
  ref: 'Package',
  localField: '_id',
  foreignField: 'itinerary.placeIds',
});


placeSchema.set('toObject', { virtuals: true });
placeSchema.set('toJSON', { virtuals: true });


const placeModel = mongoose.model("Place", placeSchema);

module.exports = {
  placeModel,
  accessibilityOptions,
  crowdLevels,
};
