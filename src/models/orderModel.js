// models/orderModel.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  bookingIds: [{
    type: String,
    required: true
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  orderStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Cancelled'],
    default: 'Pending',
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
    default: 'Pending'
  },
  paymentMethod: {
    type: String,
    enum: ['online', 'cash', 'upi', 'card', 'wallet']
  },
  transactionId: {
    type: String,
    sparse: true
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  }
}, { timestamps: true });

const { bookingModel } = require('./bookingModel');
// orderSchema.pre('save', async function(next) {
//   if (!this.orderId) {
//     this.orderId = 'ORD-' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
//   }
//   next();
// });
orderSchema.methods.cancelWithBookings = async function (session) {
  this.orderStatus = 'Cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = 'New order created';
  await this.save({ session });

  await bookingModel.updateMany(
    { bookingId: { $in: this.bookingIds } },
    {
      bookingStatus: 'Cancelled',
      notes: 'Cancelled due to new order creation'
    },
    { session }
  );
};


const orderModel = mongoose.model('Order', orderSchema);
module.exports = orderModel;