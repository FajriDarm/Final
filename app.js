const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Import middleware
const { authMiddlewarePage, checkAlreadyLoggedIn } = require('./middleware/auth');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  // Capture affiliate tracking parameters from URL
  const { ref, event } = req.query;

  // Store in cookies for tracking (30 days expiry)
  if (ref) {
    res.cookie('affiliate_ref', ref, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true
    });
  }

  if (event) {
    res.cookie('event_slug', event, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true
    });
  }

  res.render('LandingPage', {
    title: 'Home',
    affiliateRef: ref || null,
    eventSlug: event || null
  });
});

// Auth Routes (Pages)
app.get('/login', checkAlreadyLoggedIn, (req, res) => {
  // Preserve tracking params if redirecting
  const { ref, event } = req.query;
  res.render('login', { trackingRef: ref, trackingEvent: event });
});

app.get('/register', checkAlreadyLoggedIn, (req, res) => {
  // Get tracking info from cookies or URL params
  const ref = req.query.ref || req.cookies.affiliate_ref;
  const event = req.query.event || req.cookies.event_slug;

  res.render('register', {
    trackingRef: ref || null,
    trackingEvent: event || null
  });
});

app.get('/profile', authMiddlewarePage, (req, res) => {
  res.render('profile', { user: req.user, title: 'Profil' });
});

app.get('/settings', authMiddlewarePage, (req, res) => {
  res.render('settings', { user: req.user, title: 'Pengaturan' });
});

app.post('/logout', authMiddlewarePage, (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

app.get('/dashboard', authMiddlewarePage, (req, res) => {
  const role = req.user.role;
  if (role === 'super_admin') {
    res.redirect('/dashboard_admin');
  } else if (role === 'sales') {
    res.redirect('/dashboard_sales');
  } else {
    res.redirect('/profile');
  }
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
