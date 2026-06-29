// FEATURE: Guide Live Location + Users Tracking | Added: 2026-06-26/29

const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const guideTourLocationService = require("../services/guideTourLocationService");
const guideTrackingController = require("../controller/guideTrackingController");

const router = express.Router();

router.get("/tracking/users", protect, (req, res) =>
  guideTrackingController.getAllGuidesUsersTracking(req, res)
);

router.get("/tracking/me/users", protect, (req, res) =>
  guideTrackingController.getMyGuideUsersTracking(req, res)
);

router.get("/tracking/:guideId/users", protect, (req, res) =>
  guideTrackingController.getGuideUsersTracking(req, res)
);

router.post("/tours/:tourId/location", protect, async (req, res) => {
  try {
    const { tourId } = req.params;
    const result = await guideTourLocationService.updateGuideTourLocation(
      req.user.userId,
      req.user.role,
      tourId,
      req.body || {}
    );

    return res.status(200).json({
      success: true,
      message: "Guide location updated",
      data: result,
    });
  } catch (error) {
    const status =
      error.message === "Tour not found"
        ? 404
        : error.message.includes("not assigned") ||
            error.message.includes("Only assigned")
          ? 403
          : 400;
    return res.status(status).json({ success: false, message: error.message });
  }
});

module.exports = router;
