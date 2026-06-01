const express = require("express");
const IvrController = require("../controller/ivrController");
const { ivrSessionModel, ivrCallStatuses, ivrActions } = require("../models/ivrSessionModel");

const router = express.Router();
const ivrController = new IvrController(ivrSessionModel);

router.post("/", async (req, res) => {
  try {
    const session = await ivrController.createSession(req.body);
    res.status(201).json({ success: true, message: "IVR session created successfully", data: session });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/:id/events", async (req, res) => {
  try {
    const session = await ivrController.logEvent(req.params.id, req.body);
    if (!session) {
      return res.status(404).json({ success: false, message: "IVR session not found" });
    }
    res.status(200).json({ success: true, message: "IVR event logged successfully", data: session });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { page, limit, sort, ...filters } = req.query;
    const sessionsQuery = await ivrController.getSessions(filters, { page, limit, sort });
    const sessions = await sessionsQuery;
    res.status(200).json({ success: true, message: "IVR sessions fetched successfully", data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const session = await ivrController.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: "IVR session not found" });
    }
    res.status(200).json({ success: true, message: "IVR session fetched successfully", data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const session = await ivrController.updateSession(req.params.id, req.body);
    if (!session) {
      return res.status(404).json({ success: false, message: "IVR session not found" });
    }
    res.status(200).json({ success: true, message: "IVR session updated successfully", data: session });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const session = await ivrController.deleteSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: "IVR session not found" });
    }
    res.status(200).json({ success: true, message: "IVR session deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/meta/enums", (req, res) => {
  res.status(200).json({ success: true, data: { ivrCallStatuses, ivrActions } });
});

module.exports = router;
