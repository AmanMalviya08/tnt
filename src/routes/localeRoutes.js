const express = require("express");
const { localeController } = require("../controller/localeController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/language", protect, (req, res) =>
  localeController.getLanguagePreference(req, res)
);

router.put("/language", protect, (req, res) =>
  localeController.updateLanguagePreference(req, res)
);

module.exports = router;
