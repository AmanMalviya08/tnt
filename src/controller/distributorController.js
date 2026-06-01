const mongoose = require("mongoose");
const { userModel } = require("../models/userModel");
const { agentModel } = require("../models/agentModel");
const Transaction = require("../models/transactionModel");
const ExcelJS = require("exceljs");

const { s3Client } = require("../middleware/s3Upload");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

exports.transferCreditMoney = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const distributorId = req.user.userId;
        const { agentId, amount } = req.body;

        if (!agentId || !amount || amount <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Valid agentId and amount are required" });
        }

        const distributor = await userModel.findById(distributorId).session(session);
        if (!distributor) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: "Distributor not found" });
        }

        if (distributor.credit_money < amount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Insufficient credit money" });
        }

        const agent = await agentModel.findById(agentId).session(session);
        if (!agent) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: "Agent not found" });
        }

        if (agent.createdBy?.toString() !== distributorId?.toString()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "agent not belong to this distributer" });
        }

        // Deduct from distributor
        distributor.credit_money -= amount;
        await distributor.save({ session });

        // Add to agent's separate wallet
        agent.wallet += amount; 
        await agent.save({ session });

        // Also add to agent's user account wallet if applicable
        if (agent.userId) {
            const agentUser = await userModel.findById(agent.userId).session(session);
            if (agentUser) {
                agentUser.wallet += amount;
                await agentUser.save({ session });
            }
        }

        // Create transaction document for Distributor (Debit)
        const distributorTx = new Transaction({
            userId: distributorId,
            amount: amount,
            type: "Debit",
            category: "Transfer",
            status: "Completed",
            description: `Transferred credit money to agent ${agent.firstName || ''} ${agent.lastName || ''}`,
            createdBy: distributorId
        });
        await distributorTx.save({ session });

        // Create transaction document for Agent (Credit)
        const agentTx = new Transaction({
            userId: agent.userId || agentId,
            amount: amount,
            type: "Credit",
            category: "Transfer",
            status: "Completed",
            description: `Received credit money from distributor ${distributor.firstName || ''} ${distributor.lastName || ''}`,
            createdBy: distributorId
        });
        await agentTx.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            message: "Credit money transferred successfully",
            data: {
                distributorCreditMoney: distributor.credit_money,
                agentWallet: agent.wallet
            }
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error in transferCreditMoney:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

