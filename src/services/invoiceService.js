const puppeteer = require("puppeteer-core");
const InvoiceHelper = require("../utils/invoiceHelper");
const { s3Client } = require("../middleware/s3Upload");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { pdfLogger, elapsedMs } = require("../utils/logger");

class InvoiceService {
  constructor() {
    this.bucketName = process.env.LINODE_OBJECT_BUCKET;
  }

  async generateInvoice(booking) {
    const startTime = Date.now();
    const bookingRef = booking.bookingId || booking.invoiceNumber || "UNKNOWN";

    pdfLogger.info(`[generateInvoice] START`, {
      bookingId: bookingRef,
      invoiceNumber: booking.invoiceNumber,
      startTime: new Date(startTime).toISOString(),
    });

    try {
      pdfLogger.info(`[generateInvoice] Generating PDF buffer...`, { bookingId: bookingRef });
      const pdfBuffer = await this.generatePDFBuffer(booking);
      pdfLogger.info(`[generateInvoice] PDF buffer ready. Uploading to S3...`, { bookingId: bookingRef });

      const invoiceUrl = await this.uploadInvoiceToS3(
        pdfBuffer,
        booking.invoiceNumber || booking.bookingId || Date.now()
      );

      const endTime = Date.now();
      pdfLogger.info(`[generateInvoice] END - SUCCESS`, {
        bookingId: bookingRef,
        invoiceUrl,
        endTime: new Date(endTime).toISOString(),
        totalDuration: elapsedMs(startTime),
      });

      return invoiceUrl;
    } catch (error) {
      const endTime = Date.now();
      pdfLogger.error(`[generateInvoice] END - FAILED`, {
        bookingId: bookingRef,
        endTime: new Date(endTime).toISOString(),
        totalDuration: elapsedMs(startTime),
        error: error.message,
        stack: error.stack,
      });
      throw new Error("Failed to generate invoice");
    }
  }

  async generatePDFBuffer(booking) {
    const startTime = Date.now();
    const bookingRef = booking.bookingId || booking.invoiceNumber || "UNKNOWN";
    let browser;

    pdfLogger.info(`[generatePDFBuffer] START - Launching Puppeteer browser`, {
      bookingId: bookingRef,
      startTime: new Date(startTime).toISOString(),
      chromiumPath: process.env.CHROMIUM_PATH || "/usr/bin/chromium-browser",
    });

    try {
      const html =
        typeof booking === "string"
          ? booking
          : InvoiceHelper.getInvoiceHTML(booking);

      pdfLogger.debug(`[generatePDFBuffer] HTML template generated`, {
        bookingId: bookingRef,
        htmlLength: html.length,
        elapsed: elapsedMs(startTime),
      });

      pdfLogger.info(`[generatePDFBuffer] Launching browser...`, {
        bookingId: bookingRef,
        elapsed: elapsedMs(startTime),
      });

      browser = await puppeteer.launch({
        executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium-browser",
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });

      pdfLogger.info(`[generatePDFBuffer] Browser launched. Opening new page...`, {
        bookingId: bookingRef,
        elapsed: elapsedMs(startTime),
      });

      const page = await browser.newPage();

      pdfLogger.info(`[generatePDFBuffer] Page opened. Setting HTML content...`, {
        bookingId: bookingRef,
        elapsed: elapsedMs(startTime),
      });

      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });

