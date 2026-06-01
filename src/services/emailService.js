const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    if (!process.env.EMAIL_USER && !process.env.SMARTCLINIC_EMAIL_USER) {
      console.error("WARNING: EMAIL_USER not configured");
    }
    if (!process.env.EMAIL_PASS && !process.env.SMARTCLINIC_EMAIL_PASS) {
      console.error("WARNING: EMAIL_PASS not configured");
    }

    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER || process.env.SMARTCLINIC_EMAIL_USER || "zunzarraoyatra@gmail.com",
        pass: process.env.EMAIL_PASS || process.env.SMARTCLINIC_EMAIL_PASS || "lethqvszmvetbsnv",
      },
    });

    this.transporter.verify((error) => {
      if (error) {
        if (error.code === 'EAUTH') {
          console.warn("⚠️  [Email Config] Nodemailer authentication failed (Bad Credentials).");
        } else {
          console.error("❌ Email transporter verification failed:", error.message);
        }
      } else {
        console.log("✅ Email server is ready to send messages");
      }
    });
  }

  getPaymentSuccessTemplate() {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payment Successful</title>
<style>
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #333;
  margin: 0;
  padding: 0;
  background-color: #f4f4f4;
}
.container {
  max-width: 600px;
  margin: 20px auto;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  overflow: hidden;
}
.header {
  background-color: #27ae60;
  color: #ffffff;
  padding: 20px;
  text-align: center;
}
.header h1 {
  margin: 0;
  font-size: 24px;
}
.content {
  padding: 30px;
}
.success-icon {
  text-align: center;
  font-size: 48px;
  color: #27ae60;
  margin-bottom: 20px;
}
.details-table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
}
.details-table th {
  text-align: left;
  padding: 10px;
  border-bottom: 1px solid #ddd;
  color: #666;
}
.details-table td {
  text-align: right;
  padding: 10px;
  border-bottom: 1px solid #ddd;
  font-weight: bold;
}
.btn {
  display: inline-block;
  background-color: #27ae60;
  color: #ffffff;
  text-decoration: none;
  padding: 12px 25px;
  border-radius: 5px;
  font-weight: bold;
  margin-top: 20px;
  text-align: center;
}
.footer {
  background-color: #f8f9fa;
  padding: 20px;
  text-align: center;
  font-size: 12px;
  color: #666;
}
.center {
  text-align: center;
}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Payment Confirmation</h1>
  </div>
  <div class="content">
    <div class="success-icon">✓</div>
    <h2 style="text-align: center; margin-top: 0;">Thank You!</h2>
    <p style="text-align: center;">
      Your payment has been successfully processed. Your booking is now confirmed.
    </p>
    <table class="details-table">
      <tr>
        <th>Customer Name</th>
        <td>{{customerName}}</td>
      </tr>
      <tr>
        <th>Booking ID</th>
        <td>{{bookingId}}</td>
      </tr>
      <tr>
        <th>Transaction ID</th>
        <td>{{transactionId}}</td>
      </tr>
      <tr>
        <th>Date</th>
        <td>{{date}}</td>
      </tr>
      <tr>
        <th>Amount Paid</th>
        <td>₹{{amount}}</td>
      </tr>
    </table>
    <div class="center">
      <p>Please find your invoice details below or download it using the button.</p>
      <a href="{{invoiceUrl}}" class="btn">Download Invoice</a>
    </div>
  </div>
  <div class="footer">
    <p>If you have any questions, please contact our support team.</p>
    <p>&copy; 2024 Tour and Travel. All rights reserved.</p>
  </div>
