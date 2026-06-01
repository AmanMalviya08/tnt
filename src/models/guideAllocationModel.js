const mongoose = require("mongoose");

const assignmentStatuses = ["Pending", "Active", "Completed", "Cancelled"];
const assignmentTypes = ["Tour", "Booking"];

const transferSchema = new mongoose.Schema(
  {
    fromGuideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guide",
      required: true,
    },
    toGuideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guide",
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    transferredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const guideAllocationSchema = new mongoose.Schema(
  {
    assignmentType: {
      type: String,
      enum: assignmentTypes,
    },
    tourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    guideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guide",
    },
    isPrimaryGuide: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: assignmentStatuses,
      default: "Pending",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    transferHistory: {
      type: [transferSchema],
      default: [],
    },
    lastTransferredAt: {
      type: Date,
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

function resolveAssignmentType(doc) {
  if (doc.tourId && !doc.bookingId) {
    return "Tour";
  }
  if (!doc.tourId && doc.bookingId) {
    return "Booking";
  }
  return doc.assignmentType || null;
}

function validateAssociation(doc) {
  if (!doc.tourId && !doc.bookingId) {
    throw new Error("Either tourId or bookingId must be provided for guide allocation.");
  }
  if (doc.tourId && doc.bookingId) {
    throw new Error("Provide only one of tourId or bookingId for guide allocation.");
  }
}

guideAllocationSchema.pre("save", function (next) {
  try {
    validateAssociation(this);
    this.assignmentType = resolveAssignmentType(this);
    if (!this.assignmentType) {
      throw new Error("Unable to determine assignment type. Provide tourId or bookingId.");
    }
    return next();
  } catch (error) {
    return next(error);
  }
});

guideAllocationSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) {
      return next();
    }

    const payload = update.$set ? update.$set : update;

    if (payload.tourId !== undefined || payload.bookingId !== undefined) {
      validateAssociation(payload);
      const assignmentType = resolveAssignmentType(payload);
      if (!assignmentType) {
        throw new Error("Unable to determine assignment type. Provide tourId or bookingId.");
      }
      if (update.$set) {
        update.$set.assignmentType = assignmentType;
      } else {
        update.assignmentType = assignmentType;
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
});

const guideAllocationModel = mongoose.model("GuideAllocation", guideAllocationSchema);

module.exports = {
  guideAllocationModel,
  assignmentStatuses,
  assignmentTypes,
};
