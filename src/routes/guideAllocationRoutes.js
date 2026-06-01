const express = require("express");
const GuideAllocationController = require("../controller/guideAllocationController");
const {
  guideAllocationModel,
  assignmentStatuses,
  assignmentTypes,
} = require("../models/guideAllocationModel");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
const guideAllocationController = new GuideAllocationController(guideAllocationModel);

router.post("/", protect, async (req, res) => {
  try {
    const allocation = await guideAllocationController.createAllocation(req.body);
  console.log(allocation.id)
    let transferGuide = undefined;
    if (req?.body?.transferGuide) {
      transferGuide = await guideAllocationController.transferGuide(allocation.id, req?.body?.transferGuide)
    }
    res
      .status(201)
      .json({ success: true, message: "Guide allocation created successfully", data: allocation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/export-allocations/excel", protect, async (req, res) => {
  try {
    await guideAllocationController.exportGuideAllocationsExcel(req, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    const { page, limit, sort,sortOrder, ...filters } = req.query;
    const allocationsQuery = await guideAllocationController.getAllocations(filters, {
      page,
      limit,
      sort,
      sortOrder
    });
    const allocations = await allocationsQuery;
    res
      .status(200)
      .json({ success: true, message: "Guide allocations fetched successfully", data: allocations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    const allocation = await guideAllocationController.getAllocationById(req.params.id);
    if (!allocation) {
      return res.status(404).json({ success: false, message: "Guide allocation not found" });
    }
    res.status(200).json({ success: true, message: "Guide allocation fetched successfully", data: allocation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id", protect, async (req, res) => {
  try {
    const allocation = await guideAllocationController.updateAllocation(req.params.id, req.body);
    let transferGuide = undefined;
    if (req?.body?.transferGuide) {
      transferGuide = await guideAllocationController.transferGuide(req.params.id, req?.body?.transferGuide)
    }
    console.log(transferGuide)
    if (!allocation) {
      return res.status(404).json({ success: false, message: "Guide allocation not found" });
    }
    res.status(200).json({ success: true, message: "Guide allocation updated successfully", data: allocation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const allocation = await guideAllocationController.deleteAllocation(req.params.id);
    if (!allocation) {
      return res.status(404).json({ success: false, message: "Guide allocation not found" });
    }
    res.status(200).json({ success: true, message: "Guide allocation deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/:id/transfer", protect, async (req, res) => {
  try {
    const allocation = await guideAllocationController.transferGuide(req.params.id, req.body);
    if (!allocation) {
      return res.status(404).json({ success: false, message: "Guide allocation not found" });
    }
    res.status(200).json({ success: true, message: "Guide transferred successfully", data: allocation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/meta/enums", (req, res) => {
  res
    .status(200)
    .json({ success: true, data: { assignmentStatuses, assignmentTypes } });
});

module.exports = router;
