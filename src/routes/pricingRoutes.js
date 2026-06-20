const express = require("express");
const PricingController = require("../controller/pricingController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const pricingController = new PricingController();

router.post("/calculate", protect, (req, res) => pricingController.calculateQuote(req, res));

router.get("/rules", protect, async (req, res) => {
  try {
    const rules = await pricingController.listRules(req.query);
    res.status(200).json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/rules", protect, async (req, res) => {
  try {
    const rule = await pricingController.createRule({
      ...req.body,
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
    });
    res.status(201).json({ success: true, data: rule, message: "Pricing rule created" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put("/rules/:id", protect, async (req, res) => {
  try {
    const rule = await pricingController.updateRule(req.params.id, {
      ...req.body,
      updatedBy: req.user.userId,
    });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });
    res.status(200).json({ success: true, data: rule, message: "Pricing rule updated" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/rules/:id", protect, async (req, res) => {
  try {
    const rule = await pricingController.deleteRule(req.params.id);
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });
    res.status(200).json({ success: true, message: "Pricing rule deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/audit-logs", protect, (req, res) => pricingController.getAuditLogs(req, res));

module.exports = router;
