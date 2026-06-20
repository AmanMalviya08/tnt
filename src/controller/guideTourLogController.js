const mongoose = require("mongoose");
const Guide = require("../models/guideModel");
const { guideTourLogModel } = require("../models/guideTourLogModel");

class GuideTourLogController {
  constructor(model = guideTourLogModel) {
    this.model = model;
  }

  async resolveGuide(userId) {
    const guide = await Guide.findOne({ userId });
    if (!guide) {
      throw new Error("Guide profile not found for this user");
    }
    return guide;
  }

  async getMyTourLogs(userId, options = {}) {
    const guide = await this.resolveGuide(userId);

    const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);
    const parsedPage = parseInt(options.page, 10);
    const parsedLimit = parseInt(options.limit, 10);
    const pageSize = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE;
    const currentPage = !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const filter = { guideId: guide._id };
    if (options.allocationId) {
      filter.allocationId = new mongoose.Types.ObjectId(options.allocationId);
    }

    const [logs, totalItems] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.model.countDocuments(filter),
    ]);

    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

    return {
      data: logs,
      pagination: {
        totalItems,
        totalPages,
        pageSize,
        currentPage,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    };
  }

  async createTourLog(userId, payload = {}) {
    const guide = await this.resolveGuide(userId);
    const { albumName, images = [], feedback = "", allocationId } = payload;

    if (!albumName || !String(albumName).trim()) {
      throw new Error("Album name is required");
    }
    if (!Array.isArray(images) || !images.length) {
      throw new Error("At least one image is required");
    }

    const normalizedImages = images
      .map((item) => {
        if (typeof item === "string") return { url: item };
        if (item?.url) return { url: item.url };
        return null;
      })
      .filter(Boolean);

    if (!normalizedImages.length) {
      throw new Error("At least one valid image URL is required");
    }

    const log = await this.model.create({
      guideId: guide._id,
      allocationId: allocationId || null,
      albumName: String(albumName).trim(),
      images: normalizedImages,
      feedback: String(feedback || "").trim(),
      createdBy: userId,
    });

    return log.toObject();
  }

  async deleteTourLog(userId, logId) {
    const guide = await this.resolveGuide(userId);
    const log = await this.model.findOne({ _id: logId, guideId: guide._id });
    if (!log) {
      throw new Error("Tour log not found");
    }
    await log.deleteOne();
    return log.toObject();
  }

  async getLogsByAllocation(allocationId) {
    return this.model.find({ allocationId }).sort({ createdAt: -1 }).lean();
  }
}

module.exports = GuideTourLogController;
