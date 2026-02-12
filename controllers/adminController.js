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
      `SELECT al.*, 
              approver.name as approver_name,
              approver.email as approver_email,
              target.name as target_user_name,
              target.email as target_user_email
       FROM activity_logs al
       LEFT JOIN users approver ON al.approved_by = approver.id
       LEFT JOIN users target ON al.target_user_id = target.id
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
    const approverId = req.user?.id || 1; // Get approver ID from authenticated user

    await db.query(
      'UPDATE users SET affiliate_status = "approved" WHERE id = ?',
      [userId],
    );

    // Log activity with detailed info
    await db.query(
      `INSERT INTO activity_logs (approved_by, target_user_id, action, target_type, target_id, old_status, new_status, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        approverId,
        userId,
        "affiliate_approved",
        "affiliate",
        userId,
        "pending",
        "approved",
        "Affiliate approved by admin",
      ],
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
    const rejecterId = req.user?.id || 1; // Get rejector ID from authenticated user

    await db.query(
      'UPDATE users SET affiliate_status = "rejected" WHERE id = ?',
      [userId],
    );

    // Log activity with detailed info
    await db.query(
      `INSERT INTO activity_logs (approved_by, target_user_id, action, target_type, target_id, old_status, new_status, description) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rejecterId,
        userId,
        "affiliate_rejected",
        "affiliate",
        userId,
        "pending",
        "rejected",
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
      `SELECT al.*,
              approver.name as approver_name,
              approver.email as approver_email,
              target.name as target_user_name,
              target.email as target_user_email
       FROM activity_logs al
       LEFT JOIN users approver ON al.approved_by = approver.id
       LEFT JOIN users target ON al.target_user_id = target.id
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

// ============= WITHDRAWAL APPROVAL FUNCTIONS =============

// Get withdrawal approvals page
const getWithdrawalApprovalsPage = async (req, res) => {
  try {
    res.render("admin/withdrawal_approvals");
  } catch (error) {
    console.error("Get withdrawal approvals page error:", error);
    res
      .status(500)
      .render("error", { message: "Failed to load withdrawal approvals" });
  }
};

// Get pending withdrawals for approval (supports status filter: pending/approved/rejected/paid)
const getPendingWithdrawalsForApproval = async (req, res) => {
  try {
    const status = req.query.status || "pending";

    // Use an enriched query similar to financeController to include submitter/approver names
    let query = `
      SELECT
        p.id,
        p.affiliate_id,
        u.name as affiliate_name,
        u.email as affiliate_email,
        p.total_amount,
        p.status,
        u.bank_name AS bank_name,
        u.bank_account_number AS bank_account_number,
        u.bank_account_name AS bank_account_name,
        COUNT(DISTINCT pd.commission_id) as commission_count,
        p.created_at,
        p.paid_at,
        p.finance_note,
        p.admin_note,
        p.submitted_by,
        p.submitted_at,
        p.admin_approved_by,
        p.admin_approved_at,
        su.name AS submitted_by_name,
        au.name AS admin_approved_name
      FROM payouts p
      JOIN users u ON p.affiliate_id = u.id
      LEFT JOIN users su ON p.submitted_by = su.id
      LEFT JOIN users au ON p.admin_approved_by = au.id
      LEFT JOIN payout_details pd ON p.id = pd.payout_id
      WHERE 1=1
    `;

    const params = [];
    if (status && status !== "all") {
      // If requesting approved, include both 'approved' and 'paid' so already-paid items also appear
      if (status === "approved") {
        query += ` AND p.status IN (?, ?)`;
        params.push("approved", "paid");
      } else {
        query += ` AND p.status = ?`;
        params.push(status);
      }
    }

    query += ` GROUP BY p.id ORDER BY p.created_at DESC`;

    const [withdrawals] = await db.query(query, params);

    res.json({
      success: true,
      data: withdrawals,
    });
  } catch (error) {
    console.error("Get pending withdrawals error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load withdrawals",
      error: error.message,
    });
  }
};

