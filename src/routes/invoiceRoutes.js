const express = require("express");
const InvoiceController = require("../controller/invoiceController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/generate/:bookingId", protect, InvoiceController.generateInvoice);
router.get("/:bookingId", InvoiceController.getInvoice);
router.put(
  "/regenerate/:bookingId",
  protect,
  InvoiceController.regenerateInvoice,
);
router.post("/send-whatsapp/:bookingId", protect, InvoiceController.sendInvoiceWhatsApp);

// router.delete('/:bookingId', InvoiceController.deleteInvoice);

router.get("/", InvoiceController.getAllInvoices);

module.exports = router;
