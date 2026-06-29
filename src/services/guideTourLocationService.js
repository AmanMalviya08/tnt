// FEATURE: Guide Live Location | Added: 2026-06-26 | Status: NEW

const Guide = require("../models/guideModel");
const { tourModel } = require("../models/tourModel");
const { bookingModel } = require("../models/bookingModel");
const {
  guideAllocationModel,
  trackableAllocationStatuses,
} = require("../models/guideAllocationModel");
const { updateLiveTracking } = require("./tourShareService");
const { tourShareLinkModel } = require("../models/tourShareLinkModel");
const { emitTourTrackingUpdate, emitGuideTrackingUpdate } = require("./socketService");
const { resolveGuideIdForTour } = require("./guideUsersTrackingService");

async function guideHasAllocationForTour(guideId, tourId) {
  const direct = await guideAllocationModel.exists({
    tourId,
    guideId,
    isDisabled: { $ne: true },
    status: { $in: trackableAllocationStatuses },
  });
  if (direct) return true;

  const bookings = await bookingModel
    .find({ selectedTourId: tourId })
    .select("_id")
    .lean();

  if (bookings.length) {
    const viaBooking = await guideAllocationModel.exists({
      bookingId: { $in: bookings.map((b) => b._id) },
      guideId,
      isDisabled: { $ne: true },
      status: { $in: trackableAllocationStatuses },
    });
    if (viaBooking) return true;
  }

  const allocations = await guideAllocationModel
    .find({
      guideId,
      isDisabled: { $ne: true },
      status: { $in: trackableAllocationStatuses },
    })
    .select("tourId bookingId")
    .lean();

  for (const alloc of allocations) {
    if (alloc.tourId && String(alloc.tourId) === String(tourId)) return true;

    if (alloc.bookingId) {
      const booking = await bookingModel
        .findById(alloc.bookingId)
        .select("selectedTourId")
        .lean();
      if (
        booking?.selectedTourId &&
        String(booking.selectedTourId) === String(tourId)
      ) {
        return true;
      }
    }
  }

  return false;
}

async function assertGuideCanTrackTour(userId, tourId, userRole) {
  if (["Admin", "SubAdmin"].includes(userRole)) {
    return true;
  }

  if (userRole !== "Guide") {
    throw new Error("Only assigned guides or admins can update tour location");
  }

  const guide = await Guide.findOne({ userId }).select("_id");
  if (!guide) {
    throw new Error("Guide profile not found");
  }

  const tour = await tourModel.findById(tourId).select("guideId");
  if (!tour) {
    throw new Error("Tour not found");
  }

  const allocated = await guideHasAllocationForTour(guide._id, tourId);

  const isTourGuide =
    tour.guideId && String(tour.guideId) === String(guide._id);

  if (!allocated && !isTourGuide) {
    throw new Error("You are not assigned to this tour");
  }

  if (!tour.guideId) {
    await tourModel.findByIdAndUpdate(tourId, { guideId: guide._id });
  }

  return true;
}

async function updateGuideTourLocation(userId, userRole, tourId, payload = {}) {
  await assertGuideCanTrackTour(userId, tourId, userRole);

  const { lat, lng, eta, routeProgress, vehicleStatus, note } = payload;

  if (lat == null || lng == null) {
    throw new Error("lat and lng are required");
  }

  const trackingPayload = {
    currentLocation: {
      lat: Number(lat),
      lng: Number(lng),
      latitude: Number(lat),
      longitude: Number(lng),
    },
    eta: eta || null,
    routeProgress: routeProgress ?? undefined,
    vehicleStatus: vehicleStatus || "moving",
    updatedByGuide: userId,
    guideNote: note || "",
  };

  const tracking = await updateLiveTracking(tourId, trackingPayload);

  const link = await tourShareLinkModel.findOne({
    tourId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  });

  const socketPayload = {
    tourId: String(tourId),
    currentLocation: trackingPayload.currentLocation,
    eta: trackingPayload.eta,
    routeProgress: trackingPayload.routeProgress,
    vehicleStatus: trackingPayload.vehicleStatus,
    lastUpdated: new Date(),
    source: userRole === "Guide" ? "guide" : "admin",
  };

  if (link) {
    emitTourTrackingUpdate(link.shareToken, socketPayload);
  }

  const guideId = await resolveGuideIdForTour(tourId);
  if (guideId) {
    emitGuideTrackingUpdate(guideId, {
      type: "location-update",
      guideId,
      ...socketPayload,
    });
  }

  return {
    tourId,
    tracking,
    lastUpdated: new Date(),
  };
}

module.exports = {
  updateGuideTourLocation,
  assertGuideCanTrackTour,
  guideHasAllocationForTour,
};
