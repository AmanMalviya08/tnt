const tourShareService = require("../services/tourShareService");
const { tourShareLinkModel } = require("../models/tourShareLinkModel");
const { emitTourTrackingUpdate } = require("../services/socketService");

class TourShareController {
  async createShareLink(req, res) {
    try {
      const { tourId } = req.params;
      const userId = req.user?.userId;
      const result = await tourShareService.createShareLink(tourId, userId);
      res.status(201).json({
        success: true,
        message: "Share link created",
        data: result,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getPublicTracking(req, res) {
    try {
      const data = await tourShareService.getPublicTrackingData(req.params.token);
      res.status(200).json({
        success: true,
        message: "Tracking data fetched",
        data,
      });
    } catch (error) {
      const status = error.message.includes("expired") ? 410 : 404;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async updateTracking(req, res) {
    try {
      const { tourId } = req.params;
      const tracking = await tourShareService.updateLiveTracking(tourId, req.body);

      const link = await tourShareLinkModel.findOne({
        tourId,
        isActive: true,
        expiresAt: { $gt: new Date() },
      });

      if (link) {
        emitTourTrackingUpdate(link.shareToken, {
          tourId,
          ...req.body,
          lastUpdated: new Date(),
        });
      }

      res.status(200).json({
        success: true,
        message: "Tracking updated",
        data: tracking,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new TourShareController();
