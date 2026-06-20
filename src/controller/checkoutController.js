// const cartModel = require('../models/cartModel');
const { bookingModel } = require("../models/bookingModel");
const orderModel = require("../models/orderModel");
const { default: mongoose } = require("mongoose");
const { packageModel } = require("../models/packageModel");
const { tourModel } = require("../models/tourModel");
const Razorpay = require("razorpay");
const { verifyPayment } = require("../utils/razorpayVerify");
const { sendBookingConfirmationNotifications } = require("../services/bookingNotificationService");
const dotenv = require("dotenv");
dotenv.config();
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const InvoiceService = require("../services/invoiceService");
const Transaction = require("../models/transactionModel");
const { agentModel } = require("../models/agentModel");
const Company = require("../models/companyModel");
const { userModel } = require("../models/userModel");
const { incrementBookingCount } = require("./rewardController");
const {
  isMockPaymentEnabled,
  startOptionalSession,
  commitOptionalSession,
  abortOptionalSession,
  saveOptions,
  applySession,
} = require("../utils/mongoSession");
const { createRazorpayOrderSafe } = require("../utils/razorpayOrderHelper");
const { parseFlexibleDate, addDays } = require("../utils/dateParser");
const {
  normalizeOrderPaymentMethod,
  normalizeBookingPaymentMethod,
} = require("../utils/paymentMethodHelper");
const {
  checkEligibilityAndGetDiscount,
  consumeDiscount,
} = require("../controller/yatraLoyaltyController");
const {
  calculateDynamicPrice,
  logPricingAudit,
  roundCurrency,
} = require("../services/dynamicPricingService");
const {
  calculatePaymentSplit,
  recordPaymentHistory,
} = require("../services/partialPaymentService");

const invoiceService = new InvoiceService();

