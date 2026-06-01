const { leadModel } = require("../models/leadModel");

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
