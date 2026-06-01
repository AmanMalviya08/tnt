const WhatsAppService = require("./whatsappService");

const whatsapp = new WhatsAppService();

const sendBookingWhatsApp = async (phone, name, bookingId, invoiceId, pdfUrl) => {
  try {
    await whatsapp.sendMessage(phone, {
      templateName: "zn_booking",
      variables: [name, bookingId, pdfUrl],
      userName: name
    });

    console.log("Template sent ✅");

    // await new Promise(r => setTimeout(r, 3000));

    // await whatsapp.sendMessage(phone, {
    //   documentUrl: pdfUrl,
    //   documentName: `Invoice_${bookingId}.pdf`,
    //   campaignName: "zn_booking",
    //   userName: name,
    //   variables: [name, bookingId, pdfUrl] // Required if the campaign expects params
    // });

    // console.log("PDF sent ✅");

  } catch (err) {
    console.error("WhatsApp Flow Error:", err);
  }
};

module.exports = { sendBookingWhatsApp };