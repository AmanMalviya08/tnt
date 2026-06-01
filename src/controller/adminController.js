const { userModel } = require("../models/userModel");
const { bookingModel } = require("../models/bookingModel");
const { agentModel } = require("../models/agentModel");
const Guide = require("../models/guideModel");
const { packageModel } = require("../models/packageModel");

class AdminController {

    async getMonthlyData(model, year, dateField = 'createdAt') {
        const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
        const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

        const data = await model.aggregate([
            {
                $match: {
                    [dateField]: { $gte: startOfYear, $lte: endOfYear }
                }
            },
            {
                $group: {
                    _id: { $month: `$${dateField}` },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Fill missing months with 0
        const monthlyCounts = Array(12).fill(0);
        data.forEach(item => {
            monthlyCounts[item._id - 1] = item.count;
        });

        return monthlyCounts;
    }

    async getDashboardAnalytics(req, res) {
        try {
            const { tourModel } = require("../models/tourModel");
            const year = parseInt(req.query.year) || new Date().getFullYear();

            const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
            const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);
            const dateFilter = { createdAt: { $gte: startOfYear, $lte: endOfYear } };

            const now = new Date();
            const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const thisMonthFilter = { createdAt: { $gte: startOfThisMonth } };

            // Parallel execution for all counts
            const [
                totalUsers,
                activeUsers,
                disabledUsers,
                newUsersThisMonth,

                totalAgents,
                activeAgents,
                disabledAgents,
                newAgentsThisMonth,
                paidAgents,
                unpaidAgents,

                totalDistributors,
                newDistributorsThisMonth,

                totalBookings,
                completedBookings,
                pendingBookings,
                cancelledBookings,
                newBookingsThisMonth,

                totalGuides,
                activeGuides,
                pendingGuides,

                totalPackages,
                activePackages,
                disabledPackages,

                totalTours,
                activeTours,
                disabledTours,

                userGraph,
                agentGraph,
                bookingGraph

            ] = await Promise.all([
                // Users (Travelers)
                userModel.countDocuments({ role: "Traveler", ...dateFilter }),
                userModel.countDocuments({ role: "Traveler", isDisabled: false, ...dateFilter }),
                userModel.countDocuments({ role: "Traveler", isDisabled: true, ...dateFilter }),
                userModel.countDocuments({ role: "Traveler", ...thisMonthFilter }),

                // Agents
                agentModel.countDocuments({ ...dateFilter }),
                agentModel.countDocuments({ status: 'Active', isDisabled: false, ...dateFilter }),
                agentModel.countDocuments({ isDisabled: true, ...dateFilter }),
                agentModel.countDocuments({ ...thisMonthFilter }),
                agentModel.countDocuments({ isPaid: true, ...dateFilter }),
                agentModel.countDocuments({ isPaid: false, ...dateFilter }),

                // Distributors
                userModel.countDocuments({ role: "Distributor", ...dateFilter }),
                userModel.countDocuments({ role: "Distributor", ...thisMonthFilter }),

                // Bookings
                bookingModel.countDocuments({ ...dateFilter }),
                bookingModel.countDocuments({ bookingStatus: 'Completed', ...dateFilter }),
                bookingModel.countDocuments({ bookingStatus: 'Pending', ...dateFilter }),
                bookingModel.countDocuments({ bookingStatus: 'Cancelled', ...dateFilter }),
                bookingModel.countDocuments({ ...thisMonthFilter }),

                // Guides
                Guide.countDocuments({ ...dateFilter }),
                Guide.countDocuments({ status: 'Active', ...dateFilter }),
                Guide.countDocuments({ status: 'Pending', ...dateFilter }),

                // Packages
                packageModel.countDocuments({ ...dateFilter }),
                packageModel.countDocuments({ status: 'Active', isDisabled: false, ...dateFilter }),
                packageModel.countDocuments({ isDisabled: true, ...dateFilter }),

                // Tours
                tourModel.countDocuments({ ...dateFilter }),
                tourModel.countDocuments({ isDisabled: false, ...dateFilter }),
                tourModel.countDocuments({ isDisabled: true, ...dateFilter }),

                // Graphs
                this.getMonthlyData(userModel, year),
                this.getMonthlyData(agentModel, year),
                this.getMonthlyData(bookingModel, year)
            ]);

            res.status(200).json({
                success: true,
                data: {
                    counts: {
                        users: {
                            total: totalUsers,
                            active: activeUsers,
                            disabled: disabledUsers,
                            newThisMonth: newUsersThisMonth
                        },
                        agents: {
                            total: totalAgents,
                            active: activeAgents,
                            disabled: disabledAgents,
                            newThisMonth: newAgentsThisMonth,
                            paid: paidAgents,
                            unpaid: unpaidAgents
                        },
                        distributors: {
                            total: totalDistributors,
                            newThisMonth: newDistributorsThisMonth
                        },
                        bookings: {
                            total: totalBookings,
                            completed: completedBookings,
                            pending: pendingBookings,
                            cancelled: cancelledBookings,
                            newThisMonth: newBookingsThisMonth
                        },
                        guides: {
                            total: totalGuides,
                            active: activeGuides,
                            verificationPending: pendingGuides
                        },
                        packages: {
                            total: totalPackages,
                            active: activePackages,
                            disabled: disabledPackages
                        },
                        tours: {
                            total: totalTours,
                            active: activeTours,
                            disabled: disabledTours
                        }
                    },
                    graphData: {
                        year,
                        users: userGraph,
                        agents: agentGraph,
                        bookings: bookingGraph
                    }
                },
            });
        } catch (error) {
            console.error("Dashboard Analytics Error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
    async diagnoseSystem(req, res) {
        console.log("inside here absolutely")
        // Buffer to capture logs
        const logs = [];
        const originalLog = console.log;
        const originalError = console.error;

        // Overlay console methods to capture output
        const serializeArgs = (args) => {
            return args.map(a => {
                if (a instanceof Error) {
                    return JSON.stringify(a, Object.getOwnPropertyNames(a));
                }
                if (typeof a === 'object') {
                    try {
                        return JSON.stringify(a);
                    } catch (e) {
                        return '[Circular]';
                    }
                }
                return String(a);
            }).join(' ');
        };

        const logCapture = (...args) => {
            logs.push(`LOG: ${serializeArgs(args)}`);
            originalLog.apply(console, args);
        };
        const errorCapture = (...args) => {
            logs.push(`ERROR: ${serializeArgs(args)}`);
            originalError.apply(console, args);
        };

        console.log = logCapture;
        console.error = errorCapture;

        try {
            console.log('--- STARTING PRODUCTION DIAGNOSIS (API MODE) ---');
            console.log(`Node Version: ${process.version}`);
            console.log(`Platform: ${process.platform}`);

            const emailService = require('../services/emailService');
            const InvoiceService = require('../services/invoiceService');

            // 1. Check Environment Variables
            const emailUser = process.env.EMAIL_USER || process.env.SMARTCLINIC_EMAIL_USER;
            const emailPass = process.env.EMAIL_PASS || process.env.SMARTCLINIC_EMAIL_PASS;

            if (emailUser) console.log('✓ EMAIL_USER (or SMARTCLINIC_EMAIL_USER) is set.');
            else console.error('❌ EMAIL_USER is MISSING.');

            if (emailPass) console.log('✓ EMAIL_PASS (or SMARTCLINIC_EMAIL_PASS) is set.');
            else console.error('❌ EMAIL_PASS is MISSING.');

            if (process.env.LINODE_OBJECT_BUCKET) console.log('✓ LINODE_OBJECT_BUCKET is set.');
            else console.error('❌ LINODE_OBJECT_BUCKET is MISSING.');

            // 2. Test Email Sending
            if (emailUser && emailPass) {
                try {
                    const testEmail = req.query.email || emailUser;
                    console.log(`Sending test email to: ${testEmail}`);

                    await emailService.transporter.sendMail({
                        from: emailUser,
                        to: testEmail,
                        subject: 'Production Diagnosis Test (API)',
                        text: 'If you received this, email sending is WORKING.'
                    });
                    console.log('✓ Email sent successfully.');
                } catch (err) {
                    console.error('❌ Email Sending FAILED:', err.message);
                }
            } else {
                console.log('Skipping email test due to missing credentials.');
            }

            // 3. Test Invoice Generation
            const invoiceService = new InvoiceService();
            try {
                const simpleHtml = '<h1>Test Invoice</h1><p>Test from API.</p>';
                console.log('Attempting to generate PDF buffer...');

                const buffer = await invoiceService.generatePDFBuffer(simpleHtml);

                if (Buffer.isBuffer(buffer) && buffer.length > 0) {
                    console.log(`✓ PDF Generation successful. Buffer size: ${buffer.length} bytes.`);
                } else {
                    console.error('❌ PDF Generation returned invalid result.');
                }
            } catch (err) {
                console.error('❌ PDF Generation FAILED:', err.message);
                // console.error('Stack:', err.stack);
            }

            // 4. Test S3 Upload
            try {
                const dummyBuffer = Buffer.from('Test File Content API');
                console.log('Attempting to upload dummy file to S3...');
                const url = await invoiceService.uploadInvoiceToS3(dummyBuffer, 'TEST_DIAGNOSIS_API');
                console.log(`✓ S3 Upload successful: ${url}`);

                await invoiceService.deleteInvoice(url);
                console.log('✓ Cleanup successful.');
            } catch (err) {
                console.error('❌ S3 Upload FAILED:', err.message);
            }

            console.log('--- DIAGNOSIS COMPLETE ---');

            // Restore console
            console.log = originalLog;
            console.error = originalError;

            res.status(200).json({
                success: true,
                message: "Diagnosis complete",
                logs: logs
            });

        } catch (error) {
            // Restore console in case of error
            console.log = originalLog;
            console.error = originalError;

            res.status(500).json({
                success: false,
                message: "Diagnosis failed",
                error: error.message,
                logs: logs
            });
        }
    }
}

// Bind methods to the instance to avoid 'this' context issues when passing as callback
const adminController = new AdminController();
adminController.getDashboardAnalytics = adminController.getDashboardAnalytics.bind(adminController);
adminController.getMonthlyData = adminController.getMonthlyData.bind(adminController);
adminController.diagnoseSystem = adminController.diagnoseSystem.bind(adminController);

module.exports = adminController;
