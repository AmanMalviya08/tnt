const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        type: {
            type: String,
            enum: ["Credit", "Debit"],
            required: true,
        },
        category: {
            type: String,
            enum: ["Commission", "Withdrawal", "Refund", "Transfer", "Subscription"],
            required: true,
        },
        status: {
            type: String,
            enum: ["Pending", "Approved", "Rejected", "Completed"],
            default: "Pending",
        },
        description: {
            type: String,
            trim: true,
        },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
        },
        transactionId: {
            type: String,
            trim: true,
        },
        paymentTransactionId: {
            type: String,
            trim: true
        },
        bankDetails: {
            accountNumber: String,
            bankName: String,
            ifscCode: String,
            accountHolderName: String
        },
        upiId: {
            type: String,
            trim: true
        },
        withdrawalMethod: {
            type: String,
            enum: ["Bank", "UPI"],
        },
        distributorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        isCreditMoney: {
            type: Boolean,
            default: false,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
