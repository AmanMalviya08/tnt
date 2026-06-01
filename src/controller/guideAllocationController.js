const { guideAllocationModel } = require("../models/guideAllocationModel");
const emailService = require("../services/emailService");

class GuideAllocationController {
  constructor(model = guideAllocationModel) {
    this.model = model;
  }

  async createAllocation(payload) {

    let checkOr = [];

    if (payload.tourId) {
      checkOr.push({ tourId: payload.tourId });
    }

    if (payload.bookingId) {
      checkOr.push({ bookingId: payload.bookingId });
    }

    const isExist = await this.model.findOne(
      { $or: checkOr }
    );

    console.log("check", isExist)
    let allocation = []
    if (isExist) {
      allocation = await this.model
        .findOneAndReplace({ _id: isExist._id }, payload, { new: true })
        .populate("guideId", "fullName email");
    } else {
      allocation = await this.model.create(payload);
      allocation = await allocation.populate("guideId", "fullName email");
    }

    // Send allocation notification email (if requested)
    const notification = payload.notification;
    let recipientEmail;

    if (notification) {
      if (typeof notification === "string") {
        // Allow passing "email" or direct email address
        if (notification.toLowerCase() === "email") {
          recipientEmail = allocation.guideId?.email;
        } else if (notification.includes("@")) {
          recipientEmail = notification;
        }
      } else if (typeof notification === "object" && notification.email) {
        recipientEmail = notification.email;
      }
    }

    if (recipientEmail) {
      try {
        await emailService.sendGuideAllocationEmail(recipientEmail, allocation);
      } catch (emailError) {
        console.error("Failed to send guide allocation email:", emailError.message);
      }
    }

    console.log(allocation);
    return allocation;
  }

  async getAllocations(filter = {}, options = {}) {
    if (filter.search) {
      const Guide = require("../models/guideModel");
      const { tourModel } = require("../models/tourModel");

      const [guides, tours] = await Promise.all([
        Guide.find({ fullName: { $regex: filter.search, $options: "i" } }, "_id"),
        tourModel.find({ tourName: { $regex: filter.search, $options: "i" } }, "_id")
      ]);

      filter.$or = [
        { guideId: { $in: guides.map(g => g._id) } },
        { tourId: { $in: tours.map(t => t._id) } }
      ];

      delete filter.search;
    }

    const query = this.model
      .find(filter)
      .populate("guideId", "fullName email phone")
      .populate("tourId")
      .populate("bookingId")
      .populate("assignedBy", "firstName lastName email");

    // if (options.sort) {
    //   query.sort(options.sort);
    // }

    let sort = options.sort || options.sortBy;
    if (typeof sort === "string" && sort.trim()) {
      const order = options.sortOrder || options.order;
      const direction = typeof order === "string" && order.toLowerCase() === "desc" ? -1 : 1;
      query.sort({ [sort]: direction });
    } else {
      query.sort({ createdAt: -1 });
    }


    // if (!sort) {
    //   query.sort = { createdAt: -1 };
    // }
    // console.log(query.sort)
    if (options.limit) {
      const limit = parseInt(options.limit, 10);
      if (!Number.isNaN(limit)) {
        query.limit(limit);
      }
    }

    if (options.page && options.limit) {
      const page = Math.max(parseInt(options.page, 10), 1);
      const limit = parseInt(options.limit, 10);
      if (!Number.isNaN(page) && !Number.isNaN(limit)) {
        query.skip((page - 1) * limit);
      }
    }

    return query;
  }

  async getAllocationById(id) {
    return this.model
      .findById(id)
      .populate("guideId", "fullName email phone")
      .populate("tourId")
      .populate("bookingId")
      .populate("assignedBy", "firstName lastName email");
  }

  async updateAllocation(id, payload) {
    return this.model.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  }

  async deleteAllocation(id) {
    return this.model.findByIdAndDelete(id);
  }

