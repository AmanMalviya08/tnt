const mongoose = require("mongoose");

const agentStatuses = ["Active", "On Leave", "Inactive"];
const availabilityStatuses = ["Available", "Busy", "Offline"];

const documentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const agentSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
      trim: true,
    },
    experienceYears: {
      type: Number,
      min: 0,
      default: 0,
    },
    specialties: {
      type: [String],
      default: [],
    },
    preferredLanguages: {
      type: [String],
      default: [],
    },
    certifications: {
      type: [String],
      default: [],
    },
    bio: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: agentStatuses,
      default: "Active",
    },
    availabilityStatus: {
      type: String,
      enum: availabilityStatuses,
      default: "Available",
    },
    rating: {
      average: {
        type: Number,
        min: 0,
        max: 5,
        default: 0,
      },
      totalReviews: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
    totalBookingsHandled: {
      type: Number,
      min: 0,
      default: 0,
    },
    assignedBookingIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
      },
    ],
    assignedTourIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tour",
      },
    ],
    documents: {
      type: [documentSchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected'],
      default: 'Pending'
    },
    wallet: {
      type: Number,
      default: 0
    },
    bankDetails: {
      accountNumber: String,
      bankName: String,
      ifscCode: String,
      accountHolderName: String
    },
    upiId: {
      type: String,
      trim: true
    },
    agentAmount: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isPaid: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

agentSchema.virtual("fullName").get(function () {
  return [this.firstName, this.lastName].filter(Boolean).join(" ");
});

agentSchema.set("toJSON", { virtuals: true });
agentSchema.set("toObject", { virtuals: true });

const agentModel = mongoose.model("Agent", agentSchema);

module.exports = {
  agentModel,
  agentStatuses,
  availabilityStatuses,
};
