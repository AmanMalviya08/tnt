const { agentModel } = require("../models/agentModel");
const { userModel } = require("../models/userModel");
const Transaction = require("../models/transactionModel");
const mongoose = require("mongoose");
const { notifyUser, formatInr } = require("../services/notificationDispatchService");

// Get Wallet Balance and Transaction History
exports.getWalletDetails = async (req, res) => {
    try {

        const userId = req.user.userId;
        // Assuming userId is passed or extracted from token
        // If using middleware to extract user, req.user._id could be used
        console.log(req.user)
        console.log(userId)
        const agent = await agentModel.findOne({ userId: userId });

        if (!agent) {
            return res.status(404).json({
                success: false,
                message: "Agent not found",
            });
        }

        const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            walletBalance: agent.wallet,
            transactions,
        });
    } catch (error) {
        console.error("Error fetching wallet details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch wallet details",
            error: error.message,
        });
    }
};

// Get Distributor Wallet Balance and Transaction History
exports.getDistributorWalletDetails = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await userModel.findById(userId);

        if (!user || user.role !== "Distributor") {
            return res.status(404).json({
                success: false,
                message: "Distributor not found",
            });
        }

        const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            walletBalance: user.wallet,
            creditBalance: user.credit_money,
            data: transactions,
        });
    } catch (error) {
        console.error("Error fetching distributor wallet details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch wallet details",
            error: error.message,
        });
    }
};

// Request Withdrawal
exports.requestWithdrawal = async (req, res) => {
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

        const agent = await agentModel.findOne({ userId }).session(session);

        if (!agent) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Agent not found",
            });
        }

        // Validate if selected method details exist
        if (withdrawalMethod === "Bank" && (!agent.bankDetails || !agent.bankDetails.accountNumber)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Bank details not found in profile. Please update bank details first.",
            });
        }

        if (withdrawalMethod === "UPI" && !agent.upiId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "UPI ID not found in profile. Please update UPI ID first.",
            });
        }


        if (agent.wallet < amount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Insufficient wallet balance",
            });
        }

        // Deduct amount from wallet immediately
        agent.wallet -= amount;
        await agent.save({ session });

        // Create Transaction Record
        const transaction = await Transaction.create(
            [
                {
                    userId,
                    amount, // Store as positive number, type 'Debit' implies deduction
                    type: "Debit",
                    category: "Withdrawal",
                    status: "Pending",
                    description: `Withdrawal request via ${withdrawalMethod}`,
                    withdrawalMethod,
                    bankDetails: withdrawalMethod === "Bank" ? agent.bankDetails : undefined,
                    upiId: withdrawalMethod === "UPI" ? agent.upiId : undefined,
                    createdBy: userId,
                },
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        const createdTxn = transaction[0];
        setImmediate(() => {
            notifyUser(userId, {
                title: "Withdrawal Requested",
                message: `Your withdrawal of ${formatInr(amount)} via ${withdrawalMethod} has been submitted.`,
                type: "system",
                redirectScreen: "WithdrawalHistory",
                meta: { transactionId: createdTxn?._id?.toString?.() },
            }).catch((err) => console.error("[Notify] Agent withdrawal:", err.message));
        });

        res.status(201).json({
            success: true,
            message: "Withdrawal request submitted successfully",
            transaction: transaction[0],
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error requesting withdrawal:", error);
        res.status(500).json({
            success: false,
            message: "Failed to request withdrawal",
            error: error.message,
        });
    }
};

// Request Distributor Withdrawal
exports.requestDistributorWithdrawal = async (req, res) => {
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

        const user = await userModel.findById(userId).session(session);
        console.log(user)
        if (!user || user.role !== "Distributor") {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Distributor not found",
            });
        }

        // Validate if selected method details exist
        if (withdrawalMethod === "Bank" && (!user.bankDetails || !user.bankDetails.accountNumber)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Bank details not found in profile. Please update bank details first.",
            });
        }

        if (withdrawalMethod === "UPI" && !user.upiId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "UPI ID not found in profile. Please update UPI ID first.",
            });
        }


        if (user.wallet < amount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Insufficient wallet balance",
            });
        }

        // Deduct amount from wallet immediately
        user.wallet -= amount;
        await user.save({ session });

        // Create Transaction Record
        const transaction = await Transaction.create(
            [
                {
                    userId,
                    amount, // Store as positive number, type 'Debit' implies deduction
                    type: "Debit",
                    category: "Withdrawal",
                    status: "Pending",
                    description: `Withdrawal request via ${withdrawalMethod}`,
                    withdrawalMethod,
                    bankDetails: withdrawalMethod === "Bank" ? user.bankDetails : undefined,
                    upiId: withdrawalMethod === "UPI" ? user.upiId : undefined,
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
            transaction: transaction[0],
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error requesting distributor withdrawal:", error);
        res.status(500).json({
            success: false,
            message: "Failed to request withdrawal",
            error: error.message,
        });
    }
};

// Get Withdrawals (Admin)
exports.getWithdrawals = async (req, res) => {
    try {
        const { status, search } = req.query;
        const filter = { category: "Withdrawal", status: "Pending" };

        if (status) {
            filter.status = status;
        }
        if (status == 'All') {
            filter.status = { $in: ["Pending", "Approved", "Rejected", "Completed"] };
        }

        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            const matchingUsers = await userModel.find({
                $or: [
                    { firstName: searchRegex },
                    { lastName: searchRegex }
                ]
            }).select('_id');
            const matchingIds = matchingUsers.map(u => u._id);

            if (matchingIds.length > 0) {
                filter.userId = { $in: matchingIds };
            } else {
                // force empty result if search doesn't match any users
                filter._id = null;
            }
        }

        const withdrawals = await Transaction.find(filter)
            .populate("userId", "firstName lastName email role") // Added role here
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: withdrawals,
        });
    } catch (error) {
        console.error("Error fetching withdrawals:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch withdrawals",
            error: error.message,
        });
    }
};

