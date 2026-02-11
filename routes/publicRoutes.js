const express = require("express");
const router = express.Router();
const publicController = require("../controllers/publicController");

// Track affiliate clicks from public landing page
router.post("/affiliate/track-click", publicController.trackAffiliateClick);

// Checkout page for customer to submit order (separate page instead of modal)
router.get("/checkout", publicController.checkoutPage);

module.exports = router;
