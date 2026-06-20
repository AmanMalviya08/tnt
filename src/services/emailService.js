const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.fromEmail =
      process.env.EMAIL_FROM ||
      process.env.EMAIL_USER ||
      process.env.SMARTCLINIC_EMAIL_USER;

    this.smtpUser =
      process.env.EMAIL_USER || process.env.SMARTCLINIC_EMAIL_USER;

    this.smtpPass =
      process.env.EMAIL_PASS || process.env.SMARTCLINIC_EMAIL_PASS;

    if (!this.smtpUser || !this.smtpPass) {
      console.error(
        "[Email] WARNING: EMAIL_USER/EMAIL_PASS (or SMARTCLINIC_*) not set in .env"
      );
    }

    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpSecure = process.env.SMTP_SECURE === "true";

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: this.smtpUser,
        pass: this.smtpPass,
      },
      tls: { rejectUnauthorized: false },
    });

    this.transporter.verify((error) => {
      if (error) {
        if (error.code === "EAUTH") {
          console.error(
            "[Email] Authentication failed. For Gmail, use an App Password (not your login password). " +
              "Generate at: Google Account → Security → 2-Step Verification → App passwords"
          );
        } else {
          console.error("[Email] Transporter verification failed:", error.message);
        }
      } else {
        console.log("[Email] SMTP ready:", smtpHost, "as", this.fromEmail);
      }
    });
  }

  loadTemplate(filename) {
    const templatePath = path.join(__dirname, "../templates", filename);
    return fs.readFileSync(templatePath, "utf8");
  }

  applyReplacements(html, replacements) {
    let result = html;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.split(key).join(value ?? "");
    }
    return result;
  }

  getPaymentSuccessTemplate() {
    try {
      return this.loadTemplate("paymentSuccess.html");
    } catch {
      return `<p>Payment confirmed for {{customerName}}. Booking ID: {{bookingId}}. Amount: ₹{{amount}}</p>`;
    }
  }

  async sendPaymentSuccessEmail(to, bookingDetails, invoiceUrl) {
    if (!to) throw new Error("Recipient email is required");
    if (!this.smtpUser || !this.smtpPass) {
      throw new Error("Email SMTP credentials not configured in .env");
    }

    console.log("[Email] Sending payment confirmation to:", to);

    let html = this.getPaymentSuccessTemplate();
    const replacements = {
      "{{customerName}}": bookingDetails.customerName || "Valued Customer",
      "{{bookingId}}": bookingDetails.bookingId || "N/A",
      "{{amount}}": (bookingDetails.finalAmount || 0).toLocaleString("en-IN"),
      "{{invoiceUrl}}": invoiceUrl || "#",
      "{{transactionId}}": bookingDetails.transactionId || "N/A",
      "{{date}}": new Date().toLocaleDateString("en-IN"),
    };
    html = this.applyReplacements(html, replacements);

    const mailOptions = {
      from: `"Zunjarrao Yatra" <${this.fromEmail}>`,
      to,
      subject: `Booking Confirmed - ${bookingDetails.bookingId || "Your Trip"}`,
      html,
    };

    const info = await this.transporter.sendMail(mailOptions);
    console.log("[Email] Payment confirmation sent:", info.messageId);
    return info;
  }

  getItineraryTemplate(bookingDetails) {
    let itineraryHtml = "";
    const pkg = bookingDetails.selectedPackageId;

    if (pkg?.itinerary?.length) {
      itineraryHtml = pkg.itinerary
        .map((day) => {
          const placesName =
            day.placeIds?.length > 0
              ? day.placeIds.map((p) => p.placeName || "").filter(Boolean).join(", ")
              : "N/A";
          const meals =
            day.mealsIncluded?.length > 0 ? day.mealsIncluded.join(", ") : "None";
          const hotel = day.hotelDetails || "N/A";
          const transport = day.transportInfo || "N/A";

          return `
        <div style="margin-bottom: 20px; border-left: 4px solid #27ae60; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #2c3e50; font-size: 18px;">Day ${day.dayNumber}: ${day.dayTitle || "Activities"}</h3>
          <div style="color: #444; font-size: 14px; margin-bottom: 8px;">
            <strong>Places to Visit:</strong> ${placesName}<br/>
            <strong>Meals Included:</strong> ${meals}<br/>
            <strong>Hotel Details:</strong> ${hotel}<br/>
            <strong>Transport:</strong> ${transport}
          </div>
          <p style="color: #555; margin-top: 8px; margin-bottom: 0;">${day.description || "Details will be provided by your guide."}</p>
        </div>`;
        })
        .join("");
    } else {
      itineraryHtml =
        "<p>Your trip is booked! Standard itinerary applies; daily details will be shared closer to the travel date.</p>";
    }

    const packageName = pkg
      ? pkg.packageName
      : bookingDetails.selectedTourId
        ? bookingDetails.selectedTourId.tourName
        : "Your Trip";
    const customerName = bookingDetails.customerName || "Valued Customer";
    const durationDays = pkg?.durationDays || 0;
    const durationNights = pkg?.durationNights || 0;

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Trip Itinerary</title></head>
<body style="font-family: 'Segoe UI', sans-serif; color: #333; background: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
    <div style="background: #34495e; color: #fff; padding: 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">Your Trip Itinerary</h1>
    </div>
    <div style="padding: 30px;">
      <h2>Hello ${customerName},</h2>
      <p>We are excited to share the itinerary for your upcoming trip!</p>
      <div style="background: #ecf0f1; padding: 15px; border-radius: 5px; margin-bottom: 25px;">
        <p><strong>Package/Tour:</strong> ${packageName}</p>
        <p><strong>Duration:</strong> ${durationDays} Days / ${durationNights} Nights</p>
        <p><strong>Booking ID:</strong> ${bookingDetails.bookingId || "N/A"}</p>
      </div>
      <h2 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">Day-by-Day Itinerary</h2>
      ${itineraryHtml}
      <p style="margin-top: 30px;">Get ready for an amazing experience. We look forward to hosting you!</p>
    </div>
    <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
      <p>&copy; ${new Date().getFullYear()} Zunjarrao Yatra. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
  }

  async sendItineraryEmail(to, bookingDetails) {
    if (!to) throw new Error("Recipient email is required");
    if (!this.smtpUser || !this.smtpPass) {
      throw new Error("Email SMTP credentials not configured in .env");
    }

    console.log("[Email] Sending itinerary to:", to);
    const html = this.getItineraryTemplate(bookingDetails);

    const info = await this.transporter.sendMail({
      from: `"Zunjarrao Yatra" <${this.fromEmail}>`,
      to,
      subject: `Your Trip Itinerary - ${bookingDetails.bookingId || "Booking"}`,
      html,
    });

    console.log("[Email] Itinerary sent:", info.messageId);
    return info;
  }

  isConfigured() {
    return Boolean(this.smtpUser && this.smtpPass);
  }

  async sendGuideAllocationEmail(to, allocation) {
    if (!to) {
      console.warn("[Email] Guide allocation skipped: no recipient");
      return null;
    }
    if (!this.isConfigured()) {
      console.warn("[Email] Guide allocation skipped: SMTP not configured");
      return null;
    }

    try {
      console.log("[Email] Sending guide allocation to:", to);

      const guideName = allocation.guideId?.fullName || "Guide";
      const assignmentType = allocation.assignmentType || "Assignment";
      const hasTour = Boolean(allocation.tourId?._id);
      const tourName = hasTour ? allocation.tourId.tourName || "-" : null;
      const hasBooking = Boolean(allocation.bookingId?._id);
      const bookingId = hasBooking
        ? allocation.bookingId.bookingId || allocation.bookingId._id
        : null;

      const html = `
        <p>Hi ${guideName},</p>
        <p>You have been assigned a new ${assignmentType.toLowerCase()}.</p>
        ${tourName ? `<p><strong>Tour:</strong> ${tourName}</p>` : ""}
        ${bookingId ? `<p><strong>Booking ID:</strong> ${bookingId}</p>` : ""}
      `;

      return await this.transporter.sendMail({
        from: `"Zunjarrao Yatra" <${this.fromEmail}>`,
        to,
        subject: "New Guide Allocation Assigned",
        html,
      });
    } catch (error) {
      console.error("[Email] Guide allocation error:", error.message);
      return null;
    }
  }

  async sendComplaintStatusEmail(to, complaint) {
    if (!to || !this.isConfigured()) {
      return null;
    }

    try {
      const complainantName =
        complaint.complainantId?.fullName ||
        `${complaint.complainantId?.firstName || ""} ${complaint.complainantId?.lastName || ""}`.trim() ||
        "Valued Customer";
      const complaintId = complaint.complaintId || complaint._id;
      const status = complaint.status || "-";

      const html = `
        <p>Hi ${complainantName},</p>
        <p>Your complaint <strong>${complaintId}</strong> status has been updated to <strong>${status}</strong>.</p>
        <p>${complaint.adminNotes || "No additional notes."}</p>
      `;

      return await this.transporter.sendMail({
        from: `"Zunjarrao Yatra" <${this.fromEmail}>`,
        to,
        subject: `Complaint ${complaintId} - Status: ${status}`,
        html,
      });
    } catch (error) {
      console.error("[Email] Complaint status error:", error.message);
      return null;
    }
  }
}

module.exports = new EmailService();
