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
    // Compute projected commission for each pending payment (stage 2)
    try {
      const {
        getProjectedCommissionForTransaction,
      } = require("./commissionService");
      for (const p of pendingPayments) {
        const proj = await getProjectedCommissionForTransaction(p.id, 2);
        p.projected_commission = proj && proj.amount ? proj.amount : null;
      }
    } catch (e) {
      console.error("Error computing projected commissions (stage 2)", e);
    }

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

    // Try awarding commission for stage 2
    try {
      const { awardCommissionForTransaction } = require("./commissionService");
      await awardCommissionForTransaction(id, 2);
    } catch (e) {
      console.error("Error awarding commission (stage 2)", e);
    }

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
