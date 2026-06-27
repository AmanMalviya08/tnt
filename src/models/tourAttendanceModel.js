const mongoose = require("mongoose");

const passengerAttendanceSchema = new mongoose.Schema(
  {
    passengerId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    present: { type: Boolean, default: false },
    checkedAt: { type: Date },
  },
  { _id: false }
);

const tourAttendanceSchema = new mongoose.Schema(
  {
    tourId: { type: mongoose.Schema.Types.ObjectId, ref: "Tour", required: true },
    allocationId: { type: mongoose.Schema.Types.ObjectId, ref: "GuideAllocation", required: true },
    guideId: { type: mongoose.Schema.Types.ObjectId, ref: "Guide", required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    passengers: { type: [passengerAttendanceSchema], default: [] },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

tourAttendanceSchema.index({ allocationId: 1 }, { unique: true });

module.exports = mongoose.model("TourAttendance", tourAttendanceSchema);
