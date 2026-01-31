const express = require("express");
const router = express.Router();
const affiliateController = require("../controllers/affiliateController");
const authMiddleware = require("../middleware/auth");

// Dashboard page (requires auth)
router.get("/dashboard", authMiddleware, affiliateController.dashboard);

// API: Get current user status
router.get("/api/status", authMiddleware, affiliateController.getUserStatus);

// API: Get active events for affiliate
router.get("/api/events", authMiddleware, affiliateController.getActiveEvents);

// API: Generate affiliate link for specific event
router.post("/api/generate-link", authMiddleware, affiliateController.generateLink);

module.exports = router;
