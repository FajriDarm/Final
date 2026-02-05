const db = require("../config/database");

// Verifikasi Tahap 3 Page
exports.getVerifyStage3 = async (req, res) => {
  try {
    // Ambil transaksi yang sudah stage_2_approved (tahap 3 = sales verifikasi delivery)
    const [transactions] = await db.query(`
      SELECT t.id, t.total_amount, t.status, t.payment_method, t.payment_status, t.created_at,
             COALESCE(t.customer_name, c.name) AS customer_name, u.name AS affiliate_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.affiliate_id = u.id
      WHERE t.status = 'stage_2_approved'
      ORDER BY t.created_at DESC
    `);
    // Compute projected commission for each transaction (stage 3)
    try {
      const {
        getProjectedCommissionForTransaction,
      } = require("./commissionService");
      for (const t of transactions) {
        const proj = await getProjectedCommissionForTransaction(t.id, 3);
        t.projected_commission = proj && proj.amount ? proj.amount : null;
      }
    } catch (e) {
      console.error("Error computing projected commissions (stage 3)", e);
    }

    res.render("sales/verify_stage3", {
      title: "Verifikasi Tahap 3",
      transactions,
    });
  } catch (err) {
    res.status(500).send("Error loading verifikasi tahap 3");
  }
};

// Approve/Reject aksi
exports.postVerifyStage3 = async (req, res) => {
  const { id, action } = req.body;
  try {
    if (action === "approve") {
      // Fetch transaction to get affiliate_id
      const [trxRows] = await db.query(
        `SELECT id, affiliate_id FROM transactions WHERE id = ? LIMIT 1`,
        [id],
      );
      if (trxRows.length > 0) {
        const trx = trxRows[0];
        await db.query(
          `UPDATE transactions SET status = 'completed' WHERE id = ?`,
          [id],
        );

        // Award commission for stage 3 using commission rules
        try {
          const {
            awardCommissionForTransaction,
          } = require("./commissionService");
          await awardCommissionForTransaction(id, 3);

          // Update commission status to 'ready_for_withdraw' after stage 3 approval
          await db.query(
            `UPDATE commissions SET commission_status = 'ready_for_withdraw' 
             WHERE transaction_id = ? AND stage = 3`,
            [id],
          );
        } catch (e) {
          console.error("Error awarding commission (stage 3)", e);
        }
      } else {
        // If transaction not found, still attempt to mark as completed defensively
        await db.query(
          `UPDATE transactions SET status = 'completed' WHERE id = ?`,
          [id],
        );
      }
    } else if (action === "reject") {
      await db.query(
        `UPDATE transactions SET status = 'rejected' WHERE id = ?`,
        [id],
      );
    }
    res.redirect("/sales/verify-stage3");
  } catch (err) {
    res.status(500).send("Gagal memproses verifikasi");
  }
};
