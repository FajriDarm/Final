const db = require("../config/database");
const {
  getProjectedCommissionForTransaction,
} = require("../controllers/commissionService");
(async () => {
  try {
    const [rows] = await db.query(
      `SELECT t.id, COALESCE(t.customer_name,c.name) AS customer_name, u.name AS affiliate_name, e.title AS event_name, t.total_amount, t.payment_status, t.payment_method, t.created_at, ls.status as lead_status FROM transactions t LEFT JOIN customers c ON t.customer_id = c.id LEFT JOIN users u ON t.affiliate_id = u.id LEFT JOIN events e ON t.event_id = e.id LEFT JOIN lead_statuses ls ON ls.transaction_id = t.id WHERE (ls.status = 'HOT') OR (t.payment_status IN ('pending','dp')) ORDER BY t.created_at DESC LIMIT 10`,
    );
    for (const p of rows) {
      const [rowsC] = await db.query(
        `SELECT COALESCE(SUM(amount),0) as total FROM commissions WHERE transaction_id = ?`,
        [p.id],
      );
      p.commission_amount = rowsC && rowsC[0] ? Number(rowsC[0].total) || 0 : 0;
      let proj = await getProjectedCommissionForTransaction(p.id, 2);
      if (!proj || proj.amount === null) {
        const tryStages = [3, 1];
        for (const s of tryStages) {
          const p2 = await getProjectedCommissionForTransaction(p.id, s);
          if (p2 && typeof p2.amount !== "undefined" && p2.amount !== null) {
            proj = p2;
            proj.stage = s;
            break;
          }
        }
      } else {
        proj.stage = 2;
      }
      p.projected_commission = proj && proj.amount ? proj.amount : null;
      p.projected_stage =
        proj && proj.stage ? proj.stage : proj && proj.amount ? 2 : null;
    }
    console.log("pendingPayments with proj:", rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
