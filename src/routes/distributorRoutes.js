const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getDistributorDashboard, transferCreditMoney, exportDistributorExcel } = require('../controller/distributorController');

// GET /api/distributor/dashboard
router.get('/dashboard', protect, getDistributorDashboard);

// POST /api/distributor/transferCredit
router.post('/transferCredit', protect, transferCreditMoney);

router.get('/exportExcel', protect, exportDistributorExcel);

module.exports = router;

