const db = require("../config/database");

const dashboard = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id || null;

    if (!userId) {
      return res
        .status(401)
        .send("Unauthorized - user id required (for testing use ?user_id=)");
    }

    // Basic user info with role
    const [users] = await db.query(
      `SELECT u.id, u.name, u.email, u.status, u.affiliate_status, r.name as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [userId],
    );
    const user = users[0] || {
      name: "Affiliate",
      status: "inactive",
      affiliate_status: "inactive",
    };

    // Referral link - try to get existing affiliate_links, otherwise build a sample code
    let referralLink = "";
    let sampleRefCode = null;
    try {
      const [links] = await db.query(
        "SELECT code FROM affiliate_links WHERE affiliate_id = ? LIMIT 1",
        [userId],
      );
      if (links.length > 0) {
        sampleRefCode = links[0].code;
      }
    } catch (e) {
      // ignore
    }

    // siteUrl from env or localhost
    const siteUrl =
      process.env.SITE_URL || req.protocol + "://" + req.get("host");
    referralLink = sampleRefCode
      ? `${siteUrl}/?ref=${sampleRefCode}`
      : `${siteUrl}/?ref=AFF${userId}`;

    // Summary metrics
    let activeProgramsCount = 0;
    try {
      const [rows] = await db.query(
        "SELECT COUNT(*) as cnt FROM events WHERE affiliate_enabled = 1 AND status = 'active'",
      );
      activeProgramsCount = rows[0]?.cnt || 0;
    } catch (e) {}

    let totalCommission = "0.00";
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(SUM(amount),0) as total FROM commissions WHERE affiliate_id = ?",
        [userId],
      );
      totalCommission = rows[0]?.total || "0.00";
    } catch (e) {}

    let totalLeads = 0;
    try {
      const [rows] = await db.query(
        "SELECT COUNT(*) as cnt FROM transactions WHERE affiliate_id = ?",
        [userId],
      );
      totalLeads = rows[0]?.cnt || 0;
    } catch (e) {}

    let leadsLast30 = 0;
    try {
      const [rows] = await db.query(
        "SELECT COUNT(*) as cnt FROM transactions WHERE affiliate_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
        [userId],
      );
      leadsLast30 = rows[0]?.cnt || 0;
    } catch (e) {}

    // Pagination and filtering for recent leads
    const perPage = 5;
    const currentPage = Math.max(parseInt(req.query.page || "1", 10), 1);
    const statusFilter = req.query.status || "all";

    // Build where clause for filtered leads
    let whereClause = "t.affiliate_id = ?";
    const whereParams = [userId];
    if (statusFilter && statusFilter !== "all") {
      whereClause += " AND t.payment_status = ?";
      whereParams.push(statusFilter);
    }

    // Total count for pagination (with filter)
    let filteredCount = 0;
    try {
      const [countRows] = await db.query(
        `SELECT COUNT(*) as cnt FROM transactions t WHERE ${whereClause}`,
        whereParams,
      );
      filteredCount = countRows[0]?.cnt || 0;
    } catch (e) {}

    const totalPages = Math.max(Math.ceil((filteredCount || 0) / perPage), 1);
    const offset = (currentPage - 1) * perPage;

    // Recent leads details (paginated)
    let leads = [];
    try {
      const params = [...whereParams, perPage, offset];
      const [rows] = await db.query(
        `SELECT t.id, COALESCE(t.customer_name, c.name) as name, c.email, c.phone, e.title as event_title, t.payment_status, t.status, t.created_at
         FROM transactions t
         LEFT JOIN customers c ON t.customer_id = c.id
         LEFT JOIN events e ON t.event_id = e.id
         WHERE ${whereClause}
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?`,
        params,
      );
      leads = rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        event_title: r.event_title || "-",
        payment_status: r.payment_status,
        status: r.status,
        created_at: r.created_at,
      }));
    } catch (e) {}

    // Affiliate profile (optional table)
    let affiliateProfile = null;
    try {
      const [rows] = await db.query(
        "SELECT * FROM affiliate_profiles WHERE affiliate_id = ? LIMIT 1",
        [userId],
      );
      if (rows.length > 0) affiliateProfile = rows[0];
    } catch (e) {
      // table may not exist
    }

    // History: transactions older than 7 days with status paid or rejected
    const historyPerPage = 10;
    const historyPage = Math.max(parseInt(req.query.historyPage || "1", 10), 1);
    const historyFilter = req.query.historyStatus || "all"; // 'pending', 'stage_1_approved', 'stage_2_approved', 'completed', 'rejected', or 'all'

    let historyWhere =
      "t.affiliate_id = ? AND t.created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)";
    const historyParams = [userId];
    if (historyFilter && historyFilter !== "all") {
      historyWhere += " AND t.status = ?";
      historyParams.push(historyFilter);
    }

    // count
    let historyTotalCount = 0;
    try {
      const [cntRows] = await db.query(
        `SELECT COUNT(*) as cnt FROM transactions t WHERE ${historyWhere}`,
        historyParams,
      );
      historyTotalCount = cntRows[0]?.cnt || 0;
    } catch (e) {}

    const historyTotalPages = Math.max(
      Math.ceil((historyTotalCount || 0) / historyPerPage),
      1,
    );
    const historyOffset = (historyPage - 1) * historyPerPage;

    let history = [];
    try {
      const params = [...historyParams, historyPerPage, historyOffset];
      const [rowsHist] = await db.query(
        `SELECT t.id, COALESCE(t.customer_name, c.name) AS name, c.email, c.phone, e.title as event_title, t.status, t.payment_status, t.created_at
         FROM transactions t
         LEFT JOIN customers c ON t.customer_id = c.id
         LEFT JOIN events e ON t.event_id = e.id
         WHERE ${historyWhere}
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?`,
        params,
      );
      history = rowsHist.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        event_title: r.event_title || "-",
        status: r.status,
        payment_status: r.payment_status,
        created_at: r.created_at,
      }));
    } catch (e) {}

    res.render("affiliate/dashboard_affiliate", {
      name: user.name,
      userStatus: user.affiliate_status || user.status || "inactive",
      userId: user.id,
      userRole: user.role || "user",
      referralLink,
      siteUrl,
      sampleRefCode,
      activeProgramsCount,
      totalCommission,
      totalLeads,
      leadsLast30,
      leads,
      // pagination
      currentPage,
      totalPages,
      perPage,
      statusFilter,
      affiliateProfile,
      // history (older than 7 days)
      history,
      historyPage,
      historyTotalPages,
      historyPerPage,
      historyFilter,
    });
  } catch (error) {
    console.error("Affiliate dashboard error:", error);
    res.status(500).send("Internal server error");
  }
};

const getActiveEvents = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id || null;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user id required",
      });
    }

    // Get active events that can be promoted
    const [events] = await db.query(
      `SELECT id, title, slug, description, price_original, price_promo,
              start_date, end_date, status, event_type
       FROM events
       WHERE status = 'active'
       AND (end_date >= CURDATE() OR end_date IS NULL)
       ORDER BY created_at DESC`,
    );

    // Get existing affiliate links for this user with event info
    const [existingLinks] = await db.query(
      `SELECT al.event_id, al.code, al.clicks, al.created_at, e.slug
       FROM affiliate_links al
       LEFT JOIN events e ON al.event_id = e.id
       WHERE al.affiliate_id = ?`,
      [userId],
    );

    // Create a map of existing links by event_id with full URL (direct to checkout form)
    const linksMap = {};
    const siteUrl =
      process.env.SITE_URL || req.protocol + "://" + req.get("host");

    existingLinks.forEach((link) => {
      // Generate both URLs: checkout (form) and landing page (LP)
      const checkoutUrl = link.slug
        ? `${siteUrl}/checkout?event=${link.slug}&ref=${link.code}`
        : `${siteUrl}/checkout?ref=${link.code}`;
      const landingUrl = link.slug
        ? `${siteUrl}/?event=${link.slug}&ref=${link.code}`
        : `${siteUrl}/?ref=${link.code}`;

      linksMap[link.event_id] = {
        ...link,
        url_checkout: checkoutUrl,
        url_lp: landingUrl,
        // keep legacy `url` pointing to checkout for backward compatibility
        url: checkoutUrl,
      };
    });

    // Combine events with their existing links (if any)
    const eventsWithLinks = events.map((event) => ({
      ...event,
      affiliate_link: linksMap[event.id] || null,
      has_link: !!linksMap[event.id],
    }));

    res.json({
      success: true,
      data: eventsWithLinks,
    });
  } catch (error) {
    console.error("Get active events error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const generateLink = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { eventId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user id required",
      });
    }

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required",
      });
    }

    // Check if user is approved affiliate
    const [users] = await db.query(
      "SELECT id, name, affiliate_status FROM users WHERE id = ?",
      [userId],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = users[0];

    // VALIDASI: Affiliate harus approved
    if (user.affiliate_status !== "approved") {
      return res.status(403).json({
        success: false,
        message:
          "Anda belum di-approve sebagai affiliate. Silakan tunggu approval admin.",
        status: user.affiliate_status,
      });
    }

    // Check if event exists and is active
    const [events] = await db.query(
      "SELECT id, title, slug, status FROM events WHERE id = ?",
      [eventId],
    );

    if (events.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const event = events[0];

    if (event.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Event is not active",
      });
    }

    // Check if link already exists
    const [existingLinks] = await db.query(
      "SELECT id, code FROM affiliate_links WHERE affiliate_id = ? AND event_id = ?",
      [userId, eventId],
    );

    let code;

    if (existingLinks.length > 0) {
      // Link already exists, return existing
      code = existingLinks[0].code;
    } else {
      // Generate unique affiliate code
      code = `AFF${userId}-E${eventId}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Insert new affiliate link
      await db.query(
        `INSERT INTO affiliate_links (affiliate_id, event_id, code, is_active)
         VALUES (?, ?, ?, 1)`,
        [userId, eventId, code],
      );
    }

    // Generate full URL - mengarah langsung ke halaman checkout/form dengan event + ref
    const siteUrl =
      process.env.SITE_URL || req.protocol + "://" + req.get("host");
    const checkoutUrl = `${siteUrl}/checkout?event=${event.slug}&ref=${code}`;
    const landingUrl = `${siteUrl}/?event=${event.slug}&ref=${code}`;

    res.json({
      success: true,
      message: "Affiliate link generated successfully",
      data: {
        code,
        url_checkout: checkoutUrl,
        url_lp: landingUrl,
        url: checkoutUrl, // legacy
        event_id: event.id,
        event_title: event.title,
        event_slug: event.slug,
      },
    });
  } catch (error) {
    console.error("Generate link error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getUserStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id || null;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user id required",
      });
    }

    const [users] = await db.query(
      `SELECT u.id, u.name, u.email, u.affiliate_status, u.status, r.name as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [userId],
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = users[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        affiliate_status: user.affiliate_status || "inactive",
        status: user.status || "inactive",
        role: user.role || "user",
      },
    });
  } catch (error) {
    console.error("Get user status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ============================================
// COMMISSION & WITHDRAWAL ENDPOINTS
// ============================================

/**
 * GET /api/affiliate/commissions
 * List all commissions for logged-in affiliate
 */
const getMyCommissions = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user id required",
      });
    }

    const [commissions] = await db.query(
      `
      SELECT 
        c.id,
        c.transaction_id,
        c.amount,
        c.commission_status,
        c.stage,
        c.created_at,
        t.event_id,
        e.title as event_title,
        t.total_amount as transaction_amount
      FROM commissions c
      JOIN transactions t ON c.transaction_id = t.id
      LEFT JOIN events e ON t.event_id = e.id
      WHERE c.affiliate_id = ?
      ORDER BY c.created_at DESC
    `,
      [userId],
    );

    res.json({
      success: true,
      data: commissions,
    });
  } catch (error) {
    console.error("Get commissions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET /api/affiliate/commissions/ready
 * List ready-for-withdraw commissions
 */
const getReadyCommissionsEndpoint = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user id required",
      });
    }

    const { getReadyCommissions } = require("./withdrawalService");

    const commissions = await getReadyCommissions(userId);

    res.json({
      success: true,
      data: commissions,
      count: commissions.length,
    });
  } catch (error) {
    console.error("Get ready commissions error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET /api/affiliate/commissions/summary
 * Get commission summary (pending, ready, paid)
 */
const getCommissionSummaryEndpoint = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user id required",
      });
    }

    const { getCommissionSummary } = require("./withdrawalService");

    const summary = await getCommissionSummary(userId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Get commission summary error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * POST /api/affiliate/withdrawal/request
 * Affiliate request withdrawal
 * Body: { commission_ids?: [1, 2, 3] }
 */
const requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user id required",
      });
    }

    const { commission_ids } = req.body;

    const { createWithdrawalRequest } = require("./withdrawalService");

    const result = await createWithdrawalRequest(userId, commission_ids);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: "Withdrawal request created",
      data: {
        payout_id: result.payout_id,
        total_amount: result.total_amount,
        commission_count: result.commission_count,
      },
    });
  } catch (error) {
    console.error("Request withdrawal error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET /api/affiliate/withdrawal/requests
 * List withdrawal requests for affiliate
 */
const getMyWithdrawalRequests = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user id required",
      });
    }

    const { getAffiliateWithdrawals } = require("./withdrawalService");

    const withdrawals = await getAffiliateWithdrawals(userId);

    res.json({
      success: true,
      data: withdrawals,
      count: withdrawals.length,
    });
  } catch (error) {
    console.error("Get withdrawal requests error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * GET /api/affiliate/withdrawal/requests/:id
 * Get withdrawal request detail with commissions
 */
const getWithdrawalRequestDetail = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user id required",
      });
    }

    const { getWithdrawalDetail } = require("./withdrawalService");

    const withdrawal = await getWithdrawalDetail(id);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found",
      });
    }

    // Verify ownership
    if (withdrawal.affiliate_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to this withdrawal request",
      });
    }

    res.json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    console.error("Get withdrawal detail error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Page: Commission Dashboard
const commissionDashboard = async (req, res) => {
  try {
    const user = req.user || { id: req.query.user_id, name: "Affiliate" };

    res.render("affiliate/commission_dashboard", {
      name: user.name,
      user_id: user.id,
      role: user.role || "affiliate",
    });
  } catch (error) {
    console.error("Commission dashboard error:", error);
    res.status(500).send("Error loading commission dashboard");
  }
};

module.exports = {
  dashboard,
  commissionDashboard,
  getActiveEvents,
  generateLink,
  getUserStatus,
  getMyCommissions,
  getReadyCommissionsEndpoint,
  getCommissionSummaryEndpoint,
  requestWithdrawal,
  getMyWithdrawalRequests,
  getWithdrawalRequestDetail,
};
