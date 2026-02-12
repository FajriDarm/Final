const db = require("../config/database");
const {
  getProjectedCommissionForTransaction,
} = require("../controllers/commissionService");

async function run() {
  try {
    const [transactions] = await db.query(`
      SELECT t.id, t.total_amount, t.status, t.payment_method, t.payment_status, t.created_at, t.event_id, e.title AS event_name,
             COALESCE(t.customer_name, c.name) AS customer_name, u.name AS affiliate_name,
             ls.status AS lead_status
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.affiliate_id = u.id
      LEFT JOIN events e ON t.event_id = e.id
      LEFT JOIN lead_statuses ls ON ls.transaction_id = t.id
      WHERE t.status IN ('pending', 'stage_2_approved')
      ORDER BY t.created_at DESC
    `);

    for (const t of transactions) {
      const stagesToTry = [3, 2, 1];
      let proj = null;
      for (const s of stagesToTry) {
        const p = await getProjectedCommissionForTransaction(t.id, s);
        if (p && typeof p.amount !== "undefined" && p.amount !== null) {
          proj = p;
          break;
        }
      }
      t.projected_commission = proj && proj.amount ? proj.amount : null;
      try {
        const [rowsC] = await db.query(
          `SELECT COALESCE(SUM(amount),0) as total FROM commissions WHERE transaction_id = ?`,
          [t.id],
        );
        t.commission_amount =
          rowsC && rowsC[0] ? Number(rowsC[0].total) || 0 : 0;
      } catch (e) {
        t.commission_amount = null;
      }
    }

    console.log("transactions sample:", transactions.slice(0, 10));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
