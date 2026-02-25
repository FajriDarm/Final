const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Import middleware
const {
  authMiddlewarePage,
  checkAlreadyLoggedIn,
} = require("./middleware/auth");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(require("./middleware/auditLogger"));

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (req, res) => {
  // Capture affiliate tracking parameters from URL
  const { ref, event } = req.query;

  // Store in cookies for tracking (30 days expiry)
  if (ref) {
    res.cookie("affiliate_ref", ref, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
    });
  }

  if (event) {
    res.cookie("event_slug", event, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
    });
  }

  // Render the public marketing landing page (LandingPage.ejs)
  res.render("LandingPage", {
    title: "Affillink - Affiliate Marketing Platform",
    affiliateRef: ref || null,
    eventSlug: event || null,
  });
});

// Public route to render the custom landing page `LPCUST.ejs`
// Supports the same affiliate/event tracking query params as the main landing page
app.get("/lp-cust", (req, res) => {
  const { ref, event } = req.query;

  if (ref) {
    res.cookie("affiliate_ref", ref, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    });
  }

  if (event) {
    res.cookie("event_slug", event, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    });
  }

  res.render("LPCUST", {
    title: "Landing (Customer)",
    affiliateRef: ref || req.cookies?.affiliate_ref || null,
    eventSlug: event || req.cookies?.event_slug || null,
  });
});

// Public route for the original marketing landing page (LandingPage.ejs)
// Preserves affiliate/event tracking via query params and cookies
app.get("/landing", (req, res) => {
  const { ref, event } = req.query;

  if (ref) {
    res.cookie("affiliate_ref", ref, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    });
  }

  if (event) {
    res.cookie("event_slug", event, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    });
  }

  res.render("LandingPage", {
    title: "Affillink - Affiliate Marketing Platform",
    affiliateRef: ref || req.cookies?.affiliate_ref || null,
    eventSlug: event || req.cookies?.event_slug || null,
  });
});

// Landing page (dynamic per event)
const landingPageController = require("./controllers/landingPageController");
app.get("/lp/:slug", landingPageController.renderLandingPage);

// Auth Routes (Pages)
app.get("/login", checkAlreadyLoggedIn, (req, res) => {
  // Preserve tracking params if redirecting
  const { ref, event } = req.query;
  res.render("login", { trackingRef: ref, trackingEvent: event });
});

app.get("/register", checkAlreadyLoggedIn, (req, res) => {
  // Get tracking info from cookies or URL params
  const ref = req.query.ref || req.cookies.affiliate_ref;
  const event = req.query.event || req.cookies.event_slug;

  res.render("register", {
    trackingRef: ref || null,
    trackingEvent: event || null,
  });
});

// Checkout page (separate customer form page)
const publicController = require("./controllers/publicController");
app.get("/checkout", publicController.checkoutPage);

app.get("/profile", authMiddlewarePage, (req, res) => {
  res.render("profile", {
    user: req.user,
    title: "Profil",
    activePage: "profile",
  });
});

app.get("/settings", authMiddlewarePage, (req, res) => {
  res.render("settings", {
    user: req.user,
    title: "Pengaturan",
    activePage: "settings",
  });
});

// Endpoint untuk ganti password dari halaman settings
const authController = require("./controllers/authController");
app.post(
  "/settings/change-password",
  authMiddlewarePage,
  authController.changePassword,
);

