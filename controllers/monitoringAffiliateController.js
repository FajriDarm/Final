const db = require('../config/database');

// Monitoring Affiliate Page
exports.getMonitoringAffiliate = async (req, res) => {
  try {
    // Ambil data affiliate dan performa mereka
    const [affiliates] = await db.query(`
      SELECT u.id, u.name, u.email,
        COUNT(t.id) AS total_transaksi,
        SUM(t.total_amount) AS total_penjualan,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS transaksi_selesai
      FROM users u
      LEFT JOIN transactions t ON u.id = t.affiliate_id
      WHERE u.role_id = (SELECT id FROM roles WHERE name = 'affiliate')
        AND u.affiliate_status = 'approved'
      GROUP BY u.id, u.name, u.email
      ORDER BY total_penjualan DESC
    `);
    res.render('sales/monitoring_affiliate', { title: 'Monitoring Affiliate', affiliates });
  } catch (err) {
    res.status(500).send('Error loading monitoring affiliate');
  }
};