const createBookingsFromCart = async (req, res) => {
  let session = null;

  try {
    session = await startOptionalSession();
    const {
      travelerDetailsMap = [],
      customerInfo,
      userId,
      packageId,
      tourId,
      selectedAddOns = [],
      adults = 0,
      children = 0,
      infants = 0,
      checkInDate,
      selectedSeats = [],
      paymentPlan = "full",
    } = req.body;

    // Validate ObjectIds before querying to prevent BSON/Cast Errors
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      await abortOptionalSession(session);
      return res.status(400).json({
        success: false,
        message: "Invalid User ID format",
      });
    }

    if (packageId && !mongoose.Types.ObjectId.isValid(packageId)) {
      await abortOptionalSession(session);
      return res.status(400).json({
        success: false,
        message: "Invalid Package ID format",
      });
    }

    if (tourId && !mongoose.Types.ObjectId.isValid(tourId)) {
      await abortOptionalSession(session);
      return res.status(400).json({
        success: false,
        message: "Invalid Tour ID format",
      });
    }

    // Cancel previous pending orders
    const previousPendingOrders = await applySession(
      orderModel.find({ userId, orderStatus: "Pending" }),
      session
    );

    await Promise.all(
      previousPendingOrders.map(order =>
        order.cancelWithBookings(session)
      )
    );

    const normalizedPackageId = packageId ? String(packageId).trim() : null;
    const normalizedTourId = tourId ? String(tourId).trim() : null;

    if (!normalizedPackageId && !normalizedTourId) {
      await abortOptionalSession(session);
      return res.status(400).json({
        success: false,
        message: "Either packageId or tourId is required",
      });
    }

    // Fetch package/tour; if only one id sent, try the other collection (client may send wrong field)
    let packageData = null;
    let tourData = null;
    let effectivePackageId = normalizedPackageId;
    let effectiveTourId = normalizedTourId;

    if (normalizedPackageId) {
      packageData = await packageModel.findById(
        new mongoose.Types.ObjectId(normalizedPackageId)
      );
    }
    if (normalizedTourId) {
      tourData = await tourModel.findById(
        new mongoose.Types.ObjectId(normalizedTourId)
      );
    }

    if (!packageData && !tourData && normalizedPackageId && !normalizedTourId) {
      tourData = await tourModel.findById(
        new mongoose.Types.ObjectId(normalizedPackageId)
      );
      if (tourData) {
        effectiveTourId = normalizedPackageId;
        effectivePackageId = null;
      }
    }
    if (!packageData && !tourData && normalizedTourId && !normalizedPackageId) {
      packageData = await packageModel.findById(
        new mongoose.Types.ObjectId(normalizedTourId)
      );
      if (packageData) {
        effectivePackageId = normalizedTourId;
        effectiveTourId = null;
      }
    }

    if (!packageData && !tourData) {
      await abortOptionalSession(session);
      return res.status(404).json({
        success: false,
        message: "Package or tour not found for the given id",
        packageId: normalizedPackageId,
        tourId: normalizedTourId,
      });
    }

    // Fetch company + agent in parallel
    const [company, agent] = await Promise.all([
      Company.findOne(),
      applySession(
        agentModel.findOne({ userId: new mongoose.Types.ObjectId(userId) }),
        session
      ),
    ]);

    const companyGstNumber = company?.gstNumber || "";
    const companyTaxPercent = company?.tax || 0;
    const assignedAgent = agent ? userId : undefined;

    const travelers = Array.isArray(travelerDetailsMap)
      ? travelerDetailsMap
      : [];

    const totalTravelers = adults + children + infants;

    // Pricing Logic
    let basePrice, childPrice, packageCostPerPerson, duration, cityId;

    if (packageData) {
      basePrice = packageData.basePricePerPerson || 0;
      childPrice = packageData.childPrice || basePrice;
      packageCostPerPerson = basePrice;
      duration =
        Math.max(
          packageData.durationDays || 0,
          packageData.durationNights || 0
        ) || 1;
      cityId = packageData.cityId;
    } else {
      basePrice = tourData.perPersonCost || 0;
      childPrice = basePrice;
      packageCostPerPerson = basePrice;
      duration = tourData.durationInDays || 1;
      cityId = tourData.cityId;
    }

    // Addons Total
    const addOnsTotal = selectedAddOns.reduce(
      (sum, addOn) => sum + addOn.price,
      0
    );

    const quantity = 1;

    // Group Discount
    let calculatedDiscountAmount = 0;

    if (packageData?.groupDiscounts?.length) {
      const applicableDiscount = packageData.groupDiscounts
        .filter(d => adults >= d.minPersons)
        .sort((a, b) => b.minPersons - a.minPersons)[0];

      if (applicableDiscount) {
        const baseTourCost = basePrice * adults * quantity;
        calculatedDiscountAmount =
          (baseTourCost * applicableDiscount.discountPercent) / 100;
      }
    }

    // Total Amount (before dynamic pricing & loyalty)
    let totalAmount =
      basePrice * adults * quantity -
      calculatedDiscountAmount +
      childPrice * children +
      addOnsTotal;

    // Travel Dates — app sends DD/MM/YYYY or ISO
    let finalTravelStartDate;
    let finalTravelEndDate;

    if (tourData) {
      finalTravelStartDate = tourData.startDate;
      finalTravelEndDate = tourData.endDate;
    } else {
      finalTravelStartDate = parseFlexibleDate(checkInDate);
      if (!finalTravelStartDate) {
        await abortOptionalSession(session);
        session = null;
        return res.status(400).json({
          success: false,
          message: "Invalid checkInDate format. Use DD/MM/YYYY or YYYY-MM-DD.",
          checkInDate,
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDay = new Date(finalTravelStartDate);
      startDay.setHours(0, 0, 0, 0);
      if (startDay < today) {
        await abortOptionalSession(session);
        session = null;
        return res.status(400).json({
          success: false,
          message: "checkInDate cannot be in the past",
        });
      }

      finalTravelEndDate = addDays(finalTravelStartDate, duration);
    }

    const bookingType = tourData ? "Group Tour" : "Package Tour";
    const isGroupTour = bookingType === "Group Tour";

    // Dynamic pricing surcharges
    const dynamicPricing = await calculateDynamicPrice({
      baseAmount: totalAmount,
      travelDate: finalTravelStartDate,
      packageId: packageData?._id,
      tourId: tourData?._id,
      tourData: tourData?.toObject?.() || tourData,
      userId,
      adults,
    });

    totalAmount = dynamicPricing.subtotalBeforeTax;
    let loyaltyDiscountApplied = null;
    let loyaltyDiscountAmount = 0;
    let pricingBreakdown = [...dynamicPricing.breakdown];

    // Yatra Loyalty — Group Tour only, auto-apply at checkout
    if (isGroupTour && userId && adults > 1) {
      const eligibility = await checkEligibilityAndGetDiscount(userId);
      if (eligibility.isEligible) {
        loyaltyDiscountApplied = eligibility;
        if (eligibility.discountType === "free") {
          loyaltyDiscountAmount = totalAmount;
          pricingBreakdown.push({
            label: "Yatra Loyalty Reward (Free Group Yatra)",
            amount: -totalAmount,
            type: "loyalty",
          });
          totalAmount = 0;
        } else {
          loyaltyDiscountAmount = eligibility.discountValue;
          pricingBreakdown.push({
            label: "Yatra Loyalty Reward",
            amount: -loyaltyDiscountAmount,
            type: "loyalty",
          });
          totalAmount = Math.max(totalAmount - loyaltyDiscountAmount, 0);
        }
      }
    }

    const paymentSplit = calculatePaymentSplit(totalAmount, paymentPlan);
    const payableNow = paymentSplit.advanceAmount;

    // Create Booking
    const newBooking = new bookingModel({
      userId,
      customerName: customerInfo.name,
      mobileNumber: customerInfo.phone,
      email: customerInfo.email,
      userType: "App User",
      bookingType,
      selectedPackageId: packageData?._id,
      selectedTourId: tourData?._id
        ? new mongoose.Types.ObjectId(String(tourData._id))
        : undefined,
      cityId,
      numberOfTravelers: totalTravelers,
      adults,
      children,
      travelStartDate: finalTravelStartDate,
      travelEndDate: finalTravelEndDate,
      packageCostPerPerson,
      childCostPerPerson: childPrice,
      selectedAddOns,
      addOnsTotal,
      travelerDetails: travelers,
      selectedSeats,
      specialRequests: customerInfo.specialRequests || "",
      paymentStatus: "Pending",
      bookingStatus: "Pending",
      totalAmount,
      discountAmount: calculatedDiscountAmount + loyaltyDiscountAmount,
      loyaltyDiscountApplied: Boolean(loyaltyDiscountApplied),
      loyaltyDiscountAmount,
      pricingBreakdown,
      paymentPlan: paymentSplit.paymentPlan,
      advancePaid: 0,
      remainingAmount: paymentSplit.remainingAmount,
      createdBy: userId,
      assignedAgent,
      gstNumber: companyGstNumber,
      taxPercent: companyTaxPercent,
    });

    await newBooking.save(saveOptions(session));

    if (loyaltyDiscountApplied) {
      await consumeDiscount(
        userId,
        newBooking._id,
        loyaltyDiscountApplied.discountType,
        loyaltyDiscountApplied.discountType === "free"
          ? loyaltyDiscountAmount
          : loyaltyDiscountApplied.discountValue
      );
    }

    await logPricingAudit({
      userId,
      bookingId: newBooking._id,
      packageId: packageData?._id,
      tourId: tourData?._id,
      baseAmount: dynamicPricing.baseAmount,
      finalAmount: newBooking.finalAmount,
      breakdown: pricingBreakdown,
      appliedRuleIds: dynamicPricing.appliedRuleIds,
      context: dynamicPricing.meta,
    });

    const bookings = [newBooking];

    // Final Amount (full booking value after tax)
    const finalTotalAmount = bookings.reduce(
      (sum, b) => sum + b.finalAmount,
      0
    );

    const razorpayChargeAmount = paymentPlan === "advance"
      ? roundCurrency(finalTotalAmount * (paymentSplit.advancePercent / 100))
      : finalTotalAmount;

    const razorpayOrderOptions = {
      amount: Math.round(razorpayChargeAmount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId,
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        bookingType: "Package Tour",
      },
    };

    const {
      order: razorpayOrder,
      mockPayment: usedMockPayment,
      razorpayFallback,
    } = await createRazorpayOrderSafe(razorpay, razorpayOrderOptions);

    const newOrder = new orderModel({
      userId,
      bookingIds: bookings.map(b => b.bookingId),
      totalAmount: razorpayChargeAmount,
      orderId: razorpayOrder.id,
      paymentPlan: paymentSplit.paymentPlan,
      advanceAmount: paymentPlan === "advance" ? razorpayChargeAmount : finalTotalAmount,
      remainingAmount: paymentPlan === "advance"
        ? roundCurrency(finalTotalAmount - razorpayChargeAmount)
        : 0,
      meta: {
        fullBookingAmount: finalTotalAmount,
        paymentPlan: paymentSplit.paymentPlan,
      },
    });

    await newOrder.save(saveOptions(session));

    await bookingModel.updateMany(
      { bookingId: { $in: newOrder.bookingIds } },
      { orderId: newOrder.orderId },
      saveOptions(session)
    );

    await commitOptionalSession(session);
    session = null;

    const paymentMessage = razorpayFallback
      ? "Bookings created. Razorpay keys are invalid — using test payment mode."
      : usedMockPayment
        ? "Bookings created. Proceed with test payment."
        : "Bookings created. Please proceed to payment.";

    return res.status(201).json({
      success: true,
      message: paymentMessage,
      orderId: newOrder.orderId,
      bookingIds: newOrder.bookingIds,
      totalAmount: finalTotalAmount,
      payableAmount: razorpayChargeAmount,
      advanceAmount: paymentPlan === "advance" ? razorpayChargeAmount : null,
      remainingAmount: paymentPlan === "advance" ? newOrder.remainingAmount : 0,
      paymentPlan: paymentSplit.paymentPlan,
      pricingBreakdown,
      loyaltyDiscountApplied: loyaltyDiscountApplied
        ? {
            discountType: loyaltyDiscountApplied.discountType,
            discountValue: loyaltyDiscountApplied.discountValue,
            amount: loyaltyDiscountAmount,
          }
        : null,
      mockPayment: usedMockPayment,
      razorpayFallback: Boolean(razorpayFallback),
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
      razorpayKeyId: usedMockPayment ? null : process.env.RAZORPAY_KEY_ID || null,
      testMode: process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") ?? false,
    });

  } catch (error) {
    await abortOptionalSession(session);
    console.error("Error creating bookings:", error);

    const razorpayMessage = error?.error?.description || error?.message;
    const isRazorpayError =
      error?.statusCode === 401 || error?.error?.code === "BAD_REQUEST_ERROR";

    const isValidationError = error?.name === "ValidationError";

    return res.status(isValidationError ? 400 : isRazorpayError ? 502 : 500).json({
      success: false,
      message: isRazorpayError
        ? `Payment gateway error: ${razorpayMessage || "Razorpay authentication failed"}`
        : isValidationError
          ? error.message
          : "Failed to create bookings",
      error: process.env.NODE_ENV === "development" ? razorpayMessage : undefined,
    });
  }
};

// const confirmPayment = async (req, res) => {
//   const session = await mongoose.startSession();
//   try {
//     // const { orderId } = req.params;
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
//       req.body;
//     //  console.log("verify payment",orderId)
//     session.startTransaction();

//       .findOne({ orderId: razorpay_order_id })
//     // if (!order || order.orderStatus !== 'Pending') {
//     //     await session.abortTransaction();
//     //     session.endSession();
//     //     return res.status(404).json({
//     //       success: false,
//     //       message: "Failed to create bookings",
//     //     });
//     // }
//     const valid = verifyPayment(
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//     );

//     if (!valid) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid payment signature",
//       });
//     }
//     const payment = await razorpay.payments.fetch(razorpay_payment_id);
//     console.log(payment);
//     order.orderStatus = "Paid";
//     order.paymentStatus = "Completed";
//     order.transactionId = razorpay_payment_id;
//     order.paymentMethod = payment.method;
//     await order.save({ session });

//     await bookingModel.updateMany(
//       { bookingId: { $in: order.bookingIds } },
//       {
//         paymentStatus: "Paid",
//         bookingStatus: "Confirmed",
//         transactionId: razorpay_payment_id,
//         paymentMethod: payment.method,
//       },
//       { session },
//     );

//     // Mark seats as booked in Tour model after payment confirmation
//     const confirmedBookings = await bookingModel
//       .find({ bookingId: { $in: order.bookingIds } })
//       .session(session);
//     for (const booking of confirmedBookings) {
//       if (
//         booking.selectedTourId &&
//         booking.selectedSeats &&
//         booking.selectedSeats.length > 0
//       ) {
//         const tour = await tourModel
//           .findById(booking.selectedTourId)
//           .session(session);
//         if (tour && tour.seats) {
//           for (const seatNumber of booking.selectedSeats) {
//             const seat = tour.seats.find((s) => s.number === seatNumber);
//             if (seat) {
//               seat.status = "booked";
//             }
//           }
//           await tour.save({ session });
//         }
//       }
//     }

//     // await cartModel.findOneAndDelete({ userId: order.userId }).session(session);

//     await session.commitTransaction();
//     session.endSession();

//     // Generate Invoice and Send Email
//     try {
//       const bookings = await bookingModel
//         .find({ bookingId: { $in: order.bookingIds } })
//         .populate("selectedPackageId")
//         .populate("selectedTourId")
//         .populate("cityId")
//         .populate("assignedAgent", "firstName lastName email");

//       for (const booking of bookings) {
//         if (booking.paymentStatus === "Paid") {
//           try {
//             const invoiceUrl = await invoiceService.generateInvoice(booking);
//             booking.invoiceUrl = invoiceUrl;
//             await booking.save();

//             if (booking.email) {
//               await emailService.sendPaymentSuccessEmail(
//                 booking.email,
//                 booking,
//                 invoiceUrl,
//               );
//             }
//           } catch (innerError) {
//             console.error(
//               `Error processing invoice/email for booking ${booking.bookingId}:`,
//               innerError,
//             );
//           }
//         }
//       }
//     } catch (postPaymentError) {
//       console.error("Error in post-payment processing:", postPaymentError);
//     }

//     res.status(200).json({
//       success: true,
//       message: "Payment confirmed!",
//       order,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error confirming payment:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to confirm payment",
//     });
//   }
// };

const webhook = async (req, res) => {
  return res.status(201).json({
    success: true,
    message: "webhook hit",
  });
};

// const confirmPayment = async (req, res) => {
//   const session = await mongoose.startSession();
//   try {
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

//     session.startTransaction();

//     const order = await orderModel
//       .findOne({ orderId: razorpay_order_id })
//       .session(session);

//     // const valid = verifyPayment(
//     //   razorpay_order_id,
//     //   razorpay_payment_id,
//     //   razorpay_signature,
//     // );

//     // if (!valid) {
//     //   await session.abortTransaction();
//     //   session.endSession();
//     //   return res.status(400).json({
//     //     success: false,
//     //     message: "Invalid payment signature",
//     //   });
//     // }

//     const payment = await razorpay.payments.fetch(razorpay_payment_id);
//     // console.log(payment);

//     order.orderStatus = "Paid";
//     order.paymentStatus = "Completed";
//     order.transactionId = razorpay_payment_id;
//     order.paymentMethod = payment.method;
//     await order.save({ session });

//     await bookingModel.updateMany(
//       { bookingId: { $in: order.bookingIds } },
//       {
//         paymentStatus: "Paid",
//         bookingStatus: "Confirmed",
//         transactionId: razorpay_payment_id,
//         paymentMethod: payment.method,
//       },
//       { session },
//     );

//     // Mark seats as booked in Tour model
//     const confirmedBookings = await bookingModel
//       .find({ bookingId: { $in: order.bookingIds } })
//       .session(session);

//     for (const booking of confirmedBookings) {
//       if (
//         booking.selectedTourId &&
//         booking.selectedSeats &&
//         booking.selectedSeats.length > 0
//       ) {
//         const tour = await tourModel
//           .findById(booking.selectedTourId)
//           .session(session);
//         if (tour) {
//           if (!tour.bookedSeatNumbers) {
//             tour.bookedSeatNumbers = [];
//           }

//           for (const seatNumber of booking.selectedSeats) {
//             // Check if seat is from lower deck (ends with -L) or upper deck (ends with -U)
//             if (seatNumber.endsWith("-L") && tour.lowerSeats) {
//               const seat = tour.lowerSeats.find((s) => s.number === seatNumber);
//               if (seat) {
//                 seat.status = "booked";
//               }
//             } else if (seatNumber.endsWith("-U") && tour.upperSeats) {
//               const seat = tour.upperSeats.find((s) => s.number === seatNumber);
//               if (seat) {
//                 seat.status = "booked";
//               }
//             } else if (tour.seats) {
//               // Legacy fallback for seats without -L or -U suffix
//               const seat = tour.seats.find((s) => s.number === seatNumber);
//               if (seat) {
//                 seat.status = "booked";
//               }
//             }

//             // Add seat to bookedSeatNumbers tracking array if not already present
//             if (!tour.bookedSeatNumbers.includes(seatNumber)) {
//               tour.bookedSeatNumbers.push(seatNumber);
//             }
//           }
//           await tour.save({ session });
//         }
//       }
//     }

//     // Commission Logic (Agent & Distributor)
//     try {
//       const company = await Company.findOne();


//       for (const booking of confirmedBookings) {
//         console.log("bookings", booking)
//         if (!booking.assignedAgent) continue;
//         const agent = await agentModel.findOne({ userId: booking.assignedAgent }).session(session);
//         console.log("agent", agent)
//         if (!agent) continue;

//         let distributor = null;
//         if (agent.createdBy) {
//           distributor = await userModel.findById(agent.createdBy).session(session);
//         }
//         console.log("distributer", agent)
//         let agentCommissionPercent = 0;

//         if (agent.isPaid && distributor && distributor.paidAgentCommission) {
//           // Paid agent under a distributor → use distributor's paid-agent rate
//           agentCommissionPercent = distributor.paidAgentCommission;
//         } else if (agent.isPaid) {
//           // Paid agent NOT under a distributor → use company-level paid-agent rate
//           agentCommissionPercent = company?.agentPaidCommission || company?.agentCommission || 0;
//         } else {
//           // Regular (unpaid) agent → default company commission
//           agentCommissionPercent = company?.agentCommission || 0;
//         }

//         if (agentCommissionPercent > 0) {
//           // Commission is calculated on the pre-tax amount (finalAmount - taxAmount)
//           const preTaxAmount = booking.finalAmount - (booking.taxAmount || 0);
//           const agentCommissionAmount = (preTaxAmount * agentCommissionPercent) / 100;

//           if (agentCommissionAmount > 0) {
//             await agentModel.findOneAndUpdate(
//               { userId: booking.assignedAgent },
//               { $inc: { wallet: agentCommissionAmount } },
//               { session }
//             );

//             await Transaction.create([{
//               userId: booking.assignedAgent,
//               amount: agentCommissionAmount,
//               type: "Credit",
//               category: "Commission",
//               status: "Completed",
//               description: `Commission for booking ${booking.bookingId}`,
//               bookingId: booking._id,
//               createdBy: booking.assignedAgent
//             }], { session });

//             console.log(`Agent ${agent.userId} credited ${agentCommissionAmount}`);
//           }
//         }

//         if (distributor && distributor.role === "Distributor") {
//           const distributorCommissionPercent = distributor.distributorCommission || 0;

//           if (distributorCommissionPercent > 0) {
//             // Calculate remaining amount after agent commission on pre-tax amount
//             const preTaxAmount = booking.finalAmount - (booking.taxAmount || 0);
//             const remainingAmount = preTaxAmount - (agentCommissionPercent > 0 ? (preTaxAmount * agentCommissionPercent) / 100 : 0);
//             // console.log("remaining amount", remainingAmount)
//             if (remainingAmount > 0) {
//               const distributorCommissionAmount = (remainingAmount * distributorCommissionPercent) / 100;

//               if (distributorCommissionAmount > 0) {
//                 await userModel.findByIdAndUpdate(
//                   distributor._id,
//                   { $inc: { wallet: distributorCommissionAmount } },
//                   { session }
//                 );

//                 await Transaction.create([{
//                   userId: distributor._id,
//                   amount: distributorCommissionAmount,
//                   type: "Credit",
//                   category: "Commission",
//                   status: "Completed",
//                   description: `Commission for booking ${booking.bookingId} (Agent: ${agent.firstName} ${agent.lastName})`,
//                   bookingId: booking._id,
//                   createdBy: distributor._id
//                 }], { session });

//                 console.log(`Distributor ${distributor._id} credited ${distributorCommissionAmount}`);
//               }
//             }
//           }
//         }
//       }
//     } catch (commissionError) {
//       console.error("Error processing commissions:", commissionError);
//     }

//     // Free Package Reward: increment booking count for agents
//     try {
//       for (const booking of confirmedBookings) {
//         if (booking.assignedAgent) {
//           await incrementBookingCount(booking.assignedAgent, session);
//           console.log(
//             `Reward count incremented for agent ${booking.assignedAgent} (booking ${booking.bookingId})`
//           );
//         }
//       }
//     } catch (rewardError) {
//       console.error("Error processing reward count:", rewardError);
//     }

//     // COMMIT TRANSACTION BEFORE EMAIL SENDING
//     await session.commitTransaction();
//     session.endSession();

//     // Generate Invoice and Send Email (AFTER transaction is committed)
//     const emailResults = [];
//     try {
//       const bookings = await bookingModel
//         .find({ bookingId: { $in: order.bookingIds } })
//         .populate("selectedPackageId")
//         .populate("selectedTourId")
//         .populate("cityId")
//         .populate("assignedAgent", "firstName lastName email");

//       console.log(`Found ${bookings.length} bookings to process`);

//       for (const booking of bookings) {
//         console.log(
//           `Processing booking ${booking.bookingId}, paymentStatus: ${booking.paymentStatus}, email: ${booking.email}`,
//         );

//         if (booking.paymentStatus === "Paid") {
//           try {
//             // Generate invoice
//             const invoiceUrl = await invoiceService.generateInvoice(booking);
//             console.log(
//               `Invoice generated for booking ${booking.bookingId}: ${invoiceUrl}`,
//             );

//             // Save invoice URL (without session)
//             booking.invoiceUrl = invoiceUrl;
//             await booking.save();
//             console.log(`Invoice URL saved for booking ${booking.bookingId}`);

//             // Send WhatsApp confirmation via Aisensy
//             if (booking.mobileNumber) {
//               try {
//                 // Send confirmation template
//                 const bookingId = "BK12345";
//                 const invoiceId = "123";
//                 const pdfUrl = "https://sgp1.digitaloceanspaces.com/...invoice.pdf";
//                 const name = "Priyanshu";
//                 const mobile = "8435837006";

//                 // 🟢 WhatsApp call
//                 await sendBookingWhatsApp(mobile, name, bookingId, invoiceId, pdfUrl);
//                 console.log(`WhatsApp confirmation sent for booking ${booking.bookingId}:`, whatsappResult);

//                 // Send invoice document
//                 if (invoiceUrl) {
//                   const docResult = await whatsappService.sendMessage(booking.mobileNumber, {
//                     documentUrl: invoiceUrl,
//                     documentName: `Invoice_${booking.invoiceNumber}.pdf`
//                   });
//                   console.log(`WhatsApp invoice sent for booking ${booking.bookingId}:`, docResult);
//                 }
//               } catch (whatsappError) {
//                 console.error(`WhatsApp send failed for booking ${booking.bookingId}:`, whatsappError.message);
//               }
//             }

//             // Send SMS
//             if (booking.mobileNumber) {
//               sendBookingSMS(booking.mobileNumber, booking.customerName, booking.bookingId, invoiceUrl);
//               console.log(`SMS sent for booking ${booking.bookingId}`);
//             }

//             // Send emails
//             if (booking.email) {
//               console.log(`Attempting to send emails to: ${booking.email}`);

//               // 1. Send Payment Success Email (Invoice)
//               const emailResult = await emailService.sendPaymentSuccessEmail(
//                 booking.email,
//                 booking,
//                 invoiceUrl,
//               );

//               // 2. Send Itinerary Email
//               let itineraryResult = false;
//               if (booking.selectedPackageId || booking.selectedTourId) {
//                 itineraryResult = await emailService.sendItineraryEmail(
//                   booking.email,
//                   booking
//                 );
//               }
//               console.log("itenary", itineraryResult)

//               if (emailResult && itineraryResult) {
//                 console.log(`All emails sent successfully to ${booking.email}`);
//                 emailResults.push({
//                   bookingId: booking.bookingId,
//                   success: true,
//                 });
//               } else {
//                 console.error(`One or more emails failed to send to ${booking.email}`);
//                 // emailResults.push({
//                 //   bookingId: booking.bookingId,
//                 //   success: false,
//                 //   reason: !emailResult ? "Invoice email failed" : "Itinerary email failed",
//                 // });
//               }
//             } else {
//               console.warn(
//                 `No email address found for booking ${booking.bookingId}`,
//               );
//               emailResults.push({
//                 bookingId: booking.bookingId,
//                 success: false,
//                 reason: "No email address",
//               });
//             }
//           } catch (innerError) {
//             console.error(
//               `Error processing invoice/email for booking ${booking.bookingId}:`,
//               innerError.message,
//               innerError.stack,
//             );
//             emailResults.push({
//               bookingId: booking.bookingId,
//               success: false,
//               reason: innerError.message,
//             });
//           }
//         } else {
//           console.log(
//             `Skipping booking ${booking.bookingId} - payment status is ${booking.paymentStatus}`,
//           );
//         }
//       }

//       console.log("Email processing results:", emailResults);
//     } catch (postPaymentError) {
//       console.error(
//         "Error in post-payment processing:",
//         postPaymentError.message,
//         postPaymentError.stack,
//       );
//     }

//     res.status(200).json({
//       success: true,
//       message: "Payment confirmed!",
//       order,
//       // emailResults, // Include email results in response for debugging
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("Error confirming payment:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to confirm payment",
//       error: error.message,
//     });
//   }
// };


const confirmPayment = async (req, res) => {
  let session = null;
  try {
    session = await startOptionalSession();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentMethod: clientPaymentMethod,
    } = req.body;
    const order = await applySession(
      orderModel.findOne({ orderId: razorpay_order_id }),
      session
    );

    if (!order) {
      await abortOptionalSession(session);
      session = null;
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const valid = verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!valid) {
      await abortOptionalSession(session);
      session = null;
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    let rawPaymentMethod = clientPaymentMethod || "online";
    let paymentAmount = Math.round(order.totalAmount * 100);

    if (!isMockPaymentEnabled()) {
      try {
        const fetched = await razorpay.payments.fetch(razorpay_payment_id);
        rawPaymentMethod = fetched.method || rawPaymentMethod;
        paymentAmount = fetched.amount || paymentAmount;
      } catch (fetchErr) {
        console.warn("[confirmPayment] Razorpay fetch failed, using defaults:", fetchErr.message);
      }
    }

    const orderPaymentMethod = normalizeOrderPaymentMethod(rawPaymentMethod);
    const bookingPaymentMethod = normalizeBookingPaymentMethod(rawPaymentMethod);

    order.orderStatus = "Paid";
    order.paymentStatus = "Completed";
    order.transactionId = razorpay_payment_id;
    order.paymentMethod = orderPaymentMethod;
    await order.save(saveOptions(session));

    const isAdvancePayment = order.paymentPlan === "advance" || order.meta?.paymentPlan === "advance";
    const fullBookingAmount = order.meta?.fullBookingAmount || order.totalAmount;
    const paidNow = order.totalAmount;

    // ── Update Bookings ───────────────────────────────────────
    const bookingUpdate = {
      transactionId: razorpay_payment_id,
      paymentMethod: bookingPaymentMethod,
    };

    if (isAdvancePayment) {
      bookingUpdate.paymentStatus = "Partial";
      bookingUpdate.bookingStatus = "Confirmed";
      bookingUpdate.advancePaid = paidNow;
      bookingUpdate.remainingAmount = order.remainingAmount || Math.max(fullBookingAmount - paidNow, 0);
      bookingUpdate.paymentPlan = "advance";
    } else {
      bookingUpdate.paymentStatus = "Paid";
      bookingUpdate.bookingStatus = "Confirmed";
      bookingUpdate.advancePaid = paidNow;
      bookingUpdate.remainingAmount = 0;
    }

    await bookingModel.updateMany(
      { bookingId: { $in: order.bookingIds } },
      bookingUpdate,
      saveOptions(session)
    );

    const confirmedBookings = await applySession(
      bookingModel.find({ bookingId: { $in: order.bookingIds } }),
      session
    );
    // ── Mark Seats as Booked ──────────────────────────────────
    for (const booking of confirmedBookings) {
      if (!booking.selectedTourId || !booking.selectedSeats?.length) continue;

      const tour = await applySession(
        tourModel.findById(booking.selectedTourId),
        session
      );
      if (!tour) continue;

      if (!tour.bookedSeatNumbers) tour.bookedSeatNumbers = [];

      for (const seatNumber of booking.selectedSeats) {
        let seat = null;

        if (seatNumber.endsWith("-L") && tour.lowerSeats) {
          seat = tour.lowerSeats.find(s => s.number === seatNumber);
        } else if (seatNumber.endsWith("-U") && tour.upperSeats) {
          seat = tour.upperSeats.find(s => s.number === seatNumber);
        } else if (tour.seats) {
          seat = tour.seats.find(s => s.number === seatNumber);
        }

        if (seat) seat.status = "booked";
        if (!tour.bookedSeatNumbers.includes(seatNumber)) {
          tour.bookedSeatNumbers.push(seatNumber);
        }
      }

      await tour.save(saveOptions(session));
    }
    // ── Commission Logic ──────────────────────────────────────
    try {
      const company = await Company.findOne();

      for (const booking of confirmedBookings) {
        if (!booking.assignedAgent) continue;

        const agent = await applySession(
          agentModel.findOne({ userId: booking.assignedAgent }),
          session
        );
        if (!agent) continue;

        // Increment totalBookingsHandled
        await agentModel.findOneAndUpdate(
          { userId: booking.assignedAgent },
          { $inc: { totalBookingsHandled: 1 } },
          saveOptions(session)
        );


        let distributor = null;
        if (agent.createdBy) {
          distributor = await applySession(
            userModel.findById(agent.createdBy),
            session
          );
        }

        let agentCommissionPercent = 0;
        if (agent.isPaid && distributor?.paidAgentCommission) {
          agentCommissionPercent = distributor.paidAgentCommission;
        } else if (agent.isPaid) {
          agentCommissionPercent = company?.agentPaidCommission || company?.agentCommission || 0;
        } else {
          agentCommissionPercent = company?.agentCommission || 0;
        }

        const preTaxAmount = booking.finalAmount - (booking.taxAmount || 0);

        if (agentCommissionPercent > 0) {
          const agentCommissionAmount = (preTaxAmount * agentCommissionPercent) / 100;
          if (agentCommissionAmount > 0) {
            await agentModel.findOneAndUpdate(
              { userId: booking.assignedAgent },
              { $inc: { wallet: agentCommissionAmount } },
              saveOptions(session)
            );
            await Transaction.create([{
              userId: booking.assignedAgent,
              amount: agentCommissionAmount,
              type: "Credit",
              category: "Commission",
              status: "Completed",
              description: `Commission for booking ${booking.bookingId}`,
              bookingId: booking._id,
              createdBy: booking.assignedAgent
            }], saveOptions(session));

            const agentUserId = booking.assignedAgent;
            const commissionAmount = agentCommissionAmount;
            const bookingRef = booking.bookingId;
            setImmediate(() => {
              const { notifyUser, formatInr } = require("../services/notificationDispatchService");
              notifyUser(agentUserId, {
                title: "Commission Credited",
                message: `${formatInr(commissionAmount)} commission credited for booking ${bookingRef}.`,
                type: "reward",
                redirectScreen: "CommissionHistory",
                meta: { bookingId: bookingRef },
              }).catch((err) => console.error("[Notify] Agent commission:", err.message));
            });
          }
        }

        if (distributor?.role === "Distributor") {
          const distributorCommissionPercent = distributor.distributorCommission || 0;
          if (distributorCommissionPercent > 0) {
            const remainingAmount = preTaxAmount - (preTaxAmount * agentCommissionPercent) / 100;
            const distributorCommissionAmount = (remainingAmount * distributorCommissionPercent) / 100;
            if (distributorCommissionAmount > 0) {
              await userModel.findByIdAndUpdate(
                distributor._id,
                { $inc: { wallet: distributorCommissionAmount } },
                saveOptions(session)
              );
              await Transaction.create([{
                userId: distributor._id,
                amount: distributorCommissionAmount,
                type: "Credit",
                category: "Commission",
                status: "Completed",
                description: `Commission for booking ${booking.bookingId} (Agent: ${agent.firstName} ${agent.lastName})`,
                bookingId: booking._id,
                createdBy: distributor._id
              }], saveOptions(session));
            }
          }
        }
      }
    } catch (commissionError) {
      console.error("Commission error:", commissionError);
    }

    // ── Free Package Reward ───────────────────────────────────
    try {
      for (const booking of confirmedBookings) {
        if (booking.assignedAgent) {
          await incrementBookingCount(booking.assignedAgent, session);
        }
      }
    } catch (rewardError) {
      console.error("[confirmPayment] 11a. Reward error:", rewardError);
    }

    await commitOptionalSession(session);
    session = null;

    // Record payment history (non-blocking)
    setImmediate(async () => {
      try {
        const bookings = await bookingModel.find({ bookingId: { $in: order.bookingIds } });
        for (const booking of bookings) {
          await recordPaymentHistory({
            userId: order.userId,
            bookingId: booking._id,
            bookingRef: booking.bookingId,
            orderId: order.orderId,
            amount: paidNow,
            paymentType: isAdvancePayment ? "advance" : "full",
            paymentMethod: bookingPaymentMethod,
            transactionId: razorpay_payment_id,
            status: "Completed",
          });
        }
      } catch (err) {
        console.error("[confirmPayment] Payment history error:", err.message);
      }
    });

    res.status(200).json({
      success: true,
      message: isAdvancePayment
        ? "Advance payment confirmed! Remaining balance is due before travel."
        : "Payment confirmed!",
      order,
      paymentStatus: isAdvancePayment ? "Partial Paid" : "Fully Paid",
      remainingAmount: isAdvancePayment ? (order.remainingAmount || 0) : 0,
    });

    setImmediate(async () => {
      try {
        console.log(`[Background] Starting for order: ${razorpay_order_id}`);

        const freshOrder = await orderModel.findOne({ orderId: razorpay_order_id });
        if (!freshOrder) return console.error("[Background]  Order not found");

        const bookings = await bookingModel
          .find({ bookingId: { $in: freshOrder.bookingIds } })
          .populate({
            path: "selectedPackageId",
            populate: {
              path: "itinerary.placeIds"
            }
          })
          .populate("selectedTourId")
          .populate("cityId")
          .populate("assignedAgent", "firstName lastName email");

        console.log(`[Background] Bookings found: ${bookings.length}`);

        for (const booking of bookings) {
          console.log(`[Background] Processing booking: ${booking.bookingId}, paymentStatus: ${booking.paymentStatus}, email: ${booking.email}, mobile: ${booking.mobileNumber}`);
          if (booking.paymentStatus !== "Paid") {
            console.log(`[Background] Skipping ${booking.bookingId} — status is ${booking.paymentStatus}`);
            continue;
          }

          try {
            const { creditGuideCommissionForBooking } = require("../services/guideCommissionService");
            await creditGuideCommissionForBooking(booking._id, { trigger: "payment" });
          } catch (commissionErr) {
            console.error(`[Background] Guide commission error for ${booking.bookingId}:`, commissionErr.message);
          }

          try {
            const notifyResults = await sendBookingConfirmationNotifications(booking);
            console.log(`[Background] Notifications for ${booking.bookingId}:`, notifyResults);
          } catch (notifyErr) {
            console.error(`[Background] Notification error for ${booking.bookingId}:`, notifyErr.message, notifyErr.stack);
          }
        }

        console.log(`[Background] ✅ All tasks finished for order: ${razorpay_order_id}`);

      } catch (err) {
        console.error("[Background] ❌ Fatal error:", err.message, err.stack);
      }
    });


  } catch (error) {
    console.error("[confirmPayment] ❌ CATCH BLOCK ERROR:", error);
    await abortOptionalSession(session);
    console.error("Error confirming payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm payment",
      error: error.message,
    });
  }
};



const createAgentPaidOrder = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await agentModel.findOne({ userId: new mongoose.Types.ObjectId(agentId) });
    console.log("inside here", agent)
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    if (agent.isPaid) {
      return res.status(400).json({ success: false, message: "Agent is already a paid agent" });
    }

    const company = await Company.findOne();
    const fee = company?.agentPaidFee || 0;
    if (fee <= 0) {
      return res.status(400).json({ success: false, message: "Agent paid fee is not configured" });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: fee * 100, // paise
      currency: "INR",
      // receipt: `agent_paid_${agentId}_${Date.now()}`,
      notes: {
        agentId: agentId,
        purpose: "Agent Paid Subscription",
      },
    });

    res.status(201).json({
      success: true,
      message: "Razorpay order created for agent payment",
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error creating agent paid order:", error);
    res.status(500).json({ success: false, message: "Failed to create agent payment order" });
  }
};

const confirmAgentPayment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const valid = verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!valid) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }
    const agentId = req.user.userId;

    session.startTransaction();
    console.log("confirm agent", agentId)
    const agent = await agentModel.findOne({ userId: new mongoose.Types.ObjectId(agentId) }).session(session);
    console.log("confirm agent", agent)
    if (!agent) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    if (agent.isPaid) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Agent is already paid" });
    }

    agent.isPaid = true;
    await agent.save({ session });

    // const payment = await razorpay.payments.fetch(razorpay_payment_id);
    const payment = { method: "upi", amount: 100000 }; // 1000 INR default in cents

    await Transaction.create([{
      userId: agent.userId,
      amount: payment.amount / 100,
      type: "Debit",
      category: "Subscription",
      status: "Completed",
      description: "Agent paid subscription fee",
      transactionId: razorpay_payment_id,
      createdBy: agent.userId,
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Agent payment confirmed and marked as paid",
      data: agent,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error confirming agent payment:", error);
    res.status(500).json({ success: false, message: "Failed to confirm agent payment" });
  }
};

const createAgentPaidOrderDynamic = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Please provide a valid amount" });
    }

    const agent = await agentModel.findById(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    if (agent.isPaid) {
      return res.status(400).json({ success: false, message: "Agent is already a paid agent" });
    }

    const distributor = agent.createdBy
      ? await userModel.findById(agent.createdBy)
      : null;

    if (!distributor || distributor.role !== "Distributor") {
      return res.status(400).json({ success: false, message: "Agent does not belong to a distributor" });
    }

    const fee = amount;

    const razorpayOrder = await razorpay.orders.create({
      amount: fee * 100,
      currency: "INR",
      receipt: `agent_dyn_${agentId}}`,
      notes: {
        agentId: agentId,
        distributorId: distributor._id.toString(),
        purpose: "Agent Paid Subscription (Dynamic)",
      },
    });

    res.status(201).json({
      success: true,
      message: "Razorpay order created for agent payment (dynamic pricing)",
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error creating dynamic agent paid order:", error);
    res.status(500).json({ success: false, message: "Failed to create agent payment order" });
  }
};

const confirmAgentPaymentDynamic = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      agentId,
    } = req.body;

    const valid = verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!valid) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    session.startTransaction();

    const agent = await agentModel.findById(agentId).session(session);
    if (!agent) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    if (agent.isPaid) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Agent is already paid" });
    }

    agent.isPaid = true;
    await agent.save({ session });

    // const payment = await razorpay.payments.fetch(razorpay_payment_id);
    const payment = { method: "upi", amount: 100000 }; // 1000 INR default in cents

    const distributor = agent.createdBy
      ? await userModel.findById(agent.createdBy).session(session)
      : null;

    await Transaction.create([{
      userId: agent.userId,
      amount: payment.amount / 100,
      type: "Debit",
      category: "Subscription",
      status: "Completed",
      description: `Agent paid subscription fee (Dynamic - Distributor: ${distributor ? distributor.firstName + ' ' + distributor.lastName : 'N/A'})`,
      transactionId: razorpay_payment_id,
      distributorId: distributor ? distributor._id : undefined,
      createdBy: agent.userId,
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Agent payment confirmed and marked as paid (dynamic pricing)",
      data: agent,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error confirming dynamic agent payment:", error);
    res.status(500).json({ success: false, message: "Failed to confirm agent payment" });
  }
};


const getAgentPaidTransactions = async (req, res) => {
  try {


    const agent = await agentModel.findOne({ userId: req.user.userId });
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    const transaction = await Transaction.findOne({
      userId: agent.userId,
      category: "Subscription",
      status: "Completed",
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Latest agent paid transaction fetched",
      data: {
        agentId: agent._id,
        isPaid: agent.isPaid,
        transaction,
      },
    });
  } catch (error) {
    console.error("Error fetching agent paid transaction:", error);
    res.status(500).json({ success: false, message: "Failed to fetch agent transaction" });
  }
};


const getRazorpayConfig = async (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
      return res.status(503).json({
        success: false,
        message: "Razorpay keys are not configured on the server",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        keyId,
        currency: "INR",
        testMode: keyId.startsWith("rzp_test_"),
        mockPayment: isMockPaymentEnabled(),
        companyName: "Zunjarrao Yatra",
      },
    });
  } catch (error) {
    console.error("Error fetching Razorpay config:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load Razorpay configuration",
    });
  }
};

module.exports = {
  createBookingsFromCart,
  confirmPayment,
  getRazorpayConfig,
  webhook,
  createAgentPaidOrder,
  confirmAgentPayment,
  createAgentPaidOrderDynamic,
  confirmAgentPaymentDynamic,
  getAgentPaidTransactions,
};

