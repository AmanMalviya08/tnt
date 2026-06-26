// FEATURE: Guide Live Location | Added: 2026-06-26 | Status: NEW

const Guide = require("../models/guideModel");
const { tourModel } = require("../models/tourModel");
const { guideAllocationModel } = require("../models/guideAllocationModel");
const { updateLiveTracking } = require("./tourShareService");
const { tourShareLinkModel } = require("../models/tourShareLinkModel");
const { emitTourTrackingUpdate } = require("./socketService");

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

  const allocated = await guideAllocationModel.exists({
    tourId,
    guideId: guide._id,
    status: { $in: ["Assigned", "Active", "In Progress", "Confirmed"] },
  });

  const isTourGuide =
    tour.guideId && String(tour.guideId) === String(guide._id);

  if (!allocated && !isTourGuide) {
    throw new Error("You are not assigned to this tour");
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
    currentLocation: { lat: Number(lat), lng: Number(lng) },
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

  return {
    tourId,
    tracking,
    lastUpdated: new Date(),
  };
}

module.exports = {
  updateGuideTourLocation,
  assertGuideCanTrackTour,
};