// Approve Withdrawal (Admin)
exports.approveWithdrawal = async (req, res) => {
    try {
        const { id } = req.params; // Transaction ID
        const { paymentTransactionId } = req.body; // Manual transaction ID from bank/payment gateway

        if (!paymentTransactionId) {
            return res.status(400).json({
                success: false,
                message: "Payment Transaction ID is required",
            });
        }

        const transaction = await Transaction.findById(id);

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found",
            });
        }

        if (transaction.status !== "Pending") {
            return res.status(400).json({
                success: false,
                message: `Transaction is already ${transaction.status}`,
            });
        }

        transaction.status = "Approved";
        transaction.paymentTransactionId = paymentTransactionId;
        transaction.transactionId = paymentTransactionId;
        transaction.statusHistory = transaction.statusHistory || [];
        transaction.statusHistory.push({
          status: "Approved",
          changedBy: req.user?.userId,
          note: `Payment ref: ${paymentTransactionId}`,
          changedAt: new Date(),
        });
        await transaction.save();

        setImmediate(() => {
            notifyUser(transaction.userId, {
                title: "Withdrawal Approved",
                message: `Your withdrawal of ${formatInr(transaction.amount)} has been approved.`,
                type: "system",
                redirectScreen: "WithdrawalHistory",
                meta: { transactionId: transaction._id?.toString?.() },
            }).catch((err) => console.error("[Notify] Withdrawal approved:", err.message));
        });

        res.status(200).json({
            success: true,
            message: "Withdrawal approved successfully",
            transaction,
        });
    } catch (error) {
        console.error("Error approving withdrawal:", error);
        res.status(500).json({
            success: false,
            message: "Failed to approve withdrawal",
            error: error.message,
        });
    }
};

