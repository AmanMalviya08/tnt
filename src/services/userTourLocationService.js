const mongoose = require("mongoose");
const { userTourLocationModel } = require("../models/userTourLocationModel");
const { bookingModel } = require("../models/bookingModel");
const { tourModel } = require("../models/tourModel");
const { emitGuideTrackingUpdate } = require("./socketService");

const TRACKABLE_BOOKING_STATUSES = ["Confirmed", "Pending"];
const ACTIVE_TOUR_STATUSES = ["Ongoing", "Upcoming"];

function parseCoordinates(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
    throw new Error("Invalid coordinates");
  }
  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    throw new Error("Coordinates out of range");
  }
  return { lat: latNum, lng: lngNum };
}

function normalizeLocation(location) {
  if (!location || typeof location !== "object") return null;
  const lat = location.lat ?? location.latitude;
  const lng = location.lng ?? location.longitude;
  if (lat == null || lng == null) return null;
  return {
    lat: Number(lat),
    lng: Number(lng),
    address: location.address || "",
  };
}

async function assertUserCanShareLocation(userId, tourId) {
  const tour = await tourModel.findById(tourId).select("status startDate endDate").lean();
  if (!tour) {
    throw new Error("Tour not found");
  }

  const booking = await bookingModel.findOne({
    userId,
    selectedTourId: tourId,
    bookingStatus: { $in: TRACKABLE_BOOKING_STATUSES },
    isDisabled: { $ne: true },
  });

  if (!booking) {
    throw new Error("No active booking found for this tour");
  }

  const now = new Date();
  const inTravelWindow =
    booking.travelStartDate &&
    booking.travelEndDate &&
    now >= new Date(booking.travelStartDate) &&
    now <= new Date(booking.travelEndDate);

  const tourActive = ACTIVE_TOUR_STATUSES.includes(tour.status) || inTravelWindow;

  if (!tourActive) {
    throw new Error("Location sharing is only available for active tours");
  }

  return booking;
}

async function updateUserTourLocation(userId, tourId, payload = {}) {
  const lat = payload.lat ?? payload.latitude;
  const lng = payload.lng ?? payload.longitude;
  const { address, bookingId } = payload;

  if (lat == null || lng == null) {
    throw new Error("lat and lng are required");
  }

  const coords = parseCoordinates(lat, lng);
  const booking = await assertUserCanShareLocation(userId, tourId);

  if (bookingId && String(bookingId) !== String(booking._id)) {
    throw new Error("Invalid bookingId for this tour");
  }

  const { resolveGuideIdForTour } = require("./guideUsersTrackingService");
  const guideId = await resolveGuideIdForTour(tourId);

  const locationDoc = await userTourLocationModel.findOneAndUpdate(
    { userId, tourId },
    {
      userId,
      tourId,
      bookingId: booking._id,
      guideId: guideId || null,
      location: {
        lat: coords.lat,
        lng: coords.lng,
        address: address || "",
      },
      lastUpdated: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const socketPayload = {
    type: "user-location-update",
    guideId,
    tourId: String(tourId),
    userId: String(userId),
    bookingId: String(booking._id),
    currentLocation: normalizeLocation(locationDoc.location),
    lastUpdated: locationDoc.lastUpdated,
  };

  if (guideId) {
    emitGuideTrackingUpdate(guideId, socketPayload);
  }

  return {
    tourId: String(tourId),
    userId: String(userId),
    bookingId: String(booking._id),
    guideId,
    location: normalizeLocation(locationDoc.location),
    lastUpdated: locationDoc.lastUpdated,
  };
}

async function getUserLocationsForTours(tourIds = []) {
  if (!tourIds.length) return new Map();

  const objectIds = tourIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (!objectIds.length) return new Map();

  const rows = await userTourLocationModel
    .find({ tourId: { $in: objectIds } })
    .select("userId tourId bookingId location lastUpdated")
    .lean();

  const map = new Map();
  for (const row of rows) {
    const userKey = String(row.userId);
    const tourKey = String(row.tourId);
    map.set(`${tourKey}:${userKey}`, {
      currentLocation: normalizeLocation(row.location),
      lastUpdated: row.lastUpdated || null,
      bookingId: row.bookingId ? String(row.bookingId) : null,
    });
  }
  return map;
}

module.exports = {
  updateUserTourLocation,
  getUserLocationsForTours,
  assertUserCanShareLocation,
};
