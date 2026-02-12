const express = require("express");
const router = express.Router();
const paymentVerificationFinanceController = require("../controllers/paymentVerificationFinanceController");
const { authMiddlewarePage, requireRole } = require("../middleware/auth");

// Payment Verification Page (protected: finance)
router.get(
  "/payment-verification",
  authMiddlewarePage,
  requireRole("finance"),
  paymentVerificationFinanceController.getPaymentVerification,
); // API for pending payments JSON (used by frontend polling)
router.get(
  "/payment-verification/api",
  authMiddlewarePage,
  requireRole("finance"),
  paymentVerificationFinanceController.getPendingPaymentsJSON,
);
// Approve / Reject actions
router.post(
  "/payment-verification/:id/approve",
  authMiddlewarePage,
  requireRole("finance"),
  paymentVerificationFinanceController.approvePayment,
);
router.post(
  "/payment-verification/:id/reject",
  authMiddlewarePage,
  requireRole("finance"),
  paymentVerificationFinanceController.rejectPayment,
);
// Set lead status (DP / LUNAS) from finance UI
router.post(
  "/payment-verification/:id/set-lead-status",
  authMiddlewarePage,
  requireRole("finance"),
  paymentVerificationFinanceController.setLeadStatus,
);

module.exports = router;
