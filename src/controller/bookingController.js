const { bookingModel } = require("../models/bookingModel");
const ExcelJS = require("exceljs");
const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);
const mongoose = require("mongoose");
const { s3Client } = require("../middleware/s3Upload");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

class BookingController {
  constructor(model = bookingModel) {
    this.model = model;
  }

  async createBooking(payload) {
    const booking = this.model(payload);
    return booking.save();
  }

  async getBookings(filter = {}, options = {}) {
    const normalizedFilter = { ...filter };

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "isDisabled")) {
      const raw = normalizedFilter.isDisabled;
      if (typeof raw === "string") {
        normalizedFilter.isDisabled = raw === "true";
      } else {
        normalizedFilter.isDisabled = Boolean(raw);
      }
    } else {
      const includeDisabled =
        typeof options.includeDisabled === "string"
          ? options.includeDisabled === "true"
          : Boolean(options.includeDisabled);
      if (!includeDisabled) {
        normalizedFilter.isDisabled = false;
      }
    }

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "search")) {
      const value = normalizedFilter.search;
      if (value && value.trim()) {
        const regex = { $regex: value.trim(), $options: "i" };
        normalizedFilter.$or = [
          { customerName: regex },
          { mobileNumber: regex },
          { bookingId: regex },
          { invoiceNumber: regex },
        ];
      }
      delete normalizedFilter.search;
    }

    // Filter by paymentStatus and bookingStatus if provided
    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "paymentStatus")) {
      const value = normalizedFilter.paymentStatus;
      if (value && value.trim()) {
        normalizedFilter.paymentStatus = value.trim();
      } else {
        delete normalizedFilter.paymentStatus;
      }
    }

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "bookingStatus")) {
      const value = normalizedFilter.bookingStatus;
      if (value && value.trim()) {
        normalizedFilter.bookingStatus = value.trim();
      } else {
        delete normalizedFilter.bookingStatus;
      }
    }

    const parsedPage = parseInt(options.page, 10);
    const parsedLimit = parseInt(options.limit, 10);

    const pageSize =
      !Number.isNaN(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : DEFAULT_PAGE_SIZE;
    const currentPage =
      !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const query = this.model
      .find(normalizedFilter)
      .populate("selectedPackageId")
      .populate("selectedTourId")
      .populate("cityId")
      .populate("assignedAgent", "firstName lastName email");

    let sort = options.sort || options.sortBy;
    if (typeof sort === "string" && sort.trim()) {
      const order = options.sortOrder || options.order;
      const direction =
        typeof order === "string" && order.toLowerCase() === "desc" ? -1 : 1;
      sort = { [sort]: direction };
    }

    if (!sort) {
      sort = { createdAt: -1 };
    }

    query.sort(sort);
    query.skip((currentPage - 1) * pageSize).limit(pageSize);
    const [items, totalItems] = await Promise.all([
      query.exec(),
      this.model.countDocuments(normalizedFilter),
    ]);

    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

    return {
      data: items,
      pagination: {
        totalItems,
        totalPages,
        pageSize,
        currentPage,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    };
  }

  async getBookingsByUser(filter = {}, options = {}) {
    const normalizedFilter = { ...filter };

    normalizedFilter.userId = options.userId;
    console.log(options.userId);

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "isDisabled")) {
      const raw = normalizedFilter.isDisabled;
      if (typeof raw === "string") {
        normalizedFilter.isDisabled = raw === "true";
      } else {
        normalizedFilter.isDisabled = Boolean(raw);
      }
    } else {
      const includeDisabled =
        typeof options.includeDisabled === "string"
          ? options.includeDisabled === "true"
          : Boolean(options.includeDisabled);
      if (!includeDisabled) {
        normalizedFilter.isDisabled = false;
      }
    }

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "search")) {
      const value = normalizedFilter.search;
      if (value && value.trim()) {
        const regex = { $regex: value.trim(), $options: "i" };
        normalizedFilter.$or = [
          { customerName: regex },
          { mobileNumber: regex },
          { bookingId: regex },
          { invoiceNumber: regex },
        ];
      }
      delete normalizedFilter.search;
    }

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "paymentStatus")) {
      const value = normalizedFilter.paymentStatus;
      if (value && value.trim()) {
        normalizedFilter.paymentStatus = value.trim();
      } else {
        delete normalizedFilter.paymentStatus;
      }
    }

    if (Object.prototype.hasOwnProperty.call(normalizedFilter, "bookingStatus")) {
      const value = normalizedFilter.bookingStatus;
      if (value && value.trim()) {
        normalizedFilter.bookingStatus = value.trim();
      } else {
        delete normalizedFilter.bookingStatus;
      }
    }

    const parsedPage = parseInt(options.page, 10);
    const parsedLimit = parseInt(options.limit, 10);

    const pageSize =
      !Number.isNaN(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : DEFAULT_PAGE_SIZE;
    const currentPage =
      !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const query = this.model
      .find(normalizedFilter)
      .populate("selectedPackageId")
      .populate("selectedTourId")
      .populate("cityId")
      .populate("assignedAgent", "firstName lastName email");

    let sort = options.sort || options.sortBy;
    if (typeof sort === "string" && sort.trim()) {
      const order = options.sortOrder || options.order;
      const direction =
        typeof order === "string" && order.toLowerCase() === "desc" ? -1 : 1;
      sort = { [sort]: direction };
    }

    if (!sort) {
      sort = { createdAt: -1 };
    }

    query.sort(sort);
    query.skip((currentPage - 1) * pageSize).limit(pageSize);
    const [items, totalItems] = await Promise.all([
      query.exec(),
      this.model.countDocuments(normalizedFilter),
    ]);

    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

    return {
      data: items,
      pagination: {
        totalItems,
        totalPages,
        pageSize,
        currentPage,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    };
  }

  async getBookingById(id) {
    const populateQuery = () => this.model
      .findById(id)
      .populate("selectedPackageId")
      .populate("selectedTourId")
      .populate("cityId")
      .populate("assignedAgent", "firstName lastName email");

    let booking = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      booking = await populateQuery();
    }

    if (!booking) {
      booking = await this.model
        .findOne({ bookingId: id })
        .populate("selectedPackageId")
        .populate("selectedTourId")
        .populate("cityId")
        .populate("assignedAgent", "firstName lastName email");
    }

    return booking;
  }

  async updateBooking(id, payload) {
    return this.model.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Mark a booking as paid using mock/test payment (dev & USE_MOCK_PAYMENTS).
   */
  async completeTestPayment(id, options = {}) {
    const booking = await this.model.findById(id);
    if (!booking) return null;

    if (booking.paymentStatus === "Paid") {
      const err = new Error("Booking is already fully paid");
      err.code = "ALREADY_PAID";
      throw err;
    }

    const transactionId =
      options.transactionId || `pay_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const paymentMethod = options.paymentMethod || booking.paymentMethod || "Online";
    const paidAmount = Number(booking.finalAmount ?? booking.totalAmount ?? 0);

    const updated = await this.model.findByIdAndUpdate(
      id,
      {
        paymentStatus: "Paid",
        paymentMethod,
        transactionId,
        advancePaid: paidAmount,
        remainingAmount: 0,
        bookingStatus:
          booking.bookingStatus === "Pending" ? "Confirmed" : booking.bookingStatus,
      },
      { new: true, runValidators: true },
    );

    if (updated) {
      setImmediate(async () => {
        try {
          const { creditGuideCommissionForBooking } = require("../services/guideCommissionService");
          await creditGuideCommissionForBooking(updated._id, { trigger: "payment" });
        } catch (err) {
          console.error("[completeTestPayment] Guide commission credit failed:", err.message);
        }
      });
    }

    return updated;
  }

  async setBookingDisabled(id, options = {}) {
    const existing = await this.model.findById(id).select("isDisabled");
    if (!existing) {
      return null;
    }

    let { isDisabled } = options;

    if (typeof isDisabled === "string") {
      isDisabled = isDisabled === "true";
    }

    if (typeof isDisabled === "undefined") {
      isDisabled = !existing.isDisabled;
    } else {
      isDisabled = Boolean(isDisabled);
    }

    return this.model.findByIdAndUpdate(
      id,
      {
        $set: {
          isDisabled,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );
  }

  async cancelBooking(id, options = {}) {
    const { reason, userId } = options;
    const booking = await this.model.findById(id);

    if (!booking) {
      return null;
    }

    if (
      userId &&
      booking.userId &&
      booking.userId.toString() !== userId.toString()
    ) {
      throw new Error("Not authorized to cancel this booking");
    }

    if (booking.bookingStatus === "Cancelled") {
      throw new Error("Booking is already cancelled");
    }

    if (booking.bookingStatus === "Completed") {
      throw new Error("Completed bookings cannot be cancelled");
    }

    if (booking.travelStartDate && new Date(booking.travelStartDate) <= new Date()) {
      throw new Error("Cannot cancel a trip that has already started");
    }

    return this.model
      .findByIdAndUpdate(
        id,
        {
          $set: {
            bookingStatus: "Cancelled",
            cancellationReason: (reason || "Change of plans").trim(),
            cancelledAt: new Date(),
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .populate("selectedPackageId")
      .populate("selectedTourId")
      .populate("cityId")
      .populate("assignedAgent", "firstName lastName email");
  }
  async getBookingInvoiceUrlById(bookingId) {

    let booking = await this.model
      .findOne({ bookingId: bookingId })
      .populate("selectedPackageId")
      .populate("selectedTourId")
      .populate("cityId")
      .populate("assignedAgent", "invoiceUrl");

    return booking;
  }

  async deleteBooking(id) {
    return this.model.findByIdAndDelete(id);
  }

  // ------------data in excel ----------
  async getBookingsForAdminTable(filter = {}) {
    const query = {
      isDisabled: false,
    };

    if (filter.packageId && mongoose.Types.ObjectId.isValid(filter.packageId)) {
      query.selectedPackageId = new mongoose.Types.ObjectId(filter.packageId);
    }

    if (filter.tourId && mongoose.Types.ObjectId.isValid(filter.tourId)) {
      query.selectedTourId = new mongoose.Types.ObjectId(filter.tourId);
    }

    const bookings = await this.model
      .find(query)
      .populate("selectedPackageId", "packageName")
      .populate("selectedTourId", "tourName")
      .populate("cityId", "cityName")
      .sort({ createdAt: -1 });

    return {
      columns: [
        "Booking ID",
        "Customer Name",
        "Mobile",
        "Email",
        "Tour / Package Name",
        "City",
        "Adults",
        "Children",
        "Final Amount",
        "Payment Status",
        "Booking Date",
      ],
      rows: bookings.map((b) => [
        b.bookingId,
        b.customerName,
        b.mobileNumber,
        b.email || "-",
        b.selectedTourId?.tourName || b.selectedPackageId?.packageName || "-",
        b.cityId?.cityName || "-",
        b.adults,
        b.children,
        b.finalAmount,
        b.paymentStatus,
        b.createdAt,
      ]),
    };
  }

  async exportBookingsExcel(req, res) {
    let tempFilePath = null;

    try {
      // Get filters from query parameters
      const { tourId, packageId } = req.query;

      const filter = {
      };

      if (tourId && mongoose.Types.ObjectId.isValid(tourId)) {
        filter.selectedTourId = new mongoose.Types.ObjectId(tourId);
      }

      if (packageId && mongoose.Types.ObjectId.isValid(packageId)) {
        filter.selectedPackageId = new mongoose.Types.ObjectId(packageId);
      }

      const bookings = await this.model
        .find(filter)
        .populate("selectedTourId", "tourName")
        .populate("selectedPackageId", "packageName")
        .populate("cityId", "cityName")
        .sort({ createdAt: -1 })
        .lean();

      if (!bookings.length) {
        return res.status(400).json({
          success: false,
          message: "No bookings found",
        });
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Bookings");

      worksheet.columns = [
        { header: "Booking ID", key: "bookingId" },
        { header: "Customer Name", key: "customerName" },
        { header: "Mobile", key: "mobileNumber" },
        { header: "Email", key: "email" },
        { header: "Tour", key: "tour" },
        { header: "Package", key: "package" },
        { header: "City", key: "city" },
        { header: "Final Amount", key: "amount" },
        { header: "Payment Status", key: "status" },
        { header: "Booking Date", key: "date" },
      ];

      // Header styling
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 25;

      bookings.forEach((b, index) => {
        const row = worksheet.addRow({
          bookingId: b.bookingId,
          customerName: b.customerName,
          mobileNumber: b.mobileNumber,
          email: b.email || "-",
          tour: b.selectedTourId?.tourName || "-",
          package: b.selectedPackageId?.packageName || "-",
          city: b.cityId?.cityName || "-",
          amount: b.finalAmount,
          status: b.paymentStatus,
          date: new Date(b.createdAt).toLocaleDateString("en-IN"),
        });

        // Alternate row colors
        if (index % 2 === 0) {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF5F5F5" },
          };
        }

        row.alignment = { vertical: "middle", horizontal: "left" };
      });

      worksheet.columns.forEach((column) => {
        let maxLength = 0;

        column.eachCell({ includeEmpty: true }, (cell) => {
          const cellValue = cell.value ? cell.value.toString() : "";
          if (cellValue.length > maxLength) {
            maxLength = cellValue.length;
          }
        });

        column.width = Math.max(Math.min(maxLength + 2, 50), 10);
      });

      // Borders
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFD3D3D3" } },
            left: { style: "thin", color: { argb: "FFD3D3D3" } },
            bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
            right: { style: "thin", color: { argb: "FFD3D3D3" } },
          };
        });
      });

      // Payment Status conditional formatting
      const statusColIndex = 9;
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const cell = row.getCell(statusColIndex);
          const status = cell.value?.toString().toLowerCase();

          if (status === "paid") {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FF90EE90" },
            };
            cell.font = { bold: true, color: { argb: "FF006400" } };
          } else if (status === "pending") {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFCCCB" },
            };
            cell.font = { bold: true, color: { argb: "FF8B0000" } };
          }
        }
      });

      // Generate unique filename
      const timestamp = new Date().toISOString().split("T")[0];
      const uniqueId = Date.now();
      const filename = `Bookings_${timestamp}_${uniqueId}.xlsx`;

      // Create temporary directory if it doesn't exist
      const tempDir = path.join(__dirname, "../../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Temporary file path
      tempFilePath = path.join(tempDir, filename);

      // Write Excel file to temporary location
      await workbook.xlsx.writeFile(tempFilePath);

      // Read file as buffer
      const fileBuffer = fs.readFileSync(tempFilePath);

      // Define S3 key (path in bucket) - using EXCEL folder
      const folderPath = process.env.BUCKET_FOLDER_PATH || "TourTravels/";
      const s3Key = `${folderPath}EXCEL/${filename}`;

      // Upload to Object Storage using PutObjectCommand
      const uploadParams = {
        Bucket: process.env.LINODE_OBJECT_BUCKET || "leadkart",
        Key: s3Key,
        Body: fileBuffer,
        ACL: "public-read",
        ContentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ContentDisposition: `attachment; filename="${filename}"`,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      // Construct the file URL
      const endpoint =
        process.env.LINODE_OBJECT_STORAGE_ENDPOINT ||
        "https://in-maa-1.linodeobjects.com";
      const bucket = process.env.LINODE_OBJECT_BUCKET || "leadkart";
      const fileUrl = `${endpoint}/${bucket}/${s3Key}`;

      // Delete temporary file
      fs.unlinkSync(tempFilePath);
      tempFilePath = null;

      // Return response with file URL
      return res.status(200).json({
        success: true,
        message: "Excel file generated successfully",
        data: {
          fileUrl: fileUrl,
          filename: filename,
          recordCount: bookings.length,
          key: s3Key,
        },
      });
    } catch (error) {
      // Clean up temp file if it exists
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupError) {
          console.error("Cleanup error:", cleanupError);
        }
      }

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message: error.message || "Failed to generate Excel file",
        });
      }
    }
  }
}




module.exports = BookingController;
