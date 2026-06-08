const { guideWalletModel } = require("../models/guideWalletModel");
const Transaction = require("../models/transactionModel");
const Guide = require("../models/guideModel");
const mongoose = require("mongoose");

// Get Guide Wallet Details (balance + recent transactions)
exports.getGuideWalletDetails = async (req, res) => {
  try {
    const userId = req.user.userId;

    const guide = await Guide.findOne({ userId });
    if (!guide) {
      return res.status(404).json({ success: false, message: "Guide profile not found" });
    }

    let wallet = await guideWalletModel.findOne({ guideId: guide._id });
    if (!wallet) {
      wallet = await guideWalletModel.create({
        guideId: guide._id,
        balance: 0,
        totalEarnings: 0,
        totalWithdrawals: 0,
      });
    }

    const transactions = await Transaction.find({ guideId: guide._id })
      .populate("bookingId", "bookingId customerName totalAmount")
      .populate("allocationId", "assignmentType status")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        wallet: {
          balance: wallet.balance,
          totalEarnings: wallet.totalEarnings,
          totalWithdrawals: wallet.totalWithdrawals,
        },
        transactions,
      },
    });
  } catch (error) {
    console.error("Error fetching guide wallet details:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Guide Transactions with filters
exports.getGuideTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { category, type, page, limit } = req.query;

    const guide = await Guide.findOne({ userId });
    if (!guide) {
      return res.status(404).json({ success: false, message: "Guide profile not found" });
    }

    const filter = { guideId: guide._id };
    if (category) filter.category = category;
    if (type) filter.type = type;

    const query = Transaction.find(filter)
      .populate("bookingId", "bookingId customerName totalAmount")
      .populate("allocationId", "assignmentType status")
      .sort({ createdAt: -1 });

    const parsedLimit = parseInt(limit, 10);
    const shouldPaginate = !Number.isNaN(parsedLimit) && parsedLimit > 0;

    let currentPage = 1;
    if (shouldPaginate) {
      currentPage = parseInt(page, 10);
      if (Number.isNaN(currentPage) || currentPage < 1) currentPage = 1;
      query.skip((currentPage - 1) * parsedLimit).limit(parsedLimit);
    }

    const [data, totalItems] = await Promise.all([
      query.exec(),
      Transaction.countDocuments(filter),
    ]);

    let pagination = null;
    if (shouldPaginate) {
      const totalPages = Math.max(Math.ceil(totalItems / parsedLimit), 1);
      pagination = {
        totalItems,
        totalPages,
        currentPage,
        pageSize: parsedLimit,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      };
    }

    res.status(200).json({ success: true, data, pagination });
  } catch (error) {
    console.error("Error fetching guide transactions:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Request Guide Withdrawal
exports.requestGuideWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, withdrawalMethod } = req.body;
    const userId = req.user.userId;

    if (!amount || amount <= 0) {
      throw new Error("Invalid withdrawal amount");
    }

    if (!withdrawalMethod || !["Bank", "UPI"].includes(withdrawalMethod)) {
      throw new Error("Please select a valid withdrawal method: Bank or UPI");
    }

    const guide = await Guide.findOne({ userId }).session(session);
    if (!guide) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Guide profile not found" });
    }

    // Validate payment details
    if (withdrawalMethod === "Bank" && (!guide.bankDetails || !guide.bankDetails.accountNumber)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Bank details not found in profile. Please update bank details first.",
      });
    }

    if (withdrawalMethod === "UPI" && !guide.upiId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "UPI ID not found in profile. Please update UPI ID first.",
      });
    }

    const wallet = await guideWalletModel.findOne({ guideId: guide._id }).session(session);
    if (!wallet || wallet.balance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    // Deduct from wallet
    wallet.balance -= amount;
    wallet.totalWithdrawals += amount;
    await wallet.save({ session });

    // Create withdrawal transaction
    const transaction = await Transaction.create(
      [
        {
          userId,
          guideId: guide._id,
          amount,
          type: "Debit",
          category: "Withdrawal",
          status: "Pending",
          description: `Guide withdrawal request via ${withdrawalMethod}`,
          withdrawalMethod,
          bankDetails: withdrawalMethod === "Bank" ? guide.bankDetails : undefined,
          upiId: withdrawalMethod === "UPI" ? guide.upiId : undefined,
          createdBy: userId,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      data: transaction[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error requesting guide withdrawal:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Guide Withdrawals (for the guide)
exports.getGuideWithdrawals = async (req, res) => {
  try {
    const userId = req.user.userId;

    const guide = await Guide.findOne({ userId });
    if (!guide) {
      return res.status(404).json({ success: false, message: "Guide profile not found" });
    }

    const transactions = await Transaction.find({
      guideId: guide._id,
      category: "Withdrawal",
    }).sort({ createdAt: -1 });
 
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    console.error("Error fetching guide withdrawals:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Get All Guide Withdrawals
exports.getGuideWithdrawalsAdmin = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = { category: "Withdrawal", guideId: { $exists: true, $ne: null } };

    if (status && status !== "All") {
      filter.status = status;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      const matchingGuides = await Guide.find({
        fullName: searchRegex,
      }).select("_id");

      if (matchingGuides.length > 0) {
        filter.guideId = { $in: matchingGuides.map((g) => g._id) };
      } else {
        filter._id = null;
      }
    }

    const withdrawals = await Transaction.find(filter)
      .populate("guideId", "fullName email phone")
      .populate("userId", "firstName lastName email role")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: withdrawals });
  } catch (error) {
    console.error("Error fetching guide withdrawals:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Approve Guide Withdrawal
exports.approveGuideWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentTransactionId } = req.body;

    if (!paymentTransactionId) {
      return res.status(400).json({ success: false, message: "Payment Transaction ID is required" });
    }

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    if (transaction.status !== "Pending") {
      return res.status(400).json({ success: false, message: `Transaction is already ${transaction.status}` });
    }

    transaction.status = "Completed";
    transaction.paymentTransactionId = paymentTransactionId;
    transaction.transactionId = paymentTransactionId;
    await transaction.save();

    res.status(200).json({
      success: true,
      message: "Guide withdrawal approved successfully",
      data: transaction,
    });
  } catch (error) {
    console.error("Error approving guide withdrawal:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Reject Guide Withdrawal
exports.rejectGuideWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    const transaction = await Transaction.findById(id).session(session);
    if (!transaction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    if (transaction.status !== "Pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Transaction is already ${transaction.status}` });
    }

    // Refund to guide wallet
    if (transaction.guideId) {
      await guideWalletModel.findOneAndUpdate(
        { guideId: transaction.guideId },
        { $inc: { balance: transaction.amount, totalWithdrawals: -transaction.amount } },
        { session }
      );
    }

    transaction.status = "Rejected";
    transaction.description = reason ? `Rejected: ${reason}` : "Rejected by Admin";
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Guide withdrawal rejected and amount refunded",
      data: transaction,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error rejecting guide withdrawal:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
