const db = require("../config/database");
const jwt = require("jsonwebtoken");

function generateSlug(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const getActiveEvents = async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT id, title as name, description, price_original, price_promo as price_discount,
              start_date, end_date, status, slug,
              payment_methods, bank_name, bank_account_name, bank_account_number, event_type
       FROM events
       WHERE status = 'active'
       AND (end_date >= CURDATE() OR end_date IS NULL)
       ORDER BY created_at DESC`,
    );

    res.json({
      success: true,
      data: events,
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

const getDashboardStats = async (req, res) => {
  try {
    // Total Users
    const [totalUsers] = await db.query("SELECT COUNT(*) as count FROM users");

    // Total Affiliates
    const [totalAffiliates] = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE role_id = 4",
    );

    // Pending Affiliates
    const [pendingAffiliates] = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE affiliate_status = "pending"',
    );

    // Active Events
    const [activeEvents] = await db.query(
      'SELECT COUNT(*) as count FROM events WHERE status = "active"',
    );

    // Total Transactions
    const [totalTransactions] = await db.query(
      "SELECT COUNT(*) as count FROM transactions",
    );

    // Completed Transactions
    const [completedTransactions] = await db.query(
      'SELECT COUNT(*) as count FROM transactions WHERE status = "completed"',
    );

    // Total Revenue (from completed transactions)
    const [totalRevenue] = await db.query(
      'SELECT COALESCE(SUM(total_amount), 0) as revenue FROM transactions WHERE status = "completed"',
    );

    // Pending Payouts
    const [pendingPayouts] = await db.query(
      'SELECT COUNT(*) as count FROM payouts WHERE status = "pending"',
    );

    // Recent Transactions
    const [recentTransactions] = await db.query(
      `SELECT t.id, t.total_amount, t.status, t.payment_status, t.created_at,
              COALESCE(c.name, 'Unknown') as customer_name, u.name as affiliate_name
       FROM transactions t
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN users u ON t.affiliate_id = u.id
       ORDER BY t.created_at DESC
       LIMIT 10`,
    );

    // Recent Activity Logs
    const [recentActivities] = await db.query(
      `SELECT al.*, u.name as user_name
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT 10`,
    );

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers[0].count,
        totalAffiliates: totalAffiliates[0].count,
        pendingAffiliates: pendingAffiliates[0].count,
        activeEvents: activeEvents[0].count,
        totalTransactions: totalTransactions[0].count,
        completedTransactions: completedTransactions[0].count,
        totalRevenue: totalRevenue[0].revenue,
        pendingPayouts: pendingPayouts[0].count,
      },
      recentTransactions,
      recentActivities,
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.*, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`,
    );

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getEvents = async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT e.*, u.name as created_by_name
       FROM events e
       LEFT JOIN users u ON e.created_by = u.id
       ORDER BY e.created_at DESC`,
    );

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      price_original,
      price_promo,
      payment_methods,
      bank_name,
      bank_account_name,
      bank_account_number,
      start_date,
      end_date,
    } = req.body;

    const userId = req.user?.id || 1;

    // Event type logic
    const eventType = req.body.event_type || "berbayar";
    const finalPriceOriginal =
      eventType === "gratis" ? 0 : req.body.price_original || 0;
    const finalPricePromo =
      eventType === "gratis" ? 0 : req.body.price_promo || 0;
    const paymentMethods =
      eventType === "gratis" ? "" : req.body.payment_methods || "";

    const insertValues = [
      req.body.title,
      req.body.slug || generateSlug(req.body.title),
      req.body.description,
      eventType,
      finalPriceOriginal,
      finalPricePromo,
      paymentMethods,
      req.body.bank_name || "",
      req.body.bank_account_name || "",
      req.body.bank_account_number || "",
      req.body.account_holder_name || "",
      req.body.admin_whatsapp || "",
      req.body.start_date,
      req.body.end_date,
      req.body.status || "draft",
      userId,
    ];

    console.debug(
      "Creating event with values length:",
      insertValues.length,
      "values:",
      insertValues,
    );

    const [result] = await db.query(
      `INSERT INTO events
       (title, slug, description, event_type, price_original, price_promo, payment_methods,
        bank_name, bank_account_name, bank_account_number, account_holder_name,
        admin_whatsapp, start_date, end_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      insertValues,
    );

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      title,
      description,
      price_original,
      price_promo,
      payment_methods,
      bank_name,
      bank_account_name,
      bank_account_number,
      start_date,
      end_date,
      status,
    } = req.body;

    await db.query(
      `UPDATE events SET
       title = ?, description = ?, price_original = ?, price_promo = ?,
       payment_methods = ?, bank_name = ?, bank_account_name = ?,
       bank_account_number = ?, start_date = ?, end_date = ?, status = ?
       WHERE id = ?`,
      [
        title,
        description,
        price_original,
        price_promo,
        payment_methods,
        bank_name,
        bank_account_name,
        bank_account_number,
        start_date,
        end_date,
        status,
        eventId,
      ],
    );

    res.json({
      success: true,
      message: "Event updated successfully",
    });
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    await db.query("DELETE FROM events WHERE id = ?", [eventId]);

    res.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getPendingAffiliates = async (req, res) => {
  try {
    const [affiliates] = await db.query(
      'SELECT id, name, email, affiliate_status, created_at FROM users WHERE affiliate_status = "pending"',
    );

    res.json({
      success: true,
      data: affiliates,
    });
  } catch (error) {
    console.error("Get pending affiliates error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const approveAffiliate = async (req, res) => {
  try {
    const { userId } = req.params;

    await db.query(
      'UPDATE users SET affiliate_status = "approved" WHERE id = ?',
      [userId],
    );

    // Log activity
    await db.query(
      "INSERT INTO activity_logs (user_id, action, description) VALUES (?, ?, ?)",
      [userId, "affiliate_approved", "Affiliate approved by admin"],
    );

    res.json({
      success: true,
      message: "Affiliate approved successfully",
    });
  } catch (error) {
    console.error("Approve affiliate error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const rejectAffiliate = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    await db.query(
      'UPDATE users SET affiliate_status = "rejected" WHERE id = ?',
      [userId],
    );

    // Log activity
    await db.query(
      "INSERT INTO activity_logs (user_id, action, description) VALUES (?, ?, ?)",
      [
        userId,
        "affiliate_rejected",
        `Affiliate rejected. Reason: ${reason || "Not specified"}`,
      ],
    );

    res.json({
      success: true,
      message: "Affiliate rejected successfully",
    });
  } catch (error) {
    console.error("Reject affiliate error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Generate JWT token for a specific user (admin only)
const generateTokenForUser = async (req, res) => {
  try {
    // Only super_admin allowed
    if (!req.user || String(req.user.role) !== "super_admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { userId, email, expiresIn = "24h" } = req.body;
    if (!userId && !email) {
      return res
        .status(400)
        .json({ success: false, message: "Specify userId or email" });
    }

    const where = userId ? "u.id = ?" : "u.email = ?";
    const param = userId || email;

    const [users] = await db.query(
      `SELECT u.id, u.email, u.name, COALESCE(r.name, 'user') as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE ${where}`,
      [param],
    );

    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const user = users[0];

    // Simple validation for expiresIn (allow formats like 24h, 7d, 1h)
    if (!/^[0-9]+[smhd]$/.test(expiresIn) && expiresIn !== "24h") {
      // We'll still allow common strings but warn
      console.warn("Unusual expiresIn format:", expiresIn);
    }

    const token = jwt.sign(
      { user_id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn },
    );

    res.json({ success: true, token, expiresIn });
  } catch (error) {
    console.error("Generate token error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getActivityLogs = async (req, res) => {
  try {
    const [logs] = await db.query(
      `SELECT al.*, u.name as user_name
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT 100`,
    );

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Get activity logs error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  getActiveEvents,
  getDashboardStats,
  getUsers,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getPendingAffiliates,
  approveAffiliate,
  rejectAffiliate,
  generateTokenForUser,
  getActivityLogs,
};
