const express = require("express");
const UserController = require("../controller/userController");
const { userModel, userRoles, userStatuses } = require("../models/userModel");
const { protect } = require("../middleware/authMiddleware");
const { uploadSingle } = require("../middleware/s3Upload");
const multer = require("multer");

const router = express.Router();
const userController = new UserController(userModel);

router.post("/", protect, async (req, res) => {
  try {
    console.log(req.user);
    const userId = req.user.userId;
    console.log("Requesting User ID:", userId);
    const user = await userController.registerUser(req.body, userId);
    res.status(201).json({ success: true, message: "User created successfully", data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.post("/register", async (req, res) => {
  try {
    const user = await userController.registerAdmin(req.body);
    res.status(201).json({ success: true, message: "Admin created successfully", data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.post("/login", async (req, res) => {
  try {
    const user = await userController.loginAdmin(req.body);
    res.status(200).json({ success: true, message: "Logged in successfully", data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// SubAdmin Routes - Protected and Restricted to Admin
router.post("/sub-admin", protect, async (req, res) => {
  try {
    console.log("subadmin route")
    // Check if requester is Admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: "Forbidden: Only Admin can create SubAdmins" });
    }

    const subAdmin = await userController.createSubAdmin(req.body);
    res.status(201).json({ success: true, message: "SubAdmin created successfully", data: subAdmin });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/distributors", protect, async (req, res) => {
  try {
    // Check if requester is Admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: "Forbidden: Only Admin can view Distributors" });
    }

    const { page, limit, sort, search } = req.query;
    const result = await userController.getAllDistributors({ page, limit, sort, search });

    res.status(200).json({
      success: true,
      message: "Distributors fetched successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/distributors", protect, async (req, res) => {
  try {
    // Check if requester is Admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: "Forbidden: Only Admin can create Distributors" });
    }

    const distributor = await userController.createDistributor(req.body);
    res.status(201).json({ success: true, message: "Distributor created successfully", data: distributor });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/sub-admin", protect, async (req, res) => {
  try {
    // Check if requester is Admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: "Forbidden: Only Admin can view SubAdmins" });
    }
    console.log("inside get all subadmin")
    const { page, limit, sort, search } = req.query;
    const result = await userController.getAllSubAdmins({ page, limit, sort, search });

    res.status(200).json({
      success: true,
      message: "SubAdmins fetched successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/sub-admin/:id", protect, async (req, res) => {
  try {
    // Check if requester is Admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: "Forbidden: Only Admin can update SubAdmins" });
    }

    const { id } = req.params;
    const subAdmin = await userController.updateSubAdmin(id, req.body);
    if (!subAdmin) {
      return res.status(404).json({ success: false, message: "SubAdmin not found" });
    }

    res.status(200).json({
      success: true,
      message: "SubAdmin updated successfully",
      data: subAdmin,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/sub-admin/toggleStatus/:id", protect, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: "Forbidden: Only Admin can manage SubAdmins" });
    }

    const { id } = req.params;
    const { updatedBy } = req.body || {};
    const adminId = req.user.userId;

    const user = await userController.setUserDisabled(id, { updatedBy: adminId });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: user.isDisabled ? "SubAdmin disabled successfully":"SubAdmin enabled successfully",
      data: user
    });

  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/phone/send-otp", async (req, res) => {
  try {
    const result = await userController.sendPhoneOtpByPhone(req.body || {});

    res.status(200).json({
      success: true,
      message: "OTP generated successfully",
      data: {
        userId: result.userId,
        phone: result.phone,
        role: result.role,
        expiresAt: result.expiresAt,
        otp: process.env.NODE_ENV === "development" ? result.otp : undefined,
        created: result.created,
        needsProfileUpdate: result.needsProfileUpdate,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/phone/verify-otp", async (req, res) => {
  try {
    const result = await userController.verifyPhoneOtpByPhone(req.body || {});
    if (!result) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Phone number verified successfully",
      data: result,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {

    const { page, limit, sort, search, ...filters } = req.query;
    const result = await userController.getUsers(filters, { page, limit, sort, search });
    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/export-users", protect, async (req, res) => {
  try {
    await userController.exportUsersExcel(req, res);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const user = await userController.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, message: "User fetched successfully", data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id", protect, uploadSingle("profileUrl"), async (req, res) => {
  try {
    const { id: userId } = req.params
    console.log("inside here", req.body)
    const realUserId = req.user.userId;
    
    if (req.user.role !== 'Admin' && realUserId !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden: You don't have permission to update the user." });
    }

    // Restrict sensitive fields for non-admin users
    if (req.user.role !== 'Admin') {
      const restrictedFields = [
        'wallet',
        'distributorCommission',
        'paidAgentCommission',
        'role',
        'permissions',
        'status',
        'isEmailVerified',
        'isPhoneVerified',
        "creditMoney"
      ];
      restrictedFields.forEach(field => delete req.body[field]);
    }

    if (req.file && req.file.location) {
      req.body.avatarUrl = req.file.location;
    }

    const user = await userController.updateUser(userId, req.body);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, message: "User updated successfully", data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch("/:id/disable", protect, async (req, res) => {
  try {
    const { updatedBy } = req.body || {};

    const user = await userController.setUserDisabled(req.params.id, { updatedBy });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: user?.isDisabled ? "User disabled successfully" : "User enabled successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});



module.exports = router;
