const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const userTourLocationService = require("../services/userTourLocationService");

const router = express.Router({ mergeParams: true });

router.post("/:tourId/user-location", protect, async (req, res) => {
  try {
    const { tourId } = req.params;
    const result = await userTourLocationService.updateUserTourLocation(
      req.user.userId,
      tourId,
      req.body || {}
    );

    return res.status(200).json({
      success: true,
      message: "User location updated",
      data: result,
    });
  } catch (error) {
    const status =
      error.message === "Tour not found"
        ? 404
        : error.message.includes("No active booking") ||
            error.message.includes("only available")
          ? 403
          : 400;
    return res.status(status).json({ success: false, message: error.message });
  }
});

module.exports = router;
