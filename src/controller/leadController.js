const { leadModel, leadSources, leadStatuses, interestedServices } = require("../models/leadModel");
const cityModel = require("../models/cityModel");
const { packageModel } = require("../models/packageModel");

const TOUR_INTEREST_META = {
  "Tour Package": {
    label: "Package Tour",
    subtitle: "Holiday & family tour packages",
    icon: "package",
  },
  "Group Tour": {
    label: "Bus Tour",
    subtitle: "Religious & City bus tours",
    icon: "bus",
  },
};

const LEAD_STATUS_LABELS = {
  New: "New",
  Qualified: "Interested",
  "Follow Up": "Follow-up",
};

const DEFAULT_BUDGET_RANGES = [
  { id: "under10k", label: "Under ₹10k", min: 0, max: 10000 },
  { id: "10k-20k", label: "₹10k - ₹20k", min: 10000, max: 20000 },
  { id: "20k-50k", label: "₹20k - ₹50k", min: 20000, max: 50000 },
  { id: "above50k", label: "Above ₹50k", min: 50000, max: 500000 },
];

function formatInr(amount) {
  return Number(amount || 0).toLocaleString("en-IN");
}

function buildTravelMonths(count = 12) {
  const months = [];
  const now = new Date();

  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = date.toLocaleString("en-IN", { month: "long", year: "numeric" });
    months.push(label);
  }

  return months;
}

function buildBudgetRanges(packages = []) {
  const prices = packages
    .map((pkg) => Number(pkg.basePricePerPerson))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  if (!prices.length) {
    return DEFAULT_BUDGET_RANGES;
  }

  const min = prices[0];
  const max = prices[prices.length - 1];

  if (min === max) {
    return [{ id: "single-range", label: `Around ₹${formatInr(min)}`, min, max }];
  }

  const step = Math.ceil((max - min) / 4);
  const buckets = [];
  let start = min;

  for (let i = 0; i < 4 && start <= max; i += 1) {
    const end = i === 3 ? max : Math.min(start + step, max);
    const id = `range-${i}`;
    let label;

    if (i === 0) {
      label = `Under ₹${formatInr(end)}`;
    } else if (i === 3) {
      label = `Above ₹${formatInr(start)}`;
    } else {
      label = `₹${formatInr(start)} - ₹${formatInr(end)}`;
    }

    buckets.push({
      id,
      label,
      min: Math.floor(start),
      max: Math.ceil(end),
    });
    start = end;
  }

  return buckets;
}

function buildTravelerTypes(packages = []) {
  const adultPrices = packages
    .map((pkg) => Number(pkg.basePricePerPerson))
    .filter((price) => Number.isFinite(price) && price > 0);
  const childPrices = packages
    .map((pkg) => Number(pkg.childPrice ?? pkg.basePricePerPerson))
    .filter((price) => Number.isFinite(price) && price >= 0);

  const avgAdult = adultPrices.length
    ? Math.round(adultPrices.reduce((sum, price) => sum + price, 0) / adultPrices.length)
    : 0;
  const avgChild = childPrices.length
    ? Math.round(childPrices.reduce((sum, price) => sum + price, 0) / childPrices.length)
    : 0;

  return [
    {
      key: "adults",
      label: "Adult",
      ageHint: "14+ years",
      pricePerPerson: avgAdult,
      min: 1,
      max: 50,
    },
    {
      key: "children",
      label: "Children",
      ageHint: "Below 13",
      pricePerPerson: avgChild,
      min: 0,
      max: 50,
    },
    {
      key: "infants",
      label: "Infants",
      ageHint: "Below 2",
      pricePerPerson: 0,
      min: 0,
      max: 10,
    },
  ];
}

class LeadController {
  constructor(model = leadModel) {
    this.model = model;
  }

  async createLead(payload) {
    const lead = new this.model(payload);
    return lead.save();
  }

  async getLeads(filter = {}, options = {}) {
    if (filter.search) {
      const searchRegex = new RegExp(filter.search.trim(), "i");
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { source: searchRegex }
      ];
      delete filter.search;
    }

