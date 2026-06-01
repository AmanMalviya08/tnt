const express = require("express");
const GuideController = require("../controller/guideController");
const Guide = require("../models/guideModel");
const { protect } = require("../middleware/authMiddleware");
const GuideAllocationController = require("../controller/guideAllocationController");
const {
  guideAllocationModel,
} = require("../models/guideAllocationModel");
const router = express.Router();
const guideController = new GuideController(Guide);
const guideAllocationController = new GuideAllocationController(guideAllocationModel);

router.post("/", async (req, res) => {
  try {
    const guide = await guideController.registerGuide(req.body);
     const assignGuide=req?.body?.assignGuide;
       if(assignGuide){
          assignGuide.guideId=guide._id;
        await   guideAllocationController.createAllocation(assignGuide)
       }

    if (!guide) {
      return res.status(404).json({ 
        success: false, 
        message: "Failed to register guide" 
      });
    }

    res.status(201).json({
      success: true,
      data: guide,
      message: "Guide registered successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const options = {
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    };

    const filters = {
      guideId: req.query.guideId,
      status: req.query.status,
      specialization: req.query.specialization,
      language: req.query.language,
    //   isVerified: req.query.isVerified,
      minRating: req.query.minRating,
      search: req.query.search,
    };

    const result = await guideController.getGuides(options, filters);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      message: "Guides fetched successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

 

router.get("/:guideId", async (req, res) => {
  try {
    const { guideId } = req.params;
    const guide = await guideController.getGuideById(guideId);

    res.status(200).json({
      success: true,
      data: guide,
      message: "Guide fetched successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/:guideId",protect, async (req, res) => {
  try {
    const { guideId } = req.params;
    const updatedBy = req.body.updatedBy || req.user?._id; 

    const guide = await guideController.updateGuide(
      guideId,
      req.body,
      updatedBy
    );

    res.status(200).json({
      success: true,
      data: guide,
      message: "Guide updated successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/status/:guideId", async (req, res) => {
  try {
    const { guideId } = req.params;
    const { status } = req.body;
    const updatedBy = req.body.updatedBy || req.user?._id;

    const guide = await guideController.updateGuideStatus(
      guideId,
      status,
      updatedBy
    );

    res.status(200).json({
      success: true,
      data: guide,
      message: "Guide status updated successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete("/:guideId", async (req, res) => {
  try {
    const { guideId } = req.params;
    const result = await guideController.deleteGuide(guideId);

    res.status(200).json({
      success: true,
      data: result.guide,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
  
router.post("/complaints/:guideId", async (req, res) => {
  try {
    const { guideId } = req.params;
    const guide = await guideController.addComplaint({
      guideId,
      ...req.body,
    });

    res.status(201).json({
      success: true,
      data: guide,
      message: "Complaint filed successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});


router.get("/complaints/:guideId", async (req, res) => {
  try {
    const { guideId } = req.params;
    
    const filters = {
      status: req.query.status,
      severity: req.query.severity,
    };

    const options = {
      page: req.query.page,
      limit: req.query.limit,
    };

    const result = await guideController.getGuideComplaints(
      guideId,
      filters,
      options
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      message: "Guide complaints fetched successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/complaints/:guideId/:complaintId", async (req, res) => {
  try {
    const { guideId, complaintId } = req.params;
    const { status, resolution } = req.body;

    const guide = await guideController.updateComplaintStatus(
      guideId,
      complaintId,
      status,
      resolution
    );

    res.status(200).json({
      success: true,
      data: guide,
      message: "Complaint status updated successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

 

module.exports = router;