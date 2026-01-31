const db = require('../config/database');

// Verifikasi Tahap 3 Page
exports.getVerifyStage3 = async (req, res) => {
  try {
    // Ambil transaksi yang sudah stage_2_approved (tahap 3 = sales verifikasi delivery)
    const [transactions] = await db.query(`
      SELECT t.id, t.total_amount, t.status, t.payment_method, t.payment_status, t.created_at,
             c.name AS customer_name, u.name AS affiliate_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.affiliate_id = u.id
      WHERE t.status = 'stage_2_approved'
      ORDER BY t.created_at DESC
    `);
    res.render('sales/verify_stage3', { title: 'Verifikasi Tahap 3', transactions });
  } catch (err) {
    res.status(500).send('Error loading verifikasi tahap 3');
  }
};

// Approve/Reject aksi
exports.postVerifyStage3 = async (req, res) => {
  const { id, action } = req.body;
  try {
    if (action === 'approve') {
      await db.query(`UPDATE transactions SET status = 'completed' WHERE id = ?`, [id]);
    } else if (action === 'reject') {
      await db.query(`UPDATE transactions SET status = 'rejected' WHERE id = ?`, [id]);
    }
    res.redirect('/sales/verify-stage3');
  } catch (err) {
    res.status(500).send('Gagal memproses verifikasi');
  }
};
