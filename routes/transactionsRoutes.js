const express = require("express");
const router = express.Router();
const transactionsController = require("../controllers/transactionsController");

// Public endpoint for customers to create a transaction from landing page
router.post("/transactions", transactionsController.createTransaction);

module.exports = router;
