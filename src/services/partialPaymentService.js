/**
 * Partial / advance payment service (50% upfront booking).
 */

const { roundCurrency } = require("./dynamicPricingService");
const { paymentHistoryModel } = require("../models/paymentHistoryModel");

const ADVANCE_PERCENT = parseFloat(process.env.ADVANCE_PAYMENT_PERCENT || "50", 10);

function calculatePaymentSplit(totalAmount, paymentPlan = "full") {
  const total = roundCurrency(totalAmount);
  if (paymentPlan !== "advance") {
    return {
      totalAmount: total,
      advanceAmount: total,
      remainingAmount: 0,
      advancePercent: 100,
      paymentPlan: "full",
      paymentStatus: "Pending",
    };
  }

  const advanceAmount = roundCurrency((total * ADVANCE_PERCENT) / 100);
  const remainingAmount = roundCurrency(total - advanceAmount);

  return {
    totalAmount: total,
    advanceAmount,
    remainingAmount,
    advancePercent: ADVANCE_PERCENT,
    paymentPlan: "advance",
    paymentStatus: "Pending",
  };
}

function mapPaymentStatusForApi(booking) {
  const status = booking.paymentStatus;
  if (status === "Partial") return "Partial Paid";
  if (status === "Paid") return "Fully Paid";
  return "Pending";
}

async function recordPaymentHistory(entry, session = null) {
  const opts = session ? { session } : {};
  return paymentHistoryModel.create([entry], opts);
}

async function getPaymentHistoryForBooking(bookingId) {
  return paymentHistoryModel
    .find({ bookingId })
    .sort({ createdAt: -1 })
    .lean();
}

async function getPaymentHistoryForUser(userId, options = {}) {
  const page = Math.max(parseInt(options.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    paymentHistoryModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    paymentHistoryModel.countDocuments({ userId }),
  ]);

  return {
    data: items,
    pagination: {
      totalItems: total,
      currentPage: page,
      pageSize: limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

module.exports = {
  ADVANCE_PERCENT,
  calculatePaymentSplit,
  mapPaymentStatusForApi,
  recordPaymentHistory,
  getPaymentHistoryForBooking,
  getPaymentHistoryForUser,
};
