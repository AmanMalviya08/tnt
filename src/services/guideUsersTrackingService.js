// FEATURE: Guide Users Live Tracking | Added: 2026-06-29

const mongoose = require("mongoose");
const Guide = require("../models/guideModel");
const { guideAllocationModel } = require("../models/guideAllocationModel");
const { tourModel } = require("../models/tourModel");
const { bookingModel } = require("../models/bookingModel");
const { getUserLocationsForTours } = require("./userTourLocationService");

const ACTIVE_ALLOC_STATUSES = ["Pending", "Active", "Paused"];
const ACTIVE_TOUR_STATUSES = ["Ongoing", "Upcoming"];
const TRACKABLE_BOOKING_STATUSES = ["Confirmed", "Pending"];
const ACTIVE_RIDE_LOCATION_MS = 3 * 60 * 1000;

function isActiveRideLocation(lastUpdated) {
  if (!lastUpdated) return false;
  return Date.now() - new Date(lastUpdated).getTime() <= ACTIVE_RIDE_LOCATION_MS;
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

function formatLiveTracking(liveTracking) {
  if (!liveTracking) return null;
  return {
    currentLocation: normalizeLocation(liveTracking.currentLocation),
    eta: liveTracking.eta || null,
    routeProgress: liveTracking.routeProgress ?? 0,
    vehicleStatus: liveTracking.vehicleStatus || "unknown",
    lastUpdated: liveTracking.lastUpdated || null,
    route: (liveTracking.route || []).map(normalizeLocation).filter(Boolean),
  };
}

function formatBookingUser(booking, liveLocation = null) {
  const user = booking.userId && typeof booking.userId === "object" ? booking.userId : null;
  const locationUpdated = liveLocation?.lastUpdated || null;
  return {
    userId: user?._id || booking.userId || null,
    firstName: user?.firstName || null,
    lastName: user?.lastName || null,
    phone: user?.phone || booking.mobileNumber || null,
    email: user?.email || booking.email || null,
    customerName: booking.customerName || null,
    bookingId: booking.bookingId || String(booking._id),
    bookingMongoId: booking._id,
    bookingStatus: booking.bookingStatus,
    numberOfTravelers: booking.numberOfTravelers || booking.travelerDetails?.length || 0,
    selectedSeats: booking.selectedSeats || [],
    liveLocation: liveLocation?.currentLocation || null,
    locationLastUpdated: locationUpdated,
    isActiveRide: isActiveRideLocation(locationUpdated),
    travelers: (booking.travelerDetails || []).map((t) => ({
      name: t.name,
      age: t.age,
      gender: t.gender,
      seatNumber: t.seatNumber,
      phone: t.phone || null,
    })),
  };
}

async function resolveTourIdsForGuide(guideObjectId) {
  const tourIdSet = new Set();

  const allocations = await guideAllocationModel
    .find({
      guideId: guideObjectId,
      isDisabled: { $ne: true },
      status: { $in: ACTIVE_ALLOC_STATUSES },
    })
    .select("tourId bookingId status")
    .lean();

  const bookingIds = [];
  for (const alloc of allocations) {
    if (alloc.tourId) tourIdSet.add(String(alloc.tourId));
    if (alloc.bookingId) bookingIds.push(alloc.bookingId);
  }

  if (bookingIds.length) {
    const linkedBookings = await bookingModel
      .find({ _id: { $in: bookingIds } })
      .select("selectedTourId")
      .lean();

    linkedBookings.forEach((b) => {
      if (b.selectedTourId) tourIdSet.add(String(b.selectedTourId));
    });
  }

  const directTours = await tourModel
    .find({
      guideId: guideObjectId,
      status: { $nin: ["Completed", "Cancelled"] },
    })
    .select("_id")
    .lean();

  directTours.forEach((t) => tourIdSet.add(String(t._id)));

  return [...tourIdSet].filter(Boolean);
}

async function buildGuideTrackingPayload(guide, tourIds) {
  if (!tourIds.length) {
    return {
      guide: {
        id: guide._id,
        fullName: guide.fullName,
        phone: guide.phone,
        email: guide.email,
      },
      summary: {
        activeTours: 0,
        totalBookings: 0,
        totalTravelers: 0,
      },
      tours: [],
    };
  }

  const objectIds = tourIds.map((id) => new mongoose.Types.ObjectId(id));

  const tours = await tourModel
    .find({ _id: { $in: objectIds } })
    .select(
      "tourName tourCode status startDate endDate liveTracking currentJourneyStatus currentJourneyStatusAt guideId"
    )
    .populate("cityId", "cityName")
    .lean();

  const bookings = await bookingModel
    .find({
      selectedTourId: { $in: objectIds },
      bookingStatus: { $in: TRACKABLE_BOOKING_STATUSES },
      isDisabled: { $ne: true },
    })
    .select(
      "bookingId userId customerName mobileNumber email bookingStatus numberOfTravelers travelerDetails selectedTourId selectedSeats"
    )
    .populate("userId", "firstName lastName phone email")
    .lean();

  const userLocationsMap = await getUserLocationsForTours(tourIds);

  const bookingsByTour = new Map();
  let totalTravelers = 0;

  for (const booking of bookings) {
    const tourKey = String(booking.selectedTourId);
    const userKey = String(booking.userId?._id || booking.userId || "");
    const liveLocation = userLocationsMap.get(`${tourKey}:${userKey}`) || null;
    if (!bookingsByTour.has(tourKey)) bookingsByTour.set(tourKey, []);
    bookingsByTour.get(tourKey).push(formatBookingUser(booking, liveLocation));
    totalTravelers += booking.numberOfTravelers || booking.travelerDetails?.length || 1;
  }

  const tourPayloads = tours.map((tour) => {
    const tourKey = String(tour._id);
    const users = bookingsByTour.get(tourKey) || [];
    const guideLive = formatLiveTracking(tour.liveTracking);
    return {
      tourId: tour._id,
      tourName: tour.tourName,
      tourCode: tour.tourCode,
      status: tour.status,
      startDate: tour.startDate,
      endDate: tour.endDate,
      city: tour.cityId?.cityName || null,
      currentJourneyStatus: tour.currentJourneyStatus || null,
      currentJourneyStatusAt: tour.currentJourneyStatusAt || null,
      liveTracking: guideLive,
      isGuideLive: isActiveRideLocation(guideLive?.lastUpdated),
      activeRideUsers: users.filter((u) => u.isActiveRide).length,
      users,
      userCount: users.length,
      travelerCount: users.reduce((sum, u) => sum + (u.numberOfTravelers || 0), 0),
    };
  });

  return {
    guide: {
      id: guide._id,
      fullName: guide.fullName,
      phone: guide.phone,
      email: guide.email,
    },
    summary: {
      activeTours: tourPayloads.length,
      totalBookings: bookings.length,
      totalTravelers,
    },
    tours: tourPayloads,
  };
}

async function getGuideUsersTracking(guideId) {
  if (!mongoose.Types.ObjectId.isValid(guideId)) {
    throw new Error("Invalid guideId");
  }

  const guide = await Guide.findById(guideId)
    .select("_id fullName phone email userId")
    .lean();

  if (!guide) throw new Error("Guide not found");

  const tourIds = await resolveTourIdsForGuide(guide._id);
  return buildGuideTrackingPayload(guide, tourIds);
}

async function getAllGuidesUsersTracking({ guideId } = {}) {
  const allocFilter = {
    isDisabled: { $ne: true },
    status: { $in: ACTIVE_ALLOC_STATUSES },
  };
  if (guideId) {
    if (!mongoose.Types.ObjectId.isValid(guideId)) {
      throw new Error("Invalid guideId");
    }
    allocFilter.guideId = guideId;
  }

  const allocations = await guideAllocationModel
    .find(allocFilter)
    .select("guideId")
    .lean();

  const guideIdSet = new Set(
    allocations.map((a) => (a.guideId ? String(a.guideId) : null)).filter(Boolean)
  );

  const tourGuideIds = await tourModel
    .distinct("guideId", {
      guideId: { $ne: null },
      status: { $in: ["Ongoing", "Upcoming"] },
    });

  tourGuideIds.forEach((id) => {
    if (id) guideIdSet.add(String(id));
  });

  if (guideId && !guideIdSet.has(String(guideId))) {
    guideIdSet.add(String(guideId));
  }

  if (!guideIdSet.size) {
    return {
      guides: [],
      summary: {
        guidesWithActiveTours: 0,
        totalTours: 0,
        totalBookings: 0,
        totalTravelers: 0,
      },
    };
  }

  const guides = await Guide.find({ _id: { $in: [...guideIdSet] } })
    .select("_id fullName phone email")
    .lean();

  const results = await Promise.all(
    guides.map(async (guide) => {
      const tourIds = await resolveTourIdsForGuide(guide._id);
      if (!tourIds.length) return null;
      return buildGuideTrackingPayload(guide, tourIds);
    })
  );

  return {
    guides: results.filter(Boolean),
    summary: {
      guidesWithActiveTours: results.filter(Boolean).length,
      totalTours: results.reduce((sum, g) => sum + (g?.summary?.activeTours || 0), 0),
      totalBookings: results.reduce((sum, g) => sum + (g?.summary?.totalBookings || 0), 0),
      totalTravelers: results.reduce((sum, g) => sum + (g?.summary?.totalTravelers || 0), 0),
    },
  };
}

async function resolveGuideIdForTour(tourId) {
  const allocation = await guideAllocationModel
    .findOne({
      tourId,
      isDisabled: { $ne: true },
      status: { $in: ACTIVE_ALLOC_STATUSES },
    })
    .select("guideId")
    .sort({ updatedAt: -1 })
    .lean();

  if (allocation?.guideId) {
    return String(allocation.guideId);
  }

  const tour = await tourModel.findById(tourId).select("guideId").lean();
  return tour?.guideId ? String(tour.guideId) : null;
}

async function assertCanViewGuideTracking(userId, userRole, guideId) {
  if (["Admin", "SubAdmin"].includes(userRole)) return true;

  if (userRole === "Guide") {
    const guide = await Guide.findOne({ userId }).select("_id").lean();
    if (!guide) throw new Error("Guide profile not found");
    if (String(guide._id) !== String(guideId)) {
      throw new Error("You can only view tracking for your own guide profile");
    }
    return true;
  }

  throw new Error("Unauthorized to view guide tracking");
}

module.exports = {
  getGuideUsersTracking,
  getAllGuidesUsersTracking,
  resolveGuideIdForTour,
  assertCanViewGuideTracking,
  normalizeLocation,
  formatLiveTracking,
};