</div>
</body>
</html>
`;
  }

  async sendPaymentSuccessEmail(to, bookingDetails, invoiceUrl) {
    try {
      console.log("Preparing to send email to:", to);

      let html = this.getPaymentSuccessTemplate();

      const replacements = {
        "{{customerName}}": bookingDetails.customerName || "Valued Customer",
        "{{bookingId}}": bookingDetails.bookingId || "N/A",
        "{{amount}}": (bookingDetails.finalAmount || 0).toLocaleString("en-IN"),
        "{{invoiceUrl}}": invoiceUrl || "#",
        "{{transactionId}}": bookingDetails.transactionId || "N/A",
        "{{date}}": new Date().toLocaleDateString("en-IN"),
      };

      for (const [key, value] of Object.entries(replacements)) {
        html = html.split(key).join(value || "");
      }

      const mailOptions = {
        from: process.env.EMAIL_USER || process.env.SMARTCLINIC_EMAIL_USER || "zunzarraoyatra@gmail.com",
        to,
        subject: "Payment Successful - Booking Confirmation",
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", info.response);
      return info;
    } catch (error) {
      console.error("Error sending email:", error.message);
      throw error;
    }
  }

  getItineraryTemplate(bookingDetails) {
    let itineraryHtml = '';
    const pkg = bookingDetails.selectedPackageId;

    if (pkg && pkg.itinerary && pkg.itinerary.length > 0) {
      itineraryHtml = pkg.itinerary.map(day => {
        const placesName = day.placeIds && day.placeIds.length > 0
          ? day.placeIds.map(p => p.placeName || "").filter(Boolean).join(", ")
          : "N/A";
        const meals = day.mealsIncluded && day.mealsIncluded.length > 0 ? day.mealsIncluded.join(", ") : "None";
        const hotel = day.hotelDetails || "N/A";
        const transport = day.transportInfo || "N/A";

        return `
        <div style="margin-bottom: 20px; border-left: 4px solid #27ae60; padding-left: 15px; background-color: #f9f9f9; padding: 15px; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #2c3e50; font-size: 18px;">Day ${day.dayNumber}: ${day.dayTitle || 'Activities'}</h3>
          <div style="color: #444; font-size: 14px; margin-bottom: 8px;">
            <strong>Places to Visit:</strong> ${placesName}<br/>
            <strong>Meals Included:</strong> ${meals}<br/>
            <strong>Hotel Details:</strong> ${hotel}<br/>
            <strong>Transport:</strong> ${transport}
          </div>
          <p style="color: #555; margin-top: 8px; margin-bottom: 0;">${day.description || 'Details will be provided by your guide.'}</p>
        </div>
      `}).join('');
    } else {
      itineraryHtml = '<p>Your trip is booked! Standard itinerary applies, specific daily details will be shared closer to the travel date.</p>';
    }

    const packageName = pkg ? pkg.packageName : (bookingDetails.selectedTourId ? bookingDetails.selectedTourId.tourName : 'Your Trip');
    const customerName = bookingDetails.customerName || "Valued Customer";
    const durationDays = pkg ? (pkg.durationDays || 0) : 0;
    const durationNights = pkg ? (pkg.durationNights || 0) : 0;

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Trip Itinerary</title>
<style>
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #333;
  margin: 0;
  padding: 0;
  background-color: #f4f4f4;
}
.container {
  max-width: 600px;
  margin: 20px auto;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  overflow: hidden;
}
.header {
  background-color: #34495e;
  color: #ffffff;
  padding: 20px;
  text-align: center;
}
.header h1 {
  margin: 0;
  font-size: 24px;
}
.content {
  padding: 30px;
}
.trip-summary {
  background-color: #ecf0f1;
  padding: 15px;
  border-radius: 5px;
  margin-bottom: 25px;
}
.trip-summary p {
  margin: 5px 0;
}
.footer {
  background-color: #f8f9fa;
  padding: 20px;
  text-align: center;
  font-size: 12px;
  color: #666;
}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Your Trip Itinerary</h1>
  </div>
  <div class="content">
    <h2>Hello ${customerName},</h2>
    <p>We are excited to share the itinerary details for your upcoming trip!</p>
    
    <div class="trip-summary">
      <p><strong>Package/Tour:</strong> ${packageName}</p>
      <p><strong>Duration:</strong> ${durationDays} Days / ${durationNights} Nights</p>
      <p><strong>Booking ID:</strong> ${bookingDetails.bookingId || "N/A"}</p>
    </div>

    <h2 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">Day-by-Day Itinerary</h2>
    ${itineraryHtml}
    
    <p style="margin-top: 30px;">Get ready for an amazing experience. We look forward to hosting you!</p>
  </div>
  <div class="footer">
    <p>If you have any questions, please contact our support team.</p>
    <p>&copy; ${new Date().getFullYear()} Tour and Travel. All rights reserved.</p>
  </div>
</div>
</body>
</html>
`;
  }

  async sendItineraryEmail(to, bookingDetails) {
    try {
      console.log("Preparing to send itinerary email to:", to);

      const html = this.getItineraryTemplate(bookingDetails);

      const mailOptions = {
        from: process.env.EMAIL_USER || process.env.SMARTCLINIC_EMAIL_USER,
        to,
        subject: "Your Trip Itinerary Details",
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log("Itinerary email sent successfully:", info.response);
      return info;
    } catch (error) {
      console.error("Error sending itinerary email:", error.message);
      throw error;
    }
  }

  async sendGuideAllocationEmail(to, allocation) {
    try {
      console.log("Preparing to send guide allocation email to:", to);

      const guideName = allocation.guideId?.fullName || "Guide";
      const assignmentType = allocation.assignmentType || "Assignment";

      const hasTour = Boolean(allocation.tourId && allocation.tourId._id);
      const tourId = hasTour ? allocation.tourId._id : null;
      const tourName = hasTour ? allocation.tourId.tourName || "-" : null;
      const packageName = hasTour ? allocation.tourId?.packageId?.packageName || "-" : null;
      const packageDuration = hasTour && allocation.tourId?.packageId?.durationDays
        ? `${allocation.tourId.packageId.durationDays} day(s)`
        : null;
      const packageDurationNights = hasTour && allocation.tourId?.packageId?.durationNights
        ? `${allocation.tourId.packageId.durationNights} night(s)`
        : null;
      const packagePrice = hasTour && allocation.tourId?.packageId?.basePricePerPerson
        ? `₹${allocation.tourId.packageId.basePricePerPerson.toLocaleString("en-IN")}`
        : null;

      const hasBooking = Boolean(allocation.bookingId && allocation.bookingId._id);
      const bookingId = hasBooking ? (allocation.bookingId.bookingId || allocation.bookingId._id) : null;
      const bookingCustomer = hasBooking ? (allocation.bookingId.customerName || "-") : null;
      const bookingMobile = hasBooking ? (allocation.bookingId.mobileNumber || "-") : null;
      const bookingEmail = hasBooking ? (allocation.bookingId.email || "-") : null;
      const bookingType = hasBooking ? (allocation.bookingId.bookingType || "-") : null;
      const bookingTravelers = hasBooking ? (allocation.bookingId.numberOfTravelers != null ? allocation.bookingId.numberOfTravelers : "-") : null;

      const bookingPackageName = hasBooking ? (allocation.bookingId.selectedPackageId?.packageName || "-") : null;
      const bookingPackageDuration = hasBooking && allocation.bookingId.selectedPackageId?.durationDays
        ? `${allocation.bookingId.selectedPackageId.durationDays} day(s)`
        : null;
      const bookingPackageDurationNights = hasBooking && allocation.bookingId.selectedPackageId?.durationNights
        ? `${allocation.bookingId.selectedPackageId.durationNights} night(s)`
        : null;
      const bookingPackagePrice = hasBooking && allocation.bookingId.selectedPackageId?.basePricePerPerson
        ? `₹${allocation.bookingId.selectedPackageId.basePricePerPerson.toLocaleString("en-IN")}`
        : null;

      const bookingStartDate = hasBooking && allocation.bookingId.travelStartDate
        ? new Date(allocation.bookingId.travelStartDate).toLocaleDateString("en-IN")
        : null;
      const bookingEndDate = hasBooking && allocation.bookingId.travelEndDate
        ? new Date(allocation.bookingId.travelEndDate).toLocaleDateString("en-IN")
        : null;

      const startDate = allocation.startDate
        ? new Date(allocation.startDate).toLocaleDateString("en-IN")
        : "TBD";
      const endDate = allocation.endDate
        ? new Date(allocation.endDate).toLocaleDateString("en-IN")
        : "TBD";
      const reason = allocation.transferReason || allocation.transferHistory?.[allocation.transferHistory.length - 1]?.reason || "-";
      const notes = allocation.notes || "-";

      const tourSection = hasTour ? `
      <tr><th>Tour</th><td>${tourName}</td></tr>
      <tr><th>Tour ID</th><td>${tourId}</td></tr>
      <tr><th>Package</th><td>${packageName}</td></tr>
      <tr><th>Duration (Package)</th><td>${packageDuration || "-"}</td></tr>
      <tr><th>Duration (Nights)</th><td>${packageDurationNights || "-"}</td></tr>
      ` : "";

      const bookingSection = hasBooking ? `
      <tr><th>Booking ID</th><td>${bookingId}</td></tr>
      <tr><th>Booking Type</th><td>${bookingType}</td></tr>
      <tr><th>Travelers</th><td>${bookingTravelers}</td></tr>
      <tr><th>Package</th><td>${bookingPackageName || "-"}</td></tr>
      <tr><th>Package Duration</th><td>${bookingPackageDuration || "-"}</td></tr>
      <tr><th>Package Duration (Nights)</th><td>${bookingPackageDurationNights || "-"}</td></tr>
      <tr><th>Travel Start</th><td>${bookingStartDate || "-"}</td></tr>
      <tr><th>Travel End</th><td>${bookingEndDate || "-"}</td></tr>
      ` : "";

      const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Guide Allocation</title>
<style>
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
.container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); overflow: hidden; }
.header { background-color: #34495e; color: #ffffff; padding: 20px; text-align: center; }
.header h1 { margin: 0; font-size: 24px; }
.content { padding: 30px; }
.details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
.details-table th { text-align: left; padding: 10px; border-bottom: 1px solid #ddd; color: #666; }
.details-table td { text-align: right; padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; }
.footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Guide Assignment Notification</h1>
  </div>
  <div class="content">
    <p>Hi ${guideName},</p>
    <p>You have been assigned a new ${assignmentType.toLowerCase()}.</p>
    <table class="details-table">
      <tr><th>Assignment Type</th><td>${assignmentType}</td></tr>
      ${tourSection}
      ${bookingSection}
      <tr><th>Reason</th><td>${reason}</td></tr>
      <tr><th>Notes</th><td>${notes}</td></tr>
    </table>
    <p>Please reach out to the operations team if you have any questions.</p>
  </div>
  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} Tour and Travel. All rights reserved.</p>
  </div>
</div>
</body>
</html>
`;

      const mailOptions = {
        from: process.env.EMAIL_USER || process.env.SMARTCLINIC_EMAIL_USER,
        to,
        subject: "New Guide Allocation Assigned",
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log("Guide allocation email sent successfully:", info.response);
      return info;
    } catch (error) {
      console.error("Error sending guide allocation email:", error.message);
      throw error;
    }
  }
}

module.exports = new EmailService();
