const express = require('express');
const router = express.Router();
const monitoringAffiliateController = require('../controllers/monitoringAffiliateController');

// GET Monitoring Affiliate
router.get('/affiliates', monitoringAffiliateController.getMonitoringAffiliate);

module.exports = router;