// Reject Withdrawal (Admin)
exports.rejectWithdrawal = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params; // Transaction ID
        const { reason } = req.body;

        const transaction = await Transaction.findById(id).session(session).populate("userId");

        if (!transaction) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Transaction not found",
            });
        }

        if (transaction.status !== "Pending") {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `Transaction is already ${transaction.status}`,
            });
        }

        // Refund based on role
        const user = transaction.userId;
        if (user.role === "Agent") {
            await agentModel.findOneAndUpdate(
                { userId: user._id },
                { $inc: { wallet: transaction.amount } },
                { session }
            );
        } else if (user.role === "Distributor") {
            await userModel.findByIdAndUpdate(
                user._id,
                { $inc: { wallet: transaction.amount } },
                { session }
            );
        }

        transaction.status = "Rejected";
        transaction.description = reason ? `Rejected: ${reason}` : "Rejected by Admin";
        await transaction.save({ session });

        await session.commitTransaction();
        session.endSession();

        setImmediate(() => {
            notifyUser(user._id, {
                title: "Withdrawal Rejected",
                message: reason
                    ? `Your withdrawal of ${formatInr(transaction.amount)} was rejected: ${reason}`
                    : `Your withdrawal of ${formatInr(transaction.amount)} was rejected and refunded to wallet.`,
                type: "system",
                redirectScreen: "WithdrawalHistory",
                meta: { transactionId: transaction._id?.toString?.() },
            }).catch((err) => console.error("[Notify] Withdrawal rejected:", err.message));
        });

        res.status(200).json({
            success: true,
            message: "Withdrawal rejected and amount refunded",
            transaction,
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error rejecting withdrawal:", error);
        res.status(500).json({
            success: false,
            message: "Failed to reject withdrawal",
            error: error.message,
        });
    }
};
// Get Agent Withdrawal Transactions
exports.getAgentWithdrawals = async (req, res) => {
    try {
        const userId = req.user.userId;

        const transactions = await Transaction.find({
            userId,
            category: "Withdrawal"
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: transactions,
        });
    } catch (error) {
        console.error("Error fetching agent withdrawals:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch withdrawal transactions",
            error: error.message,
        });
    }
};

// Get Distributor Withdrawal Transactions
exports.getDistributorWithdrawals = async (req, res) => {
    try {
        const userId = req.user.userId;

        const transactions = await Transaction.find({
            userId,
            category: "Withdrawal"
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: transactions,
        });
    } catch (error) {
        console.error("Error fetching distributor withdrawals:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch withdrawal transactions",
            error: error.message,
        });
    }
};

// Request Transfer from Distributor (Agent)
exports.requestTransferFromDistributor = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { amount } = req.body;
        const agentId = req.user.userId;

        if (!amount || amount <= 0) {
            throw new Error("Invalid transfer amount");
        }

        const agent = await agentModel.findOne({ userId: agentId }).session(session);

        if (!agent) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Agent not found",
            });
        }

        const distributorId = agent.createdBy;

        if (!distributorId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "No associated distributor found for this agent",
            });
        }

        const distributor = await userModel.findOne({ _id: distributorId, role: "Distributor" }).session(session);

        if (!distributor) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Associated distributor not found",
            });
        }

        // Create transaction request
        const transaction = await Transaction.create(
            [
                {
                    userId: agentId,
                    distributorId: distributorId,
                    amount,
                    type: "Credit", // It's a credit to the agent's wallet
                    category: "Transfer",
                    status: "Pending",
                    description: `Transfer request from distributor ${distributor.firstName}`,
                    createdBy: agentId,
                }
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            message: "Transfer request submitted successfully",
            transaction: transaction[0],
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error requesting transfer:", error);
        res.status(500).json({
            success: false,
            message: "Failed to request transfer",
            error: error.message,
        });
    }
};

// Get Agent Transfer Requests
exports.getAgentTransferRequests = async (req, res) => {
    try {
        const agentId = req.user.userId;

        const requests = await Transaction.find({
            userId: agentId,
            category: "Transfer"
        }).populate("distributorId", "firstName lastName email").sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: requests,
        });
    } catch (error) {
        console.error("Error fetching transfer requests:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch transfer requests",
            error: error.message,
        });
    }
};

// Get Distributor Transfer Requests
exports.getDistributorTransferRequests = async (req, res) => {
    try {
        const distributorId = req.user.userId;
        const { status } = req.query;

        const filter = {
            distributorId: distributorId,
            category: "Transfer"
        };

        if (status && status !== 'All') {
            filter.status = status;
        }

        const requests = await Transaction.find(filter)
            .populate("userId", "firstName lastName email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: requests,
        });
    } catch (error) {
        console.error("Error fetching transfer requests:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch transfer requests",
            error: error.message,
        });
    }
};

