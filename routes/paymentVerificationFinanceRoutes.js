const express = require("express");
const router = express.Router();
const paymentVerificationFinanceController = require("../controllers/paymentVerificationFinanceController");

// Payment Verification Page
router.get(
  "/payment-verification",
  paymentVerificationFinanceController.getPaymentVerification,
);

// Approve / Reject actions
router.post(
  "/payment-verification/:id/approve",
  paymentVerificationFinanceController.approvePayment,
);
router.post(
  "/payment-verification/:id/reject",
  paymentVerificationFinanceController.rejectPayment,
);

module.exports = router;
