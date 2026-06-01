const express = require("express");
const LeadController = require("../controller/leadController");
const { leadModel, leadSources, leadStatuses, interestedServices } = require("../models/leadModel");

const router = express.Router();
const leadController = new LeadController(leadModel);

router.post("/", async (req, res) => {
  try {
    const lead = await leadController.createLead(req.body);
    res.status(201).json({ success: true, message: "Lead created successfully", data: lead });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/export-leads/excel", async (req, res) => {
  try {
    await leadController.exportLeadsExcel(req, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/", async (req, res) => {
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

router.get("/:id", async (req, res) => {
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

router.put("/:id", async (req, res) => {
  try {
    const lead = await leadController.updateLead(req.params.id, req.body);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }
    res.status(200).json({ success: true, message: "Lead updated successfully", data: lead });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const lead = await leadController.deleteLead(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }
    res.status(200).json({ success: true, message: "Lead deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/meta/enums", (req, res) => {
  res
    .status(200)
    .json({ success: true, data: { leadSources, leadStatuses, interestedServices } });
});

module.exports = router;