// Approve Transfer Request (Distributor)
exports.approveTransferRequest = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params; // Transaction ID
        const distributorId = req.user.userId;

        const transaction = await Transaction.findOne({ _id: id, distributorId: distributorId }).session(session);

        if (!transaction) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Transfer request not found or unauthorized",
            });
        }

        if (transaction.status !== "Pending") {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `Transfer request is already ${transaction.status}`,
            });
        }

        const distributor = await userModel.findById(distributorId).session(session);

        if (distributor.credit_money < transaction.amount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Insufficient credit money balance to approve this transfer",
            });
        }

        // Deduct from distributor
        distributor.credit_money -= transaction.amount;
        await distributor.save({ session });

        // Credit to agent
        await agentModel.findOneAndUpdate(
            { userId: transaction.userId },
            { $inc: { wallet: transaction.amount } },
            { session }
        );

        // Update transaction logic for distributor deduction
        await Transaction.create(
            [
                {
                    userId: distributorId,
                    amount: transaction.amount,
                    type: "Debit",
                    category: "Transfer",
                    status: "Completed",
                    description: `Approved transfer to agent`,
                    createdBy: distributorId,
                }
            ],
            { session }
        );

        transaction.status = "Approved";
        await transaction.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            message: "Transfer request approved successfully",
            transaction,
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error approving transfer:", error);
        res.status(500).json({
            success: false,
            message: "Failed to approve transfer request",
            error: error.message,
        });
    }
};


// Reject Transfer Request (Distributor)
exports.rejectTransferRequest = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params; // Transaction ID
        const distributorId = req.user.userId;
        const { reason } = req.body;

        const transaction = await Transaction.findOne({ _id: id, distributorId: distributorId }).session(session);

        if (!transaction) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Transfer request not found or unauthorized",
            });
        }

        if (transaction.status !== "Pending") {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `Transfer request is already ${transaction.status}`,
            });
        }

        transaction.status = "Rejected";
        transaction.description = reason ? `Rejected: ${reason}` : "Rejected by Distributor";
        await transaction.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            message: "Transfer request rejected successfully",
            transaction,
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error rejecting transfer:", error);
        res.status(500).json({
            success: false,
            message: "Failed to reject transfer request",
            error: error.message,
        });
    }
};


exports.requestTransferFromAdmin = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { amount, isCreditMoney } = req.body;
        const distributorId = req.user.userId;

        if (!amount || amount <= 0) {
            throw new Error("Invalid transfer amount");
        }

        const distributor = await userModel.findOne({ _id: distributorId, role: "Distributor" }).session(session);

        if (!distributor) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Distributor not found",
            });
        }


        const transaction = await Transaction.create(
            [
                {
                    userId: distributorId,
                    amount,
                    type: "Credit",
                    category: "Transfer",
                    status: "Pending",
                    isCreditMoney: isCreditMoney || false,
                    description: `Transfer request to Admin from distributor ${distributor.firstName || ''}`,
                    createdBy: distributorId,
                }
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            message: "Transfer request submitted successfully",
            transaction: transaction[0],
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error requesting transfer from admin:", error);
        res.status(500).json({
            success: false,
            message: "Failed to request transfer",
            error: error.message,
        });
    }
};


exports.getDistributorAdminTransferRequests = async (req, res) => {
    try {
        const distributorId = req.user.userId;

        const requests = await Transaction.find({
            userId: distributorId,
            category: "Transfer",
            distributorId: { $exists: false }
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: requests,
        });
    } catch (error) {
        console.error("Error fetching transfer requests:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch transfer requests",
            error: error.message,
        });
    }
};

exports.getAdminTransferRequests = async (req, res) => {
    try {
        const { status, search } = req.query;

        const filter = {
            category: "Transfer",
            distributorId: { $exists: false }
        };

        if (status && status !== 'All') {
            filter.status = status;
        }

        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            const matchingUsers = await userModel.find({
                $or: [
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { email: searchRegex }
                ]
            }).select('_id');
            const matchingIds = matchingUsers.map(u => u._id);

            if (matchingIds.length > 0) {
                filter.userId = { $in: matchingIds };
            } else {
                // force empty result if search doesn't match any users
                filter._id = null;
            }
        }

        const requests = await Transaction.find(filter)
            .populate("userId", "firstName lastName email")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: requests,
        });
    } catch (error) {
        console.error("Error fetching admin transfer requests:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch transfer requests",
            error: error.message,
        });
    }
};

// Approve Admin Transfer Request (Admin)
exports.approveAdminTransferRequest = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params; // Transaction ID

        const transaction = await Transaction.findOne({ _id: id, category: "Transfer", distributorId: { $exists: false } }).session(session);

        if (!transaction) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Transfer request not found or unauthorized",
            });
        }

        if (transaction.status !== "Pending") {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `Transfer request is already ${transaction.status}`,
            });
        }

        // Credit to distributor
        const updateField = transaction.isCreditMoney ? 'credit_money' : 'wallet';
        await userModel.findOneAndUpdate(
            { _id: transaction.userId },
            { $inc: { [updateField]: transaction.amount } },
            { session }
        );

        transaction.status = "Approved";
        await transaction.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            message: "Transfer request approved successfully",
            transaction,
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error approving transfer:", error);
        res.status(500).json({
            success: false,
            message: "Failed to approve transfer request",
            error: error.message,
        });
    }
};


