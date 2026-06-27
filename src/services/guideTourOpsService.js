const Guide = require("../models/guideModel");
const { guideAllocationModel } = require("../models/guideAllocationModel");
const { bookingModel } = require("../models/bookingModel");
const { tourModel } = require("../models/tourModel");
const tourAttendanceModel = require("../models/tourAttendanceModel");
const tourBroadcastModel = require("../models/tourBroadcastModel");
const guideExpenseModel = require("../models/guideExpenseModel");
const missingPassengerAlertModel = require("../models/missingPassengerAlertModel");
const { userModel } = require("../models/userModel");
const { notifyUser, notifyAdmins } = require("./notificationDispatchService");
const tourStatusService = require("./tourStatusService");

async function getGuideFromUser(userId) {
  const guide = await Guide.findOne({ userId }).select("_id emergencyContact").lean();
  if (!guide) throw new Error("Guide profile not found");
  return guide;
}

function resolveTourIdFromAllocation(allocation) {
  if (!allocation) return null;

  const directTourId = allocation.tourId?._id || allocation.tourId;
  if (directTourId) return directTourId;

  const booking = allocation.bookingId;
  if (booking && typeof booking === "object") {
    const bookingTourId = booking.selectedTourId?._id || booking.selectedTourId;
    if (bookingTourId) return bookingTourId;
  }

  const resolvedTour = allocation.tour?._id || allocation.tour;
  if (resolvedTour) return resolvedTour;

  const bookingTour = allocation.bookingTour?._id || allocation.bookingTour;
  if (bookingTour) return bookingTour;

  return null;
}

function requireTourIdForAllocation(allocation) {
  const tourId = resolveTourIdFromAllocation(allocation);
  if (!tourId) {
    throw new Error(
      "No tour is linked to this assignment. Link a bus tour to the booking or assign the guide to a tour allocation."
    );
  }
  return tourId;
}

async function assertGuideAllocation(userId, allocationId) {
  const guide = await getGuideFromUser(userId);
  const allocation = await guideAllocationModel
    .findById(allocationId)
    .populate("tourId", "tourName temples")
    .populate({
      path: "bookingId",
      populate: { path: "selectedTourId", select: "tourName temples" },
    })
    .lean();

  if (!allocation) throw new Error("Allocation not found");
  if (String(allocation.guideId) !== String(guide._id)) {
    throw new Error("You are not assigned to this tour");
  }
  return { guide, allocation };
}

async function getPassengersFromAllocation(allocation) {
  const booking = allocation.bookingId;
  if (!booking) {
    if (allocation.bookingId && typeof allocation.bookingId === "object") {
      return buildPassengerList(allocation.bookingId);
    }
    return [];
  }
  const resolved =
    booking.travelerDetails?.length
      ? booking
      : await bookingModel.findById(booking._id || booking).lean();
  return buildPassengerList(resolved);
}

function buildPassengerList(booking) {
  const travelers = booking?.travelerDetails || [];
  return travelers.map((t, index) => ({
    passengerId: t._id?.toString() || `p-${index}`,
    name: [t.firstName, t.lastName].filter(Boolean).join(" ") || t.name || `Passenger ${index + 1}`,
    phone: t.mobileNumber || t.phone || t.contactNumber || "",
  }));
}

async function markAttendance(userId, allocationId, passengers = []) {
  const { guide, allocation } = await assertGuideAllocation(userId, allocationId);
  const tourId = requireTourIdForAllocation(allocation);

  const normalized = (passengers.length ? passengers : await getPassengersFromAllocation(allocation)).map(
    (p) => ({
      passengerId: p.passengerId,
      name: p.name,
      phone: p.phone || "",
      present: Boolean(p.present),
      checkedAt: p.present ? new Date() : undefined,
    })
  );

  const record = await tourAttendanceModel.findOneAndUpdate(
    { allocationId },
    {
      tourId,
      allocationId,
      guideId: guide._id,
      bookingId: allocation.bookingId?._id || allocation.bookingId,
      passengers: normalized,
      markedBy: userId,
    },
    { upsert: true, new: true }
  );

  return record;
}

async function getAttendance(allocationId) {
  return tourAttendanceModel.findOne({ allocationId }).lean();
}

