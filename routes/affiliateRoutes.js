const express = require("express");
const router = express.Router();
const affiliateController = require("../controllers/affiliateController");
const authMiddleware = require("../middleware/auth");

// Dashboard page (requires auth)
router.get("/dashboard", authMiddleware, affiliateController.dashboard);

module.exports = router;
