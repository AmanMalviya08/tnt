const express = require("express");
const tourShareController = require("../controller/tourShareController");
const { protect } = require("../middleware/authMiddleware");
const { rateLimit } = require("../middleware/rateLimitMiddleware");

const router = express.Router();

const publicRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyPrefix: "tour-share",
});

router.post(
  "/:tourId/share",
  protect,
  (req, res) => tourShareController.createShareLink(req, res)
);

router.get(
  "/public/:token",
  publicRateLimit,
  (req, res) => tourShareController.getPublicTracking(req, res)
);

router.patch(
  "/:tourId/tracking",
  protect,
  (req, res) => tourShareController.updateTracking(req, res)
);

module.exports = router;