// Get withdrawal detail for approval
const getWithdrawalDetailForApproval = async (req, res) => {
  try {
    const payoutId = req.params.id;

    // Get payout info dengan bank details dari users
    const [payouts] = await db.query(
      `SELECT p.*, 
              u.name as affiliate_name, 
              u.email as affiliate_email,
              u.bank_name,
              u.bank_account_number,
              u.bank_account_name,
              su.name as submitted_by_name,
              au.name as admin_approved_name
       FROM payouts p
       JOIN users u ON p.affiliate_id = u.id
       LEFT JOIN users su ON p.submitted_by = su.id
       LEFT JOIN users au ON p.admin_approved_by = au.id
       WHERE p.id = ?`,
      [payoutId],
    );

    if (payouts.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    const payout = payouts[0];

    // Get linked commissions (include event title as description fallback)
    const [commissions] = await db.query(
      `SELECT pd.commission_id as id,
              c.amount,
              c.commission_status,
              c.created_at,
              COALESCE(e.title, CONCAT('Transaction #', t.id)) as description
       FROM payout_details pd
       JOIN commissions c ON pd.commission_id = c.id
       LEFT JOIN transactions t ON c.transaction_id = t.id
       LEFT JOIN events e ON t.event_id = e.id
       WHERE pd.payout_id = ?`,
      [payoutId],
    );

    res.json({
      success: true,
      data: {
        ...payout,
        commission_count: commissions.length,
        commissions: commissions,
      },
    });
  } catch (error) {
    console.error("Get withdrawal detail error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load withdrawal detail",
      error: error.message,
    });
  }
};

// Approve withdrawal
const approveWithdrawal = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payoutId = req.params.id;
    const adminId = req.user.id;
    const note = req.body.note || "";

    // Start transaction
    await connection.beginTransaction();

    // Get payout
    const [payouts] = await connection.query(
      "SELECT * FROM payouts WHERE id = ?",
      [payoutId],
    );

    if (payouts.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    const payout = payouts[0];

    if (payout.status !== "pending") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Only pending withdrawals can be approved",
      });
    }

    // Update payout status to approved dengan admin note
    await connection.query(
      `UPDATE payouts SET status = 'approved', admin_approved_by = ?, admin_approved_at = NOW(), admin_note = ? 
       WHERE id = ?`,
      [adminId, note || null, payoutId],
    );

    // Update linked commissions status to 'pending' (waiting for payment)
    await connection.query(
      `UPDATE commissions SET commission_status = 'pending' 
       WHERE id IN (
         SELECT commission_id FROM payout_details WHERE payout_id = ?
       )`,
      [payoutId],
    );

    // Log activity (use new activity_logs schema)
    await connection.query(
      `INSERT INTO activity_logs (approved_by, action, target_type, target_id, new_status, description, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        adminId,
        "APPROVE_WITHDRAWAL",
        "payout",
        payoutId,
        "approved",
        `Approved withdrawal #${payoutId} for Rp ${payout.total_amount}. Note: ${note}`,
      ],
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Withdrawal approved successfully",
      data: { payout_id: payoutId, status: "approved" },
    });
  } catch (error) {
    await connection.rollback();
    console.error("Approve withdrawal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve withdrawal",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

// Reject withdrawal
const rejectWithdrawal = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const payoutId = req.params.id;
    const adminId = req.user.id;
    const reason = req.body.reason || "";

    // Start transaction
    await connection.beginTransaction();

    // Get payout
    const [payouts] = await connection.query(
      "SELECT * FROM payouts WHERE id = ?",
      [payoutId],
    );

    if (payouts.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    const payout = payouts[0];

    if (payout.status !== "pending") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Only pending withdrawals can be rejected",
      });
    }

    // Update payout status to rejected
    await connection.query(
      `UPDATE payouts SET status = 'rejected', admin_approved_by = ?, admin_approved_at = NOW()
       WHERE id = ?`,
      [adminId, payoutId],
    );

    // Revert linked commissions back to 'ready_for_withdraw'
    await connection.query(
      `UPDATE commissions SET commission_status = 'ready_for_withdraw' 
       WHERE id IN (
         SELECT commission_id FROM payout_details WHERE payout_id = ?
       )`,
      [payoutId],
    );

    // Log activity (use new activity_logs schema)
    await connection.query(
      `INSERT INTO activity_logs (approved_by, action, target_type, target_id, new_status, description, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        adminId,
        "REJECT_WITHDRAWAL",
        "payout",
        payoutId,
        "rejected",
        `Rejected withdrawal #${payoutId} for Rp ${payout.total_amount}. Reason: ${reason}`,
      ],
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Withdrawal rejected successfully",
      data: { payout_id: payoutId, status: "rejected" },
    });
  } catch (error) {
    await connection.rollback();
    console.error("Reject withdrawal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject withdrawal",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

// ============= PAGE RENDER METHODS (for UI) =============

// Get users page with data
const getUsersPage = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.*, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`,
    );

    res.render("admin/users", {
      users: users,
      title: "User Management",
    });
  } catch (error) {
    console.error("Get users page error:", error);
    res.status(500).render("error", { message: "Failed to load users" });
  }
};

// Get events page with data
const getEventsPage = async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT e.*, u.name as created_by_name
       FROM events e
       LEFT JOIN users u ON e.created_by = u.id
       ORDER BY e.created_at DESC`,
    );

    res.render("admin/events", {
      events: events,
      title: "Event Management",
    });
  } catch (error) {
    console.error("Get events page error:", error);
    res.status(500).render("error", { message: "Failed to load events" });
  }
};

