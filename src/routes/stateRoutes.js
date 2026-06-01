const express = require("express");
const StateController = require("../controller/stateController");
const stateModel = require("../models/stateModel");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const stateController = new StateController(stateModel);

router.post("/",protect, async (req, res) => {
  try {
    const state = await stateController.createState(req.body);
    res.status(201).json({ success: true, message: "State created successfully", data: state });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const { page, limit, sort, sortBy, sortOrder, order, includeDisabled, ...filters } = req.query || {};

    const states = await stateController.getStates(filters, {
      page,
      limit,
      sort,
      sortBy,
      sortOrder,
      order,
      includeDisabled,
    });

    res.status(200).json({
      success: true,
      message: "States fetched successfully",
      data: states.data,
      pagination: states.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const state = await stateController.getStateById(req.params.id);
    if (!state) {
      return res.status(404).json({ success: false, message: "State not found" });
    }
    res.status(200).json({ success: true, message: "State fetched successfully", data: state });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id", protect,async (req, res) => {
  try {
    const state = await stateController.updateState(req.params.id, req.body);
    if (!state) {
      return res.status(404).json({ success: false, message: "State not found" });
    }
    res.status(200).json({ success: true, message: "State updated successfully", data: state });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/:id/disable",protect, async (req, res) => {
  try {
    const { isDisabled } = req.body || {};

    const state = await stateController.setStateDisabled(req.params.id, { isDisabled });
    if (!state) {
      return res.status(404).json({ success: false, message: "State not found" });
    }

    res.status(200).json({
      success: true,
      message: state.isDisabled ? "State disabled successfully" : "State enabled successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
