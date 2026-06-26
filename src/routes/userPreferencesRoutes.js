// FEATURE: Dark Mode / User Preferences | Added: 2026-06-26 | Status: NEW

const express = require("express");
const { userPreferencesController } = require("../controller/userPreferencesController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/preferences", protect, (req, res) =>
  userPreferencesController.getPreferences(req, res)
);

router.patch("/preferences", protect, (req, res) =>
  userPreferencesController.updatePreferences(req, res)
);

module.exports = router;
