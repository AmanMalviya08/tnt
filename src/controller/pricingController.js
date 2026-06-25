const { pricingRuleModel } = require("../models/pricingRuleModel");
const { pricingAuditLogModel } = require("../models/pricingAuditLogModel");
const {
  calculateDynamicPrice,
  calculateOccupancyBasedPrice,
  logPricingAudit,
} = require("../services/dynamicPricingService");

class PricingController {
  constructor(model = pricingRuleModel) {
    this.model = model;
  }

  async createRule(payload) {
    return new this.model(payload).save();
  }

  async updateRule(id, payload) {
    return this.model.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  }

  async deleteRule(id) {
    return this.model.findByIdAndDelete(id);
  }

  async listRules(filters = {}) {
    const query = {};
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive === "true";
    }
    if (filters.ruleType) query.ruleType = filters.ruleType;
    return this.model.find(query).sort({ priority: 1, createdAt: -1 }).lean();
  }

  async getRuleById(id) {
    return this.model.findById(id).lean();
  }

  async calculateQuote(req, res) {
    try {
      const {
        baseAmount,
        travelDate,
        packageId,
        tourId,
        adults,
      } = req.body;

      if (baseAmount === undefined || baseAmount === null) {
        return res.status(400).json({
          success: false,
          message: "baseAmount is required",
        });
      }

      const { tourModel } = require("../models/tourModel");
      const { packageModel } = require("../models/packageModel");
      let tourData = null;
      let demandFactor = 1;

      if (tourId) {
        tourData = await tourModel.findById(tourId).lean();
      }

      if (packageId) {
        const pkg = await packageModel.findById(packageId).select("demandFactor").lean();
        if (pkg?.demandFactor) demandFactor = pkg.demandFactor;
      }

      const result = await calculateOccupancyBasedPrice({
        baseAmount,
        travelDate: travelDate || new Date(),
        packageId,
        tourId,
        tourData,
        userId: req.user?.userId,
        adults: adults || 1,
        demandFactor,
      });

      await logPricingAudit({
        userId: req.user?.userId,
        packageId,
        tourId,
        baseAmount: result.baseAmount,
        finalAmount: result.subtotalBeforeTax,
        breakdown: result.breakdown,
        appliedRuleIds: result.appliedRuleIds,
        context: result.meta,
      });

      return res.status(200).json({
        success: true,
        message: "Price calculated successfully",
        data: result,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getAuditLogs(req, res) {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        pricingAuditLogModel
          .find({})
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        pricingAuditLogModel.countDocuments({}),
      ]);

      return res.status(200).json({
        success: true,
        data: items,
        pagination: {
          totalItems: total,
          currentPage: page,
          pageSize: limit,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = PricingController;
