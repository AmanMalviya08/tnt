const { complaintModel } = require("../models/complaintModel");
const emailService = require("../services/emailService");
const Guide = require("../models/guideModel");
const { userModel } = require("../models/userModel");

class ComplaintController {
  constructor(model = complaintModel) {
    this.model = model;
  }

  async createComplaint(payload, files, user) {
    // Auto-set complainant from logged-in user
    if (user.role === "Guide") {
      const guide = await Guide.findOne({ userId: user.userId });
      if (!guide) {
        throw new Error("Guide profile not found for this user");
      }
      payload.complainantType = "Guide";
      payload.complainantId = guide._id;
    } else {
      payload.complainantType = "User";
      payload.complainantId = user.userId;
    }

    // Map uploaded files to media array
    if (files && files.length > 0) {
      payload.media = files.map((file) => ({
        url: file.location,
        type: file.mimetype.startsWith("video") ? "video" : "image",
        originalName: file.originalname,
      }));
    }

    const complaint = await this.model.create(payload);
    return complaint;
  }

  async getComplaints(filter = {}, options = {}) {
    if (filter.search) {
      const searchRegex = new RegExp(filter.search, "i");
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { complaintId: searchRegex },
      ];
      delete filter.search;
    }

    const query = this.model
      .find(filter)
      .populate("complainantId", "fullName firstName lastName email phone")
      .populate("againstId", "fullName firstName lastName email phone");

    // Sorting
    let sort = options.sort || options.sortBy;
    if (typeof sort === "string" && sort.trim()) {
      const order = options.sortOrder || options.order;
      const direction =
        typeof order === "string" && order.toLowerCase() === "desc" ? -1 : 1;
      query.sort({ [sort]: direction });
    } else {
      query.sort({ createdAt: -1 });
    }

    // Pagination
    const parsedLimit = parseInt(options.limit, 10);
    const shouldPaginate = !Number.isNaN(parsedLimit) && parsedLimit > 0;

    let currentPage = 1;
    if (shouldPaginate) {
      currentPage = parseInt(options.page, 10);
      if (Number.isNaN(currentPage) || currentPage < 1) {
        currentPage = 1;
      }
      const skip = (currentPage - 1) * parsedLimit;
      query.skip(skip).limit(parsedLimit);
    }

    const [data, totalItems] = await Promise.all([
      query.exec(),
      this.model.countDocuments(filter),
    ]);

    let pagination = null;
    if (shouldPaginate) {
      const totalPages = Math.max(Math.ceil(totalItems / parsedLimit), 1);
      pagination = {
        totalItems,
        totalPages,
        currentPage,
        pageSize: parsedLimit,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      };
    }

    return { data, pagination };
  }

  async getComplaintById(id) {
    return this.model
      .findById(id)
      .populate("complainantId", "fullName firstName lastName email phone")
      .populate("againstId", "fullName firstName lastName email phone");
  }

  async getMyComplaints(userId, role, filter = {}, options = {}) {
    // Find the complainantId based on role
    if (role === "Guide") {
      const guide = await Guide.findOne({ userId });
      if (!guide) {
        throw new Error("Guide profile not found for this user");
      }
      filter.complainantId = guide._id;
      filter.complainantType = "Guide";
    } else {
      filter.complainantId = userId;
      filter.complainantType = "User";
    }

    return this.getComplaints(filter, options);
  }

  async updateComplaintStatus(id, payload) {
    const complaint = await this.model.findById(id);
    if (!complaint) {
      throw new Error("Complaint not found");
    }

    complaint.status = payload.status;

    if (payload.adminNotes !== undefined) {
      complaint.adminNotes = payload.adminNotes;
    }

    if (payload.status === "Resolved") {
      complaint.resolvedAt = new Date();
    }

    await complaint.save();

    // Populate complainant to get email for notification
    await complaint.populate(
      "complainantId",
      "fullName firstName lastName email phone"
    );

    // Send email notification on status update
    const complainantEmail = complaint.complainantId?.email;
    if (complainantEmail) {
      try {
        await emailService.sendComplaintStatusEmail(
          complainantEmail,
          complaint
        );
      } catch (emailError) {
        console.error(
          "Failed to send complaint status email:",
          emailError.message
        );
      }
    }

    return complaint;
  }

  async deleteComplaint(id) {
    return this.model.findByIdAndDelete(id);
  }
}

module.exports = ComplaintController;
