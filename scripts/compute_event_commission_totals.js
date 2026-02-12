const db = require("../config/database");
const {
  getProjectedCommissionForTransaction,
} = require("../controllers/commissionService");

async function run() {
  try {
    const [transactions] = await db.query(`
      SELECT t.id, t.total_amount, t.status, t.payment_method, t.payment_status, t.created_at, t.event_id,
             COALESCE(t.customer_name, c.name) AS customer_name, u.name AS affiliate_name,
             ls.status AS lead_status
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.affiliate_id = u.id
      LEFT JOIN lead_statuses ls ON ls.transaction_id = t.id
      WHERE t.status IN ('pending', 'stage_2_approved')
      ORDER BY t.created_at DESC
    `);

    const eventTotals = {};
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
      const amount = proj && proj.amount ? proj.amount : 0;
      const key = t.event_id || "no_event_" + t.id;
      eventTotals[key] = (eventTotals[key] || 0) + amount;
    }

    console.log("event commission totals:", eventTotals);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
