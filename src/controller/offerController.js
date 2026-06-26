const offerModel = require("../models/offerModel");
const DEFAULT_PAGE_SIZE = parseInt(process.env.DEFAULT_PAGE_SIZE || "20", 10);

function normalizeOfferPayload(payload = {}) {
  const data = { ...payload };
  if (data.couponCode) {
    data.couponCode = String(data.couponCode).trim().toUpperCase();
  }
  if (data.discountValue != null) {
    data.discountValue = Number(data.discountValue);
  }
  return data;
}

class OfferController {
  constructor(model = offerModel) {
    this.model = model;
  }

  async addOffer(payload) {
    const banner = await this.model.create(normalizeOfferPayload(payload));
    return banner;
  }

  async updateOffer(id, payload) {
    const banner = await this.model.findByIdAndUpdate(
      id,
      normalizeOfferPayload(payload),
      { new: true, runValidators: true }
    );
    return banner;
  }

  async deleteOffer(id) {
    return this.model.findByIdAndDelete(id);
  }

  async getOffer(id) {
    const banner = await this.model.findById(id);
    return banner;
  }

  async getAllOffers(options = {}, filter = {}) {
    const merged = { ...filter, ...options };
    const { page = 1, limit = DEFAULT_PAGE_SIZE, type, isDisabled, active } = merged;
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    const pageSize = !Number.isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE;
    const currentPage = !Number.isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const normalisedFilter = {};
    if (type) normalisedFilter.type = type;
    if (isDisabled !== undefined) {
      normalisedFilter.isDisabled = isDisabled === true || isDisabled === "true";
    }
    if (active === true || active === "true") {
      const now = new Date();
      normalisedFilter.isDisabled = false;
      normalisedFilter.startDate = { $lte: now };
      normalisedFilter.endDate = { $gte: now };
    }

    const banners = await this.model
      .find(normalisedFilter)
      .skip((currentPage - 1) * pageSize)
      .limit(parseInt(pageSize, 10))
      .sort({ createdAt: -1 });

    const totalItems = await this.model.countDocuments(normalisedFilter);
    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);

    return {
      data: banners,
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
}

module.exports = OfferController;
