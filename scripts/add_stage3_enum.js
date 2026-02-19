const db = require('../config/database');

(async () => {
  try {
    console.log('Altering transactions.status to include stage_3_approved...');
    await db.query(`ALTER TABLE transactions MODIFY status ENUM('pending','stage_1_approved','stage_2_approved','stage_3_approved','completed','rejected') DEFAULT 'pending'`);
    console.log('Alter completed. Current enum:');
    const [rows] = await db.query("SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'status' LIMIT 1");
    console.log(rows[0].COLUMN_TYPE);
  } catch (e) {
    console.error('ALTER failed:', e);
  } finally {
    process.exit(0);
  }
})();