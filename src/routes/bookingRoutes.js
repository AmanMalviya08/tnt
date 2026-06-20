const express = require("express");
const BookingController = require("../controller/bookingController");
const {
  bookingModel,
  bookingTypes,
  bookingStatuses,
  paymentStatuses,
  paymentMethods,
  userTypes,
} = require("../models/bookingModel");
const { protect } = require("../middleware/authMiddleware");
const {
  checkEligibilityAndGetDiscount,
  consumeDiscount,
  incrementCompletedYatras,
} = require("../controller/yatraLoyaltyController");

const router = express.Router();
const bookingController = new BookingController(bookingModel);

router.post("/", async (req, res) => {
  try {
    console.log("Request Body:", req.body);

    const payload = { ...req.body };

    const isGroupTour = payload.bookingType === "Group Tour";
    const userId = payload.userId;
    let loyaltyDiscountApplied = null;

    if (isGroupTour && userId) {
      const eligibility = await checkEligibilityAndGetDiscount(userId);
      if (eligibility.isEligible) {
        loyaltyDiscountApplied = eligibility;
        if (eligibility.discountType === "free") {
          payload._loyaltyFreeDiscount = true;
        } else {
          const existing = payload.discountAmount || 0;
          payload.discountAmount = existing + eligibility.discountValue;
        }
      }
    }

    const booking = await bookingController.createBooking(payload);

    if (booking?.paymentStatus === "Paid") {
      setImmediate(async () => {
        try {
          const { creditGuideCommissionForBooking } = require("../services/guideCommissionService");
          await creditGuideCommissionForBooking(booking._id, { trigger: "payment" });
        } catch (err) {
          console.error("[booking/create] Guide commission credit failed:", err.message);
        }
      });
    }

    if (loyaltyDiscountApplied && loyaltyDiscountApplied.discountType === "free") {
      await bookingController.updateBooking(booking._id, {
        $set: { discountAmount: booking.totalAmount },
      });
    }

    if (loyaltyDiscountApplied) {
      await consumeDiscount(
        userId,
        booking._id,
        loyaltyDiscountApplied.discountType,
        loyaltyDiscountApplied.discountType === "free"
          ? booking.totalAmount
          : loyaltyDiscountApplied.discountValue
      );
    }

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
      loyaltyDiscountApplied: loyaltyDiscountApplied
        ? {
            discountType: loyaltyDiscountApplied.discountType,
            discountValue: loyaltyDiscountApplied.discountValue,
          }
        : null,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    const {
      page,
      limit,
      sort,
      sortBy,
      sortOrder,
      order,
      includeDisabled,
      ...filters
    } = req.query || {};

    const bookings = await bookingController.getBookings(filters, {
      page,
      limit,
      sort,
      sortBy,
      sortOrder,
      order,
      includeDisabled,
    });

    res.status(200).json({
      success: true,
      message: "Bookings fetched successfully",
      data: bookings.data,
      pagination: bookings.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get("/user", protect, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      page,
      limit,
      sort,
      sortBy,
      sortOrder,
      order,
      includeDisabled,
      ...filters
    } = req.query || {};

    const bookings = await bookingController.getBookingsByUser(filters, {
      page,
      limit,
      sort,
      sortBy,
      sortOrder,
      order,
      userId,
      includeDisabled,
    });

    res.status(200).json({
      success: true,
      message: "Bookings fetched successfully",
      data: bookings.data,
      pagination: bookings.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


router.put("/:id", protect, async (req, res) => {
  try {
    if (req.body.bookingStatus === "Completed") {
      const existing = await bookingController.getBookingById(req.params.id);
      const wasAlreadyCompleted = existing && existing.bookingStatus === "Completed";

      if (
        !wasAlreadyCompleted &&
        existing &&
        existing.bookingType === "Group Tour" &&
        existing.userId &&
        existing.numberOfTravelers > 1
      ) {
        incrementCompletedYatras(
          existing.userId.toString(),
          existing._id
        ).catch((err) =>
          console.error("[YatraLoyalty] incrementCompletedYatras error:", err.message)
        );
      }
    }

    const booking = await bookingController.updateBooking(
      req.params.id,
      req.body,
    );
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    if (booking.paymentStatus === "Paid") {
      setImmediate(async () => {
        try {
          const { creditGuideCommissionForBooking } = require("../services/guideCommissionService");
          await creditGuideCommissionForBooking(booking._id, { trigger: "payment" });
        } catch (err) {
          console.error("[booking/update] Guide commission credit failed:", err.message);
        }
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/:id/disable", protect, async (req, res) => {
  try {
    const { isDisabled } = req.body || {};

    const booking = await bookingController.setBookingDisabled(req.params.id, {
      isDisabled,
    });
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    res.status(200).json({
      success: true,
      message: booking.isDisabled
        ? "Booking disabled successfully"
        : "Booking enabled successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch("/:id/cancel", protect, async (req, res) => {
  try {
    const { reason } = req.body || {};
    const booking = await bookingController.cancelBooking(req.params.id, {
      reason,
      userId: req.user?.userId,
    });

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/meta/enums", (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      bookingTypes,
      bookingStatuses,
      paymentStatuses,
      paymentMethods,
      userTypes,
    },
  });
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const booking = await bookingController.deleteBooking(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }
    res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/admin/table", protect, async (req, res) => {
  try {
    const data = await bookingController.getBookingsForAdminTable(req.query);

    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// router.get("/admin/export", protect, async (req, res) => {
//   try {
//     await bookingController.exportBookingsExcel(req, res);
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// });



router.get("/export-bookings", protect, async (req, res) => {
  try {
    await bookingController.exportBookingsExcel(req, res);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.get("/invoice-url/:bookingId", async (req, res) => {
  try {
    const booking = await bookingController.getBookingInvoiceUrlById(req.params.bookingId);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }
    res.status(200).json({
      success: true,
      message: "Invoice URL fetched successfully",
      invoiceUrl: booking.invoiceUrl || null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/bookings/:id/test-payment
 * Mock/test payment completion for CRM agent bookings (USE_MOCK_PAYMENTS or development).
 */
router.post("/:id/test-payment", protect, async (req, res) => {
  try {
    const allowTest =
      process.env.USE_MOCK_PAYMENTS === "true" ||
      process.env.MOCK_PAYMENT === "true" ||
      process.env.NODE_ENV === "development";

    if (!allowTest) {
      return res.status(403).json({
        success: false,
        message: "Test payment is disabled. Enable USE_MOCK_PAYMENTS or run in development.",
      });
    }

    const booking = await bookingController.completeTestPayment(req.params.id, {
      paymentMethod: req.body?.paymentMethod,
      transactionId: req.body?.transactionId,
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Record payment history when available
    try {
      const { recordPaymentHistory } = require("../services/partialPaymentService");
      await recordPaymentHistory({
        userId: req.user?.userId,
        bookingId: booking._id,
        bookingRef: booking.bookingId,
        amount: booking.finalAmount ?? booking.totalAmount ?? 0,
        paymentType: "full",
        paymentMethod: booking.paymentMethod,
        transactionId: booking.transactionId,
        status: "Completed",
        notes: "Test/mock payment",
      });
    } catch (historyErr) {
      console.warn("[test-payment] History log skipped:", historyErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Test payment completed — booking marked as Paid",
      data: booking,
      paymentStatus: "Paid",
    });
  } catch (error) {
    const status = error.code === "ALREADY_PAID" ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const booking = await bookingController.getBookingById(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }
    res.status(200).json({
      success: true,
      message: "Booking fetched successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
