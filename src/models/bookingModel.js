const mongoose = require("mongoose");

const bookingTypes = ["Package Tour", "Group Tour", "Custom Tour"];
const userTypes = ["App User", "CRM Agent", "Walk-in"];
const paymentStatuses = ["Pending", "Partial", "Paid", "Failed", "Refunded"];
const paymentMethods = [
  "Online",
  "Cash",
  "Bank Transfer",
  "upi",
  "UPI",
  "Card",
  "Wallet",
];
const bookingStatuses = ["Pending", "Confirmed", "Cancelled", "Completed"];

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
  { _id: false },
);

const travelerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    age: {
      type: Number,
      min: 0,
    },
    gender: {
      type: String,
      trim: true,
    },
    idProofType: {
      type: String,
      trim: true,
    },
    idProofNumber: {
      type: String,
      trim: true,
    },
    specialNotes: {
      type: String,
      trim: true,
    },
    relationship: {
      type: String,
      trim: true,
    },
    seatNumber: {
      type: String,
      trim: true,
    },
    documents: {
      type: [documentSchema],
      default: [],
    },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      trim: true,
      unique: true,
    },
    customerName: {
      type: String,
      trim: true,
      required: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    nationality: {
      type: String,
      trim: true,
    },
    orderId: {
      type: String,
      index: true,
      sparse: true,
    },
    selectedAddOns: [
      {
        addOnName: {
          type: String,
          trim: true,
        },
        price: {
          type: Number,
          min: 0,
        },
      },
    ],
    addOnsTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    selectedSeats: {
      type: [String],
      default: [],
    },
    userType: {
      type: String,
      enum: userTypes,
      default: "App User",
    },
    bookingType: {
      type: String,
      enum: bookingTypes,
      required: true,
    },
    selectedPackageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
    },
    selectedTourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tour",
    },
    cityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
    },
    numberOfTravelers: {
      type: Number,
      min: 1,
    },
    //new h
    adults: {
      type: Number,
      min: 1,
      default: 1,
    },
    //new h
    children: {
      type: Number,
      min: 0,
      default: 0,
    },

    travelerDetails: {
      type: [travelerSchema],
      default: [],
    },
    specialRequests: {
      type: String,
      trim: true,
    },
    travelStartDate: {
      type: Date,
    },
    travelEndDate: {
      type: Date,
    },
    durationInDays: {
      type: Number,
      min: 0,
    },
    packageCostPerPerson: {
      type: Number,
      min: 0,
    },
    childCostPerPerson: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      min: 0,
    },
    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    finalAmount: {
      type: Number,
      min: 0,
    },
    gstNumber: {
      type: String,
      trim: true,
    },
    taxPercent: {
      type: Number,
      min: 0,
      default: 0,
    },
    taxAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    //new h
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    paymentStatus: {
      type: String,
      enum: paymentStatuses,
      default: "Pending",
    },
    paymentMethod: {
      type: String,
      enum: paymentMethods,
    },
    transactionId: {
      type: String,
      trim: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
      unique: true,
    },
    invoiceUrl: {
      type: String,
      trim: true,
    },
    bookingStatus: {
      type: String,
      enum: bookingStatuses,
      default: "Pending",
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: {
      type: String,
      trim: true,
    },
    documents: {
      type: [documentSchema],
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
  { timestamps: true },
);

function generateUniqueCode(prefix = "BK") {
  const unique = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .substring(2, 8)}`.toUpperCase();
  return `${prefix}-${unique}`;
}

async function ensureUniqueField(model, field, value, attempt = 0) {
  const candidate = attempt === 0 ? value : `${value}-${attempt}`;
  const exists = await model.exists({ [field]: candidate });
  if (exists) {
    return ensureUniqueField(model, field, value, attempt + 1);
  }
  return candidate;
}

function computeDuration(startDate, endDate) {
  if (!(startDate && endDate)) {
    return undefined;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return undefined;
  }
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function computeAmounts(doc) {
  const adults = doc.adults || 0;
  const children = doc.children || 0;
  const costPerPerson = doc.packageCostPerPerson || 0;
  const childCost =
    doc.childCostPerPerson !== undefined
      ? doc.childCostPerPerson
      : costPerPerson;
  //new h
  const addOnsTotal = doc.addOnsTotal || 0;

  const total = adults * costPerPerson + children * childCost + addOnsTotal;

  const discount = doc.discountAmount || 0;
  const subtotal = total ? Math.max(total - discount, 0) : doc.finalAmount;

  doc.totalAmount = total || 0;

  // Calculate GST on the subtotal (pre-tax amount)
  const taxPercent = doc.taxPercent || 0;
  const taxAmount = subtotal ? Math.round((subtotal * taxPercent) / 100 * 100) / 100 : 0;
  doc.taxAmount = taxAmount;

  // finalAmount includes GST
  doc.finalAmount = subtotal !== undefined ? subtotal + taxAmount : doc.totalAmount;
}

bookingSchema.pre("save", async function (next) {
  try {
    if (!this.bookingId) {
      const Booking = this.constructor;
      const rawId = generateUniqueCode("BK");
      this.bookingId = await ensureUniqueField(Booking, "bookingId", rawId);
    }

    if (!this.invoiceNumber) {
      const Booking = this.constructor;
      const rawInvoice = generateUniqueCode("INV");
      this.invoiceNumber = await ensureUniqueField(
        Booking,
        "invoiceNumber",
        rawInvoice,
      );
    }

    const duration = computeDuration(this.travelStartDate, this.travelEndDate);
    if (duration !== undefined) {
      this.durationInDays = duration;
    }

    computeAmounts(this);

    return next();
  } catch (error) {
    return next(error);
  }
});

bookingSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();
    if (!update) {
      return next();
    }

    const payload = update.$set ? update.$set : update;

    if (payload.travelStartDate || payload.travelEndDate) {
      const existing = await this.model.findOne(this.getQuery());
      const startDate = payload.travelStartDate || existing.travelStartDate;
      const endDate = payload.travelEndDate || existing.travelEndDate;
      const duration = computeDuration(startDate, endDate);
      if (duration !== undefined) {
        if (update.$set) {
          update.$set.durationInDays = duration;
        } else {
          update.durationInDays = duration;
        }
      }
    }

    if (
      payload.packageCostPerPerson !== undefined ||
      payload.numberOfTravelers !== undefined ||
      payload.totalAmount !== undefined ||
      payload.discountAmount !== undefined ||
      payload.addOnsTotal !== undefined ||
      payload.taxPercent !== undefined
    ) {
      const existing = await this.model.findOne(this.getQuery());
      const tempDoc = {
        numberOfTravelers:
          payload.numberOfTravelers !== undefined
            ? payload.numberOfTravelers
            : existing.numberOfTravelers,
        packageCostPerPerson:
          payload.packageCostPerPerson !== undefined
            ? payload.packageCostPerPerson
            : existing.packageCostPerPerson,
        totalAmount:
          payload.totalAmount !== undefined
            ? payload.totalAmount
            : existing.totalAmount,
        discountAmount:
          payload.discountAmount !== undefined
            ? payload.discountAmount
            : existing.discountAmount,
        //new h
        addOnsTotal:
          payload.addOnsTotal !== undefined
            ? payload.addOnsTotal
            : existing.addOnsTotal,
        finalAmount:
          payload.finalAmount !== undefined
            ? payload.finalAmount
            : existing.finalAmount,
        taxPercent:
          payload.taxPercent !== undefined
            ? payload.taxPercent
            : existing.taxPercent,
      };
      computeAmounts(tempDoc);
      if (update.$set) {
        update.$set.totalAmount = tempDoc.totalAmount;
        update.$set.finalAmount = tempDoc.finalAmount;
        update.$set.taxAmount = tempDoc.taxAmount;
      } else {
        update.totalAmount = tempDoc.totalAmount;
        update.finalAmount = tempDoc.finalAmount;
        update.taxAmount = tempDoc.taxAmount;
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
});

const bookingModel = mongoose.model("Booking", bookingSchema);

module.exports = {
  bookingModel,
  bookingTypes,
  bookingStatuses,
  paymentStatuses,
  paymentMethods,
  userTypes,
};
