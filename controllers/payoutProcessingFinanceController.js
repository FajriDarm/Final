const db = require("../config/database");

// Render Payout Processing Page
exports.getPayoutProcessing = async (req, res) => {
  try {
    // Ambil semua payout request yang statusnya 'pending' atau 'approved' (belum paid)
    const [payouts] = await db.query(`
      SELECT p.id, u.name AS affiliate_name, p.total_amount, p.status, p.paid_at, p.admin_approved_by, admin.name AS admin_approved_name
      FROM payouts p
      LEFT JOIN users u ON p.affiliate_id = u.id
      LEFT JOIN users admin ON p.admin_approved_by = admin.id
      WHERE p.status IN ('pending', 'approved')
      ORDER BY p.id DESC
    `);
    res.render("finance/payout_processing", {
      payouts,
    });
  } catch (err) {
    res.status(500).send("Error loading payout processing");
  }
};

// (Optional) Tambahkan fungsi untuk memproses payout jika diperlukan aksi POST