exports.getDistributorDashboard = async (req, res) => {
    try {
        const userId = req.user.userId;

        const distributor = await userModel.findById(userId).select("wallet firstName lastName email phone").lean();
        if (!distributor) {
            return res.status(404).json({ success: false, message: "Distributor not found" });
        }

        const agentCount = await agentModel.countDocuments({ createdBy: userId });
        const agents = await agentModel.find({ createdBy: userId })
            .select("firstName lastName email phone status wallet totalBookingsHandled createdAt")
            .sort({ createdAt: -1 });

        const transactions = await Transaction.find({ userId: userId })
            .sort({ createdAt: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            data: {
                ...distributor,
                overview: {
                    walletBalance: distributor.wallet,
                    totalAgents: agentCount
                },
                agents,
                transactions
            }
        });

    } catch (error) {
        console.error("Error in getDistributorDashboard:", error);
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

exports.exportDistributorExcel = async (req, res) => {
    let tempFilePath = null;

    try {
        const distributorId = req.user.userId;

        const distributor = await userModel.findById(distributorId);
        if (!distributor) {
            return res.status(404).json({ success: false, message: "Distributor not found" });
        }

        const agents = await agentModel.find({ createdBy: distributorId })
            .populate("userId", "firstName lastName email phone")
            .sort({ createdAt: -1 })
            .lean();

        if (!agents.length) {
            return res.status(400).json({
                success: false,
                message: "No agents found for this distributor",
            });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Agents");

        worksheet.columns = [
            { header: "Agent ID", key: "agentId" },
            { header: "First Name", key: "firstName" },
            { header: "Last Name", key: "lastName" },
            { header: "Email", key: "email" },
            { header: "Phone", key: "phone" },
            { header: "Status", key: "status" },
            { header: "Wallet Balance", key: "wallet" },
            { header: "Total Bookings", key: "totalBookings" },
            { header: "Is Paid", key: "isPaid" },
            { header: "Created Date", key: "createdAt" },
        ];

        // Header styling
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF4472C4" },
        };
        headerRow.alignment = { vertical: "middle", horizontal: "center" };
        headerRow.height = 25;

        agents.forEach((agent, index) => {
            const row = worksheet.addRow({
                agentId: agent._id.toString(),
                firstName: agent.firstName || "-",
                lastName: agent.lastName || "-",
                email: agent.userId?.email || agent.email || "-",
                phone: agent.userId?.phone || agent.phone || "-",
                status: agent.status || "Active",
                wallet: agent.wallet || 0,
                totalBookings: agent.totalBookingsHandled || 0,
                isPaid: agent.isPaid ? "Yes" : "No",
                createdAt: new Date(agent.createdAt).toLocaleDateString("en-IN"),
            });

            // Alternate row colors
            if (index % 2 === 0) {
                row.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFF5F5F5" },
                };
            }

            row.alignment = { vertical: "middle", horizontal: "left" };
        });

        worksheet.columns.forEach((column) => {
            let maxLength = 0;

            column.eachCell({ includeEmpty: true }, (cell) => {
                const cellValue = cell.value ? cell.value.toString() : "";
                if (cellValue.length > maxLength) {
                    maxLength = cellValue.length;
                }
            });

            column.width = Math.max(Math.min(maxLength + 2, 50), 10);
        });

        // Borders
        worksheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: "thin", color: { argb: "FFD3D3D3" } },
                    left: { style: "thin", color: { argb: "FFD3D3D3" } },
                    bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
                    right: { style: "thin", color: { argb: "FFD3D3D3" } },
                };
            });
        });

        // Status conditional formatting
        const statusColIndex = 6;
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                const cell = row.getCell(statusColIndex);
                const status = cell.value?.toString().toLowerCase();

                if (status === "active") {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FF90EE90" },
                    };
                    cell.font = { bold: true, color: { argb: "FF006400" } };
                } else if (status === "inactive") {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFFFCCCB" },
                    };
                    cell.font = { bold: true, color: { argb: "FF8B0000" } };
                }
            }
        });

        // Generate unique filename
        const timestamp = new Date().toISOString().split("T")[0];
        const uniqueId = Date.now();
        const filename = `Distributor_Agents_${timestamp}_${uniqueId}.xlsx`;

        // Create temporary directory if it doesn't exist
        const tempDir = path.join(__dirname, "../../temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Temporary file path
        tempFilePath = path.join(tempDir, filename);

        // Write Excel file to temporary location
        await workbook.xlsx.writeFile(tempFilePath);

        // Read file as buffer
        const fileBuffer = fs.readFileSync(tempFilePath);

        // Define S3 key (path in bucket) - using EXCEL folder
        const folderPath = process.env.BUCKET_FOLDER_PATH || "TourTravels/";
        const s3Key = `${folderPath}EXCEL/${filename}`;

        // Upload to Object Storage using PutObjectCommand
        const uploadParams = {
            Bucket: process.env.LINODE_OBJECT_BUCKET || "leadkart",
            Key: s3Key,
            Body: fileBuffer,
            ACL: "public-read",
            ContentType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ContentDisposition: `attachment; filename="${filename}"`,
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        // Construct the file URL
        const endpoint =
            process.env.LINODE_OBJECT_STORAGE_ENDPOINT ||
            "https://in-maa-1.linodeobjects.com";
        const bucket = process.env.LINODE_OBJECT_BUCKET || "leadkart";
        const fileUrl = `${endpoint}/${bucket}/${s3Key}`;

        // Delete temporary file
        fs.unlinkSync(tempFilePath);
        tempFilePath = null;

        // Return response with file URL
        return res.status(200).json({
            success: true,
            message: "Excel file generated successfully",
            data: {
                fileUrl: fileUrl,
                filename: filename,
                recordCount: agents.length,
                key: s3Key,
            },
        });
    } catch (error) {
        // Clean up temp file if it exists
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (cleanupError) {
                console.error("Cleanup error:", cleanupError);
            }
        }

        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to generate Excel file",
            });
        }
    }
};

module.exports = {
    transferCreditMoney: exports.transferCreditMoney,
    getDistributorDashboard: exports.getDistributorDashboard,
    exportDistributorExcel: exports.exportDistributorExcel,
}
