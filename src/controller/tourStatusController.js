// FEATURE: Tour Live Status | Added: 2026-06-26 | Status: NEW

const tourStatusService = require("../services/tourStatusService");
const { isValidTourStatusCode, TOUR_STATUS_CODES } = require("../constants/tourStatusConstants");
const { bookingModel } = require("../models/bookingModel");
const mongoose = require("mongoose");

const ADMIN_ROLES = ["Admin", "SubAdmin"];

class TourStatusController {
  async updateStatus(req, res) {
    try {
      if (!ADMIN_ROLES.includes(req.user.role) && req.user.role !== "Guide") {
        return res.status(403).json({
          success: false,
          message: "Only Admin, SubAdmin or assigned Guide can update tour status",
        });
      }

      const { tourId } = req.params;
      const tourIdFromBody = req.body?.tourId;
      const resolvedTourId = tourId || tourIdFromBody;

      if (req.user.role === "Guide") {
        const guideTourLocationService = require("../services/guideTourLocationService");
        await guideTourLocationService.assertGuideCanTrackTour(
          req.user.userId,
          resolvedTourId,
          req.user.role
        );
      }

      const { statusCode, lat, lng, note, timestamp } = req.body || {};

      if (!statusCode || !isValidTourStatusCode(statusCode)) {
        return res.status(400).json({
          success: false,
          message: `statusCode is required and must be one of: ${TOUR_STATUS_CODES.join(", ")}`,
        });
      }

      const data = await tourStatusService.updateTourStatus({
        tourId: resolvedTourId,
        statusCode,
        lat,
        lng,
        note,
        updatedBy: req.user.userId,
        timestamp,
      });

      return res.status(200).json({
        success: true,
        message: "Tour status updated",
        data,
      });
    } catch (error) {
      const status = error.message === "Tour not found" ? 404 : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async getStatus(req, res) {
    try {
      const { tourId } = req.params;
      const { limit } = req.query || {};

      const data = await tourStatusService.getTourStatusHistory(tourId, { limit });

      return res.status(200).json({
        success: true,
        message: "Tour status fetched",
        data,
      });
    } catch (error) {
      const status = error.message === "Tour not found" ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async getLiveStream(req, res) {
    try {
      const { tourId } = req.params;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      if (res.flushHeaders) res.flushHeaders();

      const sendEvent = (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent("connected", { tourId, message: "Live status stream connected" });

      const snapshot = await tourStatusService.getTourStatusHistory(tourId);
      sendEvent("snapshot", snapshot);

      const { subscribeTourStatusStream } = require("../services/socketService");
      const unsubscribe = subscribeTourStatusStream(tourId, (data) => {
        sendEvent("status-update", data);
      });

      const heartbeat = setInterval(() => {
        res.write(": heartbeat\n\n");
      }, 30000);

      req.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    } catch (error) {
      if (!res.headersSent) {
        return res.status(500).json({ success: false, message: error.message });
      }
      res.end();
    }
  }

  async getAdminStatusBoard(req, res) {
    try {
      if (!ADMIN_ROLES.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Only Admin or SubAdmin can access status board",
        });
      }

      const { tourId } = req.params;
      const data = await tourStatusService.getAdminStatusBoard(tourId);

      return res.status(200).json({
        success: true,
        message: "Tour status board fetched",
        data,
      });
    } catch (error) {
      const status = error.message === "Tour not found" ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async getStagesMeta(req, res) {
    return res.status(200).json({
      success: true,
      data: {
        stages: tourStatusService.TOUR_JOURNEY_STATUSES,
      },
    });
  }

  async getMyTourStatus(req, res) {
    try {
      const userId = req.user.userId;
      const { tourId } = req.params;

      const hasBooking = await bookingModel.exists({
        userId: new mongoose.Types.ObjectId(userId),
        selectedTourId: tourId,
        bookingStatus: { $in: ["Confirmed", "Pending", "Completed"] },
        isDisabled: { $ne: true },
      });

      if (!hasBooking && !ADMIN_ROLES.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "You do not have a booking for this tour",
        });
      }

      const data = await tourStatusService.getTourStatusHistory(tourId, {
        limit: req.query.limit,
      });

      return res.status(200).json({
        success: true,
        message: "Tour status fetched",
        data,
      });
    } catch (error) {
      const status = error.message === "Tour not found" ? 404 : 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  }
}

module.exports = new TourStatusController();
