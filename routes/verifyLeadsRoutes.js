const express = require("express");
const router = express.Router();
const verifyLeadsController = require("../controllers/verifyLeadsController");

router.get("/verify-leads", verifyLeadsController.getVerifyLeads);
router.get("/lead-events", verifyLeadsController.leadEventsStream);
router.post("/update-lead-status", verifyLeadsController.postUpdateLeadStatus);

module.exports = router;
