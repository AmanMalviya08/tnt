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
    },
    agentType: {
      type: String,
      enum: ["company", "external"],
      default: "company",
    },
    referralCode: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

agentSchema.pre("save", async function generateReferralCode(next) {
  if (this.referralCode) return next();
  const base = [this.firstName, this.lastName].filter(Boolean).join("") || "AGENT";
  const suffix = (this.userId || this._id || Date.now()).toString().slice(-6).toUpperCase();
  let candidate = `${base.slice(0, 4).toUpperCase()}${suffix}`.replace(/[^A-Z0-9]/g, "");
  if (candidate.length < 6) candidate = `AG${suffix}`;
  let attempt = 0;
  while (attempt < 5) {
    const exists = await agentModel.findOne({ referralCode: candidate, _id: { $ne: this._id } });
    if (!exists) {
      this.referralCode = candidate;
      return next();
    }
    candidate = `${candidate.slice(0, 6)}${attempt + 1}`;
    attempt += 1;
  }
  this.referralCode = `AG${Date.now().toString(36).toUpperCase()}`;
  next();
});

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
