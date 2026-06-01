const mongoose = require("mongoose");

const leadSources = [
  "Website",
  "Social Media",
  "Referral",
  "Travel Fair",
  "Walk-in",
  "Email Campaign",
  "Phone",
  "Other",
];

const leadStatuses = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Follow Up",
  "Won",
  "Lost",
  "Cancelled",
];

const interestedServices = [
  "Tour Package",
  "Group Tour",
  "Custom Itinerary",
  "Flight Booking",
  "Hotel Booking",
  "Visa Assistance",
  "Travel Insurance",
];

const communicationSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
    },
    communicatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    communicatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    leadId: {
      type: String,
      trim: true,
      unique: true,
    },
    firstName: {
      type: String,
      trim: true,
      required: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
      required: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: leadSources,
      default: "Other",
    },
    status: {
      type: String,
      enum: leadStatuses,
      default: "New",
    },
    interestedService: {
      type: String,
      enum: interestedServices,
    },
    interestedCities: {
      type: [String],
      default: [],
    },
    budgetRange: {
      min: {
        type: Number,
        min: 0,
      },
      max: {
        type: Number,
        min: 0,
      },
    },
    travelMonth: {
      type: String,
      trim: true,
    },
    travelYear: {
      type: Number,
      min: new Date().getFullYear(),
    },
    numberOfTravelers: {
      adults: {
        type: Number,
        min: 0,
        default: 1,
      },
      children: {
        type: Number,
        min: 0,
        default: 0,
      },
      infants: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    specialRequests: {
      type: String,
      trim: true,
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    followUpDate: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    lastContactedAt: {
      type: Date,
    },
    communications: {
      type: [communicationSchema],
      default: [],
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

function generateLeadId() {
  return `LEAD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

leadSchema.pre("save", async function (next) {
  try {
    if (!this.leadId) {
      const Lead = this.constructor;
      let candidate = generateLeadId();
      while (await Lead.exists({ leadId: candidate })) {
        candidate = generateLeadId();
      }
      this.leadId = candidate;
    }

    if (this.isModified("status") && this.status === "Follow Up" && !this.followUpDate) {
      this.followUpDate = new Date();
    }

    if (this.isModified("communications") && this.communications.length) {
      const latest = this.communications[this.communications.length - 1];
      this.lastContactedAt = latest.communicatedAt;
    }

    return next();
  } catch (error) {
    return next(error);
  }
});

leadSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) {
      return next();
    }

    const payload = update.$set ? update.$set : update;

    if (payload.status === "Follow Up" && !payload.followUpDate) {
      const newDate = new Date();
      if (update.$set) {
        update.$set.followUpDate = newDate;
      } else {
        update.followUpDate = newDate;
      }
    }

    if (payload.communications && payload.communications.length) {
      const latest = payload.communications[payload.communications.length - 1];
      const newDate = latest.communicatedAt || new Date();
      if (update.$set) {
        update.$set.lastContactedAt = newDate;
      } else {
        update.lastContactedAt = newDate;
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
});

const leadModel = mongoose.model("Lead", leadSchema);

module.exports = {
  leadModel,
  leadSources,
  leadStatuses,
  interestedServices,
};