      pdfLogger.info(`[generatePDFBuffer] HTML content set. Generating PDF...`, {
        bookingId: bookingRef,
        elapsed: elapsedMs(startTime),
      });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      });

      pdfLogger.info(`[generatePDFBuffer] PDF generated. Closing browser...`, {
        bookingId: bookingRef,
        pdfSizeKB: `${(pdfBuffer.length / 1024).toFixed(2)} KB`,
        elapsed: elapsedMs(startTime),
      });

      await browser.close();

      const endTime = Date.now();
      pdfLogger.info(`[generatePDFBuffer] END - SUCCESS`, {
        bookingId: bookingRef,
        pdfSizeKB: `${(pdfBuffer.length / 1024).toFixed(2)} KB`,
        endTime: new Date(endTime).toISOString(),
        totalDuration: elapsedMs(startTime),
      });

      return pdfBuffer;
    } catch (error) {
      const endTime = Date.now();
      pdfLogger.error(`[generatePDFBuffer] END - FAILED`, {
        bookingId: bookingRef,
        endTime: new Date(endTime).toISOString(),
        totalDuration: elapsedMs(startTime),
        error: error.message,
        stack: error.stack,
      });

      if (browser) {
        try {
          await browser.close();
          pdfLogger.info(`[generatePDFBuffer] Browser closed after error`, { bookingId: bookingRef });
        } catch (closeErr) {
          pdfLogger.warn(`[generatePDFBuffer] Could not close browser after error`, {
            bookingId: bookingRef,
            closeError: closeErr.message,
          });
        }
      }

      throw error;
    }
  }

  generateHeader(doc, booking) {

    doc
      .fillColor("#444444")
      .fontSize(20)
      .text("Tour & Travels", 50, 57)
      .fontSize(10)
      .text("123 Travel Street", 200, 50, { align: "right" })
      .text("New Delhi, India", 200, 65, { align: "right" });

    if (booking.gstNumber) {
      doc.text(`GSTIN: ${booking.gstNumber}`, 200, 80, { align: "right" });
    }

    doc.moveDown();

    doc
      .fillColor("#000000")
      .fontSize(20)
      .text("INVOICE", 50, 100, { align: "center" })
      .moveDown();
  }

  generateCustomerInformation(doc, booking) {
    doc.fillColor("#444444").fontSize(20).text("Invoice", 50, 160);

    const invoiceDate = booking.createdAt
      ? new Date(booking.createdAt).toLocaleDateString("en-IN")
      : new Date().toLocaleDateString("en-IN");

    const status = booking.paymentStatus || "Pending";

    this.generateHr(doc, 185);

    const customerInformationTop = 200;

    doc
      .fontSize(10)
      .text("Invoice Number:", 50, customerInformationTop)
      .font("Helvetica-Bold")
      .text(booking.invoiceNumber || booking.bookingId || "-", 150, customerInformationTop)
      .font("Helvetica")
      .text("Invoice Date:", 50, customerInformationTop + 15)
      .text(invoiceDate, 150, customerInformationTop + 15)
      .text("Payment Status:", 50, customerInformationTop + 30)
      .fillColor(status === "Paid" ? "#27ae60" : "#e74c3c")
      .font("Helvetica-Bold")
      .text(status, 150, customerInformationTop + 30)
      .fillColor("#444444")
      .font("Helvetica")
      .text("Customer Name:", 300, customerInformationTop)
      .font("Helvetica-Bold")
      .text(booking.customerName || "-", 400, customerInformationTop)
      .font("Helvetica")
      .text("Email:", 300, customerInformationTop + 15)
      .text(booking.email || "-", 400, customerInformationTop + 15)
      .moveDown();

    this.generateHr(doc, 252);
  }

  generateInvoiceTable(doc, booking) {
    let i = 300;

    const packageName =
      booking.selectedPackageId?.title ||
      booking.selectedTourId?.tourName ||
      "Travel Booking";
    const adults = booking.adults || 0;
    const children = booking.children || 0;
    const addOnsTotal = booking.addOnsTotal || 0;

    doc.font("Helvetica-Bold");
    this.generateTableRow(doc, i, "Item", "Quantity", "Price", "Total");
    this.generateHr(doc, i + 20);
    doc.font("Helvetica");

    if (adults > 0) {
      i += 30;
      const adultPrice =
        booking.selectedPackageId?.basePricePerPerson ||
        booking.selectedTourId?.perPersonCost ||
        booking.packageCostPerPerson ||
        0;
      const adultTotal = adultPrice * adults;
      this.generateTableRow(
        doc,
        i,
        `${packageName} (Adults)`,
        adults,
        this.formatCurrency(adultPrice),
        this.formatCurrency(adultTotal)
      );
    }

    if (children > 0) {
      i += 30;
      const childPrice =
        booking.selectedPackageId?.childPrice ||
        booking.selectedTourId?.perPersonCost ||
        booking.childCostPerPerson ||
        0;
      const childTotal = childPrice * children;
      this.generateTableRow(
        doc,
        i,
        `${packageName} (Children)`,
        children,
        this.formatCurrency(childPrice),
        this.formatCurrency(childTotal)
      );
    }

    if (addOnsTotal > 0) {
      i += 30;
      this.generateTableRow(doc, i, "Add-ons", "-", "-", this.formatCurrency(addOnsTotal));
    }

    this.generateHr(doc, i + 30);

    const subtotalPosition = i + 45;
    const taxAmount = booking.taxAmount || 0;
    const taxPercent = booking.taxPercent || 0;
    const subtotal = (booking.finalAmount || 0) - taxAmount;
    const totalAmount = booking.finalAmount || booking.totalAmount || 0;

    doc.font("Helvetica-Bold");

    this.generateTableRow(
      doc,
      subtotalPosition,
      "",
      "",
      "Subtotal",
      this.formatCurrency(subtotal)
    );

    if (taxAmount > 0) {
      this.generateTableRow(
        doc,
        subtotalPosition + 20,
        "",
        "",
        `GST (${taxPercent}%)`,
        this.formatCurrency(taxAmount)
      );
    }

    const totalRow = taxAmount > 0 ? subtotalPosition + 40 : subtotalPosition + 20;
    this.generateHr(doc, totalRow - 5);
    this.generateTableRow(
      doc,
      totalRow,
      "",
      "",
      "Total Due",
      this.formatCurrency(totalAmount)
    );
    doc.font("Helvetica");

    if (booking.travelerDetails && booking.travelerDetails.length > 0) {
      let y = totalRow + 30;
      this.generateHr(doc, y);
      y += 20;
      doc.font("Helvetica-Bold").fontSize(12).text("Traveler Details", 50, y);
      y += 25;
      doc.fontSize(10);

      booking.travelerDetails.forEach((t, idx) => {
        doc.text(
          `${idx + 1}. ${t.name || "N/A"} (${t.gender || "-"}, ${t.age || "-"} yrs)`,
          50,
          y
        );
        y += 15;
      });
    }
  }

  generateFooter(doc) {
    doc
      .fontSize(10)
      .text(
        "Payment is due within 15 days. Thank you for your business.",
        50,
        780,
        { align: "center", width: 500 }
      );
  }

  generateTableRow(doc, y, item, quantity, price, total) {
    doc
      .fontSize(10)
      .text(item, 50, y)
      .text(quantity, 280, y, { width: 90, align: "right" })
      .text(price, 370, y, { width: 90, align: "right" })
      .text(total, 0, y, { align: "right" });
  }

  generateHr(doc, y) {
    doc
      .strokeColor("#aaaaaa")
      .lineWidth(1)
      .moveTo(50, y)
      .lineTo(550, y)
      .stroke();
  }

  formatCurrency(amount) {
    return "Rs. " + (amount || 0).toLocaleString("en-IN");
  }

  async uploadInvoiceToS3(pdfBuffer, invoiceNumber) {
    const startTime = Date.now();
    pdfLogger.info(`[uploadInvoiceToS3] START - Uploading to S3`, {
      invoiceNumber,
      startTime: new Date(startTime).toISOString(),
      pdfSizeKB: `${(pdfBuffer.length / 1024).toFixed(2)} KB`,
    });

    try {
      const fileName = `invoice_${invoiceNumber}_${Date.now()}.pdf`;
      const key = `TourTravels/INVOICES/${fileName}`;

      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: pdfBuffer,
        ContentType: "application/pdf",
        ACL: "public-read",
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      const endpoint =
        process.env.LINODE_OBJECT_STORAGE_ENDPOINT ||
        "https://in-maa-1.linodeobjects.com";
      const invoiceUrl = `${endpoint}/${this.bucketName}/${key}`;

      const endTime = Date.now();
      pdfLogger.info(`[uploadInvoiceToS3] END - SUCCESS`, {
        invoiceNumber,
        invoiceUrl,
        endTime: new Date(endTime).toISOString(),
        totalDuration: elapsedMs(startTime),
      });

      return invoiceUrl;
    } catch (error) {
      const endTime = Date.now();
      pdfLogger.error(`[uploadInvoiceToS3] END - FAILED`, {
        invoiceNumber,
        endTime: new Date(endTime).toISOString(),
        totalDuration: elapsedMs(startTime),
        error: error.message,
        stack: error.stack,
      });
      throw new Error("Failed to upload invoice");
    }
  }

  async deleteInvoice(invoiceUrl) {
    try {
      const endpoint =
        process.env.LINODE_OBJECT_STORAGE_ENDPOINT ||
        "https://in-maa-1.linodeobjects.com";
      const key = invoiceUrl.replace(`${endpoint}/${this.bucketName}/`, "");

      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      return true;
    } catch (error) {
      pdfLogger.error(`[deleteInvoice] FAILED`, {
        invoiceUrl,
        error: error.message,
        stack: error.stack,
      });
      throw new Error("Failed to delete invoice");
    }
  }
}

module.exports = InvoiceService;
