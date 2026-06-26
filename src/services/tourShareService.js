const { tourShareLinkModel } = require("../models/tourShareLinkModel");
const { tourModel } = require("../models/tourModel");
const { bookingModel } = require("../models/bookingModel");
const tourStatusService = require("./tourStatusService");

const APP_DEEP_LINK_BASE =
  process.env.APP_DEEP_LINK_BASE || "https://zunjarraoyatra.com/track";

async function createShareLink(tourId, userId) {
  const tour = await tourModel.findById(tourId);
  if (!tour) throw new Error("Tour not found");

  if (!["Ongoing", "Upcoming"].includes(tour.status)) {
    throw new Error("Share links are only available for active tours");
  }

  const expiresAt = tour.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const existing = await tourShareLinkModel.findOne({
    tourId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  });

  if (existing) {
    return formatShareResponse(existing, tour);
  }

  const shareToken = tourShareLinkModel.generateToken();
  const link = await tourShareLinkModel.create({
    tourId,
    shareToken,
    createdBy: userId,
    expiresAt,
    isActive: true,
  });

  return formatShareResponse(link, tour);
}

function formatShareResponse(link, tour) {
  const deepLink = `${APP_DEEP_LINK_BASE}/${link.shareToken}`;
  const webLink = `${process.env.API_PUBLIC_URL || "https://api.zunjarraoyatra.com"}/api/tour-share/public/${link.shareToken}`;

  return {
    shareToken: link.shareToken,
    deepLink,
    webLink,
    expiresAt: link.expiresAt,
    tourId: tour._id,
    tourName: tour.tourName,
  };
}

async function getPublicTrackingData(shareToken) {
  const link = await tourShareLinkModel.findOne({
    shareToken,
    isActive: true,
  });

  if (!link) throw new Error("Share link not found or expired");
  if (new Date() > new Date(link.expiresAt)) {
    link.isActive = false;
    await link.save();
    throw new Error("Share link has expired");
  }

  link.accessCount += 1;
  link.lastAccessedAt = new Date();
  await link.save();

  const tour = await tourModel
    .findById(link.tourId)
    .populate("cityId", "cityName")
    .populate("guideId", "name phone")
    .lean();

  if (!tour) throw new Error("Tour not found");

  if (tour.status === "Completed" || tour.status === "Cancelled") {
    link.isActive = false;
    await link.save();
    throw new Error("Tour has ended. Tracking is no longer available.");
  }

  const latestBooking = await bookingModel
    .findOne({ selectedTourId: tour._id, bookingStatus: { $in: ["Confirmed", "Completed"] } })
    .sort({ updatedAt: -1 })
    .select("travelerDetails selectedSeats")
    .lean();

  const tracking = tour.liveTracking || {};

  let journeyStatus = null;
  try {
    journeyStatus = await tourStatusService.getTourStatusHistory(tour._id, { limit: 50 });
  } catch (err) {
    console.warn("[tourShare] journey status load failed:", err.message);
  }

  return {
    tour: {
      id: tour._id,
      tourId: tour._id,
      tourName: tour.tourName,
      status: tour.status,
      startDate: tour.startDate,
      endDate: tour.endDate,
      city: tour.cityId?.cityName,
      guide: tour.guideId
        ? { name: tour.guideId.name, phone: tour.guideId.phone }
        : null,
      remainingSeats: tour.remainingSeats,
      totalSeats: tour.totalSeats,
    },
    location: tracking.currentLocation || null,
    eta: tracking.eta || null,
    routeProgress: tracking.routeProgress ?? 0,
    vehicleStatus: tracking.vehicleStatus || "unknown",
    lastUpdated: tracking.lastUpdated || null,
    route: tracking.route || [],
    bookedSeats: latestBooking?.selectedSeats || [],
    journeyStatus: journeyStatus
      ? {
          currentStatus: journeyStatus.currentStatus,
          stages: journeyStatus.stages,
          history: journeyStatus.history,
          tourLifecycleStatus: journeyStatus.tourLifecycleStatus,
        }
      : null,
  };
}

async function updateLiveTracking(tourId, payload) {
  const tour = await tourModel.findByIdAndUpdate(
    tourId,
    {
      $set: {
        liveTracking: {
          currentLocation: payload.currentLocation,
          eta: payload.eta,
          routeProgress: payload.routeProgress,
          vehicleStatus: payload.vehicleStatus || "moving",
          route: payload.route || [],
          lastUpdated: new Date(),
        },
      },
    },
    { new: true }
  );

  return tour?.liveTracking;
}

module.exports = {
  createShareLink,
  getPublicTrackingData,
  updateLiveTracking,
};
