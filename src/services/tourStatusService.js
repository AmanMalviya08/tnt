// FEATURE: Tour Live Status | Added: 2026-06-26 | Status: NEW

const { tourStatusLogModel } = require("../models/tourStatusLogModel");
const { tourModel } = require("../models/tourModel");
const { bookingModel } = require("../models/bookingModel");
const {
  TOUR_JOURNEY_STATUSES,
  getStatusLabel,
  isValidTourStatusCode,
} = require("../constants/tourStatusConstants");
const { emitTourStatusUpdate, emitTourTrackingUpdate } = require("./socketService");
const { tourShareLinkModel } = require("../models/tourShareLinkModel");
const { notifyUser } = require("./notificationDispatchService");

async function updateTourStatus({
  tourId,
  statusCode,
  lat,
  lng,
  note,
  updatedBy,
  timestamp,
}) {
  if (!isValidTourStatusCode(statusCode)) {
    throw new Error(
      `Invalid statusCode. Must be one of: ${require("../constants/tourStatusConstants").TOUR_STATUS_CODES.join(", ")}`
    );
  }

  const tour = await tourModel.findById(tourId);
  if (!tour) {
    throw new Error("Tour not found");
  }

  const label = getStatusLabel(statusCode);
  const logEntry = await tourStatusLogModel.create({
    tourId,
    statusCode,
    label,
    location:
      lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : undefined,
    note: note || "",
    updatedBy,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
  });

  await tourModel.findByIdAndUpdate(tourId, {
    $set: {
      currentJourneyStatus: statusCode,
      currentJourneyStatusAt: logEntry.timestamp,
      ...(lat != null && lng != null
        ? {
            "liveTracking.currentLocation": {
              lat: Number(lat),
              lng: Number(lng),
            },
            "liveTracking.lastUpdated": logEntry.timestamp,
          }
        : {}),
    },
  });

  const payload = formatStatusPayload(logEntry, tour);

  emitTourStatusUpdate(String(tourId), payload);

  notifyShareLinksOfJourneyUpdate(tourId, payload).catch((err) => {
    console.warn("[TourStatus] Share link journey broadcast failed:", err.message);
  });

  notifyBookedUsers(tourId, label, statusCode, tour.tourName).catch((err) => {
    console.error("[TourStatus] Push notification failed:", err.message);
  });

  return payload;
}

async function getTourStatusHistory(tourId, { limit = 50 } = {}) {
  const tour = await tourModel
    .findById(tourId)
    .select("tourName tourCode status currentJourneyStatus currentJourneyStatusAt liveTracking")
    .lean();

  if (!tour) {
    throw new Error("Tour not found");
  }

  const logs = await tourStatusLogModel
    .find({ tourId })
    .sort({ timestamp: -1 })
    .limit(Math.min(Number(limit) || 50, 100))
    .populate("updatedBy", "firstName lastName role")
    .lean();

  const current = logs[0] || null;

  return {
    tourId,
    tourName: tour.tourName,
    tourCode: tour.tourCode,
    tourLifecycleStatus: tour.status,
    currentStatus: current
      ? {
          statusCode: current.statusCode,
          label: current.label,
          timestamp: current.timestamp,
          location: current.location,
          note: current.note,
        }
      : tour.currentJourneyStatus
        ? {
            statusCode: tour.currentJourneyStatus,
            label: getStatusLabel(tour.currentJourneyStatus),
            timestamp: tour.currentJourneyStatusAt,
          }
        : null,
    stages: TOUR_JOURNEY_STATUSES,
    history: logs.map(formatLogEntry),
    liveTracking: tour.liveTracking || null,
  };
}

async function getAdminStatusBoard(tourId) {
  return getTourStatusHistory(tourId, { limit: 100 });
}

async function notifyShareLinksOfJourneyUpdate(tourId, payload) {
  const links = await tourShareLinkModel
    .find({
      tourId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
    .select("shareToken")
    .lean();

  for (const link of links) {
    emitTourTrackingUpdate(link.shareToken, {
      type: "journey-update",
      journeyStatus: {
        currentStatus: {
          statusCode: payload.statusCode,
          label: payload.label,
          timestamp: payload.timestamp,
          location: payload.location,
          note: payload.note,
        },
      },
    });
  }
}

async function notifyBookedUsers(tourId, label, statusCode, tourName) {
  const bookings = await bookingModel
    .find({
      selectedTourId: tourId,
      bookingStatus: { $in: ["Confirmed", "Pending"] },
      isDisabled: { $ne: true },
      userId: { $exists: true, $ne: null },
    })
    .select("userId bookingId")
    .lean();

  const uniqueUserIds = [
    ...new Set(bookings.map((b) => String(b.userId)).filter(Boolean)),
  ];

  await Promise.allSettled(
    uniqueUserIds.map((userId) =>
      notifyUser(userId, {
        title: "Tour Status Update",
        message: `Your tour "${tourName || "Yatra"}" is now at: ${label}`,
        type: "tour_status",
        redirectScreen: "LiveStatus",
        redirectParams: { tourId: String(tourId), statusCode },
        meta: { tourId: String(tourId), statusCode, label },
      })
    )
  );
}

function formatLogEntry(log) {
  return {
    _id: log._id,
    statusCode: log.statusCode,
    label: log.label,
    location: log.location,
    note: log.note,
    timestamp: log.timestamp,
    updatedBy: log.updatedBy
      ? {
          _id: log.updatedBy._id,
          firstName: log.updatedBy.firstName,
          lastName: log.updatedBy.lastName,
          role: log.updatedBy.role,
        }
      : log.updatedBy,
  };
}

function formatStatusPayload(logEntry, tour) {
  const populated = logEntry.toObject ? logEntry.toObject() : logEntry;
  return {
    tourId: populated.tourId,
    tourName: tour?.tourName,
    statusCode: populated.statusCode,
    label: populated.label,
    location: populated.location,
    note: populated.note,
    timestamp: populated.timestamp,
    updatedBy: populated.updatedBy,
  };
}

module.exports = {
  updateTourStatus,
  getTourStatusHistory,
  getAdminStatusBoard,
  TOUR_JOURNEY_STATUSES,
};