exports.rejectAdminTransferRequest = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const { reason } = req.body;

        const transaction = await Transaction.findOne({ _id: id, category: "Transfer", distributorId: { $exists: false } }).session(session);

        if (!transaction) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Transfer request not found or unauthorized",
            });
        }

        if (transaction.status !== "Pending") {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `Transfer request is already ${transaction.status}`,
            });
        }

        transaction.status = "Rejected";
        transaction.description = reason ? `Rejected: ${reason}` : "Rejected by Admin";
        await transaction.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            message: "Transfer request rejected successfully",
            transaction,
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error rejecting transfer:", error);
        res.status(500).json({
            success: false,
            message: "Failed to reject transfer request",
            error: error.message,
        });
    }
};

exports.exportTransactionsExcel = async (req, res) => {
    let tempFilePath = null;
    const fs = require("fs");
    const path = require("path");

    try {
        const { type, category, status } = req.query;
        const filter = {};
        if (type) filter.type = type;
        if (category) filter.category = category;
        if (status) filter.status = status;

        const transactions = await Transaction.find(filter)
            .populate("userId", "firstName lastName email role")
            .sort({ createdAt: -1 })
            .lean();

        if (!transactions.length) {
            return res.status(404).json({
                success: false,
                message: "No transactions found",
            });
        }

        const ExcelJS = require("exceljs");
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Transactions");

        const allKeys = new Set();
        transactions.forEach((t) => Object.keys(t).forEach((k) => allKeys.add(k)));
        
        allKeys.add("UserName");
        allKeys.add("UserEmail");
        allKeys.add("UserRole");
        
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

        transactions.forEach((t) => {
            const rowData = {};
            keysArray.forEach((key) => {
                let val = t[key];
                
                if (key === "UserName") {
                    val = t.userId ? `${t.userId.firstName || ""} ${t.userId.lastName || ""}`.trim() : "-";
                } else if (key === "UserEmail") {
                    val = t.userId && t.userId.email ? t.userId.email : "-";
                } else if (key === "UserRole") {
                    val = t.userId && t.userId.role ? t.userId.role : "-";
                } else if (key === "userId" && typeof val === "object") {
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
        const filename = `Transactions_${timestamp}_${uniqueId}.xlsx`;

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
            Bucket: process.env.LINODE_OBJECT_BUCKET || "leadkart",
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
            message: "Transactions exported to Excel successfully",
            data: {
                fileUrl,
                filename,
                recordCount: transactions.length,
                key: s3Key,
            },
        });
    } catch (error) {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch (e) {}
        }
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to export transactions",
        });
    }
};

exports.exportDistributorTransfersExcel = async (req, res) => {
    let tempFilePath = null;
    const fs = require("fs");
    const path = require("path");

    try {
        const filter = {
            category: "Transfer",
            distributorId: { $exists: false }
        };

        const transfers = await Transaction.find(filter)
            .sort({ createdAt: -1 })
            .lean();

        if (!transfers.length) {
            return res.status(404).json({
                success: false,
                message: "No distributor transfer requests found",
            });
        }

        const ExcelJS = require("exceljs");
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("DistributorTransfers");

        const allKeys = new Set();
        transfers.forEach((t) => Object.keys(t).forEach((k) => allKeys.add(k)));
        
        allKeys.add("DistributorName");
        allKeys.add("DistributorEmail");
        
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

        transfers.forEach((t) => {
            const rowData = {};
            keysArray.forEach((key) => {
                let val = t[key];
                
                if (key === "DistributorName") {
                    val = t.userId ? `${t.userId.firstName || ""} ${t.userId.lastName || ""}`.trim() : "-";
                } else if (key === "DistributorEmail") {
                    val = t.userId && t.userId.email ? t.userId.email : "-";
                } else if (key === "userId" && typeof val === "object") {
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
        const filename = `DistributorTransfers_${timestamp}_${uniqueId}.xlsx`;

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
            message: "Distributor transfer requests exported to Excel successfully",
            data: {
                fileUrl,
                filename,
                recordCount: transfers.length,
                key: s3Key,
            },
        });
    } catch (error) {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch (e) {}
        }
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to export distributor transfer requests",
        });
    }
};

