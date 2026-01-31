const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');

// Dashboard Finance
router.get('/dashboard', financeController.getFinanceDashboard);

module.exports = router;
