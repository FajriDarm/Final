const db = require('../config/database');

(async () => {
  try {
    const [rows] = await db.query("SELECT id, action, description, created_at FROM activity_logs WHERE action LIKE 'SEND_WA%' ORDER BY created_at DESC LIMIT 10");
    console.log('WA activity logs (recent):');
    rows.forEach(r => console.log(r));
    process.exit(0);
  } catch (err) {
    console.error('error', err && err.message);
    process.exit(1);
  }
})();