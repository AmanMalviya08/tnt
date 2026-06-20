const express = require("express");
const GuideController = require("../controller/guideController");
const Guide = require("../models/guideModel");
const { protect } = require("../middleware/authMiddleware");
const { notifyUser } = require("../services/notificationDispatchService");
const { uploadFields } = require("../middleware/s3Upload");
const GuideAllocationController = require("../controller/guideAllocationController");
const GuideTourLogController = require("../controller/guideTourLogController");
const {
  guideAllocationModel,
} = require("../models/guideAllocationModel");
const router = express.Router();
const guideController = new GuideController(Guide);
const guideAllocationController = new GuideAllocationController(guideAllocationModel);
const guideTourLogController = new GuideTourLogController();

// Multer middleware for guide document uploads
const guideDocUpload = uploadFields([
  { name: "passportImage", maxCount: 1 },
  { name: "guideLicenseImage", maxCount: 1 },
  { name: "aidCertificateImage", maxCount: 1 },
  { name: "proofOfAddressImage", maxCount: 1 },
]);

router.post("/", protect, guideDocUpload, async (req, res) => {
  try {
    // Map uploaded files to documents payload
    const docFields = ['passportImage', 'guideLicenseImage', 'aidCertificateImage', 'proofOfAddressImage'];
    const documents = {};
    for (const field of docFields) {
      if (req.files && req.files[field] && req.files[field][0]) {
        documents[field] = req.files[field][0].location; // S3 URL
      }
    }
    // Also allow JSON URLs in body (for cases where files were pre-uploaded)
    if (req.body.documents) {
      const bodyDocs = typeof req.body.documents === 'string' ? JSON.parse(req.body.documents) : req.body.documents;
      for (const field of docFields) {
        if (!documents[field] && bodyDocs[field]) {
          documents[field] = bodyDocs[field];
        }
      }
    }
    req.body.documents = documents;
    req.body.createdBy = req.user?.userId || req.body.createdBy;

    const guide = await guideController.registerGuide(req.body);
    const assignGuide = req?.body?.assignGuide;
    if (assignGuide) {
      assignGuide.guideId = guide._id;
      await guideAllocationController.createAllocation(assignGuide)
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


// ── Get all reviews for a guide with guide info ──
router.get("/reviews/:guideId", async (req, res) => {
  try {
    const { guideId } = req.params;
    const options = {
      page: req.query.page,
      limit: req.query.limit,
      sortOrder: req.query.sortOrder,
      rating: req.query.rating,
    };

    const result = await guideController.getGuideReviews(guideId, options);

    res.status(200).json({
      success: true,
      guide: result.guide,
      reviews: result.reviews,
      pagination: result.pagination,
      message: "Guide reviews fetched successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/me/profile", protect, async (req, res) => {
  try {
    const guide = await Guide.findOne({ userId: req.user.userId })
      .populate("createdBy", "firstName lastName email");
    if (!guide) {
      return res.status(404).json({
        success: false,
        message: "Guide profile not found for this user",
      });
    }
    res.status(200).json({
      success: true,
      data: guide,
      message: "Guide profile fetched successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch("/me/profile", protect, async (req, res) => {
  try {
    const guide = await guideController.upsertGuideForUser(
      req.user.userId,
      req.body,
      req.user.userId
    );
    res.status(200).json({
      success: true,
      data: guide,
      message: "Guide profile updated successfully",
    });
  } catch (error) {
    const statusCode = error.message === "Guide profile not found for this user" ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
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

router.patch("/:guideId", protect, async (req, res) => {
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

// ── Guide Tour Logs (Post-Tour Field Reports) ──
router.get("/tour-logs/my-logs", protect, async (req, res) => {
  try {
    const { page, limit, allocationId } = req.query;
    const result = await guideTourLogController.getMyTourLogs(req.user.userId, {
      page,
      limit,
      allocationId,
    });
    res.status(200).json({
      success: true,
      message: "Tour logs fetched successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    const statusCode = error.message === "Guide profile not found for this user" ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
});

router.post("/tour-logs", protect, async (req, res) => {
  try {
    const log = await guideTourLogController.createTourLog(req.user.userId, req.body);
    res.status(201).json({
      success: true,
      message: "Tour log submitted successfully",
      data: log,
    });
  } catch (error) {
    const statusCode = error.message === "Guide profile not found for this user" ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
});

router.delete("/tour-logs/:id", protect, async (req, res) => {
  try {
    const log = await guideTourLogController.deleteTourLog(req.user.userId, req.params.id);
    res.status(200).json({
      success: true,
      message: "Tour log deleted successfully",
      data: log,
    });
  } catch (error) {
    const statusCode = error.message === "Tour log not found" ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
});

// ── Admin: Verify Guide Documents ──
router.patch("/verify-documents/:guideId", protect, async (req, res) => {
  try {
    const { guideId } = req.params;
    const verifiedBy = req.user?._id || req.body.verifiedBy;

    const guide = await guideController.verifyGuideDocuments(
      guideId,
      req.body,
      verifiedBy
    );

    if (guide?.userId && guide?.documentVerification?.status === "Verified") {
      setImmediate(() => {
        notifyUser(guide.userId, {
          title: "Documents Verified",
          message: "Your guide documents have been verified. Your profile is now active.",
          type: "system",
          redirectScreen: "DocumentsVerification",
          meta: { verificationStatus: "Verified" },
        }).catch((err) => console.error("[Notify] Guide verification:", err.message));
      });
    }

    res.status(200).json({
      success: true,
      data: guide,
      message: "Guide documents verification updated successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;