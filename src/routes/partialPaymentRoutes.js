const express = require("express");
const partialPaymentController = require("../controller/partialPaymentController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/history", protect, (req, res) =>
  partialPaymentController.getUserPaymentHistory(req, res)
);

router.get("/summary/:bookingId", protect, (req, res) =>
  partialPaymentController.getBookingPaymentSummary(req, res)
);

router.post("/balance/:bookingId", protect, (req, res) =>
  partialPaymentController.createBalancePaymentOrder(req, res)
);

router.post("/balance/verify", protect, (req, res) =>
  partialPaymentController.verifyBalancePayment(req, res)
);

module.exports = router;
