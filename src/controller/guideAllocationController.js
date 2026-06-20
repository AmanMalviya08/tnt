const { guideAllocationModel } = require("../models/guideAllocationModel");
const emailService = require("../services/emailService");
const Guide = require("../models/guideModel");
const { bookingModel } = require("../models/bookingModel");
const { notifyUser } = require("../services/notificationDispatchService");
const mongoose = require("mongoose");


class GuideAllocationController {
  constructor(model = guideAllocationModel) {
    this.model = model;
  }

  static joinMeetingPoints(value) {
    if (!value) return null;
    if (Array.isArray(value)) {
      const points = value.filter(Boolean).map(String);
      return points.length ? points.join(", ") : null;
    }
    return String(value).trim() || null;
  }

  static resolveGuestCount({ booking, tour, bookingTour } = {}) {
    if (booking?.numberOfTravelers) return booking.numberOfTravelers;
    if (booking?.travelerDetails?.length) return booking.travelerDetails.length;
    const adults = Number(booking?.adults) || 0;
    const children = Number(booking?.children) || 0;
    if (adults + children > 0) return adults + children;
    if (tour?.totalSeats) return tour.totalSeats;
    if (bookingTour?.totalSeats) return bookingTour.totalSeats;
    return null;
  }

  static resolvePickupTime({ tour, bookingTour } = {}) {
    return tour?.pickupTime || bookingTour?.pickupTime || null;
  }

  static resolveMeetingPoint({ tour, bookingTour, pkg, city } = {}) {
    return (
      GuideAllocationController.joinMeetingPoints(tour?.meetingPoint)
      || GuideAllocationController.joinMeetingPoints(bookingTour?.meetingPoint)
      || pkg?.pickupPoint
      || city?.cityName
      || null
    );
  }

  formatAllocationSummary(item = {}) {
    const tour = item.tour || null;
    const bookingTour = item.bookingTour || null;
    const booking = item.booking || null;
    const pkg = item.package || null;
    const city = item.city || null;

    return {
      ...item,
      pickupTime: item.pickupTime
        || GuideAllocationController.resolvePickupTime({ tour, bookingTour }),
      numberOfPeople: item.numberOfPeople
        ?? GuideAllocationController.resolveGuestCount({ booking, tour, bookingTour }),
      meetingPoint: GuideAllocationController.resolveMeetingPoint({
        tour,
        bookingTour,
        pkg,
        city,
      }) || item.meetingPoint || null,
      tour: undefined,
      booking: undefined,
      bookingTour: undefined,
      package: undefined,
      city: undefined,
      _tourMeetingPoint: undefined,
      _bookingTourMeetingPoint: undefined,
      _packagePickupPoint: undefined,
      _cityName: undefined,
    };
  }

