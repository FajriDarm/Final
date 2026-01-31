const express = require('express');
const router = express.Router();
const transactionReviewController = require('../controllers/transactionReviewController');

// Transaction Review
router.get('/transactions', transactionReviewController.getTransactionReview);

module.exports = router;
