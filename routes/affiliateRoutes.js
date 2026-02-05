const express = require("express");
const router = express.Router();
const affiliateController = require("../controllers/affiliateController");
const authMiddleware = require("../middleware/auth");

// Dashboard page (requires auth)
router.get("/dashboard", authMiddleware, affiliateController.dashboard);

// Commission Dashboard page
router.get(
  "/commissions",
  authMiddleware,
  affiliateController.commissionDashboard,
);

// API: Get current user status
router.get("/api/status", authMiddleware, affiliateController.getUserStatus);

// API: Get active events for affiliate
router.get("/api/events", authMiddleware, affiliateController.getActiveEvents);

// API: Generate affiliate link for specific event
router.post(
  "/api/generate-link",
  authMiddleware,
  affiliateController.generateLink,
);

// ============================================
// COMMISSION & WITHDRAWAL ENDPOINTS
// ============================================

// Commission endpoints
router.get(
  "/api/commissions",
  authMiddleware,
  affiliateController.getMyCommissions,
);
router.get(
  "/api/commissions/ready",
  authMiddleware,
  affiliateController.getReadyCommissionsEndpoint,
);
router.get(
  "/api/commissions/summary",
  authMiddleware,
  affiliateController.getCommissionSummaryEndpoint,
);

// Withdrawal request endpoints
router.post(
  "/api/withdrawal/request",
  authMiddleware,
  affiliateController.requestWithdrawal,
);
router.get(
  "/api/withdrawal/requests",
  authMiddleware,
  affiliateController.getMyWithdrawalRequests,
);
router.get(
  "/api/withdrawal/requests/:id",
  authMiddleware,
  affiliateController.getWithdrawalRequestDetail,
);

module.exports = router;
