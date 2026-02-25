const express = require("express");
const router = express.Router();
const verifyLeadsController = require("../controllers/verifyLeadsController");
const { authMiddlewarePage, requireRole } = require("../middleware/auth");

router.get(
  "/verify-leads",
  authMiddlewarePage,
  requireRole("sales"),
  verifyLeadsController.getVerifyLeads,
);
router.get(
  "/lead-events",
  authMiddlewarePage,
  requireRole("sales"),
  verifyLeadsController.leadEventsStream,
);
router.post(
  "/update-lead-status",
  authMiddlewarePage,
  requireRole("sales"),
  verifyLeadsController.postUpdateLeadStatus,
);

module.exports = router;
