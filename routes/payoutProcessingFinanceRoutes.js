const express = require('express');
const router = express.Router();
const payoutProcessingFinanceController = require('../controllers/payoutProcessingFinanceController');

// Payout Processing Page
router.get('/payout-processing', payoutProcessingFinanceController.getPayoutProcessing);

module.exports = router;
