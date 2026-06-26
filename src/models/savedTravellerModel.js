const mongoose = require("mongoose");

const savedTravellerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    age: { type: Number, min: 0 },
    gender: { type: String, trim: true },
    relationship: { type: String, trim: true, default: "Family/Friend" },
    idProofType: { type: String, trim: true },
    idProofNumber: { type: String, trim: true },
    idImageUrl: { type: String, trim: true },
    specialNotes: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

savedTravellerSchema.index({ userId: 1, createdAt: -1 });

module.exports = {
  savedTravellerModel: mongoose.model("SavedTraveller", savedTravellerSchema),
};
