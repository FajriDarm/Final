const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
  res.render("LandingPage", { title: "Home" });
});

// Auth Routes (Pages)
app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

// API Routes
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const adminRoutes = require("./routes/adminRoutes");
app.use("/api/admin", adminRoutes);

const affiliateRoutes = require("./routes/affiliateRoutes");
app.use("/affiliate", affiliateRoutes);
const authMiddleware = require("./middleware/auth");

// Legacy/public-facing route for older links or redirects
app.get("/dashboard_affiliate", authMiddleware, (req, res) => {
  // Redirect to the new affiliate route
  res.redirect("/affiliate/dashboard");
});

const salesRoutes = require('./routes/salesRoutes');
app.use('/sales', salesRoutes);

const transactionReviewRoutes = require('./routes/transactionReviewRoutes');
app.use('/sales', transactionReviewRoutes);

const verifyStage1Routes = require('./routes/verifyStage1Routes');
app.use('/sales', verifyStage1Routes);

const verifyStage3Routes = require('./routes/verifyStage3Routes');
app.use('/sales', verifyStage3Routes);

const monitoringAffiliateRoutes = require('./routes/monitoringAffiliateRoutes');
app.use('/sales', monitoringAffiliateRoutes);

const financeRoutes = require('./routes/financeRoutes');
app.use('/finance', financeRoutes);

const paymentVerificationFinanceRoutes = require('./routes/paymentVerificationFinanceRoutes');
app.use('/finance', paymentVerificationFinanceRoutes);

const payoutProcessingFinanceRoutes = require('./routes/payoutProcessingFinanceRoutes');
app.use('/finance', payoutProcessingFinanceRoutes);

// Dashboard Sales langsung di sini
const salesController = require('./controllers/salesController');
app.get('/dashboard_sales', salesController.getSalesDashboard);

// Dashboard Finance langsung di sini
const financeController = require('./controllers/financeController');
app.get('/dashboard_finance', financeController.getFinanceDashboard);

// Admin Pages (Protected)
app.get("/dashboard_admin", (req, res) => {
  res.render("admin/dashboard_admin");
});

app.get("/admin/users", (req, res) => {
  res.render("admin/users");
});

app.get("/admin/events", (req, res) => {
  res.render("admin/events");
});

app.get("/admin/affiliates", (req, res) => {
  res.render("admin/affiliates");
});

app.get("/admin/activity-logs", (req, res) => {
  res.render("admin/activity-logs");
});

// Start
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
