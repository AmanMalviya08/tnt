const contactUsModel = require('../models/contactUsModel')
class ContactUsController {
    constructor(model = contactUsModel) {
        this.model = model;
    }

    async createContactUs(payload) {

        const contactUs = new this.model(payload);
        return contactUs.save();
    }

    async getContactUsById(id) {
        const contactUs = this.model.findById(id)
        return contactUs;
    }
    async getContactUs(filter = {}, options = {}) {

        const search = filter.search || options.search;
        if (search) {
            const searchRegex = new RegExp(search, "i");
            filter.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
            ];
            delete filter.search;
        }

        const query = this.model.find(filter);

        if (options.sort) {
            query.sort(options.sort);
        }

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

    // return this.model.findByIdAndUpdate(id, payload,{ new: true, runValidators: true });

    async exportContactUsExcel(req, res) {
        let tempFilePath = null;
        const fs = require("fs");
        const path = require("path");

        try {
            const contacts = await this.model
                .find()
                .sort({ createdAt: -1 })
                .lean();

            if (!contacts.length) {
                return res.status(404).json({
                    success: false,
                    message: "No contact requests found",
                });
            }

            const ExcelJS = require("exceljs");
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("ContactUs");

            const allKeys = new Set();
            contacts.forEach((c) => Object.keys(c).forEach((k) => allKeys.add(k)));
            
            allKeys.add("UserName");
            allKeys.add("UserEmail");
            
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

            contacts.forEach((c) => {
                const rowData = {};
                keysArray.forEach((key) => {
                    let val = c[key];
                    
                    if (key === "UserName") {
                        val = c.userId ? `${c.userId.firstName || ""} ${c.userId.lastName || ""}`.trim() : "-";
                    } else if (key === "UserEmail") {
                        val = c.userId && c.userId.email ? c.userId.email : "-";
                    } else if (key === "userId" && typeof val === "object") {
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
            const filename = `ContactUs_${timestamp}_${uniqueId}.xlsx`;

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
                message: "Contact requests exported to Excel successfully",
                data: {
                    fileUrl,
                    filename,
                    recordCount: contacts.length,
                    key: s3Key,
                },
            });
        } catch (error) {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try { fs.unlinkSync(tempFilePath); } catch (e) {}
            }
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to export contact requests",
            });
        }
    }


}

module.exports = ContactUsController;
