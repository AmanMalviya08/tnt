const { agentModel } = require("../models/agentModel");

async function loadAgentProfile(req, res, next) {
  try {
    if (req.user?.role !== "Agent") {
      return res.status(403).json({ success: false, message: "Agent access only" });
    }
    const agent = await agentModel.findOne({ userId: req.user.userId }).lean();
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent profile not found" });
    }
    req.agent = agent;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function requireCompanyAgent(req, res, next) {
  const agentType = req.agent?.agentType || "company";
  if (agentType !== "company") {
    return res.status(403).json({
      success: false,
      message: "Not authorized. This module is available to company agents only.",
      code: "COMPANY_AGENT_ONLY",
    });
  }
  next();
}

module.exports = { loadAgentProfile, requireCompanyAgent };
