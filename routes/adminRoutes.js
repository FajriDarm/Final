const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
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
router.post("/events", adminController.createEvent);
router.put("/events/:eventId", adminController.updateEvent);
router.delete("/events/:eventId", adminController.deleteEvent);

// Admin: generate token for user (super_admin only)
router.post("/tokens", authMiddleware, adminController.generateTokenForUser);

// Affiliates - Remove auth temporarily for development
router.get("/affiliates/pending", adminController.getPendingAffiliates);
router.put("/affiliates/:userId/approve", adminController.approveAffiliate);
router.put("/affiliates/:userId/reject", adminController.rejectAffiliate);

// Activity Logs - Remove auth temporarily for development
router.get("/activity-logs", adminController.getActivityLogs);

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
