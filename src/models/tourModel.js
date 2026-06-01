const mongoose = require("mongoose");
const { generateSlug, ensureUniqueSlug } = require("../utils/slugHelper");

const transportTypes = [
  "Bus",
  "Train",
  "Flight",
  "Cruise",
  "Private",
  "Tempo Traveller",
  "Car",
  "Boat",
  "Mixed",
];
const tourStatuses = ["Draft", "Upcoming", "Ongoing", "Completed", "Cancelled"];

const tourSchema = new mongoose.Schema(
  {
    tourCode: {
      type: String,
      unique: true,
      trim: true,
    },
    tourName: {
      type: String,
      required: true,
      trim: true,
    },
    tourCategory: {
      type: String,
      trim: true,
    },
    cityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
      required: true,
    },
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
    },
    tourPlaces: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Place",
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    durationInDays: {
      type: Number,
      min: 1,
    },
    transportType: {
      type: String,
      enum: transportTypes,
    },
    guideName: {
      type: String,
      trim: true,
    },
    guideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guide",
    },
    totalSeats: {
      type: Number,
      min: 1,
    },
    totalLowerSeats: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalUpperSeats: {
      type: Number,
      min: 0,
      default: 0,
    },
    bookedSeats: {
      type: Number,
      default: 0,
      min: 0,
    },
    seatsPerRow: {
      type: Number,
      min: 1,
    },
    lowerSeatsPerRow: {
      type: Number,
      min: 1,
    },
    upperSeatsPerRow: {
      type: Number,
      min: 1,
    },
    seats: [
      {
        number: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ["available", "booked", "blocked"],
          default: "available",
        },
      },
    ],
    lowerSeats: [
      {
        number: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ["available", "booked", "blocked"],
          default: "available",
        },
      },
    ],
    upperSeats: [
      {
        number: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ["available", "booked", "blocked"],
          default: "available",
        },
      },
    ],
    remainingSeats: {
      type: Number,
      min: 0,
    },
    perPersonCost: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: tourStatuses,
      default: "Draft",
    },
    inclusions: {
      type: [String],
      default: [],
    },
    exclusions: {
      type: [String],
      default: [],
    },
    meetingPoint: {
      type: [String],
      trim: true,
      default: [],
    },
    pickupTime: {
      type: String,
      trim: true,
    },
    dropPoint: {
      type: String,
      trim: true,
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
    videoLink: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
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
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
    ratings: {
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },
    bookedSeatNumbers: [{
      type: String,
    }]
  },
  { timestamps: true },
);

tourSchema.virtual("GuideAllocation", {
  ref: "GuideAllocation",
  localField: "_id",
  foreignField: "tourId",
});
tourSchema.set("toObject", { virtuals: true });
tourSchema.set("toJSON", { virtuals: true });

async function ensureUniqueValue(model, field, value, excludeId) {
  if (!value) {
    return value;
  }

  let uniqueValue = value;
  let counter = 1;
  const baseValue = value;

  const query = { [field]: uniqueValue };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  // eslint-disable-next-line no-constant-condition
  while (await model.exists(query)) {
    uniqueValue = `${baseValue}-${counter++}`;
    query[field] = uniqueValue;
  }

  return uniqueValue;
}

function autoDuration(doc) {
  if (!doc.startDate || !doc.endDate) {
    return;
  }

  const start = new Date(doc.startDate);
  const end = new Date(doc.endDate);

  if (end < start) {
    throw new Error("End date cannot be before start date");
  }

  const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  doc.durationInDays = diff;
}

function autoRemainingSeats(doc) {
  if (
    typeof doc.totalSeats === "number" &&
    typeof doc.bookedSeats === "number"
  ) {
    doc.remainingSeats = Math.max(doc.totalSeats - doc.bookedSeats, 0);
  }
}

function syncBookedSeats(doc) {
  // Count booked seats from both lower and upper deck arrays
  let bookedCount = 0;

  if (doc.lowerSeats && Array.isArray(doc.lowerSeats)) {
    bookedCount += doc.lowerSeats.filter(
      (s) => s.status === "booked" || s.status === "blocked",
    ).length;
  }

  if (doc.upperSeats && Array.isArray(doc.upperSeats)) {
    bookedCount += doc.upperSeats.filter(
      (s) => s.status === "booked" || s.status === "blocked",
    ).length;
  }

  // Fallback to legacy seats array if no deck-specific arrays
  if (bookedCount === 0 && doc.seats && Array.isArray(doc.seats)) {
    bookedCount = doc.seats.filter(
      (s) => s.status === "booked" || s.status === "blocked",
    ).length;
  }

  doc.bookedSeats = bookedCount;
  autoRemainingSeats(doc);
}

