const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const financeController = require("../controllers/financeController");
const auth = require("../middleware/auth");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public/uploads/payment_proofs"));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and PDF files are allowed"));
    }
  },
});

// Dashboard Finance
router.get("/dashboard", financeController.getFinanceDashboard);

// Withdrawal Management page
router.get("/withdrawals", financeController.getWithdrawalManagementPage);

// ============================================
// WITHDRAWAL REQUEST ENDPOINTS
// ============================================

// Get all pending withdrawal requests
router.get(
  "/api/withdrawals",
  auth,
  financeController.getPendingWithdrawalsAPI,
);

// Get counts per withdrawal status (for realtime badges)
router.get(
  "/api/withdrawals/counts",
  auth,
  financeController.getWithdrawalCountsAPI,
);

// Get withdrawal request detail
router.get(
  "/api/withdrawals/:id",
  auth,
  financeController.getWithdrawalDetailAPI,
);

// Submit withdrawal to Admin for approval
router.post(
  "/api/withdrawals/:id/submit-to-admin",
  auth,
  financeController.submitWithdrawalToAdmin,
);

// Approve withdrawal (admin only - but kept for backwards compatibility)
router.post(
  "/api/withdrawals/:id/approve",
  auth,
  financeController.approveWithdrawalAPI,
);

// Reject withdrawal
router.post(
  "/api/withdrawals/:id/reject",
  auth,
  financeController.rejectWithdrawalAPI,
);

// Mark withdrawal as paid
router.post(
  "/api/withdrawals/:id/mark-paid",
  auth,
  upload.single("proof_file"),
  financeController.markWithdrawalAsPaidAPI,
);

module.exports = router;
