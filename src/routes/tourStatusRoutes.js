// FEATURE: Tour Live Status | Added: 2026-06-26 | Status: NEW

const express = require("express");
const tourStatusController = require("../controller/tourStatusController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/meta/stages", tourStatusController.getStagesMeta);

router.post("/update", protect, (req, res) => {
  if (req.body?.tourId && !req.params.tourId) {
    req.params.tourId = req.body.tourId;
  }
  return tourStatusController.updateStatus(req, res);
});

router.post("/update/:tourId", protect, (req, res) =>
  tourStatusController.updateStatus(req, res)
);

router.get("/:tourId/live", (req, res) =>
  tourStatusController.getLiveStream(req, res)
);

router.get("/:tourId/my-status", protect, (req, res) =>
  tourStatusController.getMyTourStatus(req, res)
);

router.get("/:tourId", protect, (req, res) =>
  tourStatusController.getStatus(req, res)
);

module.exports = router;
