const mongoose = require("mongoose");
const { bookingModel } = require("../models/bookingModel");
const orderModel = require("../models/orderModel");
const Razorpay = require("razorpay");
const dotenv = require("dotenv");
const { verifyPayment } = require("../utils/razorpayVerify");
const { createRazorpayOrderSafe } = require("../utils/razorpayOrderHelper");
const {
  calculatePaymentSplit,
  recordPaymentHistory,
  getPaymentHistoryForBooking,
  getPaymentHistoryForUser,
  mapPaymentStatusForApi,
} = require("../services/partialPaymentService");
const {
  normalizeOrderPaymentMethod,
  normalizeBookingPaymentMethod,
} = require("../utils/paymentMethodHelper");
const {
  startOptionalSession,
  commitOptionalSession,
  abortOptionalSession,
  saveOptions,
  applySession,
} = require("../utils/mongoSession");

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

class PartialPaymentController {
  async getBookingPaymentSummary(req, res) {
    try {
      const { bookingId } = req.params;
      const booking = await bookingModel.findOne({
        $or: [{ bookingId }, { _id: mongoose.Types.ObjectId.isValid(bookingId) ? bookingId : null }],
        userId: req.user.userId,
      }).lean();

      if (!booking) {
        return res.status(404).json({ success: false, message: "Booking not found" });
      }

      const history = await getPaymentHistoryForBooking(booking._id);

      return res.status(200).json({
        success: true,
        data: {
          bookingId: booking.bookingId,
          totalAmount: booking.totalAmount,
          finalAmount: booking.finalAmount,
          advancePaid: booking.advancePaid || 0,
          remainingAmount: booking.remainingAmount ?? Math.max((booking.finalAmount || 0) - (booking.advancePaid || 0), 0),
          paymentStatus: mapPaymentStatusForApi(booking),
          paymentPlan: booking.paymentPlan || "full",
          history,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async createBalancePaymentOrder(req, res) {
    let session = null;
    try {
      const { bookingId } = req.params;
      const booking = await bookingModel.findOne({
        $or: [{ bookingId }, { _id: mongoose.Types.ObjectId.isValid(bookingId) ? bookingId : null }],
        userId: req.user.userId,
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: "Booking not found" });
      }

      if (booking.paymentStatus === "Paid") {
        return res.status(400).json({
          success: false,
          message: "Booking is already fully paid",
        });
      }

      const remaining = booking.remainingAmount ??
        Math.max((booking.finalAmount || 0) - (booking.advancePaid || 0), 0);

      if (remaining <= 0) {
        return res.status(400).json({
          success: false,
          message: "No remaining balance due for this booking",
        });
      }

      session = await startOptionalSession();

      const razorpayOrderOptions = {
        amount: Math.round(remaining * 100),
        currency: "INR",
        receipt: `balance_${booking.bookingId}_${Date.now()}`,
        notes: {
          userId: String(req.user.userId),
          bookingId: booking.bookingId,
          paymentType: "balance",
        },
      };

      const { order: razorpayOrder, mockPayment } = await createRazorpayOrderSafe(
        razorpay,
        razorpayOrderOptions
      );

      const balanceOrder = new orderModel({
        userId: req.user.userId,
        bookingIds: [booking.bookingId],
        totalAmount: remaining,
        orderId: razorpayOrder.id,
        paymentStatus: "Pending",
        orderStatus: "Pending",
      });
      balanceOrder.meta = { paymentType: "balance", parentBookingId: booking.bookingId };
      await balanceOrder.save(saveOptions(session));

      await commitOptionalSession(session);

      return res.status(201).json({
        success: true,
        message: "Balance payment order created",
        data: {
          orderId: balanceOrder.orderId,
          remainingAmount: remaining,
          razorpayOrder: {
            id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
          },
          razorpayKeyId: mockPayment ? null : process.env.RAZORPAY_KEY_ID,
          mockPayment,
        },
      });
    } catch (error) {
      await abortOptionalSession(session);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async verifyBalancePayment(req, res) {
    let session = null;
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        paymentMethod: clientPaymentMethod,
      } = req.body;

      session = await startOptionalSession();
      const order = await applySession(
        orderModel.findOne({ orderId: razorpay_order_id }),
        session
      );

      if (!order) {
        await abortOptionalSession(session);
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      const valid = verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      if (!valid) {
        await abortOptionalSession(session);
        return res.status(400).json({ success: false, message: "Invalid payment signature" });
      }

      const bookingRef = order.bookingIds?.[0];
      const booking = await applySession(
        bookingModel.findOne({ bookingId: bookingRef, userId: order.userId }),
        session
      );

      if (!booking) {
        await abortOptionalSession(session);
        return res.status(404).json({ success: false, message: "Booking not found" });
      }

      const orderPaymentMethod = normalizeOrderPaymentMethod(clientPaymentMethod || "online");
      const bookingPaymentMethod = normalizeBookingPaymentMethod(clientPaymentMethod || "online");
      const paidAmount = order.totalAmount;

      order.orderStatus = "Paid";
      order.paymentStatus = "Completed";
      order.transactionId = razorpay_payment_id;
      order.paymentMethod = orderPaymentMethod;
      await order.save(saveOptions(session));

      booking.advancePaid = (booking.advancePaid || 0) + paidAmount;
      booking.remainingAmount = Math.max((booking.finalAmount || 0) - booking.advancePaid, 0);
      booking.paymentStatus = booking.remainingAmount > 0 ? "Partial" : "Paid";
      if (booking.remainingAmount <= 0) {
        booking.paymentStatus = "Paid";
        booking.bookingStatus = booking.bookingStatus === "Pending" ? "Confirmed" : booking.bookingStatus;
      }
      booking.transactionId = razorpay_payment_id;
      booking.paymentMethod = bookingPaymentMethod;
      await booking.save(saveOptions(session));

      await recordPaymentHistory({
        userId: order.userId,
        bookingId: booking._id,
        bookingRef: booking.bookingId,
        orderId: order.orderId,
        amount: paidAmount,
        paymentType: booking.paymentStatus === "Paid" ? "full" : "balance",
        paymentMethod: bookingPaymentMethod,
        transactionId: razorpay_payment_id,
        status: "Completed",
      });

      await commitOptionalSession(session);

      if (booking.paymentStatus === "Paid") {
        setImmediate(async () => {
          try {
            const { creditGuideCommissionForBooking } = require("../services/guideCommissionService");
            await creditGuideCommissionForBooking(booking._id, { trigger: "payment" });
          } catch (err) {
            console.error("[partialPayment] Guide commission credit failed:", err.message);
          }
        });
      }

      return res.status(200).json({
        success: true,
        message: "Balance payment confirmed",
        data: {
          bookingId: booking.bookingId,
          paymentStatus: mapPaymentStatusForApi(booking),
          advancePaid: booking.advancePaid,
          remainingAmount: booking.remainingAmount,
        },
      });
    } catch (error) {
      await abortOptionalSession(session);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getUserPaymentHistory(req, res) {
    try {
      const result = await getPaymentHistoryForUser(req.user.userId, req.query);
      return res.status(200).json({
        success: true,
        ...result,
        message: "Payment history fetched",
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new PartialPaymentController();
