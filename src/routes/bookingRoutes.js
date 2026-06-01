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

const router = express.Router();
const bookingController = new BookingController(bookingModel);

router.post("/", async (req, res) => {
  try {
    //  req.
    console.log("Request Body:", req.body);
    const booking = await bookingController.createBooking(req.body);
    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
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
    const booking = await bookingController.updateBooking(
      req.params.id,
      req.body,
    );
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
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
