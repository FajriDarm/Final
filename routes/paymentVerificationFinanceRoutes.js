const express = require('express');
const router = express.Router();
const paymentVerificationFinanceController = require('../controllers/paymentVerificationFinanceController');

// Payment Verification Page
router.get('/payment-verification', paymentVerificationFinanceController.getPaymentVerification);

module.exports = router;
