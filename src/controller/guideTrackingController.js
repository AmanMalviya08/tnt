const guideUsersTrackingService = require("../services/guideUsersTrackingService");
const Guide = require("../models/guideModel");

class GuideTrackingController {
  async getGuideUsersTracking(req, res) {
    try {
      const { guideId } = req.params;
      await guideUsersTrackingService.assertCanViewGuideTracking(
        req.user.userId,
        req.user.role,
        guideId
      );

      const data = await guideUsersTrackingService.getGuideUsersTracking(guideId);

      return res.status(200).json({
        success: true,
        message: "Guide users tracking fetched",
        data,
      });
    } catch (error) {
      const status =
        error.message === "Guide not found"
          ? 404
          : error.message.includes("Unauthorized") ||
              error.message.includes("only view")
            ? 403
            : 400;
      return res.status(status).json({ success: false, message: error.message });
    }
  }

  async getMyGuideUsersTracking(req, res) {
    try {
      const guide = await Guide.findOne({ userId: req.user.userId }).select("_id").lean();
      if (!guide) {
        return res.status(404).json({ success: false, message: "Guide profile not found" });
      }

      const data = await guideUsersTrackingService.getGuideUsersTracking(guide._id);

      return res.status(200).json({
        success: true,
        message: "Your assigned users tracking fetched",
        data,
      });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async getAllGuidesUsersTracking(req, res) {
    try {
      if (!["Admin", "SubAdmin"].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: "Admin access required" });
      }

      const data = await guideUsersTrackingService.getAllGuidesUsersTracking({
        guideId: req.query.guideId,
      });

      return res.status(200).json({
        success: true,
        message: "All guides users tracking fetched",
        data,
      });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = new GuideTrackingController();
