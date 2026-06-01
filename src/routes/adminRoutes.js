const express = require("express");
const adminController = require("../controller/adminController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/analytics", protect, adminController.getDashboardAnalytics);
router.get("/diagnose", adminController.diagnoseSystem);

module.exports = router;