async function sendBroadcast(userId, { tourId, allocationId, message }) {
  if (!message?.trim()) throw new Error("Message is required");
  const guide = await getGuideFromUser(userId);

  if (allocationId) {
    const { allocation } = await assertGuideAllocation(userId, allocationId);
    tourId = requireTourIdForAllocation(allocation);
  }

  if (!tourId) throw new Error("tourId or allocationId is required");

  const broadcast = await tourBroadcastModel.create({
    tourId,
    allocationId,
    guideId: guide._id,
    message: message.trim(),
    sentBy: userId,
    sentByRole: "Guide",
  });

  const tour = await tourModel.findById(tourId).select("tourName").lean();
  const bookings = await bookingModel
    .find({ selectedTourId: tourId, bookingStatus: { $in: ["Confirmed", "Completed"] } })
    .select("userId")
    .lean();

  const userIds = [...new Set(bookings.map((b) => String(b.userId)).filter(Boolean))];
  setImmediate(() => {
    userIds.forEach((uid) => {
      notifyUser(uid, {
        title: tour?.tourName ? `Update: ${tour.tourName}` : "Tour Update",
        message: message.trim(),
        type: "tour",
        redirectScreen: "TourStatus",
        meta: { tourId: String(tourId) },
      }).catch(() => {});
    });
    notifyAdmins({
      title: "Guide Broadcast Sent",
      message: message.trim(),
      type: "tour",
      meta: { tourId: String(tourId), broadcastId: String(broadcast._id) },
    }).catch(() => {});
  });

  return broadcast;
}

