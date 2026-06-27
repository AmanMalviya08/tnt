const express = require("express");
const LeadController = require("../controller/leadController");
const { leadModel } = require("../models/leadModel");
const { notifyLeadCreated, notifyLeadUpdated } = require("../services/leadNotificationService");
const { protect } = require("../middleware/authMiddleware");
const { loadAgentProfile, requireCompanyAgent } = require("../middleware/agentTypeMiddleware");

const router = express.Router();
const leadController = new LeadController(leadModel);

function agentLeadsOnly(req, res, next) {
  if (["Admin", "SubAdmin"].includes(req.user?.role)) {
    return next();
  }
  return loadAgentProfile(req, res, () => requireCompanyAgent(req, res, next));
}

router.get("/meta/enums", protect, agentLeadsOnly, async (req, res) => {
  try {
    const data = await leadController.getLeadFormMeta();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/", protect, agentLeadsOnly, async (req, res) => {
  try {
    const lead = await leadController.createLead(req.body);
    setImmediate(() => {
      notifyLeadCreated(lead).catch((err) => console.error("[Notify] Lead created:", err.message));
    });
    res.status(201).json({ success: true, message: "Lead created successfully", data: lead });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/export-leads/excel", protect, async (req, res) => {
  try {
    if (!["Admin", "SubAdmin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Admin access only" });
    }
    await leadController.exportLeadsExcel(req, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/", protect, agentLeadsOnly, async (req, res) => {
  try {
    const { page, limit, sort, ...filters } = req.query;
    const { data, pagination } = await leadController.getLeads(filters, { page, limit, sort });
    res.status(200).json({
      success: true,
      message: "Leads fetched successfully",
      data,
      pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", protect, agentLeadsOnly, async (req, res) => {
  try {
    const lead = await leadController.getLeadById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }
    res.status(200).json({ success: true, message: "Lead fetched successfully", data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id", protect, agentLeadsOnly, async (req, res) => {
  try {
    const existing = await leadModel.findById(req.params.id).select("followUpDate");
    const lead = await leadController.updateLead(req.params.id, req.body);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }
    setImmediate(() => {
      notifyLeadUpdated(lead, { previousFollowUpDate: existing?.followUpDate }).catch(
        (err) => console.error("[Notify] Lead updated:", err.message)
      );
    });
    res.status(200).json({ success: true, message: "Lead updated successfully", data: lead });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    if (!["Admin", "SubAdmin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Admin access only" });
    }
    const lead = await leadController.deleteLead(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }
    res.status(200).json({ success: true, message: "Lead deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
