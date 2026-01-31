const express = require('express');
const router = express.Router();
const verifyStage1Controller = require('../controllers/verifyStage1Controller');

// GET Verifikasi Tahap 1
router.get('/verify-stage1', verifyStage1Controller.getVerifyStage1);
// POST Approve/Reject
router.post('/verify-stage1', verifyStage1Controller.postVerifyStage1);

module.exports = router;
