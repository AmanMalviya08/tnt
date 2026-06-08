const mongoose = require("mongoose");

const complaintStatuses = ["Pending", "In Review", "Resolved", "Rejected"];
const complaintPartyTypes = ["User", "Guide"];

const mediaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
    },
    type: {
      type: String,
      enum: ["image", "video"],
    },
    originalName: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      unique: true,
    },
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    complainantType: {
      type: String,
      enum: complaintPartyTypes,
    },
    complainantId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "complainantType",
    },
    againstType: {
      type: String,
      enum: complaintPartyTypes,
    },
    againstId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "againstType",
    },
    media: {
      type: [mediaSchema],
      default: [],
    },
    status: {
      type: String,
      enum: complaintStatuses,
      default: "Pending",
    },
    adminNotes: {
      type: String,
      trim: true,
    },
    resolvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);



// Auto-generate complaintId before saving
complaintSchema.pre("save", function (next) {
  if (!this.complaintId) {
    this.complaintId = `CMP-${Date.now()}`;
  }
  next();
});

const complaintModel = mongoose.model("Complaint", complaintSchema);

module.exports = {
  complaintModel,
  complaintStatuses,
  complaintPartyTypes,
};