async function listBroadcasts(tourId, { limit = 50 } = {}) {
  return tourBroadcastModel
    .find({ tourId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("guideId", "firstName lastName")
    .lean();
}

async function createExpense(userId, payload) {
  const { allocationId, amount, description, receiptUrl } = payload;
  if (!allocationId || amount == null) throw new Error("allocationId and amount are required");

  const { guide, allocation } = await assertGuideAllocation(userId, allocationId);
  const tourId = requireTourIdForAllocation(allocation);

  const expense = await guideExpenseModel.create({
    tourId,
    allocationId,
    guideId: guide._id,
    amount: Number(amount),
    description: description || "",
    receiptUrl: receiptUrl || "",
    status: "Pending",
  });

  setImmediate(() => {
    notifyAdmins({
      title: "Guide Expense Submitted",
      message: `₹${Number(amount).toLocaleString("en-IN")} — ${description || "No description"}`,
      type: "system",
      meta: { expenseId: String(expense._id) },
    }).catch(() => {});
  });

  return expense;
}

async function listMyExpenses(userId, { limit = 50, allocationId } = {}) {
  const guide = await getGuideFromUser(userId);
  const filter = { guideId: guide._id };
  if (allocationId) filter.allocationId = allocationId;
  return guideExpenseModel
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("tourId", "tourName")
    .lean();
}

async function listPendingExpenses({ limit = 100, status } = {}) {
  const filter = status ? { status } : { status: "Pending" };
  return guideExpenseModel
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("guideId", "fullName userId")
    .populate("tourId", "tourName")
    .populate("allocationId", "startDate endDate")
    .lean();
}

async function reviewExpense(expenseId, adminUserId, { status, reviewNote }) {
  if (!["Approved", "Rejected"].includes(status)) {
    throw new Error("status must be Approved or Rejected");
  }
  const expense = await guideExpenseModel.findById(expenseId).populate("guideId", "userId");
  if (!expense) throw new Error("Expense not found");
  if (expense.status !== "Pending") throw new Error(`Expense is already ${expense.status}`);

  expense.status = status;
  expense.reviewedBy = adminUserId;
  expense.reviewNote = reviewNote || "";
  expense.reviewedAt = new Date();
  await expense.save();

  const guideUserId = expense.guideId?.userId;
  if (guideUserId) {
    setImmediate(() => {
      notifyUser(guideUserId, {
        title: `Expense ${status}`,
        message: `Your expense of ₹${expense.amount} has been ${status.toLowerCase()}.`,
        type: "system",
        redirectScreen: "GuideExpenses",
      }).catch(() => {});
    });
  }

  return expense;
}

async function triggerMissingAlert(userId, payload) {
  const { allocationId, passengerName, passengerPhone, note } = payload;
  if (!allocationId || !passengerName?.trim()) {
    throw new Error("allocationId and passengerName are required");
  }

  const { guide, allocation } = await assertGuideAllocation(userId, allocationId);
  const tourId = requireTourIdForAllocation(allocation);
  const resolvedTour =
    allocation.tourId && typeof allocation.tourId === "object"
      ? allocation.tourId
      : allocation.bookingId?.selectedTourId && typeof allocation.bookingId.selectedTourId === "object"
        ? allocation.bookingId.selectedTourId
        : null;
  const emergencyContactPhone =
    guide.emergencyContact?.phone ||
    guide.emergencyContact?.mobile ||
    resolvedTour?.emergencyContact ||
    "";

  const alert = await missingPassengerAlertModel.create({
    tourId,
    allocationId,
    guideId: guide._id,
    passengerName: passengerName.trim(),
    passengerPhone: passengerPhone || "",
    emergencyContactPhone,
    note: note || "",
    triggeredBy: userId,
    status: "Open",
  });

  const tourName = resolvedTour?.tourName || allocation.tourId?.tourName || "Tour";
  setImmediate(() => {
    notifyAdmins({
      title: "Missing Passenger Alert",
      message: `${passengerName} reported missing on ${tourName}. ${note || ""}`.trim(),
      type: "alert",
      meta: { alertId: String(alert._id), tourId: String(tourId) },
    }).catch(() => {});

    if (emergencyContactPhone) {
      console.log(
        `[MissingAlert] Emergency contact notified: ${emergencyContactPhone} for passenger ${passengerName}`
      );
    }
  });

  return alert;
}

async function templeCheckin(userId, { tourId, allocationId, statusCode, note, timestamp }) {
  if (allocationId) {
    const { allocation } = await assertGuideAllocation(userId, allocationId);
    tourId = requireTourIdForAllocation(allocation);
  }
  if (!tourId) throw new Error("tourId or allocationId is required");

  return tourStatusService.updateTourStatus({
    tourId,
    statusCode: statusCode || "REACHED_TEMPLE",
    note,
    updatedBy: userId,
    timestamp,
  });
}

async function getAgentHomeAlerts(userId) {
  const [upcomingBookings, wallet] = await Promise.all([
    bookingModel
      .find({
        assignedAgent: userId,
        bookingStatus: { $in: ["Confirmed", "Pending"] },
        travelStartDate: { $gte: new Date() },
      })
      .sort({ travelStartDate: 1 })
      .limit(1)
      .populate("selectedTourId", "tourName")
      .lean(),
    require("../models/agentModel").agentModel.findOne({ userId }).select("wallet").lean(),
  ]);

  const pendingPayments = await bookingModel
    .find({
      assignedAgent: userId,
      paymentStatus: { $in: ["Pending", "Partially Paid"] },
      bookingStatus: { $ne: "Cancelled" },
    })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  const banners = [];

  if (upcomingBookings.length) {
    const b = upcomingBookings[0];
    banners.push({
      id: `upcoming-${b._id}`,
      type: "upcoming_tour",
      title: "Upcoming Tour",
      message: `${b.selectedTourId?.tourName || b.packageName || "Tour"} on ${new Date(b.travelStartDate).toLocaleDateString("en-IN")}`,
      meta: { bookingId: String(b._id) },
    });
  }

  if (pendingPayments.length) {
    const totalPending = pendingPayments.reduce(
      (sum, b) => sum + Math.max(0, (b.finalAmount || b.totalAmount || 0) - (b.paidAmount || 0)),
      0
    );
    banners.push({
      id: "pending-payment",
      type: "pending_payment",
      title: "Pending Payment",
      message: `${pendingPayments.length} booking(s) with ₹${totalPending.toLocaleString("en-IN")} pending`,
      meta: { count: pendingPayments.length },
    });
  }

  return { banners, walletBalance: wallet?.wallet || 0 };
}

module.exports = {
  markAttendance,
  getAttendance,
  sendBroadcast,
  listBroadcasts,
  createExpense,
  listMyExpenses,
  listPendingExpenses,
  reviewExpense,
  triggerMissingAlert,
  templeCheckin,
  getAgentHomeAlerts,
  assertGuideAllocation,
};
