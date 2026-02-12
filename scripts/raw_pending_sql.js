const db = require("../config/database");
(async () => {
  try {
    const [rows] = await db.query(
      `SELECT t.id, COALESCE(t.customer_name,c.name) AS customer_name, u.name AS affiliate_name, e.title AS event_name, t.total_amount, t.payment_status, t.payment_method, t.created_at, ls.status as lead_status FROM transactions t LEFT JOIN customers c ON t.customer_id = c.id LEFT JOIN users u ON t.affiliate_id = u.id LEFT JOIN events e ON t.event_id = e.id LEFT JOIN lead_statuses ls ON ls.transaction_id = t.id WHERE (ls.status = 'HOT') OR (t.payment_status IN ('pending','dp')) ORDER BY t.created_at DESC LIMIT 20`,
    );
    console.log("rows:", rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
