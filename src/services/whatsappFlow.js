const WhatsAppService = require("./whatsappService");

const whatsapp = new WhatsAppService();

const sendBookingWhatsApp = async (phone, name, bookingId, invoiceId, pdfUrl) => {
  const safeName = name || "Customer";
  const safeBookingId = bookingId || "N/A";
  const safeInvoiceId = invoiceId || safeBookingId;
  const safePdfUrl = pdfUrl || "https://zunjarraoyatra.com";

  const result = await whatsapp.sendMessage(phone, {
    templateName: "zn_booking",
    variables: [safeName, safeBookingId, safePdfUrl || safeInvoiceId],
    userName: safeName,
  });

  if (!result?.success) {
    throw new Error(
      `WhatsApp booking confirmation failed: ${JSON.stringify(result?.error || result)}`
    );
  }

  console.log(`[WhatsApp] Booking confirmation sent to ${phone} via ${result.provider}`);
  return result;
};

module.exports = { sendBookingWhatsApp };
