const express = require('express');
const router = express.Router();
const controller = require('./controller');

// Serve the HTML UI
router.get('/ui', controller.serveTestUI);

// Create order
router.post('/create-order', controller.createOrder);

// Verify payment
router.post('/verify', controller.verifyPayment);

module.exports = router;
