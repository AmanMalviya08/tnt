const express = require("express");
const { savedTravellerController } = require("../controller/savedTravellerController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/combined", protect, (req, res) => savedTravellerController.listCombined(req, res));
router.get("/from-bookings", protect, (req, res) => savedTravellerController.listFromBookings(req, res));
router.get("/", protect, (req, res) => savedTravellerController.list(req, res));
router.post("/", protect, (req, res) => savedTravellerController.create(req, res));
router.put("/:id", protect, (req, res) => savedTravellerController.update(req, res));
router.delete("/:id", protect, (req, res) => savedTravellerController.remove(req, res));

module.exports = router;
