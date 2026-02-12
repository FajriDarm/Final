const db = require("../config/database");

async function run() {
  try {
    const [rules] = await db.query(
      "SELECT id, event_id, commission_type, commission_value, min_stage, is_active FROM commission_rules LIMIT 50",
    );
    console.log("commission_rules sample:", rules);

    const ids = [27, 26, 25, 24];
    const [trx] = await db.query(
      "SELECT id, event_id, total_amount, affiliate_id FROM transactions WHERE id IN (?)",
      [ids],
    );
    console.log("transactions sample:", trx);

    for (const t of trx) {
      const [proj] = await db.query(
        `SELECT id, event_id, commission_type, commission_value, min_stage, is_active
         FROM commission_rules
         WHERE is_active = 1 AND min_stage <= ? AND (event_id = ? OR event_id IS NULL)
         ORDER BY (event_id IS NOT NULL) DESC, id DESC
         LIMIT 1`,
        [1, t.event_id],
      );
      console.log("trx", t.id, "rule:", proj[0] || null);
    }
  } catch (e) {
    console.error("error", e);
  } finally {
    process.exit(0);
  }
}

run();
