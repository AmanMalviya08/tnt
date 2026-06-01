const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userRoles = ["Admin", "SubAdmin", "Agent", "Traveler", "Guest", "Distributor"];
const userStatuses = ["Active", "Inactive", "Pending"];
const userPermissions = [
  "dashboard",
  "userManagement",
  "distrbutorManagement",
  "distributorMoneyRequest",
  "withdrawManagement",
  "agentManagement",
  "subAdminManagement",
  "bookingManagement",
  "tourGuideManagement",
  "packageManagement",
  "cityManagement",
  "placeManagement",
  "groupTourCreation",
  "gallery",
  "guideAllocationAndTransfer",
  "leadManagement",
  "bannerManagement",
  "companyManagement",
  "contactUsManagement",
  "aboutUsPage",
  "subadmin",
  "distributor",
  "distributorDashboard",
  "agentBannerManagement",
  "faqManagement",
  "agentRequest"
];

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: userRoles,
      default: "Traveler",
    },
    status: {
      type: String,
      enum: userStatuses,
      default: "Pending",
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
    },
    lastLogin: {
      type: Date,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    phoneOtp: {
      codeHash: {
        type: String,
        select: false,
      },
      expiresAt: {
        type: Date,
      },
      attempts: {
        type: Number,
        default: 0,
      },
      lastSentAt: {
        type: Date,
      },
    },
    resetToken: {
      token: String,
      expiresAt: Date,
    },
    preferences: {
      preferredTransport: [String],
      preferredDestinations: [String],
      language: {
        type: String,
        trim: true,
      },
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
    address: {
      country: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true }
    },
    permissions: [{
      type: String,
      trim: true,
      enum: userPermissions
    }],
    distributorCommission: {
      type: Number,
      default: 0
    },
    paidAgentCommission: {
      type: Number,
      default: 0
    },
    paidAgentFee: {
      type: Number,
      default: 0
    },
    agentAmount: {
      type: Number,
      default: 0
    },
    wallet: {
      type: Number,
      default: 0
    },
    credit_money: {
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
   

  },
  { timestamps: true }
);
userSchema.virtual('agents', {
  ref: 'Agent',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
})
userSchema.virtual("fullName").get(function () {
  return [this.firstName, this.lastName].filter(Boolean).join(" ");
});

userSchema.virtual('wishlist', {
  ref: 'Wishlist',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});


userSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.resetToken;
    if (ret.phoneOtp) {
      delete ret.phoneOtp.codeHash;
    }
    return ret;
  },
});

userSchema.set("toObject", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.resetToken;
    if (ret.phoneOtp) {
      delete ret.phoneOtp.codeHash;
    }
    return ret;
  },
});

userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) {
      return next();
    }
    console.log("inside here", this.password)

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) {
      return next();
    }

    const payload = update;
    console.log("payload", payload)
    if (payload.password && payload.password.trim() !== '') {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      const hashed = await bcrypt.hash(payload.password, salt);
      console.log("inside the payload password", payload)

      if (update.$set?.password) {
        update.$set.password = hashed;
      } else {
        update.password = hashed;
      }

      this.setUpdate(update);
    } else if (payload.password === '') {
      if (update.$set) delete update.$set.password;
      else delete update.password;
      this.setUpdate(update);
    }
    console.log("inside find one ", update)

    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

const userModel = mongoose.model("User", userSchema);

module.exports = {
  userModel,
  userRoles,
  userStatuses,
  userPermissions,
};
