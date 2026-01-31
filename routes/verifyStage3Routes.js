const express = require('express');
const router = express.Router();
const verifyStage3Controller = require('../controllers/verifyStage3Controller');

// GET Verifikasi Tahap 3
router.get('/verify-stage3', verifyStage3Controller.getVerifyStage3);
// POST Approve/Reject
router.post('/verify-stage3', verifyStage3Controller.postVerifyStage3);

module.exports = router;