// Get affiliates page with data
const getAffiliatesPage = async (req, res) => {
  try {
    const [affiliates] = await db.query(
      'SELECT id, name, email, affiliate_status, created_at FROM users WHERE affiliate_status = "pending"',
    );

    res.render("admin/affiliates", {
      affiliates: affiliates,
      title: "Affiliate Management",
    });
  } catch (error) {
    console.error("Get affiliates page error:", error);
    res.status(500).render("error", { message: "Failed to load affiliates" });
  }
};

// Get activity logs page with data
const getActivityLogsPage = async (req, res) => {
  try {
    const [logs] = await db.query(
      `SELECT al.*,
              approver.name as approver_name,
              approver.email as approver_email,
              target.name as target_user_name,
              target.email as target_user_email
       FROM activity_logs al
       LEFT JOIN users approver ON al.approved_by = approver.id
       LEFT JOIN users target ON al.target_user_id = target.id
       ORDER BY al.created_at DESC
       LIMIT 100`,
    );

    res.render("admin/activity-logs", {
      logs: logs,
      title: "Activity Logs",
    });
  } catch (error) {
    console.error("Get activity logs page error:", error);
    res
      .status(500)
      .render("error", { message: "Failed to load activity logs" });
  }
};

// Update User
const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, role_id, status } = req.body;

    // Build dynamic UPDATE query - only update fields that are provided
    let updateFields = [];
    let updateValues = [];

    if (name) {
      updateFields.push("name = ?");
      updateValues.push(name);
    }
    if (email) {
      updateFields.push("email = ?");
      updateValues.push(email);
    }
    if (role_id) {
      updateFields.push("role_id = ?");
      updateValues.push(role_id);
    }
    if (status) {
      updateFields.push("status = ?");
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    updateValues.push(userId);

    const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;

    await db.query(query, updateValues);

    res.json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
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
  getWithdrawalApprovalsPage,
  getPendingWithdrawalsForApproval,
  getWithdrawalDetailForApproval,
  approveWithdrawal,
  rejectWithdrawal,
  updateUser,
  // Page render methods
  getUsersPage,
  getEventsPage,
  getAffiliatesPage,
  getActivityLogsPage,
};