function ensureStatus(doc) {
  const now = new Date();
  if (["Draft", "Cancelled"].includes(doc.status)) {
    return;
  }

  if (doc.startDate && doc.endDate) {
    if (now < doc.startDate) {
      doc.status = "Upcoming";
    } else if (now >= doc.startDate && now <= doc.endDate) {
      doc.status = "Ongoing";
    } else if (now > doc.endDate) {
      doc.status = "Completed";
      doc.isDisabled = true;
    }
  }
}

async function populateSlugAndCode(doc) {
  const Tour = doc.constructor;

  if (!doc.slug || doc.isModified("slug") || doc.isModified("tourName")) {
    const rawSlug = doc.slug
      ? generateSlug(doc.slug)
      : generateSlug(doc.tourName);
    doc.slug = await ensureUniqueSlug(Tour, rawSlug, doc._id);
  }

  if (!doc.tourCode) {
    const baseCode = doc.tourName
      ? doc.tourName.slice(0, 3).toUpperCase()
      : "TOUR";
    const initialCode = `${baseCode}-${Date.now().toString().slice(-6)}`;
    doc.tourCode = await ensureUniqueValue(
      Tour,
      "tourCode",
      initialCode,
      doc._id,
    );
  }
}

function handlePreSave(next) {
  syncBookedSeats(this);
  autoDuration(this);

  // Calculate totalUpperSeats from totalSeats - totalLowerSeats
  if (this.totalSeats && this.totalLowerSeats !== undefined) {
    this.totalUpperSeats = Math.max(this.totalSeats - this.totalLowerSeats, 0);
  }

  // Initialize lower seats if totalLowerSeats is defined
  if (this.totalLowerSeats && (!this.lowerSeats || this.lowerSeats.length === 0)) {
    this.lowerSeats = Array.from({ length: this.totalLowerSeats }, (_, i) => ({
      number: `${i + 1}-L`,
      status: "available",
    }));
  }

  // Initialize upper seats if totalUpperSeats is defined
  if (this.totalUpperSeats && (!this.upperSeats || this.upperSeats.length === 0)) {
    this.upperSeats = Array.from({ length: this.totalUpperSeats }, (_, i) => ({
      number: `${i + 1}-U`,
      status: "available",
    }));
  }

  // Legacy: Initialize seats if they don't exist and totalSeats is defined (backward compatibility)
  if (this.totalSeats && (!this.seats || this.seats.length === 0) && !this.totalLowerSeats) {
    this.seats = Array.from({ length: this.totalSeats }, (_, i) => ({
      number: String(i + 1),
      status: "available",
    }));
  }

  ensureStatus(this);
  populateSlugAndCode(this)
    .then(() => next())
    .catch((error) => next(error));
}

tourSchema.pre("save", handlePreSave);

tourSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) {
      return next();
    }

    // Merge top-level fields and $set fields to see all updates
    const payload = { ...update, ...(update.$set || {}) };

    autoDuration(payload);
    ensureStatus(payload);

    // Sync booked seats from both deck arrays
    if (payload.lowerSeats || payload.upperSeats || payload.seats) {
      syncBookedSeats(payload);
    } else if (
      typeof payload.totalSeats === "number" ||
      typeof payload.bookedSeats === "number"
    ) {
      const existing = await this.model.findOne(this.getQuery());
      const totalSeats =
        typeof payload.totalSeats === "number"
          ? payload.totalSeats
          : existing.totalSeats;
      const bookedSeats =
        typeof payload.bookedSeats === "number"
          ? payload.bookedSeats
          : existing.bookedSeats;

      if (bookedSeats > totalSeats) {
        throw new Error("Booked seats cannot exceed total seats");
      }
      payload.remainingSeats = Math.max(totalSeats - bookedSeats, 0);
    }

    // Calculate totalUpperSeats when totalSeats or totalLowerSeats changes
    if (payload.totalSeats !== undefined || payload.totalLowerSeats !== undefined) {
      const existing = await this.model.findOne(this.getQuery());
      const totalSeats = payload.totalSeats ?? existing.totalSeats;
      const totalLowerSeats = payload.totalLowerSeats ?? existing.totalLowerSeats ?? 0;
      const totalUpperSeats = Math.max(totalSeats - totalLowerSeats, 0);

      if (update.$set) {
        update.$set.totalUpperSeats = totalUpperSeats;
      } else {
        update.totalUpperSeats = totalUpperSeats;
      }
    }

    // Handle lower seats resizing
    if (payload.totalLowerSeats !== undefined) {
      const existing = await this.model.findOne(this.getQuery());
      const newLowerTotal = payload.totalLowerSeats;
      const currentLowerSeats = existing.lowerSeats || [];

      if (newLowerTotal > currentLowerSeats.length) {
        // Add new lower seats
        const seatsToAdd = Array.from(
          { length: newLowerTotal - currentLowerSeats.length },
          (_, i) => ({
            number: `${currentLowerSeats.length + i + 1}-L`,
            status: "available",
          }),
        );
        const newSeats = [...currentLowerSeats, ...seatsToAdd];
        if (update.$set) {
          update.$set.lowerSeats = newSeats;
        } else {
          update.lowerSeats = newSeats;
        }
      } else if (newLowerTotal < currentLowerSeats.length) {
        const newSeats = currentLowerSeats.slice(0, newLowerTotal);
        if (update.$set) {
          update.$set.lowerSeats = newSeats;
        } else {
          update.lowerSeats = newSeats;
        }
      }
    }

    // Handle upper seats resizing
    const existing = await this.model.findOne(this.getQuery());
    const totalSeats = payload.totalSeats ?? existing.totalSeats;
    const totalLowerSeats = payload.totalLowerSeats ?? existing.totalLowerSeats ?? 0;
    const newUpperTotal = Math.max(totalSeats - totalLowerSeats, 0);

    if (payload.totalSeats !== undefined || payload.totalLowerSeats !== undefined) {
      const currentUpperSeats = existing.upperSeats || [];

      if (newUpperTotal > currentUpperSeats.length) {
        // Add new upper seats
        const seatsToAdd = Array.from(
          { length: newUpperTotal - currentUpperSeats.length },
          (_, i) => ({
            number: `${currentUpperSeats.length + i + 1}-U`,
            status: "available",
          }),
        );
        const newSeats = [...currentUpperSeats, ...seatsToAdd];
        if (update.$set) {
          update.$set.upperSeats = newSeats;
        } else {
          update.upperSeats = newSeats;
        }
      } else if (newUpperTotal < currentUpperSeats.length) {
        const newSeats = currentUpperSeats.slice(0, newUpperTotal);
        if (update.$set) {
          update.$set.upperSeats = newSeats;
        } else {
          update.upperSeats = newSeats;
        }
      }
    }

    // Legacy: Handle old seats array resizing (backward compatibility)
    if (payload.totalSeats !== undefined && !payload.totalLowerSeats && !existing.totalLowerSeats) {
      const newTotal = payload.totalSeats;
      const currentSeats = existing.seats || [];

      if (newTotal > currentSeats.length) {
        const seatsToAdd = Array.from(
          { length: newTotal - currentSeats.length },
          (_, i) => ({
            number: String(currentSeats.length + i + 1),
            status: "available",
          }),
        );
        const newSeats = [...currentSeats, ...seatsToAdd];
        if (update.$set) {
          update.$set.seats = newSeats;
        } else {
          update.seats = newSeats;
        }
      } else if (newTotal < currentSeats.length) {
        const newSeats = currentSeats.slice(0, newTotal);
        if (update.$set) {
          update.$set.seats = newSeats;
        } else {
          update.seats = newSeats;
        }
      }
    }

    if (payload.tourName || payload.slug) {
      const Tour = mongoose.model("Tour");
      const rawSlug = payload.slug
        ? generateSlug(payload.slug)
        : generateSlug(payload.tourName);
      payload.slug = await ensureUniqueValue(
        Tour,
        "slug",
        rawSlug,
        this.getQuery()._id,
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

const tourModel = mongoose.model("Tour", tourSchema);

module.exports = {
  tourModel,
  transportTypes,
  tourStatuses,
};
