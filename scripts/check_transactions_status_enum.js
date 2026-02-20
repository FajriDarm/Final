const db = require('../config/database');

(async () => {
  try {
    const [rows] = await db.query(
      "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'status' LIMIT 1"
    );
    if (!rows || rows.length === 0) {
      console.log('transactions.status column not found');
      process.exit(0);
    }
    console.log('transactions.status enum type:', rows[0].COLUMN_TYPE);
  } catch (e) {
    console.error('Error querying information_schema:', e);
  } finally {
    process.exit(0);
  }
})();