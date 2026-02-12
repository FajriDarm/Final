const db = require("../config/database");
(async () => {
  try {
    const [rows] = await db.query(
      `SELECT t.id, t.total_amount, t.status, t.payment_method, t.payment_status, t.created_at, t.event_id, e.name AS event_name, COALESCE(t.customer_name, c.name) AS customer_name, u.name AS affiliate_name, ls.status AS lead_status FROM transactions t LEFT JOIN customers c ON t.customer_id = c.id LEFT JOIN users u ON t.affiliate_id = u.id LEFT JOIN events e ON t.event_id = e.id LEFT JOIN lead_statuses ls ON ls.transaction_id = t.id WHERE t.status IN ('pending','stage_2_approved') ORDER BY t.created_at DESC LIMIT 5`,
    );
    console.log("rows:", rows);
  } catch (e) {
    console.error("select error", e);
  }
  process.exit(0);
})();
