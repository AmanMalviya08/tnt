const mongoose = require("mongoose");
const { agentModel } = require("../models/agentModel");
const { userModel } = require("../models/userModel");
const { bookingModel } = require("../models/bookingModel");
const Company = require("../models/companyModel");
const Transaction = require("../models/transactionModel");
const { notifyUser, formatInr } = require("./notificationDispatchService");

async function resolveAgentCommissionPercent(agent, company, distributor) {
  if (agent.isPaid && distributor?.paidAgentCommission) {
    return distributor.paidAgentCommission;
  }
  if (agent.isPaid) {
    return company?.agentPaidCommission || company?.agentCommission || 0;
  }
  return company?.agentCommission || 0;
}

/**
 * Credit agent commission when booking is paid and assignedAgent is set.
 * Skips if commission already credited for this booking.
 */
async function creditAgentCommissionForBooking(bookingId, options = {}) {
  const booking = await bookingModel.findById(bookingId).lean();
  if (!booking || booking.paymentStatus !== "Paid" || !booking.assignedAgent) {
    return { skipped: true, reason: "not_eligible" };
  }

  const existing = await Transaction.findOne({
    bookingId: booking._id,
    category: "Commission",
    userId: booking.assignedAgent,
    type: "Credit",
  }).lean();

  if (existing) {
    return { skipped: true, reason: "already_credited" };
  }

  const [company, agent] = await Promise.all([
    Company.findOne().lean(),
    agentModel.findOne({ userId: booking.assignedAgent }).lean(),
  ]);

  if (!agent) {
    return { skipped: true, reason: "agent_not_found" };
  }

  let distributor = null;
  if (agent.createdBy) {
    distributor = await userModel.findById(agent.createdBy).lean();
  }

  const agentCommissionPercent = await resolveAgentCommissionPercent(agent, company, distributor);
  const preTaxAmount = (booking.finalAmount || booking.totalAmount || 0) - (booking.taxAmount || 0);

  if (agentCommissionPercent <= 0 || preTaxAmount <= 0) {
    return { skipped: true, reason: "zero_commission" };
  }

  const agentCommissionAmount = Math.round((preTaxAmount * agentCommissionPercent) / 100 * 100) / 100;
  if (agentCommissionAmount <= 0) {
    return { skipped: true, reason: "zero_amount" };
  }

  const session = options.session || null;
  const saveOpts = session ? { session } : {};

  await agentModel.findOneAndUpdate(
    { userId: booking.assignedAgent },
    { $inc: { wallet: agentCommissionAmount, totalBookingsHandled: 1 } },
    saveOpts
  );

  await Transaction.create(
    [
      {
        userId: booking.assignedAgent,
        amount: agentCommissionAmount,
        type: "Credit",
        category: "Commission",
        status: "Completed",
        description: `Commission for booking ${booking.bookingId}`,
        bookingId: booking._id,
        commissionPercent: agentCommissionPercent,
        bookingAmount: preTaxAmount,
        createdBy: booking.assignedAgent,
      },
    ],
    saveOpts
  );

  if (distributor?.role === "Distributor") {
    const distributorCommissionPercent = distributor.distributorCommission || 0;
    if (distributorCommissionPercent > 0) {
      const remainingAmount = preTaxAmount - agentCommissionAmount;
      const distributorCommissionAmount =
        Math.round((remainingAmount * distributorCommissionPercent) / 100 * 100) / 100;
      if (distributorCommissionAmount > 0) {
        await userModel.findByIdAndUpdate(
          distributor._id,
          { $inc: { wallet: distributorCommissionAmount } },
          saveOpts
        );
        await Transaction.create(
          [
            {
              userId: distributor._id,
              amount: distributorCommissionAmount,
              type: "Credit",
              category: "Commission",
              status: "Completed",
              description: `Commission for booking ${booking.bookingId} (Agent: ${agent.firstName || ""} ${agent.lastName || ""})`.trim(),
              bookingId: booking._id,
              createdBy: distributor._id,
            },
          ],
          saveOpts
        );
      }
    }
  }

  if (!options.skipNotify) {
    setImmediate(() => {
      notifyUser(booking.assignedAgent, {
        title: "Commission Credited",
        message: `${formatInr(agentCommissionAmount)} commission credited for booking ${booking.bookingId}.`,
        type: "reward",
        redirectScreen: "CommissionHistory",
        meta: { bookingId: booking.bookingId },
      }).catch((err) => console.error("[Notify] Agent commission:", err.message));
    });
  }

  return { success: true, amount: agentCommissionAmount };
}

