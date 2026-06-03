const express = require("express");
const adminController = require("../controller/adminController");
const { protect } = require("../middleware/authMiddleware");
const notificationController = require("../controller/notificationController");

const router = express.Router();

router.get("/analytics", protect, adminController.getDashboardAnalytics);
router.get("/diagnose", adminController.diagnoseSystem);
router.post("/notifications/send", protect, notificationController.sendAdminNotification);

module.exports = router;
