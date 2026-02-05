const db = require("../config/database");

// Render Finance Dashboard
exports.getFinanceDashboard = async (req, res) => {
  try {
    // Total pembayaran masuk (paid)
    const [[{ totalPaid }]] = await db.query(
      `SELECT SUM(total_amount) AS totalPaid FROM transactions WHERE payment_status = 'paid'`,
    );
    // Total pembayaran pending
    const [[{ totalPending }]] = await db.query(
      `SELECT SUM(total_amount) AS totalPending FROM transactions WHERE payment_status = 'pending'`,
    );
    // Jumlah transaksi paid
    const [[{ countPaid }]] = await db.query(
      `SELECT COUNT(*) AS countPaid FROM transactions WHERE payment_status = 'paid'`,
    );
    // Jumlah transaksi pending
    const [[{ countPending }]] = await db.query(
      `SELECT COUNT(*) AS countPending FROM transactions WHERE payment_status = 'pending'`,
    );
    // 10 pembayaran terakhir
    const [recentPayments] = await db.query(`
      SELECT t.id, COALESCE(t.customer_name, c.name) AS customer_name, t.total_amount, t.payment_status, t.payment_method, t.created_at
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);
    res.render("finance/dashboard_finance", {
      stats: {
        totalPaid: totalPaid || 0,
        totalPending: totalPending || 0,
        countPaid: countPaid || 0,
        countPending: countPending || 0,
      },
      recentPayments,
    });
  } catch (err) {
    res.status(500).send("Error loading finance dashboard");
  }
};

// ============================================
// WITHDRAWAL REQUEST ENDPOINTS
// ============================================

/**
 * GET /api/finance/withdrawals
 * List all withdrawal requests (with optional status filter)
 */
exports.getPendingWithdrawalsAPI = async (req, res) => {
  try {
    const { status } = req.query;
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
        p.paid_at
      FROM payouts p
      JOIN users u ON p.affiliate_id = u.id
      LEFT JOIN payout_details pd ON p.id = pd.payout_id
      WHERE 1=1
    `;

    const params = [];

    if (status && status !== "all") {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    query += ` GROUP BY p.id ORDER BY p.created_at DESC`;

    const [withdrawals] = await db.query(query, params);

    res.json({
      success: true,
      data: withdrawals,
      count: withdrawals.length,
    });
  } catch (error) {
    console.error("Get withdrawals error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// New: return counts per status for realtime badges
exports.getWithdrawalCountsAPI = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT status, COUNT(*) AS cnt
      FROM payouts
      GROUP BY status
    `);

    // Map results to an object with defaults
    const counts = {
      pending: 0,
      approved: 0,
      paid: 0,
      rejected: 0,
    };

    rows.forEach((r) => {
      const s = r.status || "pending";
      counts[s] = r.cnt;
    });

    res.json({ success: true, data: counts });
  } catch (error) {
    console.error("Get withdrawal counts error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
  }
};

/**
 * POST /api/finance/withdrawals/:id/submit-to-admin
 * Finance submit withdrawal request to Admin for approval
 * Body: { note?: "some note" }
 */
exports.submitWithdrawalToAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const financeUserId = req.user?.id || req.query.user_id;

    if (!financeUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user id required",
      });
    }

    // Get payout
    const [payouts] = await db.query("SELECT * FROM payouts WHERE id = ?", [
      id,
    ]);

    if (payouts.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    const payout = payouts[0];

    if (payout.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending withdrawals can be submitted to admin",
      });
    }

    // Update payout: mark as submitted to admin with note
    await db.query(
      `UPDATE payouts SET submitted_by = ?, submitted_at = NOW(), finance_note = ? 
       WHERE id = ?`,
      [financeUserId, note || null, id],
    );

    // Log activity
    await db.query(
      `INSERT INTO activity_logs (approved_by, action, target_type, target_id, new_status, description, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        financeUserId,
        "SUBMIT_WITHDRAWAL_TO_ADMIN",
        "payout",
        id,
        "pending",
        `Submitted withdrawal #${id} (Rp ${payout.total_amount}) to Admin. Note: ${note || "None"}`,
      ],
    );

    res.json({
      success: true,
      message: "Withdrawal submitted to Admin for approval",
      data: { payout_id: id, status: "pending" },
    });
  } catch (error) {
    console.error("Submit withdrawal to admin error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * POST /api/finance/withdrawals/:id/approve
 * Finance approve withdrawal request
 * Body: { note?: "some note" }
 */
exports.approveWithdrawalAPI = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user?.id || req.query.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user id required",
      });
    }

    const { approveWithdrawal } = require("./withdrawalService");

    const result = await approveWithdrawal(id, userId, note || "");

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: "Withdrawal approved",
    });
  } catch (error) {
    console.error("Approve withdrawal error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * POST /api/finance/withdrawals/:id/reject
 * Finance reject withdrawal request
 * Body: { reason?: "some reason" }
 */
exports.rejectWithdrawalAPI = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id || req.query.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user id required",
      });
    }

    const { rejectWithdrawal } = require("./withdrawalService");

    const result = await rejectWithdrawal(id, userId, reason || "");

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: "Withdrawal rejected",
    });
  } catch (error) {
    console.error("Reject withdrawal error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * POST /api/finance/withdrawals/:id/mark-paid
 * Finance mark withdrawal as paid with proof file upload
 * Body: FormData { proof_file: File }
 */
exports.markWithdrawalAsPaidAPI = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.query.user_id;
    const proofFile = req.file;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user id required",
      });
    }

    if (!proofFile) {
      return res.status(400).json({
        success: false,
        message: "Proof file is required",
      });
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Get payout
      const [payouts] = await connection.query(
        "SELECT * FROM payouts WHERE id = ? AND status = 'approved'",
        [id],
      );

      if (payouts.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: "Withdrawal not found or not in approved status",
        });
      }

      const payout = payouts[0];

      // Save proof to payment_proofs table (status pending - waiting for admin approval)
      const proofPath = `/uploads/payment_proofs/${proofFile.filename}`;
      await connection.query(
        `INSERT INTO payment_proofs (payout_id, proof_file, proof_type, uploaded_at)
         VALUES (?, ?, ?, NOW())`,
        [id, proofPath, "payout_transfer"],
      );

      // Update payout status to paid (pending admin approval)
      await connection.query(
        `UPDATE payouts SET status = 'paid', paid_at = NOW() WHERE id = ?`,
        [id],
      );

      // Update linked commissions to paid
      await connection.query(
        `UPDATE commissions SET commission_status = 'paid'
         WHERE id IN (
           SELECT commission_id FROM payout_details WHERE payout_id = ?
         )`,
        [id],
      );

      // Log activity
      await connection.query(
        `INSERT INTO activity_logs (approved_by, action, target_type, target_id, new_status, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId,
          "MARK_WITHDRAWAL_PAID",
          "payout",
          id,
          "paid",
          `Marked withdrawal #${id} (Rp ${payout.total_amount}) as paid with proof: ${proofFile.originalname}`,
        ],
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Withdrawal marked as paid successfully with proof",
        data: {
          payout_id: id,
          proof_file: proofPath,
        },
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Mark withdrawal as paid error:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sql: error.sql,
    });
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
      details:
        process.env.NODE_ENV === "development" ? error.toString() : undefined,
    });
  }
};

