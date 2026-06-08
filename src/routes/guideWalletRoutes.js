const express = require("express");
const router = express.Router();
const guideWalletController = require("../controller/guideWalletController");
const { protect } = require("../middleware/authMiddleware");

// Guide Routes
router.get("/my-wallet", protect, guideWalletController.getGuideWalletDetails);
router.get("/my-transactions", protect, guideWalletController.getGuideTransactions);
router.get("/my-withdrawals", protect, guideWalletController.getGuideWithdrawals);
router.post("/withdraw", protect, guideWalletController.requestGuideWithdrawal);

// Admin Routes
router.get("/withdrawals", protect, guideWalletController.getGuideWithdrawalsAdmin);
router.put("/withdrawals/approve/:id", protect, guideWalletController.approveGuideWithdrawal);
router.put("/withdrawals/reject/:id", protect, guideWalletController.rejectGuideWithdrawal);

module.exports = router;
