const db = require("../config/database");

// Transaction Review Page
exports.getTransactionReview = async (req, res) => {
  try {
    // Ambil semua transaksi beserta customer & affiliate
    const [transactions] = await db.query(`
            SELECT t.id, t.total_amount, t.status, t.payment_method, t.payment_status, t.created_at,
              COALESCE(t.customer_name, c.name) AS customer_name, u.name AS affiliate_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.affiliate_id = u.id
      ORDER BY t.created_at DESC
    `);
    res.render("sales/transaction_review", {
      title: "Transaction Review",
      transactions,
      user: null,
    });
  } catch (err) {
    res.status(500).send("Error loading transaction review");
  }
};