  async createAllocation(payload) {
    let checkOr = [];

    if (payload.tourId) {
      checkOr.push({ tourId: payload.tourId });
    }

    if (payload.bookingId) {
      checkOr.push({ bookingId: payload.bookingId });
    }

    const isExist = await this.model.findOne({ $or: checkOr });

    // Initialize itineraryStatus if it's a new allocation or if it doesn't exist
    if (!isExist || !isExist.itineraryStatus || isExist.itineraryStatus.length === 0) {
      let itinerary = [];
      if (payload.bookingId) {
        const { bookingModel } = require("../models/bookingModel");
        const booking = await bookingModel.findById(payload.bookingId).populate("selectedPackageId");
        if (booking?.selectedPackageId?.itinerary) {
          itinerary = booking.selectedPackageId.itinerary;
        }
      } else if (payload.tourId) {
        const { tourModel } = require("../models/tourModel");
        const tour = await tourModel.findById(payload.tourId).populate("packageId");
        if (tour?.packageId?.itinerary) {
          itinerary = tour.packageId.itinerary;
        }
      }

      if (itinerary.length > 0) {
        payload.itineraryStatus = itinerary.map((item) => ({
          dayNumber: item.dayNumber,
          dayTitle: item.dayTitle,
          status: "Pending",
        }));
      }
    }

    let allocation;
    if (isExist) {
      // Preserve itineraryStatus if it already exists
      const updateData = { ...payload };
      if (isExist.itineraryStatus && isExist.itineraryStatus.length > 0) {
        delete updateData.itineraryStatus;
      }

      allocation = await this.model
        .findOneAndUpdate({ _id: isExist._id }, updateData, { new: true, runValidators: true })
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

    const shouldNotifyApp = payload.notifyApp !== false;
    if (shouldNotifyApp && allocation?.guideId) {
      const guideDoc = await Guide.findById(allocation.guideId).select("userId fullName");
      if (guideDoc?.userId) {
        const tour = allocation.tourId && typeof allocation.tourId === "object" ? allocation.tourId : null;
        const booking = allocation.bookingId && typeof allocation.bookingId === "object" ? allocation.bookingId : null;
        const tourName = tour?.tourName || booking?.customerName || "a new tour";
        setImmediate(() => {
          notifyUser(guideDoc.userId, {
            title: "New Tour Assigned",
            message: `You have been assigned to ${tourName}. Open the app to view details.`,
            type: "tour",
            redirectScreen: "GuideViewDetails",
            redirectParams: { allocationId: allocation._id?.toString() },
            meta: {
              category: "tour",
              allocationId: allocation._id?.toString(),
              assignmentType: allocation.assignmentType || null,
            },
          }).catch((err) => console.error("[Notify] Guide allocation:", err.message));
        });
      }
    }

    const bookingRef = payload.bookingId || allocation.bookingId;
    if (bookingRef) {
      setImmediate(async () => {
        try {
          const { creditGuideCommissionForBooking } = require("../services/guideCommissionService");
          await creditGuideCommissionForBooking(bookingRef, { trigger: "payment" });
        } catch (err) {
          console.error("[createAllocation] Guide commission credit failed:", err.message);
        }
      });
    }

    console.log(allocation);
    return allocation;
  }

  async getAllocations(filter = {}, options = {}) {
    if (filter.search) {
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
    const allocation = await this.model
      .findById(id)
      .populate("guideId", "fullName email phone userId")
      .populate("tourId")
      .populate({
        path: "bookingId",
        populate: [
          { path: "selectedPackageId" },
          { path: "selectedTourId" },
          { path: "cityId", select: "cityName" },
        ],
      })
      .populate("assignedBy", "firstName lastName email")
      .lean();

    if (!allocation) return null;

    const tour = allocation.tourId && typeof allocation.tourId === "object" ? allocation.tourId : null;
    const booking = allocation.bookingId && typeof allocation.bookingId === "object" ? allocation.bookingId : null;
    let pkg = booking?.selectedPackageId && typeof booking.selectedPackageId === "object"
      ? booking.selectedPackageId
      : null;

    if (!pkg && tour?.packageId) {
      const { packageModel } = require("../models/packageModel");
      pkg = await packageModel.findById(tour.packageId).lean();
    }

    const name = tour?.tourName || pkg?.packageName || booking?.customerName || "Tour";
    const packageItinerary = pkg?.itinerary || [];
    const statusItems = allocation.itineraryStatus || [];

    const mergedItinerary = packageItinerary.length
      ? packageItinerary.map((day) => {
          const statusDay = statusItems.find((s) => s.dayNumber === day.dayNumber) || {};
          return {
            dayNumber: day.dayNumber,
            dayTitle: day.dayTitle || statusDay.dayTitle,
            time: day.startTime || day.time || day.dayTitle || null,
            subtitle: day.location || day.destination || day.placeName || "",
            description: day.description || day.activities || statusDay.notes || "",
            status: statusDay.status || "Pending",
            notes: statusDay.notes || null,
          };
        })
      : statusItems.map((day) => ({
          dayNumber: day.dayNumber,
          dayTitle: day.dayTitle,
          time: day.dayTitle,
          subtitle: "",
          description: day.notes || "",
          status: day.status || "Pending",
          notes: day.notes || null,
        }));

    const guideObjectId = allocation.guideId?._id || allocation.guideId;
    const tourObjectId = tour?._id || allocation.tourId;
    const bookingObjectId = booking?._id || allocation.bookingId;

    const Review = mongoose.model("Review");
    const GuideTourLogController = require("./guideTourLogController");
    const tourLogController = new GuideTourLogController();

    if (booking?.paymentStatus === "Paid") {
      try {
        const { creditGuideCommissionForAllocation } = require("../services/guideCommissionService");
        await creditGuideCommissionForAllocation(allocation, booking, { trigger: "payment" });
      } catch (commissionErr) {
        console.error("[getAllocationById] Guide commission credit failed:", commissionErr.message);
      }
    }

    const reviewFilter = { guideId: guideObjectId };
    const reviewOr = [];
    if (tourObjectId) reviewOr.push({ tourId: tourObjectId });
    if (bookingObjectId) reviewOr.push({ bookingId: bookingObjectId });
    if (reviewOr.length) reviewFilter.$or = reviewOr;

    const [reviews, tourLogs, commissionTxn] = await Promise.all([
      Review.find(reviewFilter)
        .populate("userId", "firstName lastName avatarUrl phone")
        .sort({ createdAt: -1 })
        .lean(),
      tourLogController.getLogsByAllocation(allocation._id),
      mongoose.model("Transaction").findOne({
        allocationId: allocation._id,
        guideId: guideObjectId,
        category: "Guide Commission",
      }).select("amount commissionPercent bookingAmount status").lean(),
    ]);

    const itineraryNotes = statusItems
      .map((day) => day.notes)
      .filter(Boolean)
      .join(" ");
    const tourLogFeedback = tourLogs.map((log) => log.feedback).filter(Boolean).join(" ");
    const tourPhotos = tourLogs.flatMap((log) => (log.images || []).map((img) => img.url));

    const resolvedTour = tour
      || (booking?.selectedTourId && typeof booking.selectedTourId === "object"
        ? booking.selectedTourId
        : null);
    const city = booking?.cityId && typeof booking.cityId === "object" ? booking.cityId : null;

    return {
      ...allocation,
      name,
      tourStartDate: (resolvedTour || tour)?.startDate || booking?.travelStartDate || allocation.startDate,
      pickupTime: GuideAllocationController.resolvePickupTime({
        tour: tour || resolvedTour,
        bookingTour: resolvedTour && !tour ? resolvedTour : null,
      }),
      meetingPoint: GuideAllocationController.resolveMeetingPoint({
        tour: tour || resolvedTour,
        bookingTour: resolvedTour && !tour ? resolvedTour : null,
        pkg,
        city,
      }),
      numberOfPeople: GuideAllocationController.resolveGuestCount({
        booking,
        tour: tour || resolvedTour,
        bookingTour: resolvedTour,
      }),
      coverImage: tour?.coverImage || pkg?.coverImage || null,
      durationInDays: tour?.durationInDays || pkg?.durationInDays || booking?.durationInDays || null,
      packageItinerary: mergedItinerary,
      booking,
      tour,
      package: pkg,
      reviews,
      tourLogs,
      tourPhotos,
      fieldReport: tourLogFeedback || itineraryNotes || allocation.notes || null,
      tourSummary: tour?.description || pkg?.description || booking?.specialRequests || null,
      commission: commissionTxn
        ? {
            amount: commissionTxn.amount || 0,
            percent: commissionTxn.commissionPercent || 0,
            bookingAmount: commissionTxn.bookingAmount || 0,
            status: commissionTxn.status || null,
          }
        : null,
    };
  }

  async updateAllocation(id, payload) {
    return this.model.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  }

  async deleteAllocation(id) {
    return this.model.findByIdAndDelete(id);
  }

  async getAllocationsByGuideUserId(userId, filter = {}, options = {}) {

    const guide = await Guide.findOne({ userId });

    if (!guide) {
      throw new Error("Guide profile not found for this user");
    }

    const guideObjectId = new mongoose.Types.ObjectId(guide._id);

    // Pagination
    const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);
    const parsedPage = parseInt(options.page, 10);
    const parsedLimit = parseInt(options.limit, 10);
    const pageSize = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE;
    const currentPage = !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    // Sort
    let sortField = options.sort || options.sortBy || "createdAt";
    const sortDirection = (options.sortOrder || options.order || "").toLowerCase() === "asc" ? 1 : -1;

    // Match filter
    const matchFilter = { guideId: guideObjectId };
    if (filter.status) {
      if (Array.isArray(filter.status)) {
        matchFilter.status = { $in: filter.status };
      } else {
        matchFilter.status = filter.status;
      }
    }
    if (filter.assignmentType) matchFilter.assignmentType = filter.assignmentType;

    const pipeline = [
      { $match: matchFilter },
      { $sort: { [sortField]: sortDirection } },

      // ── Lookup Tour details ──
      {
        $lookup: {
          from: "tours",
          localField: "tourId",
          foreignField: "_id",
          as: "tour",
        },
      },
      { $unwind: { path: "$tour", preserveNullAndEmptyArrays: true } },

      // ── Lookup Booking details ──
      {
        $lookup: {
          from: "bookings",
          localField: "bookingId",
          foreignField: "_id",
          as: "booking",
        },
      },
      { $unwind: { path: "$booking", preserveNullAndEmptyArrays: true } },

      // ── Lookup Package via booking.selectedPackageId ──
      {
        $lookup: {
          from: "packages",
          localField: "booking.selectedPackageId",
          foreignField: "_id",
          as: "package",
        },
      },
      { $unwind: { path: "$package", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "tours",
          localField: "booking.selectedTourId",
          foreignField: "_id",
          as: "bookingTour",
        },
      },
      { $unwind: { path: "$bookingTour", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "cities",
          localField: "booking.cityId",
          foreignField: "_id",
          as: "city",
        },
      },
      { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },

      // ── Lookup Guide Commission from Transactions ──
      {
        $lookup: {
          from: "transactions",
          let: { allocId: "$_id", gId: "$guideId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$allocationId", "$$allocId"] },
                    { $eq: ["$guideId", "$$gId"] },
                    { $eq: ["$category", "Guide Commission"] },
                  ],
                },
              },
            },
            { $project: { amount: 1, commissionPercent: 1, bookingAmount: 1, status: 1 } },
          ],
          as: "commissionTxn",
        },
      },
      { $unwind: { path: "$commissionTxn", preserveNullAndEmptyArrays: true } },

      // ── Lookup Review (user rating for this guide on this tour/booking) ──
      {
        $lookup: {
          from: "reviews",
          let: {
            gId: "$guideId",
            tId: "$tourId",
            bId: "$bookingId",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$guideId", "$$gId"] },
                    {
                      $or: [
                        { $eq: ["$tourId", "$$tId"] },
                        { $eq: ["$bookingId", "$$bId"] },
                      ],
                    },
                  ],
                },
              },
            },
            { $project: { rating: 1, review: 1, userId: 1 } },
          ],
          as: "reviews",
        },
      },

      // ── Final projection ──
      {
        $facet: {
          metadata: [{ $count: "totalItems" }],
          data: [
            { $skip: (currentPage - 1) * pageSize },
            { $limit: pageSize },
            {
              $project: {
                _id: 1,
                assignmentType: 1,
                status: 1,
                startDate: 1,
                endDate: 1,
                isPrimaryGuide: 1,
                notes: 1,
                itineraryStatus: 1,
                createdAt: 1,

                // Tour / Package name
                name: {
                  $cond: {
                    if: { $ifNull: ["$tour", false] },
                    then: "$tour.tourName",
                    else: {
                      $cond: {
                        if: { $ifNull: ["$package", false] },
                        then: "$package.packageName",
                        else: { $ifNull: ["$booking.customerName", "N/A"] },
                      },
                    },
                  },
                },

                // Duration
                durationInDays: {
                  $cond: {
                    if: { $ifNull: ["$tour.durationInDays", false] },
                    then: "$tour.durationInDays",
                    else: { $ifNull: ["$booking.durationInDays", null] },
                  },
                },

                // Number of people
                numberOfPeople: {
                  $let: {
                    vars: {
                      travelers: { $ifNull: ["$booking.numberOfTravelers", 0] },
                      detailsCount: { $size: { $ifNull: ["$booking.travelerDetails", []] } },
                      adults: { $ifNull: ["$booking.adults", 0] },
                      children: { $ifNull: ["$booking.children", 0] },
                    },
                    in: {
                      $cond: {
                        if: { $gt: ["$$travelers", 0] },
                        then: "$$travelers",
                        else: {
                          $cond: {
                            if: { $gt: ["$$detailsCount", 0] },
                            then: "$$detailsCount",
                            else: {
                              $cond: {
                                if: { $gt: [{ $add: ["$$adults", "$$children"] }, 0] },
                                then: { $add: ["$$adults", "$$children"] },
                                else: { $ifNull: ["$tour.totalSeats", "$bookingTour.totalSeats"] },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },

                // Tour start date (from tour or booking travel date)
                tourStartDate: {
                  $cond: {
                    if: { $ifNull: ["$tour.startDate", false] },
                    then: "$tour.startDate",
                    else: { $ifNull: ["$booking.travelStartDate", "$startDate"] },
                  },
                },

                // Commission
                commission: {
                  amount: { $ifNull: ["$commissionTxn.amount", 0] },
                  percent: { $ifNull: ["$commissionTxn.commissionPercent", 0] },
                  bookingAmount: { $ifNull: ["$commissionTxn.bookingAmount", 0] },
                  status: { $ifNull: ["$commissionTxn.status", null] },
                },

                // User rating for this allocation
                reviews: 1,

                // Tour / Booking IDs for reference
                tourId: { $ifNull: ["$tour._id", null] },
                bookingId: { $ifNull: ["$booking._id", null] },
                bookingRef: { $ifNull: ["$booking.bookingId", null] },

                // Tour cover image
                coverImage: { $ifNull: ["$tour.coverImage", null] },

                // Tour starting time & pickup location
                pickupTime: { $ifNull: ["$tour.pickupTime", "$bookingTour.pickupTime"] },
                meetingPoint: {
                  $ifNull: [
                    "$package.pickupPoint",
                    "$city.cityName",
                  ],
                },
                tour: 1,
                booking: 1,
                bookingTour: 1,
                package: 1,
                city: 1,
              },
            },
          ],
        },
      },
    ];

    const result = await this.model.aggregate(pipeline);

    const totalItems = result[0].metadata[0]?.totalItems || 0;
    const allocations = (result[0].data || []).map((item) => this.formatAllocationSummary(item));
    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

    return {
      data: allocations,
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

  async getGuideAllocationHistory(userId, filter = {}, options = {}) {
    if (!filter.status) {
      filter.status = ["Completed", "Cancelled"];
    } else if (typeof filter.status === "string") {
      filter.status = [filter.status];
    }
    return this.getAllocationsByGuideUserId(userId, filter, options);
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
        try { fs.unlinkSync(tempFilePath); } catch (e) { }
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
      { path: "guideId", select: "fullName email userId" },
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
        await emailService.sendGuideAllocationEmail(allocation.guideId.email, allocation);
      } catch (emailError) {
        console.error("Failed to send guide transfer email:", emailError.message);
      }
    }

    if (allocation.guideId?.userId) {
      const tourName = allocation.tourId?.tourName
        || allocation.bookingId?.selectedPackageId?.packageName
        || allocation.bookingId?.customerName
        || "a tour";
      setImmediate(() => {
        notifyUser(allocation.guideId.userId, {
          title: "Tour Transferred to You",
          message: `A tour has been transferred to you: ${tourName}.`,
          type: "tour",
          redirectScreen: "GuideViewDetails",
          redirectParams: { allocationId: allocation._id?.toString() },
          meta: {
            category: "tour",
            allocationId: allocation._id?.toString(),
          },
        }).catch((err) => console.error("[Notify] Guide transfer:", err.message));
      });
    }

    return allocation;
  }

  async updateItineraryDay(id, dayNumber, updateData) {
    const allocation = await this.model.findById(id);
    if (!allocation) {
      throw new Error("Guide allocation not found");
    }

    if (!allocation.itineraryStatus || allocation.itineraryStatus.length === 0) {
      throw new Error("No itinerary found for this allocation");
    }

    if (allocation.status !== "Active") {
      throw new Error("Guide allocation is not active");
    }

    const day = allocation.itineraryStatus.find((d) => d.dayNumber === parseInt(dayNumber, 10));
    if (!day) {
      throw new Error(`Day ${dayNumber} not found in itinerary`);
    }

    if (updateData.status) {
      day.status = updateData.status;
      if (updateData.status === "Completed") {
        day.completedAt = new Date();
      }
    }

    if (updateData.notes !== undefined) {
      day.notes = updateData.notes;
    }

    // Check if all days are completed
    const allCompleted = allocation.itineraryStatus.every((d) => d.status === "Completed");
    if (allCompleted) {
      allocation.status = "Completed";
    }

    await allocation.save();

    // Auto-credit guide wallet on allocation completion
  
    if (allCompleted && allocation.bookingId) {
      console.log("All days are completed, crediting guide commission");
      try {
        await this._creditGuideCommission(allocation);
      } catch (commissionError) {
        console.error("Failed to credit guide commission:", commissionError.message);
      }
    }

    return allocation;
  }

  async _creditGuideCommission(allocation) {
    const { creditGuideCommissionForAllocation } = require("../services/guideCommissionService");
    const booking = await bookingModel.findById(allocation.bookingId).lean();
    await creditGuideCommissionForAllocation(allocation, booking, { trigger: "completion" });
  }

  async updateAllocationStatus(id, payload, user) {
    const { status } = payload;
    const allocation = await this.model.findById(id);

    if (!allocation) {
      throw new Error("Guide allocation not found");
    }

    if (user.role === "Guide") {
      const guide = await Guide.findOne({ userId: user.userId });

      if (!guide || allocation.guideId.toString() !== guide._id.toString()) {
        throw new Error("You are not authorized to update this allocation status");
      }

      // Business Logic: if status is Active, guide cannot Cancel
      if (allocation.status === "Active" && status === "Cancelled") {
        throw new Error("You cannot cancel an allocation that is already active");
      }
    }

    allocation.status = status;
    await allocation.save();

    return allocation;
  }
}

module.exports = GuideAllocationController;
