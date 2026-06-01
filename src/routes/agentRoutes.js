const express = require("express");
const AgentController = require("../controller/agentController");
const { agentModel, agentStatuses, availabilityStatuses } = require("../models/agentModel");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const agentController = new AgentController(agentModel);

router.post("/", protect, async (req, res) => {
  try {
    const payload = { ...req.body, createdBy: req.user.userId };
    const agent = await agentController.createAgent(payload);
    res.status(201).json({ success: true, message: "Agent created successfully", data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    const { page, limit, sort, search, ...filters } = req.query;

    // If user is a Distributor, only show agents created by them
    if (req.user.role === 'Distributor') {
      filters.createdBy = req.user.userId;
    }

    const agentsQuery = await agentController.getAgents(filters, { page, limit, sort, search });

    const agents = await agentsQuery;
    res.status(200).json({ success: true, message: "Agents fetched successfully", data: agents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.patch("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const agent = await agentController.changeStatus(id, req.body, req.user);

    res.status(201).json({ success: true, message: "Agent status changed successfully", data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/:id/pay-status", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { isPaid } = req.body;

    // Optional: Check if requester is authorized (e.g. Distributor who created it)
    // For now, relying on protect middleware role check.

    const agent = await agentController.markAgentAsPaid(id, isPaid);

    res.status(200).json({ success: true, message: "Agent payment status updated", data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    const agent = await agentController.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    res.status(200).json({ success: true, message: "Agent fetched successfully", data: agent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id", protect, async (req, res) => {
  try {
    const agent = await agentController.updateAgent(req.params.id, req.body);
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    res.status(200).json({ success: true, message: "Agent updated successfully", data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const agent = await agentController.deleteAgent(req.params.id, req.user);
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    res.status(200).json({ success: true, message: "Agent deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/meta/enums", (req, res) => {
  res.status(200).json({ success: true, data: { agentStatuses, availabilityStatuses } });
});

module.exports = router;