  async exportGuideAllocationsExcel(req, res) {
    let tempFilePath = null;
    const fs = require("fs");
    const path = require("path");

    try {
      const allocations = await this.model
        .find()
        .populate("guideId", "fullName email phone")
        .populate("tourId", "tourName")
        .populate("bookingId", "bookingId customerName")
        .populate("assignedBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .lean();

      if (!allocations.length) {
        return res.status(404).json({
          success: false,
          message: "No guide allocations found",
        });
      }

      const ExcelJS = require("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("GuideAllocations");

      const allKeys = new Set();
      allocations.forEach((a) => Object.keys(a).forEach((k) => allKeys.add(k)));
      
      allKeys.add("GuideName");
      allKeys.add("TourName");
      allKeys.add("BookingID");
      allKeys.add("AssignedBy");
      
      const keysArray = Array.from(allKeys);

      worksheet.columns = keysArray.map((key) => ({
        header: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1").trim(),
        key: key,
      }));

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };

      allocations.forEach((a) => {
        const rowData = {};
        keysArray.forEach((key) => {
          let val = a[key];
          
          if (key === "GuideName") {
            val = a.guideId ? a.guideId.fullName : "-";
          } else if (key === "TourName") {
            val = a.tourId ? a.tourId.tourName : "-";
          } else if (key === "BookingID") {
            val = a.bookingId ? a.bookingId.bookingId : "-";
          } else if (key === "AssignedBy") {
            val = a.assignedBy ? `${a.assignedBy.firstName || ""} ${a.assignedBy.lastName || ""}`.trim() : "-";
          } else if ((key === "guideId" || key === "tourId" || key === "bookingId" || key === "assignedBy") && typeof val === "object") {
            val = val._id ? val._id.toString() : "-";
          }
          
          if (val === null || val === undefined) {
            rowData[key] = "-";
          } else if (val instanceof Date) {
            rowData[key] = val.toLocaleString("en-IN");
          } else if (typeof val === "object") {
            rowData[key] = JSON.stringify(val);
          } else {
            rowData[key] = val.toString();
          }
        });
        worksheet.addRow(rowData);
      });

      worksheet.columns.forEach((column) => {
        column.width = 25;
      });

      const timestamp = new Date().toISOString().split("T")[0];
      const uniqueId = Date.now();
      const filename = `GuideAllocations_${timestamp}_${uniqueId}.xlsx`;

      const tempDir = path.join(__dirname, "../../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      tempFilePath = path.join(tempDir, filename);
      await workbook.xlsx.writeFile(tempFilePath);

      const fileBuffer = fs.readFileSync(tempFilePath);

      const { s3Client } = require("../middleware/s3Upload");
      const { PutObjectCommand } = require("@aws-sdk/client-s3");

      const folderPath = process.env.BUCKET_FOLDER_PATH || "TourTravels/";
      const s3Key = `${folderPath}EXCEL/${filename}`;

      const uploadParams = {
          Bucket: process.env.LINODE_OBJECT_BUCKET,
          Key: s3Key,
          Body: fileBuffer,
          ACL: "public-read",
          ContentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ContentDisposition: `attachment; filename="${filename}"`,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      const endpoint = process.env.LINODE_OBJECT_STORAGE_ENDPOINT;
      const bucket = process.env.LINODE_OBJECT_BUCKET;
      const fileUrl = `${endpoint}/${bucket}/${s3Key}`;

      fs.unlinkSync(tempFilePath);
      tempFilePath = null;

      return res.status(200).json({
          success: true,
          message: "Guide allocations exported to Excel successfully",
          data: {
              fileUrl,
              filename,
              recordCount: allocations.length,
              key: s3Key,
          },
      });
    } catch (error) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
          try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
      return res.status(500).json({
          success: false,
          message: error.message || "Failed to export guide allocations",
      });
    }
  }

  async transferGuide(id, transferPayload) {
    let allocation = await this.model.findById(id);
    if (!allocation) {
      return null;
    }

    if (!transferPayload || !transferPayload.toGuideId) {
      throw new Error("toGuideId is required for guide transfer");
    }

    const transferRecord = {
      fromGuideId: allocation.guideId,
      toGuideId: transferPayload.toGuideId,
      reason: transferPayload.reason,
      transferredBy: transferPayload.transferredBy,
      transferredAt: new Date(),
    };

    allocation.transferHistory.push(transferRecord);
    allocation.guideId = transferPayload.toGuideId;
    allocation.lastTransferredAt = transferRecord.transferredAt;
    allocation.transferReason = transferPayload.reason;

    if (transferPayload.status) {
      allocation.status = transferPayload.status;
    }

    if (transferPayload.notes) {
      allocation.notes = transferPayload.notes;
    }
    await allocation.save();

    // Populate the new guide's details, tour/package, and booking (with selected package) for email
    allocation = await allocation.populate([
      { path: "guideId", select: "fullName email" },
      { path: "tourId", populate: { path: "packageId", select: "packageName durationDays basePricePerPerson" } },
      {
        path: "bookingId",
        select: "bookingId customerName mobileNumber email bookingType numberOfTravelers totalAmount travelStartDate travelEndDate selectedPackageId",
        populate: { path: "selectedPackageId", select: "packageName durationDays basePricePerPerson" },
      },
    ]);

    // console.log("Guide transferred:", allocation);

    // Send email to the new guide with allocation + tour/package info
    if (allocation.guideId?.email) {
      try {
        const temp = await emailService.sendGuideAllocationEmail(allocation.guideId.email, allocation);
        // console.log("Guide transfer email sent:", temp);
      } catch (emailError) {
        // console.error("Failed to send guide transfer email:", emailError.message);
      }
    }

    return allocation;
  }
}

module.exports = GuideAllocationController;
