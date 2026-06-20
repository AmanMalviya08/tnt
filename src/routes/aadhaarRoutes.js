const express = require("express");
const aadhaarController = require("../controller/aadhaarController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/verify", protect, (req, res) => aadhaarController.verifyAadhaar(req, res));

module.exports = router;