/**
 * GET /api/finance/withdrawals/:id
 * Get withdrawal request detail with related commissions
 */
exports.getWithdrawalDetailAPI = async (req, res) => {
  try {
    const { id } = req.params;

    // Get payout detail
    const [payouts] = await db.query(
      `
      SELECT 
        p.*,
        u.name as affiliate_name,
        u.email as affiliate_email,
        u.bank_name,
        u.bank_account_number,
        u.bank_account_name
      FROM payouts p
      JOIN users u ON p.affiliate_id = u.id
      WHERE p.id = ?
    `,
      [id],
    );

    if (!payouts.length) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    const payout = payouts[0];

    // Get related commissions (join via transactions)
    const [commissions] = await db.query(
      `
      SELECT 
        c.id,
        t.event_id,
        e.title as event_title,
        c.amount,
        c.commission_status,
        c.created_at
      FROM commissions c
      JOIN payout_details pd ON c.id = pd.commission_id
      LEFT JOIN transactions t ON c.transaction_id = t.id
      LEFT JOIN events e ON t.event_id = e.id
      WHERE pd.payout_id = ?
      ORDER BY c.created_at DESC
    `,
      [id],
    );

    payout.commissions = commissions;

    res.json({
      success: true,
      data: payout,
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

/**
 * Page: Withdrawal Management
 * Display withdrawal management page for finance team
 */
exports.getWithdrawalManagementPage = async (req, res) => {
  try {
    const user = req.user || { name: "Finance Officer" };

    // Fetch simple finance stats similar to dashboard
    const [[{ totalPaid }]] = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS totalPaid FROM transactions WHERE payment_status = 'paid'`,
    );
    const [[{ totalPending }]] = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS totalPending FROM transactions WHERE payment_status = 'pending'`,
    );
    const [[{ countPaid }]] = await db.query(
      `SELECT COUNT(*) AS countPaid FROM transactions WHERE payment_status = 'paid'`,
    );
    const [[{ countPending }]] = await db.query(
      `SELECT COUNT(*) AS countPending FROM transactions WHERE payment_status = 'pending'`,
    );

    const stats = {
      totalPaid: totalPaid || 0,
      totalPending: totalPending || 0,
      countPaid: countPaid || 0,
      countPending: countPending || 0,
    };

    res.render("finance/withdrawal_management", {
      name: user.name,
      role: user.role || "finance",
      stats,
    });
  } catch (error) {
    console.error("Withdrawal management page error:", error);
    res.status(500).send("Error loading withdrawal management page");
  }
};
