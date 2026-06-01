const mongoose = require("mongoose");
const { generateSlug, ensureUniqueSlug } = require("../utils/slugHelper");
const generateCityId = async (cityName, stateName, City, currentDocId) => {
  // const baseCityId = `${cityName.toLowerCase().replace(/\s+/g, '-')}-${stateName.toLowerCase().replace(/\s+/g, '-')}`;

  let cityIdUnique = '1';
  // let counter = 1;
  let counter = 1;
  while (await City.findOne({
    cityIdUnique,
    _id: { $ne: currentDocId }
  }

  )) {
    cityIdUnique = `${counter}`;
    counter++;
  }

  return cityIdUnique;
};
const citySchema = new mongoose.Schema(
  {
    cityIdUnique: {
      type: String,
      trim: true,
      uppercase: true,
    },
    cityName: {
      type: String,
      trim: true,
      required: true,
    },
    stateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "State",
      required: true,
    },
    countryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contry",
      required: true,
    },
    cityCode: {
      type: String,
      trim: true,
    },
    shortDescription: {
      type: String,
      trim: true,
    },
    detailDescription: {
      type: String,
      trim: true,
    },
    bestTimeToVisit: {
      type: String,
      trim: true,
    },
    popularFor: {
      type: [String],
      default: [],
    },
    cityCoverImg: {
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
    videoLink: {
      type: String,
      trim: true,
    },
    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },
    pinCode: {
      type: String,
      trim: true,
    },
    nearestAirport: {
      type: String,
      trim: true,
    },
    nearestRailwayStation: {
      type: String,
      trim: true,
    },
    localTransportOptions: {
      type: [
        {
          type: String,
          enum: ["Auto", "Cab", "Bus", "Metro"],
          trim: true,
        },
      ],
      default: [],
    },
    emergencyContactNumbers: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
    },
    metaTitle: {
      type: String,
    },
    metaDescription: {
      type: String,
      trim: true,
    },
    metaKeywords: {
      type: [String],
      default: [],
    },
    travelGuide: {
      type: String,
      trim: true,
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);
citySchema.pre("save", async function (next) {
  try {
    if (!this.cityIdUnique || this.isModified("cityName") || this.isModified("stateId")) {
      const State = mongoose.model("State");
      const state = await State.findById(this.stateId);
      const stateName = state ? state.stateName : "unknown";

      const City = this.constructor;
      this.cityIdUnique = await generateCityId(this.cityName, stateName, City, this._id);
    }

    if (this.isModified("cityName") || this.isModified("slug") || !this.slug) {
      const rawSlug = this.slug ? generateSlug(this.slug) : generateSlug(this.cityName);
      const City = this.constructor;
      this.slug = await ensureUniqueSlug(City, rawSlug, this._id);
    }
    next();
  } catch (error) {
    next(error);
  }
});

citySchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) {
      return next();
    }

    // const payload = update.$set ? update.$set : update;
    const payload = { ...update };
    delete payload.$set;
    delete payload.$setOnInsert;



    if (payload.cityName || payload.slug) {
      const rawSlug = payload.slug
        ? generateSlug(payload.slug)
        : generateSlug(payload.cityName);
      const City = mongoose.model("City");
      const docId = this.getQuery()._id;
      const uniqueSlug = await ensureUniqueSlug(City, rawSlug, docId);

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
citySchema.virtual("bestTimeToVist")
  .get(function () {
    return this.bestTimeToVisit;
  })
  .set(function (value) {
    this.bestTimeToVisit = value;
  });

citySchema.virtual("gallaryImg")
  .get(function () {
    return this.galleryImages;
  })
  .set(function (value) {
    this.galleryImages = value;
  });

citySchema.virtual("localTransportOption")
  .get(function () {
    return this.localTransportOptions;
  })
  .set(function (value) {
    this.localTransportOptions = value;
  });

citySchema.virtual("emergencyContactNumber")
  .get(function () {
    return this.emergencyContactNumbers;
  })
  .set(function (value) {
    this.emergencyContactNumbers = value;
  });

citySchema.set("toJSON", { virtuals: true });
citySchema.set("toObject", { virtuals: true });

const cityModel = mongoose.model("City", citySchema);

module.exports = cityModel;
