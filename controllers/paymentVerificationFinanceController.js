const db = require('../config/database');

// Render Payment Verification Page
exports.getPaymentVerification = async (req, res) => {
  try {
    // Ambil semua transaksi dengan status 'pending' untuk diverifikasi
    const [pendingPayments] = await db.query(`
      SELECT t.id, c.name AS customer_name, t.total_amount, t.payment_status, t.payment_method, t.created_at
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.payment_status = 'pending'
      ORDER BY t.created_at DESC
    `);
    res.render('finance/payment_verification', {
      pendingPayments
    });
  } catch (err) {
    res.status(500).send('Error loading payment verification');
  }
};

// (Optional) Tambahkan fungsi untuk memverifikasi pembayaran jika diperlukan aksi POST
