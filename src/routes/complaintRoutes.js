const express = require("express");
const ComplaintController = require("../controller/complaintController");
const {
  complaintModel,
  complaintStatuses,
  complaintPartyTypes,
} = require("../models/complaintModel");
const { protect } = require("../middleware/authMiddleware");
const { uploadFields } = require("../middleware/s3Upload");

const router = express.Router();
const complaintController = new ComplaintController(complaintModel);

// Media upload middleware — accepts images (max 5) and videos (max 2)
const complaintUpload = uploadFields([
  { name: "images", maxCount: 5 },
  { name: "videos", maxCount: 2 },
]);

// Create complaint (User / Guide)
router.post("/", protect, complaintUpload, async (req, res) => {
  try {
    // Combine all uploaded files
    const files = [
      ...(req.files?.images || []),
      ...(req.files?.videos || []),
    ];

    const complaint = await complaintController.createComplaint(req.body, files, req.user);
    res.status(201).json({
      success: true,
      message: "Complaint created successfully",
      data: complaint,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get my complaints (logged-in user/guide)
router.get("/my-complaints", protect, async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const { page, limit, sort, sortOrder, ...filters } = req.query;

    const result = await complaintController.getMyComplaints(
      userId,
      role,
      filters,
      { page, limit, sort, sortOrder }
    );
    res.status(200).json({
      success: true,
      message: "Complaints fetched successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    const statusCode =
      error.message === "Guide profile not found for this user" ? 404 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
});

// Get all complaints (Admin)
router.get("/", protect, async (req, res) => {
  try {
    const { page, limit, sort, sortOrder, ...filters } = req.query;
    const result = await complaintController.getComplaints(filters, {
      page,
      limit,
      sort,
      sortOrder,
    });
    res.status(200).json({
      success: true,
      message: "Complaints fetched successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get complaint by ID
router.get("/:id", protect, async (req, res) => {
  try {
    const complaint = await complaintController.getComplaintById(req.params.id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }
    res.status(200).json({
      success: true,
      message: "Complaint fetched successfully",
      data: complaint,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update complaint status (Admin)
router.patch("/:id/status", protect, async (req, res) => {
  try {
    const complaint = await complaintController.updateComplaintStatus(
      req.params.id,
      req.body
    );
    res.status(200).json({
      success: true,
      message: "Complaint status updated successfully",
      data: complaint,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete complaint (Admin)
router.delete("/:id", protect, async (req, res) => {
  try {
    const complaint = await complaintController.deleteComplaint(req.params.id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }
    res.status(200).json({
      success: true,
      message: "Complaint deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Meta: enums
router.get("/meta/enums", (req, res) => {
  res.status(200).json({
    success: true,
    data: { complaintStatuses, complaintPartyTypes },
  });
});

module.exports = router;