app.post("/logout", authMiddlewarePage, (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

app.get("/dashboard", authMiddlewarePage, (req, res) => {
  const role = req.user.role;
  if (role === "super_admin") {
    res.redirect("/dashboard_admin");
  } else if (role === "sales") {
    res.redirect("/dashboard_sales");
  } else if (role === "finance") {
    res.redirect("/dashboard_finance");
  } else if (role === "affiliate") {
    res.redirect("/affiliate/dashboard");
  } else {
    res.redirect("/profile");
  }
});

// API Routes
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const adminRoutes = require("./routes/adminRoutes");
// Mount admin routes at /api/admin for API calls only
// Page routes are handled separately below in app.js
app.use("/api/admin", adminRoutes);

// Public API routes (landing page usage)
const publicRoutes = require("./routes/publicRoutes");
app.use("/api", publicRoutes);

const affiliateRoutes = require("./routes/affiliateRoutes");
app.use("/affiliate", affiliateRoutes);
const authMiddleware = require("./middleware/auth");

// Public transaction routes (landing page form)
const transactionsRoutes = require("./routes/transactionsRoutes");
app.use("/", transactionsRoutes);

// Legacy/public-facing route for older links or redirects
app.get("/dashboard_affiliate", authMiddleware, (req, res) => {
  // Redirect to the new affiliate route
  res.redirect("/affiliate/dashboard");
});

const salesRoutes = require("./routes/salesRoutes");
app.use("/sales", salesRoutes);

const transactionReviewRoutes = require("./routes/transactionReviewRoutes");
app.use("/sales", transactionReviewRoutes);

// `verifyStage1Routes` and `verifyStage3Routes` removed — functionality
// consolidated into `verifyLeadsRoutes` (combined Sales verification UI/API).
const verifyLeadsRoutes = require("./routes/verifyLeadsRoutes");
app.use("/sales", verifyLeadsRoutes);

const monitoringAffiliateRoutes = require("./routes/monitoringAffiliateRoutes");
app.use("/sales", monitoringAffiliateRoutes);

const financeRoutes = require("./routes/financeRoutes");
app.use("/finance", financeRoutes);

const paymentVerificationFinanceRoutes = require("./routes/paymentVerificationFinanceRoutes");
app.use("/finance", paymentVerificationFinanceRoutes);

// Simple debug endpoint to return current user's info (requires auth token)
app.get("/api/whoami", authMiddleware, (req, res) => {
  res.json({ user: req.user || null });
});

const payoutProcessingFinanceRoutes = require("./routes/payoutProcessingFinanceRoutes");
app.use("/finance", payoutProcessingFinanceRoutes);

// Dashboard Sales langsung di sini
const salesController = require("./controllers/salesController");
app.get("/dashboard_sales", salesController.getSalesDashboard);

// Dashboard Finance langsung di sini
const financeController = require("./controllers/financeController");
app.get("/dashboard_finance", financeController.getFinanceDashboard);

// Admin withdrawal approvals page (rendered view)
const adminController = require("./controllers/adminController");
app.get(
  "/admin/withdrawals",
  authMiddlewarePage,
  adminController.getWithdrawalApprovalsPage,
);

// Monitoring Affiliate page
const monitoringCtrl = require("./controllers/monitoringAffiliateController");
app.get(
  "/admin/monitoring_affiliate",
  authMiddlewarePage,
  (req, res) => {
    // reuse controller to load data and render admin view
    monitoringCtrl.getMonitoringAffiliate(req, res);
  },
);

// Admin Pages (Protected)
app.get("/dashboard_admin", (req, res) => {
  res.render("admin/dashboard_admin");
});

// Redirect /admin/dashboard to /dashboard_admin for consistency
app.get("/admin/dashboard", (req, res) => {
  res.redirect("/dashboard_admin");
});

app.get("/admin/users", authMiddlewarePage, adminController.getUsersPage);

app.get("/admin/events", authMiddlewarePage, adminController.getEventsPage);

app.get(
  "/admin/affiliates",
  authMiddlewarePage,
  adminController.getAffiliatesPage,
);

app.get(
  "/admin/activity-logs",
  authMiddlewarePage,
  adminController.getActivityLogsPage,
);

app.get("/admin/commissions", authMiddlewarePage, (req, res) => {
  res.render("admin/commissions");
});

app.get("/admin/withdrawals", (req, res) => {
  res.render("admin/withdrawal_approvals");
});

// Commission Routes (Page and API)
const commissionRoutes = require("./routes/commissionRoutes");
app.use("/", commissionRoutes);
app.use("/api", commissionRoutes);

// Start
const db = require("./config/database");

(async () => {
  try {
    // Ensure lead_statuses table exists so SELECT with LEFT JOIN won't fail
    await db.query(`
      CREATE TABLE IF NOT EXISTS lead_statuses (
        transaction_id INT PRIMARY KEY,
        status VARCHAR(191),
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (e) {
    console.error(
      "Failed creating lead_statuses table at startup:",
      e.message || e,
    );
  }

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
})();
