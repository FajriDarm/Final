const db = require("../config/database");

// Render Sales Dashboard mirip dashboard_admin
exports.getSalesDashboard = async (req, res) => {
  try {
    const [
      [[{ totalTransactions }]],
      [[{ completedTransactions }]],
      [[{ totalAffiliates }]],
      [[{ activeEvents }]],
      [[{ totalRevenue }]],
      [recentTransactions],
    ] = await Promise.all([
      db.query(`SELECT COUNT(*) AS totalTransactions FROM transactions`),
      db.query(
        `SELECT COUNT(*) AS completedTransactions FROM transactions WHERE status = 'completed'`,
      ),
      db.query(
        `SELECT COUNT(*) AS totalAffiliates FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'affiliate') AND affiliate_status = 'approved'`,
      ),
      db.query(`SELECT COUNT(*) AS activeEvents FROM events WHERE status = 'active'`),
      db.query(
        `SELECT SUM(total_amount) AS totalRevenue FROM transactions WHERE status = 'completed'`,
      ),
      db.query(`
      SELECT t.id, COALESCE(t.customer_name, c.name) AS customer_name, u.name AS affiliate_name, t.total_amount, t.status,
             ls.status AS lead_status
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.affiliate_id = u.id
      LEFT JOIN lead_statuses ls ON ls.transaction_id = t.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `),
    ]);

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