    const page = Math.max(parseInt(options.page, 10) || 1, 1);
    const limit = Math.max(parseInt(options.limit, 10) || 10, 1);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .populate("assignedAgent", "firstName lastName email phone")
        .populate("createdBy", "firstName lastName email")
        .populate("updatedBy", "firstName lastName email")
        .sort(options.sort || { createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.model.countDocuments(filter)
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getLeadById(id) {
    return this.model
      .findById(id)
      .populate("assignedAgent", "firstName lastName email phone")
      .populate("createdBy", "firstName lastName email")
      .populate("updatedBy", "firstName lastName email");
  }

  async updateLead(id, payload) {
    return this.model.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  }

  async deleteLead(id) {
    return this.model.findByIdAndDelete(id);
  }

  async getLeadFormMeta() {
    const [cities, packages] = await Promise.all([
      cityModel
        .find({ isDisabled: { $ne: true } })
        .select("cityName")
        .sort({ cityName: 1 })
        .lean(),
      packageModel
        .find({ isDisabled: { $ne: true }, status: "Active" })
        .select("basePricePerPerson childPrice")
        .lean(),
    ]);

    const destinations = cities.map((city) => city.cityName).filter(Boolean);

    const tourInterestOptions = interestedServices
      .filter((service) => TOUR_INTEREST_META[service])
      .map((service) => ({
        id: service,
        service,
        label: TOUR_INTEREST_META[service].label,
        subtitle: TOUR_INTEREST_META[service].subtitle,
        icon: TOUR_INTEREST_META[service].icon,
      }));

    const leadStatusPills = leadStatuses
      .filter((status) => LEAD_STATUS_LABELS[status])
      .map((id) => ({ id, label: LEAD_STATUS_LABELS[id] }));

    return {
      leadSources,
      leadStatuses,
      interestedServices,
      destinations,
      travelMonths: buildTravelMonths(12),
      budgetRanges: buildBudgetRanges(packages),
      travelerTypes: buildTravelerTypes(packages),
      tourInterestOptions,
      leadStatusPills,
    };
  }

  async exportLeadsExcel(req, res) {
    let tempFilePath = null;
    const fs = require("fs");
    const path = require("path");

    try {
      const leads = await this.model
        .find()
        .populate("assignedAgent", "firstName lastName email phone")
        .populate("createdBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .lean();

      if (!leads.length) {
        return res.status(404).json({
          success: false,
          message: "No leads found",
        });
      }

      const ExcelJS = require("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Leads");

      const allKeys = new Set();
      leads.forEach((l) => Object.keys(l).forEach((k) => allKeys.add(k)));
      
      allKeys.add("AssignedAgentName");
      allKeys.add("CreatedByName");
      
      const keysArray = Array.from(allKeys);

      worksheet.columns = keysArray.map((key) => ({
        header: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1").trim(),
        key: key,
      }));

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };

      leads.forEach((l) => {
        const rowData = {};
        keysArray.forEach((key) => {
          let val = l[key];
          
          if (key === "AssignedAgentName") {
            val = l.assignedAgent ? `${l.assignedAgent.firstName || ""} ${l.assignedAgent.lastName || ""}`.trim() : "-";
          } else if (key === "CreatedByName") {
            val = l.createdBy ? `${l.createdBy.firstName || ""} ${l.createdBy.lastName || ""}`.trim() : "-";
          } else if ((key === "assignedAgent" || key === "createdBy" || key === "updatedBy") && typeof val === "object") {
            val = val._id ? val._id.toString() : "-";
          }
          
          if (val === null || val === undefined) {
            rowData[key] = "-";
          } else if (val instanceof Date) {
            rowData[key] = val.toLocaleString("en-IN");
          } else if (typeof val === "object") {
            rowData[key] = JSON.stringify(val);
          } else {
            rowData[key] = val.toString();
          }
        });
        worksheet.addRow(rowData);
      });

      worksheet.columns.forEach((column) => {
        column.width = 25;
      });

      const timestamp = new Date().toISOString().split("T")[0];
      const uniqueId = Date.now();
      const filename = `Leads_${timestamp}_${uniqueId}.xlsx`;

      const tempDir = path.join(__dirname, "../../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      tempFilePath = path.join(tempDir, filename);
      await workbook.xlsx.writeFile(tempFilePath);

      const fileBuffer = fs.readFileSync(tempFilePath);

      const { s3Client } = require("../middleware/s3Upload");
      const { PutObjectCommand } = require("@aws-sdk/client-s3");

      const folderPath = process.env.BUCKET_FOLDER_PATH || "TourTravels/";
      const s3Key = `${folderPath}EXCEL/${filename}`;

      const uploadParams = {
        Bucket: process.env.LINODE_OBJECT_BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        ACL: "public-read",
        ContentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ContentDisposition: `attachment; filename="${filename}"`,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      const endpoint = process.env.LINODE_OBJECT_STORAGE_ENDPOINT;
      const bucket = process.env.LINODE_OBJECT_BUCKET;
      const fileUrl = `${endpoint}/${bucket}/${s3Key}`;

      fs.unlinkSync(tempFilePath);
      tempFilePath = null;

      return res.status(200).json({
        success: true,
        message: "Leads exported to Excel successfully",
        data: {
          fileUrl,
          filename,
          recordCount: leads.length,
          key: s3Key,
        },
      });
    } catch (error) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to export leads",
      });
    }
  }
}

module.exports = LeadController;
