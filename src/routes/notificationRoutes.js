const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const notificationController = require("../controller/notificationController");

const router = express.Router();

router.get("/", protect, notificationController.getMyNotifications);
router.post("/device-token", protect, notificationController.registerDeviceToken);
router.patch("/read-all", protect, notificationController.markAllAsRead);
router.patch("/:id/read", protect, notificationController.markAsRead);

module.exports = router;
