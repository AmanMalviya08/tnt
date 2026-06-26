const { bookingModel } = require("../models/bookingModel");
const { savedTravellerModel } = require("../models/savedTravellerModel");

function normalizeKey(traveller = {}) {
  const name = String(traveller.name || "").trim().toLowerCase();
  const idNum = String(traveller.idProofNumber || "").trim().toLowerCase();
  if (name && idNum) return `${name}|${idNum}`;
  const age = traveller.age != null ? String(traveller.age) : "";
  const gender = String(traveller.gender || "").trim().toLowerCase();
  return `${name}|${age}|${gender}`;
}

function mapTravelerFromBooking(traveler, booking) {
  const doc = traveler.documents?.[0];
  return {
    name: traveler.name || "",
    age: traveler.age,
    gender: traveler.gender || "",
    relationship: traveler.relationship || "Family/Friend",
    idProofType: traveler.idProofType || "",
    idProofNumber: traveler.idProofNumber || "",
    specialNotes: traveler.specialNotes || "",
    seatNumber: traveler.seatNumber || "",
    idImageUrl: doc?.url || "",
    lastBookingId: booking.bookingId || String(booking._id),
    lastTripTitle:
      booking.selectedTourId?.tourName
      || booking.selectedPackageId?.packageName
      || booking.bookingType
      || "Trip",
    lastUsedAt: booking.createdAt || booking.travelStartDate,
  };
}

function isSameTraveller(a, b) {
  return normalizeKey(a) === normalizeKey(b);
}

async function getTravellersFromBookings(userId) {
  const bookings = await bookingModel
    .find({ userId, isDisabled: { $ne: true } })
    .select("bookingId bookingType travelerDetails createdAt travelStartDate selectedTourId selectedPackageId")
    .populate("selectedTourId", "tourName")
    .populate("selectedPackageId", "packageName")
    .sort({ createdAt: -1 })
    .lean();

  const map = new Map();

  for (const booking of bookings) {
    const travelers = Array.isArray(booking.travelerDetails) ? booking.travelerDetails : [];
    for (const traveler of travelers) {
      if (!traveler?.name?.trim()) continue;

      const mapped = mapTravelerFromBooking(traveler, booking);
      const key = normalizeKey(mapped);
      const existing = map.get(key);

      if (existing) {
        existing.bookingCount += 1;
        if (new Date(mapped.lastUsedAt) > new Date(existing.lastUsedAt || 0)) {
          Object.assign(existing, mapped, { bookingCount: existing.bookingCount });
        }
      } else {
        map.set(key, { ...mapped, bookingCount: 1, source: "booking" });
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0)
  );
}

async function getCombinedTravellers(userId) {
  const [saved, fromBookings] = await Promise.all([
    savedTravellerModel.find({ userId }).sort({ isDefault: -1, createdAt: -1 }).lean(),
    getTravellersFromBookings(userId),
  ]);

  const savedKeys = new Set(saved.map((t) => normalizeKey(t)));

  const suggestions = fromBookings.map((t) => ({
    ...t,
    isAlreadySaved: savedKeys.has(normalizeKey(t)),
  }));

  return { saved, fromBookings: suggestions };
}

async function saveFromBookingPayload(userId, payload) {
  const { name, age, gender, relationship, idProofType, idProofNumber, idImageUrl, specialNotes, isDefault } =
    payload || {};

  if (!name?.trim()) {
    const err = new Error("name is required");
    err.statusCode = 400;
    throw err;
  }

  const existing = await savedTravellerModel.findOne({
    userId,
    name: name.trim(),
    ...(idProofNumber ? { idProofNumber } : {}),
  });

  if (existing) {
    if (isDefault) {
      await savedTravellerModel.updateMany({ userId }, { $set: { isDefault: false } });
    }
    Object.assign(existing, {
      age,
      gender,
      relationship,
      idProofType,
      idProofNumber,
      idImageUrl,
      specialNotes,
      isDefault: Boolean(isDefault),
    });
    await existing.save();
    return { traveller: existing.toObject(), created: false };
  }

  if (isDefault) {
    await savedTravellerModel.updateMany({ userId }, { $set: { isDefault: false } });
  }

  const traveller = await savedTravellerModel.create({
    userId,
    name: name.trim(),
    age,
    gender,
    relationship,
    idProofType,
    idProofNumber,
    idImageUrl,
    specialNotes,
    isDefault: Boolean(isDefault),
  });

  return { traveller: traveller.toObject(), created: true };
}

module.exports = {
  normalizeKey,
  isSameTraveller,
  getTravellersFromBookings,
  getCombinedTravellers,
  saveFromBookingPayload,
};
