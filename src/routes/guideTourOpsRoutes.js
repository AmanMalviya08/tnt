const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { loadAgentProfile, requireCompanyAgent } = require("../middleware/agentTypeMiddleware");
const guideTourOpsService = require("../services/guideTourOpsService");
const { sendCsvExport, sendPdfExport } = require("../utils/exportHelper");
const Transaction = require("../models/transactionModel");
const guideExpenseModel = require("../models/guideExpenseModel");

const router = express.Router();

// ── Attendance ──────────────────────────────────────────────────────────────
router.post("/attendance/:allocationId", protect, async (req, res) => {
  try {
    const data = await guideTourOpsService.markAttendance(
      req.user.userId,
      req.params.allocationId,
      req.body?.passengers
    );
    res.status(200).json({ success: true, message: "Attendance saved", data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/attendance/:allocationId", protect, async (req, res) => {
  try {
    const data = await guideTourOpsService.getAttendance(req.params.allocationId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ── Broadcast ───────────────────────────────────────────────────────────────
router.post("/broadcast", protect, async (req, res) => {
  try {
    const data = await guideTourOpsService.sendBroadcast(req.user.userId, req.body || {});
    res.status(201).json({ success: true, message: "Broadcast sent", data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/broadcast/:tourId", protect, async (req, res) => {
  try {
    const data = await guideTourOpsService.listBroadcasts(req.params.tourId, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ── Expenses ────────────────────────────────────────────────────────────────
router.post("/expenses", protect, async (req, res) => {
  try {
    const data = await guideTourOpsService.createExpense(req.user.userId, req.body || {});
    res.status(201).json({ success: true, message: "Expense submitted", data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/expenses/my", protect, async (req, res) => {
  try {
    const data = await guideTourOpsService.listMyExpenses(req.user.userId, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/expenses/pending", protect, async (req, res) => {
  try {
    if (!["Admin", "SubAdmin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Admin access only" });
    }
    const data = await guideTourOpsService.listPendingExpenses(req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/expenses/:id/review", protect, async (req, res) => {
  try {
    if (!["Admin", "SubAdmin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Admin access only" });
    }
    const data = await guideTourOpsService.reviewExpense(
      req.params.id,
      req.user.userId,
      req.body || {}
    );
    res.status(200).json({ success: true, message: "Expense reviewed", data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/expenses/export/csv", protect, async (req, res) => {
  try {
    const expenses = await guideTourOpsService.listMyExpenses(req.user.userId, { limit: 500 });
    const columns = [
      { label: "Date", get: (r) => new Date(r.createdAt).toLocaleDateString("en-IN") },
      { label: "Amount", get: (r) => r.amount },
      { label: "Description", get: (r) => r.description || "" },
      { label: "Status", get: (r) => r.status },
    ];
    return sendCsvExport(res, "guide-expenses", expenses, columns);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Missing passenger alert ─────────────────────────────────────────────────
router.post("/missing-alert", protect, async (req, res) => {
  try {
    const data = await guideTourOpsService.triggerMissingAlert(req.user.userId, req.body || {});
    res.status(201).json({ success: true, message: "Missing passenger alert sent", data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ── Temple check-in ─────────────────────────────────────────────────────────
router.post("/temple-checkin", protect, async (req, res) => {
  try {
    const data = await guideTourOpsService.templeCheckin(req.user.userId, req.body || {});
    res.status(200).json({ success: true, message: "Temple check-in recorded", data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ── Agent home alerts ───────────────────────────────────────────────────────
router.get("/home-alerts", protect, loadAgentProfile, async (req, res) => {
  try {
    const data = await guideTourOpsService.getAgentHomeAlerts(req.user.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ── Agent certificate PDF ───────────────────────────────────────────────────
router.get("/certificate", protect, loadAgentProfile, async (req, res) => {
  try {
    const agent = req.agent;
    const rows = [
      {
        name: [agent.firstName, agent.lastName].filter(Boolean).join(" "),
        code: agent.referralCode || "—",
        status: agent.verificationStatus || "Pending",
        joined: agent.createdAt ? new Date(agent.createdAt).toLocaleDateString("en-IN") : "—",
      },
    ];
    const columns = [
      { label: "Agent Name", get: (r) => r.name, weight: 2 },
      { label: "Referral Code", get: (r) => r.code, weight: 1.2 },
      { label: "Status", get: (r) => r.status, weight: 1 },
      { label: "Joined", get: (r) => r.joined, weight: 1 },
    ];
    return sendPdfExport(res, "agent-certificate", "Agent Certificate", rows, columns);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Agent transactions export ───────────────────────────────────────────────
router.get("/transactions/export", protect, loadAgentProfile, async (req, res) => {
  try {
    const { format = "csv" } = req.query;
    const txns = await Transaction.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(500).lean();
    const columns = [
      { label: "Date", get: (r) => new Date(r.createdAt).toLocaleDateString("en-IN"), weight: 1.1 },
      { label: "Type", get: (r) => r.type, weight: 0.8 },
      { label: "Category", get: (r) => r.category, weight: 1 },
      { label: "Amount", get: (r) => r.amount, weight: 1, format: "currency" },
      { label: "Status", get: (r) => r.status, weight: 0.9 },
      { label: "Description", get: (r) => r.description || "", weight: 2.4 },
    ];
    if (format === "pdf") {
      return sendPdfExport(res, "agent-transactions", "Transaction History", txns, columns);
    }
    return sendCsvExport(res, "agent-transactions", txns, columns);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
