// FEATURE: Guide Live Location | Added: 2026-06-26 | Status: NEW

const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const guideTourLocationService = require("../services/guideTourLocationService");

const router = express.Router();

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
