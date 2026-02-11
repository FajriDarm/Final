/*
  Simple test script for checkout flow.
  Usage:
    1) Start server: npm start
    2) Run: node scripts/test-checkout.js
  Configure DB env vars if you want the DB verification step to run.
*/

const axios = require('axios');
const mysql = require('mysql2/promise');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_EVENT_ID = process.env.TEST_EVENT_ID || '8'; // adjust if needed

(async function run() {
  try {
    console.log('1) Checking /checkout page for event', TEST_EVENT_ID);
    const r = await axios.get(`${BASE}/checkout`, { params: { event_id: TEST_EVENT_ID } });
    if (r.status === 200) console.log('  -> /checkout loaded OK');
    else console.warn('  -> /checkout returned status', r.status);

    console.log('2) Submitting transaction (POST /transactions)');
    const payload = {
      customer_name: 'Test User',
      customer_email: 'test+' + Date.now() + '@example.test',
      customer_phone: '081200000' + Math.floor(Math.random() * 900 + 100),
      payment_method: 'transfer',
      event_id: TEST_EVENT_ID,
      affiliate_ref: null
    };

    const res = await axios.post(`${BASE}/transactions`, payload, { headers: { 'Content-Type': 'application/json' } });
    if (res.data && res.data.success) {
      console.log('  -> Transaction created, id =', res.data.transactionId);

      // If DB configured, verify transaction exists
      if (process.env.DB_HOST) {
        console.log('3) Verifying transaction in DB...');
        const conn = await mysql.createConnection({
          host: process.env.DB_HOST,
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'affiliate_system',
        });
        const [rows] = await conn.execute('SELECT id, event_id, payment_method, payment_status, status FROM transactions WHERE id = ?', [res.data.transactionId]);
        if (rows.length > 0) console.log('  -> DB verification OK:', rows[0]);
        else console.warn('  -> DB: transaction not found');
        await conn.end();
      } else {
        console.log('  -> Skipping DB verification (DB_HOST not set)');
      }
    } else {
      console.error('  -> Create transaction failed', res.data || res.status);
    }
  } catch (err) {
    console.error('Test error:', err.response ? (err.response.data || err.response.status) : err.message);
    process.exitCode = 1;
  }
})();