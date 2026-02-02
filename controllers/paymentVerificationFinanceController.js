const db = require("../config/database");

// Render Payment Verification Page
exports.getPaymentVerification = async (req, res) => {
  try {
    // Ambil transaksi yang sudah disetujui di tahap 1 (stage_1_approved)
    // dan masih memiliki payment_status 'pending' untuk diverifikasi oleh Finance.
    const [pendingPayments] = await db.query(`
      SELECT t.id, COALESCE(t.customer_name, c.name) AS customer_name, t.total_amount, t.payment_status, t.payment_method, t.created_at
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.payment_status = 'pending' AND t.status = 'stage_1_approved'
      ORDER BY t.created_at DESC
    `);
    res.render("finance/payment_verification", {
      pendingPayments,
    });
  } catch (err) {
    res.status(500).send("Error loading payment verification");
  }
};

// Verify (approve) payment
exports.approvePayment = async (req, res) => {
  try {
    const id = req.params.id || req.body.id;
    if (!id) return res.status(400).send("Transaction id required");

    // Set payment_status to 'paid' and advance status to stage_2_approved
    await db.query(
      "UPDATE transactions SET payment_status = 'paid', status = 'stage_2_approved' WHERE id = ?",
      [id],
    );

    res.redirect("/finance/payment-verification");
  } catch (err) {
    console.error("approvePayment error", err);
    res.status(500).send("Error approving payment");
  }
};

// Reject payment
exports.rejectPayment = async (req, res) => {
  try {
    const id = req.params.id || req.body.id;
    if (!id) return res.status(400).send("Transaction id required");

    await db.query(
      "UPDATE transactions SET payment_status = 'rejected', status = 'rejected' WHERE id = ?",
      [id],
    );

    res.redirect("/finance/payment-verification");
  } catch (err) {
    console.error("rejectPayment error", err);
    res.status(500).send("Error rejecting payment");
  }
};