/**
 * Reverse agent (and distributor) commission when a booking is cancelled or refunded.
 * Creates Debit Commission transactions and reduces wallet balances.
 */
async function deductAgentCommissionForBooking(bookingId, options = {}) {
  const booking = await bookingModel.findById(bookingId).lean();
  if (!booking) {
    return { skipped: true, reason: "booking_not_found" };
  }

  const session = options.session || null;
  const saveOpts = session ? { session } : {};
  const reasonLabel = options.reason === "refunded" ? "refunded" : "cancelled";
  let totalDeducted = 0;

  const creditTransactions = await Transaction.find({
    bookingId: booking._id,
    category: "Commission",
    type: "Credit",
  }).lean();

  if (!creditTransactions.length) {
    return { skipped: true, reason: "no_commission_credited" };
  }

  for (const creditTxn of creditTransactions) {
    const existingDebit = await Transaction.findOne({
      bookingId: booking._id,
      category: "Commission",
      type: "Debit",
      userId: creditTxn.userId,
    }).lean();

    if (existingDebit) {
      continue;
    }

    const amount = Number(creditTxn.amount || 0);
    if (amount <= 0) {
      continue;
    }

    const agent = session
      ? await agentModel.findOne({ userId: creditTxn.userId }).session(session)
      : await agentModel.findOne({ userId: creditTxn.userId });
    if (agent) {
      const nextWallet = Math.max(0, Number(agent.wallet || 0) - amount);
      await agentModel.findOneAndUpdate(
        { userId: creditTxn.userId },
        { $set: { wallet: nextWallet } },
        saveOpts
      );
    } else {
      const distributor = session
        ? await userModel.findById(creditTxn.userId).session(session)
        : await userModel.findById(creditTxn.userId);
      if (distributor) {
        const nextWallet = Math.max(0, Number(distributor.wallet || 0) - amount);
        await userModel.findByIdAndUpdate(
          creditTxn.userId,
          { $set: { wallet: nextWallet } },
          saveOpts
        );
      }
    }

    await Transaction.create(
      [
        {
          userId: creditTxn.userId,
          amount,
          type: "Debit",
          category: "Commission",
          status: "Completed",
          description: `Commission deducted for ${reasonLabel} booking ${booking.bookingId}`,
          bookingId: booking._id,
          commissionPercent: creditTxn.commissionPercent,
          bookingAmount: creditTxn.bookingAmount,
          createdBy: options.actorId || creditTxn.userId,
        },
      ],
      saveOpts
    );

    totalDeducted += amount;

    if (!options.skipNotify && agent) {
      setImmediate(() => {
        notifyUser(creditTxn.userId, {
          title: "Commission Deducted",
          message: `${formatInr(amount)} commission deducted for ${reasonLabel} booking ${booking.bookingId}.`,
          type: "alert",
          redirectScreen: "CommissionHistory",
          meta: { bookingId: booking.bookingId },
        }).catch((err) => console.error("[Notify] Agent commission deduction:", err.message));
      });
    }
  }

  if (totalDeducted <= 0) {
    return { skipped: true, reason: "already_deducted" };
  }

  return { success: true, amount: totalDeducted };
}

async function resolveAssignedAgentFromReferral(referralCode) {
  if (!referralCode || typeof referralCode !== "string") return null;
  const code = referralCode.trim().toUpperCase();
  if (!code) return null;
  const agent = await agentModel.findOne({ referralCode: code }).select("userId").lean();
  return agent?.userId || null;
}

module.exports = {
  creditAgentCommissionForBooking,
  deductAgentCommissionForBooking,
  resolveAssignedAgentFromReferral,
  resolveAgentCommissionPercent,
};
