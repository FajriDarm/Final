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
