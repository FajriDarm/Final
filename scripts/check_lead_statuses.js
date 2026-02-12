const db = require("../config/database");

async function run() {
  try {
    const [rows] = await db.query(
      "SELECT * FROM lead_statuses WHERE transaction_id IN (24,25,26,27)",
    );
    console.log("lead_statuses rows:", rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
