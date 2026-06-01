const mongoose =require('mongoose')
const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    discountType: { type: String, enum: ["percentage", "flat"]},
    discountValue: { type: Number, required: true },
    applicableTour: { type: mongoose.Schema.Types.ObjectId, ref: "Package"},
    couponCode: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isDisabled: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const offerModel= mongoose.model("Offer", offerSchema);

module.exports=offerModel
