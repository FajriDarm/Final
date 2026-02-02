const db = require("../config/database");

// Render Sales Dashboard mirip dashboard_admin
exports.getSalesDashboard = async (req, res) => {
  try {
    // Total transaksi
    const [[{ totalTransactions }]] = await db.query(
      `SELECT COUNT(*) AS totalTransactions FROM transactions`,
    );
    // Total transaksi selesai
    const [[{ completedTransactions }]] = await db.query(
      `SELECT COUNT(*) AS completedTransactions FROM transactions WHERE status = 'completed'`,
    );
    // Total affiliate aktif
    const [[{ totalAffiliates }]] = await db.query(
      `SELECT COUNT(*) AS totalAffiliates FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'affiliate') AND affiliate_status = 'approved'`,
    );
    // Total event aktif
    const [[{ activeEvents }]] = await db.query(
      `SELECT COUNT(*) AS activeEvents FROM events WHERE status = 'active'`,
    );
    // Total revenue
    const [[{ totalRevenue }]] = await db.query(
      `SELECT SUM(total_amount) AS totalRevenue FROM transactions WHERE status = 'completed'`,
    );

    // 10 transaksi terakhir
    const [recentTransactions] = await db.query(`
      SELECT t.id, COALESCE(t.customer_name, c.name) AS customer_name, u.name AS affiliate_name, t.total_amount, t.status
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.affiliate_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    res.render("sales/dashboard_sales", {
      stats: {
        totalTransactions: totalTransactions || 0,
        completedTransactions: completedTransactions || 0,
        totalAffiliates: totalAffiliates || 0,
        activeEvents: activeEvents || 0,
        totalRevenue: totalRevenue || 0,
      },
      recentTransactions,
    });
  } catch (err) {
    res.status(500).send("Error loading sales dashboard");
  }
};
