const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// multer setup for hero uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
const monitoringCtrl = require("../controllers/monitoringAffiliateController");
const authMiddleware = require("../middleware/auth");

// Public endpoint for active events (no auth required)
router.get("/events/active", adminController.getActiveEvents);

// Dashboard
router.get("/dashboard/stats", adminController.getDashboardStats);

// Users - Remove auth temporarily for development
router.get("/users", adminController.getUsers);
router.put("/users/:id", adminController.updateUser);

// Events - Remove auth temporarily for development
router.get("/events", adminController.getEvents);
router.get("/events/:eventId", adminController.getEventById); // detail for edit
router.post("/events", adminController.createEvent);
router.put("/events/:eventId", adminController.updateEvent);
router.delete("/events/:eventId", adminController.deleteEvent);

// Upload hero media (image/video) - authenticated
router.post('/events/upload-hero', (req, res, next) => {
  upload.single('hero')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran file melebihi batas 5MB'
        : `Upload gagal: ${err.message}`;
      return res.status(400).json({ success: false, message });
    }
    return res.status(500).json({ success: false, message: err.message || 'Upload gagal' });
  });
}, adminController.uploadHero);

// Packages endpoint removed - pricing is part of the event record

// Admin: generate token for user (super_admin only)
router.post("/tokens", authMiddleware, adminController.generateTokenForUser);

// Affiliates - Remove auth temporarily for development
router.get("/affiliates/pending", adminController.getPendingAffiliates);
router.put("/affiliates/:userId/approve", adminController.approveAffiliate);
router.put("/affiliates/:userId/reject", adminController.rejectAffiliate);

// Activity Logs - Remove auth temporarily for development
router.get("/activity-logs", adminController.getActivityLogs);

// Monitoring Affiliate page (needs to load admin view)
router.get(
  "/monitoring_affiliate",
  authMiddleware,
  monitoringCtrl.getMonitoringAffiliate,
);

// Withdrawal Approvals
router.get(
  "/withdrawals",
  authMiddleware,
  adminController.getWithdrawalApprovalsPage,
);
router.get(
  "/withdrawals/approval",
  authMiddleware,
  adminController.getPendingWithdrawalsForApproval,
);
router.get(
  "/withdrawals/approval/:id",
  authMiddleware,
  adminController.getWithdrawalDetailForApproval,
);
router.post(
  "/withdrawals/approval/:id/approve",
  authMiddleware,
  adminController.approveWithdrawal,
);
router.post(
  "/withdrawals/approval/:id/reject",
  authMiddleware,
  adminController.rejectWithdrawal,
);

// Withdrawal Approvals
router.get('/withdrawals', authMiddleware, adminController.getWithdrawalApprovalsPage);
router.get('/withdrawals/approval', authMiddleware, adminController.getPendingWithdrawalsForApproval);
router.get('/withdrawals/approval/:id', authMiddleware, adminController.getWithdrawalDetailForApproval);
router.post('/withdrawals/approval/:id/approve', authMiddleware, adminController.approveWithdrawal);
router.post('/withdrawals/approval/:id/reject', authMiddleware, adminController.rejectWithdrawal);

module.exports = router;