// Get payment methods (Bank details and UPI ID) dynamically
exports.getPaymentMethods = async (req, res) => {
    try {
        const userId = req.user.userId;
        const role = req.user.role;

        if (role === 'Agent') {
            const agent = await agentModel.findOne({ userId });
            if (!agent) {
                return res.status(404).json({ success: false, message: "Agent profile not found" });
            }
            return res.status(200).json({
                success: true,
                bankDetails: agent.bankDetails || {
                    accountNumber: '',
                    bankName: '',
                    ifscCode: '',
                    accountHolderName: ''
                },
                upiId: agent.upiId || ''
            });
        } else {
            // Distributors or Admins
            const user = await userModel.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            return res.status(200).json({
                success: true,
                bankDetails: user.bankDetails || {
                    accountNumber: '',
                    bankName: '',
                    ifscCode: '',
                    accountHolderName: ''
                },
                upiId: user.upiId || ''
            });
        }
    } catch (error) {
        console.error("Error getting payment methods:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update payment methods (Bank details and UPI ID) dynamically
exports.updatePaymentMethods = async (req, res) => {
    try {
        const userId = req.user.userId;
        const role = req.user.role;
        const { bankDetails, upiId } = req.body;

        if (role === 'Agent') {
            const existingAgent = await agentModel.findOne({ userId });
            const hadBank = Boolean(existingAgent?.bankDetails?.accountNumber);
            const hadUpi = Boolean(existingAgent?.upiId);

            const agent = await agentModel.findOneAndUpdate(
                { userId },
                { $set: { bankDetails, upiId } },
                { new: true, runValidators: true }
            );

            if (!agent) {
                return res.status(404).json({ success: false, message: "Agent profile not found" });
            }

            // Also keep userModel in sync
            await userModel.findByIdAndUpdate(userId, {
                $set: { bankDetails, upiId }
            });

            const bankAdded = Boolean(bankDetails?.accountNumber) && !hadBank;
            const upiAdded = Boolean(upiId) && !hadUpi;
            const bankUpdated = Boolean(bankDetails?.accountNumber) && hadBank
                && JSON.stringify(bankDetails) !== JSON.stringify(existingAgent?.bankDetails || {});
            const upiUpdated = Boolean(upiId) && hadUpi && upiId !== existingAgent?.upiId;

            if (bankAdded || upiAdded || bankUpdated || upiUpdated) {
                setImmediate(() => {
                    const tasks = [];
                    if (bankAdded) {
                        tasks.push(notifyUser(userId, {
                            title: "Bank Account Added",
                            message: "Your bank account has been saved successfully.",
                            type: "system",
                            redirectScreen: "Payment",
                        }));
                    } else if (bankUpdated) {
                        tasks.push(notifyUser(userId, {
                            title: "Bank Account Updated",
                            message: "Your bank account details have been updated.",
                            type: "system",
                            redirectScreen: "Payment",
                        }));
                    }
                    if (upiAdded) {
                        tasks.push(notifyUser(userId, {
                            title: "UPI ID Added",
                            message: "Your UPI ID has been saved successfully.",
                            type: "system",
                            redirectScreen: "Payment",
                        }));
                    } else if (upiUpdated) {
                        tasks.push(notifyUser(userId, {
                            title: "UPI ID Updated",
                            message: "Your UPI ID has been updated successfully.",
                            type: "system",
                            redirectScreen: "Payment",
                        }));
                    }
                    Promise.allSettled(tasks).catch((err) => console.error("[Notify] Payment methods:", err.message));
                });
            }

            return res.status(200).json({
                success: true,
                message: "Payment methods updated successfully",
                bankDetails: agent.bankDetails,
                upiId: agent.upiId
            });
        } else {
            const user = await userModel.findByIdAndUpdate(
                userId,
                { $set: { bankDetails, upiId } },
                { new: true, runValidators: true }
            );

            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            return res.status(200).json({
                success: true,
                message: "Payment methods updated successfully",
                bankDetails: user.bankDetails,
                upiId: user.upiId
            });
        }
    } catch (error) {
        console.error("Error updating payment methods:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

