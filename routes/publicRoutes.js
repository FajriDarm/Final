const express = require("express");
const router = express.Router();
const publicController = require("../controllers/publicController");

// Track affiliate clicks from public landing page
router.post("/affiliate/track-click", publicController.trackAffiliateClick);

module.exports = router;
