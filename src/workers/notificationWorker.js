const { parentPort, workerData } = require("worker_threads");
const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");

// Mongoose populate ke liye models register karna zaruri hai pure worker instance me!
require("../models/packageModel");
require("../models/tourModel");
require("../models/agentModel");
require("../models/userModel");
// City model available ho toh require kar lena chahiye, par agar errors na aaye to thik hai.

const { bookingModel } = require("../models/bookingModel");
const orderModel = require("../models/orderModel");
const { sendBookingWhatsApp } = require("../services/whatsappFlow");
const InvoiceService = require("../services/invoiceService");
const emailService = require("../services/emailService");
const { sendBookingSMS } = require("../utils/smsSendHelper");

const invoiceService = new InvoiceService();

(async () => {
  const workerStartTime = Date.now();
  console.log(`[Worker] ⏱ Started notification thread: ${new Date(workerStartTime).toISOString()}`);

  try {
    // Isolated DB connection for the worker thread
    await mongoose.connect(process.env.MONGODB_URL, {
      maxPoolSize: 2,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[Worker] ✅ DB Connected for background jobs.`);

    const { razorpay_order_id } = workerData;
    if (!razorpay_order_id) {
       console.log("[Worker] ❌ razorpay_order_id missing");
       process.exit(1);
    }

    const order = await orderModel.findOne({ orderId: razorpay_order_id });
    if (!order) {
       console.log("[Worker] ❌ Order not found in DB");
       process.exit(1);
    }

    const bookings = await bookingModel
      .find({ bookingId: { $in: order.bookingIds } })
      .populate("selectedPackageId")
      .populate("selectedTourId")
      .populate("cityId")
      .populate("assignedAgent", "firstName lastName email");

    console.log(`[Worker] ✅ Bookings fetched: ${bookings.length}`);

    await Promise.allSettled(
      bookings
        .filter((b) => b.paymentStatus === "Paid")
        .map(async (booking) => {
          try {
            console.log(`[Worker] Processing ${booking.bookingId}... Generating invoice...`);
            const invoiceUrl = await invoiceService.generateInvoice(booking);
            booking.invoiceUrl = invoiceUrl;
            await booking.save();
            console.log(`[Worker] ✅ Invoice generated: ${invoiceUrl}`);

            console.log(`[Worker] Sending WA, SMS, Email for ${booking.bookingId}...`);
            const results = await Promise.allSettled([
              booking.mobileNumber
                ? sendBookingWhatsApp(
                    booking.mobileNumber,
                    booking.customerName,
                    booking.bookingId,
                    booking.invoiceNumber,
                    invoiceUrl
                  )
                : Promise.resolve(),

              booking.mobileNumber
                ? sendBookingSMS(
                    booking.mobileNumber,
                    booking.customerName,
                    booking.bookingId,
                    invoiceUrl
                  )
                : Promise.resolve(),

              booking.email
                ? emailService
                    .sendPaymentSuccessEmail(booking.email, booking, invoiceUrl)
                    .then(() =>
                      booking.selectedPackageId || booking.selectedTourId
                        ? emailService.sendItineraryEmail(booking.email, booking)
                        : Promise.resolve()
                    )
                : Promise.resolve(),
            ]);

            const [wa, sms, email] = results;
            console.log(`[Worker] ${booking.bookingId} Results: WhatsApp ${wa.status}, SMS ${sms.status}, Email ${email.status}`);

          } catch (err) {
             console.error(`[Worker] ❌ Error processing ${booking.bookingId}:`, err.message);
          }
        })
    );

    const timeTaken = Date.now() - workerStartTime;
    console.log(`[Worker] ✅ Successfully Finished all tasks. Total Time: ${timeTaken}ms`);

    // Cleanly close DB connection and exit
    await mongoose.connection.close();
    if (parentPort) {
      parentPort.postMessage({ success: true, timeTakenMs: timeTaken });
    }
    process.exit(0);

  } catch (error) {
    console.error(`[Worker] ❌ Fatal Error:`, error);
    if (mongoose.connection.readyState !== 0) {
       await mongoose.connection.close();
    }
    if (parentPort) parentPort.postMessage({ success: false, error: error.message });
    process.exit(1);
  }
})();
