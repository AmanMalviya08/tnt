const express = require("express");
const {
  createBookingsFromCart,
  confirmPayment,
  createAgentPaidOrder,
  confirmAgentPayment,
  createAgentPaidOrderDynamic,
  confirmAgentPaymentDynamic,
  getAgentPaidTransactions,
} = require("../controller/checkoutController");
const { protect } = require("../middleware/authMiddleware");

const { bookingModel } = require("../models/bookingModel");

const router = express.Router();

router.post("/verify", protect, confirmPayment);

// Agent paid subscription (company fixed fee)
router.post("/agent-pay/verify", protect, confirmAgentPayment);
router.post("/agent-pay/:agentId", protect, createAgentPaidOrder);

// Agent paid subscription (distributor dynamic pricing)
router.post("/agent-pay-dynamic/verify", protect, confirmAgentPaymentDynamic);
router.post("/agent-pay-dynamic/:agentId", protect, createAgentPaidOrderDynamic);

// Agent paid transactions
router.get("/agent-pay/transactions/:agentId", protect, getAgentPaidTransactions);

router.post("/:userId", createBookingsFromCart);


// Route: GET /invoice
router.get('/invoice', async (req, res) => {
  try {
    const { id } = req.query;
    console.log("Invoice route hit, bookingId:", id);

    if (!id) {
      return res.status(400).json({ success: false, message: "bookingId query parameter is required" });
    }

    const booking = await bookingModel.findOne({ bookingId: id });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (!booking.invoiceUrl) {
      return res.status(404).json({ success: false, message: "Invoice not generated yet for this booking" });
    }

    // Redirect to the S3 invoice PDF
    return res.redirect(booking.invoiceUrl);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch invoice" });
  }
});

module.exports = router;

