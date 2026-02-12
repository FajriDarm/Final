const db = require("../config/database");

// Verifikasi Tahap 1 Page
exports.getVerifyStage1 = async (req, res) => {
  try {
    // Ambil transaksi yang statusnya pending (tahap 1 = sales review intent)
    const [transactions] = await db.query(`
      SELECT t.id, t.total_amount, t.status, t.payment_method, t.payment_status, t.created_at,
             COALESCE(t.customer_name, c.name) AS customer_name, u.name AS affiliate_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.affiliate_id = u.id
      WHERE t.status = 'pending'
      ORDER BY t.created_at DESC
    `);
    // Compute projected commission for each transaction (stage 1)
    try {
      const {
        getProjectedCommissionForTransaction,
      } = require("./commissionService");
      for (const t of transactions) {
        const proj = await getProjectedCommissionForTransaction(t.id, 1);
        t.projected_commission = proj && proj.amount ? proj.amount : null;
      }
    } catch (e) {
      console.error("Error computing projected commissions (stage 1)", e);
    }

    // redirect to combined page (view moved)
    return res.redirect("/sales/verify-leads");
  } catch (err) {
    res.status(500).send("Error loading verifikasi tahap 1");
  }
};

// Approve/Reject aksi
exports.postVerifyStage1 = async (req, res) => {
  const { id, action } = req.body;
  try {
    if (action === "approve") {
      await db.query(
        `UPDATE transactions SET status = 'stage_1_approved' WHERE id = ?`,
        [id],
      );

      // Try awarding commission for stage 1
      try {
        const {
          awardCommissionForTransaction,
        } = require("./commissionService");
        await awardCommissionForTransaction(id, 1);
      } catch (e) {
        console.error("Error awarding commission (stage 1)", e);
      }
    } else if (action === "reject") {
      await db.query(
        `UPDATE transactions SET status = 'rejected' WHERE id = ?`,
        [id],
      );
    }
    res.redirect("/sales/verify-leads");
  } catch (err) {
    res.status(500).send("Gagal memproses verifikasi");
  }
};
