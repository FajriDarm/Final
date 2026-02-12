const db = require("../config/database");
(async () => {
  try {
    const [r] = await db.query(
      `SELECT id,status,payment_status,created_at FROM transactions WHERE status IN ('stage_1_approved','stage_2_approved') OR payment_status IN ('pending','dp') ORDER BY created_at DESC LIMIT 50`,
    );
    console.log("relevant transactions:", r);
  } catch (e) {
    console.error("err", e);
  }
  process.exit(0);
})();
