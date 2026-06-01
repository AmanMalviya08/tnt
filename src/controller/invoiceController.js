const InvoiceService = require('../services/invoiceService');
const { bookingModel } = require('../models/bookingModel');
const WhatsAppService = require('../services/whatsappService');

class InvoiceController {
  constructor() {
    this.invoiceService = new InvoiceService();
    this.whatsappService = new WhatsAppService();
  }

   generateInvoice=async (req, res)=> {
    try {
      const { bookingId } = req.params;

      const booking = await bookingModel
        .findById(bookingId)
        .populate('selectedPackageId')
        .populate('selectedTourId')
        .populate('cityId')
        .populate('assignedAgent', 'firstName lastName email');

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

    //   if (booking.invoiceUrl) {
    //     return res.status(200).json({
    //       success: true,
    //       message: 'Invoice already exists',
    //       data: {
    //         invoiceNumber: booking.invoiceNumber,
    //         invoiceUrl: booking.invoiceUrl
    //       }
    //     });
    //   }

      const invoiceUrl = await this.invoiceService.generateInvoice(booking);
      booking.invoiceUrl = invoiceUrl;
      await booking.save();

      res.status(201).json({
        success: true,
        message: 'Invoice generated successfully',
        data: {
          invoiceNumber: booking.invoiceNumber,
          invoiceUrl: invoiceUrl
        }
      });

    } catch (error) {
      console.error('Error generating invoice:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate invoice'
      });
    }
  }

  async getInvoice(req, res) {
    try {
      const { bookingId } = req.params;

      const booking = await bookingModel
        .findById(bookingId)
        .populate('selectedPackageId')
        .populate('selectedTourId')
        .populate('cityId')
        .populate('assignedAgent', 'firstName lastName email');

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (!booking.invoiceUrl) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not generated yet'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Invoice details retrieved successfully',
        data: {
          invoiceNumber: booking.invoiceNumber,
          invoiceUrl: booking.invoiceUrl,
          bookingId: booking.bookingId,
          customerName: booking.customerName,
          totalAmount: booking.finalAmount,
          paymentStatus: booking.paymentStatus,
          createdAt: booking.createdAt
        }
      });

    } catch (error) {
      console.error('Error getting invoice:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get invoice'
      });
    }
  }
  async regenerateInvoice(req, res) {
    try {
      const { bookingId } = req.params;

      const booking = await bookingModel
        .findById(bookingId)
        .populate('selectedPackageId')
        .populate('selectedTourId')
        .populate('cityId')
        .populate('assignedAgent', 'firstName lastName email');

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (booking.invoiceUrl) {
        try {
          await this.invoiceService.deleteInvoice(booking.invoiceUrl);
        } catch (deleteError) {
          console.warn('Failed to delete old invoice:', deleteError.message);
        }
      }

      const invoiceUrl = await this.invoiceService.generateInvoice(booking);

      booking.invoiceUrl = invoiceUrl;
      await booking.save();

      res.status(200).json({
        success: true,
        message: 'Invoice regenerated successfully',
        data: {
          invoiceNumber: booking.invoiceNumber,
          invoiceUrl: invoiceUrl
        }
      });

    } catch (error) {
      console.error('Error regenerating invoice:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to regenerate invoice'
      });
    }
  }

  async deleteInvoice(req, res) {
    try {
      const { bookingId } = req.params;

      const booking = await bookingModel.findById(bookingId);

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (!booking.invoiceUrl) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      await this.invoiceService.deleteInvoice(booking.invoiceUrl);

      booking.invoiceUrl = '';
      await booking.save();

      res.status(200).json({
        success: true,
        message: 'Invoice deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting invoice:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete invoice'
      });
    }
  }

  async getAllInvoices(req, res) {
    try {
      const { page = 1, limit = 20, search, paymentStatus, bookingStatus } = req.query;

      // Build filter
      const filter = {
        invoiceUrl: { $exists: true, $ne: '' }
      };

      if (search) {
        filter.$or = [
          { customerName: { $regex: search, $options: 'i' } },
          { invoiceNumber: { $regex: search, $options: 'i' } },
          { bookingId: { $regex: search, $options: 'i' } }
        ];
      }

      if (paymentStatus) {
        filter.paymentStatus = paymentStatus;
      }

      if (bookingStatus) {
        filter.bookingStatus = bookingStatus;
      }

      // Calculate pagination
      const pageSize = parseInt(limit);
      const currentPage = parseInt(page);
      const skip = (currentPage - 1) * pageSize;

      // Get invoices
      const invoices = await bookingModel
        .find(filter)
        .select('invoiceNumber invoiceUrl bookingId customerName finalAmount paymentStatus bookingStatus createdAt')
        .populate('selectedPackageId', 'title')
        .populate('selectedTourId', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize);

      // Get total count
      const totalInvoices = await bookingModel.countDocuments(filter);
      const totalPages = Math.ceil(totalInvoices / pageSize);

      res.status(200).json({
        success: true,
        message: 'Invoices retrieved successfully',
        data: invoices,
        pagination: {
          currentPage,
          totalPages,
          totalInvoices,
          pageSize,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1
        }
      });

    } catch (error) {
      console.error('Error getting invoices:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get invoices'
      });
    }
  }

  async sendInvoiceWhatsApp(req, res) {
    try {
      const { bookingId } = req.params;
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      const booking = await bookingModel
        .findById(bookingId)
        .populate('selectedPackageId')
        .populate('selectedTourId')
        .populate('cityId')
        .populate('assignedAgent', 'firstName lastName email');

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (!booking.invoiceUrl) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not generated yet'
        });
      }

      // Send invoice as document via WhatsApp
      const result = await this.whatsappService.sendMessage(phone, {
        documentUrl: booking.invoiceUrl,
        documentName: `Invoice_${booking.invoiceNumber}.pdf`
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Invoice sent via WhatsApp successfully',
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send invoice via WhatsApp',
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error sending invoice via WhatsApp:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send invoice via WhatsApp'
      });
    }
  }
}

module.exports = new InvoiceController();
