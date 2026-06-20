const mongoose = require("mongoose");
const { guideAllocationModel } = require("../models/guideAllocationModel");
const { bookingModel } = require("../models/bookingModel");
const Company = require("../models/companyModel");
const Guide = require("../models/guideModel");
const { guideWalletModel } = require("../models/guideWalletModel");
const Transaction = require("../models/transactionModel");
const { notifyUser, formatInr } = require("./notificationDispatchService");

const resolveBookingAmount = (booking) =>
  Number(booking?.finalAmount ?? booking?.totalAmount ?? 0);

/**
 * Credit guide commission for a single allocation when booking is paid.
 * Skips if commission was already credited for this allocation.
 */
async function creditGuideCommissionForAllocation(allocation, booking, options = {}) {
  const allocationId = allocation._id || allocation.id;
  const guideId = allocation.guideId?._id || allocation.guideId;
  const bookingId = allocation.bookingId?._id || allocation.bookingId || booking?._id;

  const [resolvedBooking, company, guide, existingTransaction] = await Promise.all([
    booking?.paymentStatus
      ? Promise.resolve(booking)
      : bookingModel.findById(bookingId).lean(),
    Company.findOne().lean(),
    Guide.findById(guideId).lean(),
    Transaction.findOne({ allocationId, category: "Guide Commission" }).lean(),
  ]);

  if (existingTransaction) {
    return { skipped: true, reason: "already_credited", allocationId };
  }

  if (!resolvedBooking || resolvedBooking.paymentStatus !== "Paid") {
    return { skipped: true, reason: "booking_not_paid", allocationId };
  }

  const bookingAmount = resolveBookingAmount(resolvedBooking);
  if (!bookingAmount) {
    return { skipped: true, reason: "no_booking_amount", allocationId };
  }

  if (!company?.guideCommission || company.guideCommission <= 0) {
    return { skipped: true, reason: "no_commission_config", allocationId };
  }

  if (!guide) {
    return { skipped: true, reason: "guide_not_found", allocationId };
  }

  const commissionPercent = company.guideCommission;
  const commissionAmount =
    Math.round((bookingAmount * commissionPercent) / 100 * 100) / 100;

  if (commissionAmount <= 0) {
    return { skipped: true, reason: "zero_commission", allocationId };
  }

  const trigger = options.trigger || "payment";
  const notificationMessage =
    trigger === "completion"
      ? `${formatInr(commissionAmount)} has been added to your wallet for completing the tour.`
      : `${formatInr(commissionAmount)} commission has been credited to your wallet — booking payment received.`;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await guideWalletModel.findOneAndUpdate(
      { guideId },
      { $inc: { balance: commissionAmount, totalEarnings: commissionAmount } },
      { upsert: true, session },
    );

    await Transaction.create(
      [
        {
          userId: guide.userId,
          guideId,
          allocationId,
          bookingId: resolvedBooking._id,
          amount: commissionAmount,
          type: "Credit",
          category: "Guide Commission",
          status: "Completed",
          commissionPercent,
          bookingAmount,
          description: `Guide commission ${commissionPercent}% on booking ${resolvedBooking.bookingId || resolvedBooking._id} — ₹${bookingAmount} × ${commissionPercent}% = ₹${commissionAmount}`,
          createdBy: guide.userId,
        },
      ],
      { session },
    );

    await session.commitTransaction();
    console.log(
      `[guideCommission] ₹${commissionAmount} credited to guide ${guide.fullName || guideId}`,
    );

    if (guide.userId) {
      setImmediate(() => {
        notifyUser(guide.userId, {
          title: "Commission Credited",
          message: notificationMessage,
          type: "reward",
          redirectScreen: "Payment",
          meta: {
            category: "payment",
            allocationId: allocationId?.toString(),
            amount: commissionAmount,
          },
        }).catch((err) => console.error("[Notify] Guide commission:", err.message));
      });
    }

    return {
      credited: true,
      allocationId,
      guideId,
      amount: commissionAmount,
      commissionPercent,
      bookingAmount,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Credit commission for all guide allocations linked to a paid booking.
 */
async function creditGuideCommissionForBooking(bookingId, options = {}) {
  const booking = await bookingModel.findById(bookingId).lean();
  if (!booking) {
    return { credited: [], skipped: true, reason: "booking_not_found" };
  }

  if (booking.paymentStatus !== "Paid") {
    return { credited: [], skipped: true, reason: "booking_not_paid" };
  }

  const allocations = await guideAllocationModel
    .find({ bookingId: booking._id })
    .lean();

  if (!allocations.length) {
    return { credited: [], skipped: true, reason: "no_allocations" };
  }

  const results = [];
  for (const allocation of allocations) {
    try {
      const result = await creditGuideCommissionForAllocation(
        allocation,
        booking,
        options,
      );
      if (result?.credited) {
        results.push(result);
      }
    } catch (error) {
      console.error(
        `[guideCommission] Failed for allocation ${allocation._id}:`,
        error.message,
      );
    }
  }

  return { credited: results };
}

module.exports = {
  creditGuideCommissionForAllocation,
  creditGuideCommissionForBooking,
  resolveBookingAmount,
};
