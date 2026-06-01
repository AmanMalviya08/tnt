const express = require("express");
const router = express.Router();
const walletController = require("../controller/walletController");
const { protect } = require("../middleware/authMiddleware");

// Agent Routes
router.get("/my-wallet", protect, walletController.getWalletDetails);
router.get("/my-withdrawals", protect, walletController.getAgentWithdrawals);
router.post("/withdraw", protect, walletController.requestWithdrawal);
router.get("/payment-methods", protect, walletController.getPaymentMethods);
router.put("/payment-methods", protect, walletController.updatePaymentMethods);


// Admin Routes
router.get("/admin/export-transactions/excel", protect, walletController.exportTransactionsExcel);
router.get("/withdrawals", protect, walletController.getWithdrawals);
router.put("/withdrawals/approve/:id", protect, walletController.approveWithdrawal);
router.put("/withdrawals/reject/:id", protect, walletController.rejectWithdrawal);

// Distributor Routes
router.get("/distributor/my-wallet", protect, walletController.getDistributorWalletDetails);
router.get("/distributor/my-withdrawals", protect, walletController.getDistributorWithdrawals);
router.post("/distributor/withdraw", protect, walletController.requestDistributorWithdrawal);

// Agent to Distributor Transfer Routes
router.post("/distributor/transfer", protect, walletController.requestTransferFromDistributor);
router.get("/distributor/transfers/agent", protect, walletController.getAgentTransferRequests);
router.get("/distributor/transfers/requests", protect, walletController.getDistributorTransferRequests);
router.put("/distributor/transfers/approve/:id", protect, walletController.approveTransferRequest);
router.put("/distributor/transfers/reject/:id", protect, walletController.rejectTransferRequest);

// Distributor to Admin Transfer Routes
router.post("/admin/transfer", protect, walletController.requestTransferFromAdmin);
router.get("/admin/transfers/distributor", protect, walletController.getDistributorAdminTransferRequests);
router.get("/admin/transfers/export/excel", protect, walletController.exportDistributorTransfersExcel);
router.get("/admin/transfers/requests", protect, walletController.getAdminTransferRequests);
router.put("/admin/transfers/approve/:id", protect, walletController.approveAdminTransferRequest);
router.put("/admin/transfers/reject/:id", protect, walletController.rejectAdminTransferRequest);

module.exports = router;
