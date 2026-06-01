const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const { sendBookingSMS } = require('../utils/smsSendHelper');
const { sendBookingWhatsApp } = require('../services/whatsappFlow');

// Hardcoded test data
const TEST_EMAIL = "sahujipriyanshu2112@gmail.com";
const TEST_MOBILE = "918435837006";

const bookingDetails = {
    customerName: "Test User",
    bookingId: "TEST-BKG-12345",
    totalAmount: 15000,
    transactionId: "TXN-987654321",
    invoiceNumber: "INV-TEST-001",
    mobileNumber: TEST_MOBILE,
    email: TEST_EMAIL,
    travelStartDate: new Date(),
    travelEndDate: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000),
    selectedPackageId: {
        packageName: "Test Sample Tour Package",
        durationDays: 4,
        durationNights: 3,
        basePricePerPerson: 15000,
        itinerary: [
            { dayNumber: 1, dayTitle: "Arrival and Welcome", description: "Arrive at destination and welcome address." },
            { dayNumber: 2, dayTitle: "Local Sightseeing", description: "Visit the famous local spots." }
        ]
    }
};

const invoiceUrl = "https://example.com/invoice/TEST-BKG-12345.pdf";

// ─── TEST EMAIL ──────────────────────────────────
router.get('/email', async (req, res) => {
    try {
        console.log("[Test] Sending payment email to:", TEST_EMAIL);
        const paymentRes = await emailService.sendPaymentSuccessEmail(TEST_EMAIL, bookingDetails, invoiceUrl);
        console.log("[Test] ✅ Payment email sent");

        res.status(200).json({
            success: true,
            message: `Payment email sent to ${TEST_EMAIL}`,
            data: { paymentEmail: paymentRes.response }
        });
    } catch (error) {
        console.error("Test email error:", error);
        res.status(500).json({ success: false, message: "Failed to send email", error: error.message });
    }
});

// ─── TEST SMS ────────────────────────────────────
router.get('/sms', async (req, res) => {
    try {
        console.log("[Test] Sending SMS to:", TEST_MOBILE);
        const smsRes = await sendBookingSMS(TEST_MOBILE, bookingDetails.customerName, bookingDetails.bookingId, invoiceUrl);
        console.log("[Test] ✅ SMS sent");

        res.status(200).json({
            success: true,
            message: `SMS sent to ${TEST_MOBILE}`,
            data: { smsResult: smsRes }
        });
    } catch (error) {
        console.error("Test SMS error:", error);
        res.status(500).json({ success: false, message: "Failed to send SMS", error: error.message });
    }
});

// ─── TEST WHATSAPP ───────────────────────────────
router.get('/whatsapp', async (req, res) => {
    try {
        console.log("[Test] Sending WhatsApp to:", TEST_MOBILE);
        const waRes = await sendBookingWhatsApp(TEST_MOBILE, bookingDetails.customerName, bookingDetails.bookingId, bookingDetails.invoiceNumber, invoiceUrl);
        console.log("[Test] ✅ WhatsApp sent");

        res.status(200).json({
            success: true,
            message: `WhatsApp sent to ${TEST_MOBILE}`,
            data: { whatsappResult: waRes }
        });
    } catch (error) {
        console.error("Test WhatsApp error:", error);
        res.status(500).json({ success: false, message: "Failed to send WhatsApp", error: error.message });
    }
});

// ─── TEST ALL (Email + SMS + WhatsApp) ───────────
router.get('/all', async (req, res) => {
    try {
        console.log("[Test] Sending ALL notifications...");

        const [emailRes, smsRes, waRes] = await Promise.allSettled([
            emailService.sendPaymentSuccessEmail(TEST_EMAIL, bookingDetails, invoiceUrl),
            sendBookingSMS(TEST_MOBILE, bookingDetails.customerName, bookingDetails.bookingId, invoiceUrl),
            sendBookingWhatsApp(TEST_MOBILE, bookingDetails.customerName, bookingDetails.bookingId, bookingDetails.invoiceNumber, invoiceUrl),
        ]);

        console.log(`[Test] Email: ${emailRes.status} | SMS: ${smsRes.status} | WA: ${waRes.status}`);

        res.status(200).json({
            success: true,
            message: "All notifications triggered",
            data: {
                email: { status: emailRes.status, error: emailRes.reason?.message },
                sms: { status: smsRes.status, error: smsRes.reason?.message },
                whatsapp: { status: waRes.status, error: waRes.reason?.message },
            }
        });
    } catch (error) {
        console.error("Test all error:", error);
        res.status(500).json({ success: false, message: "Failed", error: error.message });
    }
});

module.exports = router;
