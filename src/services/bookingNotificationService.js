const emailService = require('./emailService');
const { sendBookingWhatsApp } = require('./whatsappFlow');
const { sendBookingSMS } = require('../utils/smsSendHelper');
const InvoiceService = require('./invoiceService');
const { notifyUser, formatTravelDate } = require('./notificationDispatchService');

const invoiceService = new InvoiceService();

async function sendBookingPushNotifications(booking) {
  const bookingRef = booking.bookingId || booking._id;
  const packageName = booking.selectedPackageId?.packageName
    || booking.selectedTourId?.tourName
    || booking.bookingType
    || 'your trip';
  const travelDate = formatTravelDate(booking.travelStartDate);
  const scheduleSuffix = travelDate ? ` Trip scheduled for ${travelDate}.` : '';

  const tasks = [];

  if (booking.userId) {
    tasks.push(
      notifyUser(booking.userId, {
        title: 'Booking Confirmed',
        message: `Your booking ${bookingRef} for ${packageName} is confirmed.${scheduleSuffix}`,
        type: 'booking',
        redirectScreen: 'BookingDetails',
        redirectParams: { bookingId: bookingRef, id: booking._id?.toString?.() || bookingRef },
        meta: { bookingId: bookingRef },
      })
    );
  }

  if (booking.assignedAgent) {
    tasks.push(
      notifyUser(booking.assignedAgent, {
        title: 'New Booking Created',
        message: `New booking ${bookingRef} for ${booking.customerName || 'customer'} is confirmed.${scheduleSuffix}`,
        type: 'booking',
        redirectScreen: 'ViewDetails',
        redirectParams: { bookingId: bookingRef, id: booking._id?.toString?.() || bookingRef },
        meta: { bookingId: bookingRef },
      })
    );
  }

  if (travelDate && booking.assignedAgent) {
    tasks.push(
      notifyUser(booking.assignedAgent, {
        title: 'Trip Scheduled',
        message: `${packageName} is scheduled on ${travelDate} (Booking ${bookingRef}).`,
        type: 'tour',
        redirectScreen: 'ViewDetails',
        redirectParams: { bookingId: bookingRef, id: booking._id?.toString?.() || bookingRef },
        meta: { bookingId: bookingRef, travelStartDate: booking.travelStartDate },
      })
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * Sends booking confirmation notifications after payment is confirmed.
 * Invoice generation is best-effort; email/SMS/WhatsApp are always attempted.
 */
async function sendBookingConfirmationNotifications(booking) {
  const bookingRef = booking.bookingId || booking._id;
  const results = {
    bookingId: bookingRef,
    invoice: null,
    email: null,
    itineraryEmail: null,
    whatsapp: null,
    sms: null,
  };

  let invoiceUrl = booking.invoiceUrl || null;

  try {
    console.log(`[BookingNotify] Generating invoice for ${bookingRef}...`);
    const invoicePromise = invoiceService.generateInvoice(booking);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Invoice generation timed out after 60s')), 60000)
    );
    invoiceUrl = await Promise.race([invoicePromise, timeoutPromise]);
    booking.invoiceUrl = invoiceUrl;
    await booking.save();
    results.invoice = { status: 'sent', url: invoiceUrl };
    console.log(`[BookingNotify] Invoice ready: ${invoiceUrl}`);
  } catch (invoiceErr) {
    results.invoice = { status: 'failed', error: invoiceErr.message };
    console.error(`[BookingNotify] Invoice failed for ${bookingRef}:`, invoiceErr.message);
  }

  const invoiceId = booking.invoiceNumber || booking.bookingId || 'N/A';
  const notifyPayload = typeof booking.toObject === 'function'
    ? { ...booking.toObject(), invoiceUrl }
    : { ...booking, invoiceUrl };

  if (booking.mobileNumber) {
    try {
      results.whatsapp = await sendBookingWhatsApp(
        booking.mobileNumber,
        booking.customerName,
        booking.bookingId,
        invoiceId,
        invoiceUrl || ''
      );
    } catch (waErr) {
      results.whatsapp = { success: false, error: waErr.message };
      console.error(`[BookingNotify] WhatsApp failed for ${bookingRef}:`, waErr.message);
    }

    try {
      results.sms = await sendBookingSMS(
        booking.mobileNumber,
        booking.customerName,
        booking.bookingId,
        invoiceUrl || ''
      );
    } catch (smsErr) {
      results.sms = { success: false, error: smsErr.message };
      console.error(`[BookingNotify] SMS failed for ${bookingRef}:`, smsErr.message);
    }
  } else {
    results.whatsapp = { success: false, skipped: true, reason: 'no mobile' };
    results.sms = { success: false, skipped: true, reason: 'no mobile' };
  }

  if (booking.email) {
    try {
      results.email = await emailService.sendPaymentSuccessEmail(
        booking.email,
        notifyPayload,
        invoiceUrl || ''
      );
      console.log(`[BookingNotify] Confirmation email sent to ${booking.email}`);
    } catch (emailErr) {
      results.email = { success: false, error: emailErr.message };
      console.error(`[BookingNotify] Email failed for ${bookingRef}:`, emailErr.message);
    }

    if (booking.bookingType === 'Package Tour' && booking.selectedPackageId) {
      try {
        results.itineraryEmail = await emailService.sendItineraryEmail(
          booking.email,
          notifyPayload
        );
        console.log(`[BookingNotify] Itinerary email sent to ${booking.email}`);
      } catch (itineraryErr) {
        results.itineraryEmail = { success: false, error: itineraryErr.message };
        console.error(`[BookingNotify] Itinerary email failed:`, itineraryErr.message);
      }
    }
  } else {
    results.email = { success: false, skipped: true, reason: 'no email' };
  }

  try {
    results.push = await sendBookingPushNotifications(booking);
  } catch (pushErr) {
    results.push = { success: false, error: pushErr.message };
    console.error(`[BookingNotify] Push failed for ${bookingRef}:`, pushErr.message);
  }

  console.log(`[BookingNotify] Done for ${bookingRef}`);
  return results;
}

module.exports = { sendBookingConfirmationNotifications, sendBookingPushNotifications };
