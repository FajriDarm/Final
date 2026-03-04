const db = require("../config/database");

function calculateProjectedAmount(totalAmount, rule) {
  if (!rule) return null;
  const base = Number(totalAmount) || 0;
  if (rule.commission_type === "flat") return Number(rule.commission_value) || 0;
  if (rule.commission_type === "percentage") {
    return Math.round((((Number(rule.commission_value) || 0) / 100) * base + Number.EPSILON) * 100) / 100;
  }
  return null;
}

function pickRule(ruleBuckets, eventId, stage) {
  const eventRules = ruleBuckets.byEvent.get(eventId) || [];
  const globalRules = ruleBuckets.global || [];
  return (
    eventRules.find((r) => Number(r.min_stage) <= stage) ||
    globalRules.find((r) => Number(r.min_stage) <= stage) ||
    null
  );
}

async function attachProjectedCommissions(rows, preferredStages) {
  if (!rows.length) return;

  const [rules] = await db.query(
    `SELECT id, event_id, commission_type, commission_value, min_stage
     FROM commission_rules
     WHERE is_active = 1
     ORDER BY (event_id IS NOT NULL) DESC, id DESC`,
  );

  const byEvent = new Map();
  const global = [];

  for (const rule of rules) {
    if (rule.event_id === null || typeof rule.event_id === "undefined") {
      global.push(rule);
      continue;
    }
    if (!byEvent.has(rule.event_id)) byEvent.set(rule.event_id, []);
    byEvent.get(rule.event_id).push(rule);
  }

  const buckets = { byEvent, global };

  for (const row of rows) {
    let projected = null;
    let projectedStage = null;

    for (const stage of preferredStages) {
      const selectedRule = pickRule(buckets, row.event_id, stage);
      const amount = calculateProjectedAmount(row.total_amount, selectedRule);
      if (amount !== null) {
        projected = amount;
        projectedStage = stage;
        break;
      }
    }

    row.projected_commission = projected;
    row.projected_stage = projectedStage;
  }
}

// Render Payment Verification Page
exports.getPaymentVerification = async (req, res) => {
  try {
    // Ambil transaksi yang memiliki lead_status = 'HOT' (dikirim dari sales)
    // atau transaksi yang sudah disetujui tahap 1 dan payment_status pending
    const [pendingPayments] = await db.query(`
      SELECT t.id, t.event_id, COALESCE(t.customer_name, c.name) AS customer_name, u.name AS affiliate_name, e.title AS event_name, t.total_amount, t.payment_status, t.payment_method, t.created_at, ls.status as lead_status, COALESCE(cs.total_commission, 0) AS commission_amount
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.affiliate_id = u.id
      LEFT JOIN events e ON t.event_id = e.id
      LEFT JOIN lead_statuses ls ON ls.transaction_id = t.id
      LEFT JOIN (
        SELECT transaction_id, SUM(amount) AS total_commission
        FROM commissions
        GROUP BY transaction_id
      ) cs ON cs.transaction_id = t.id
      WHERE ls.status IN ('HOT','DP')
      ORDER BY t.created_at DESC
    `);

    try {
      await attachProjectedCommissions(pendingPayments, [2, 3, 1]);
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

// API: return pending payments as JSON (used by polling in frontend)
exports.getPendingPaymentsJSON = async (req, res) => {
  try {
    const [pendingPayments] = await db.query(`
      SELECT t.id, t.event_id, COALESCE(t.customer_name, c.name) AS customer_name, u.name AS affiliate_name, e.title AS event_name, t.total_amount, t.payment_status, t.payment_method, t.created_at, ls.status as lead_status, COALESCE(cs.total_commission, 0) AS commission_amount
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.affiliate_id = u.id
      LEFT JOIN events e ON t.event_id = e.id
      LEFT JOIN lead_statuses ls ON ls.transaction_id = t.id
      LEFT JOIN (
        SELECT transaction_id, SUM(amount) AS total_commission
        FROM commissions
        GROUP BY transaction_id
      ) cs ON cs.transaction_id = t.id
      WHERE ls.status IN ('HOT','DP')
      ORDER BY t.created_at DESC
    `);

    try {
      await attachProjectedCommissions(pendingPayments, [2, 3, 1]);
    } catch (e) {
      // ignore
    }

    res.json({ pendingPayments });
  } catch (err) {
    console.error("getPendingPaymentsJSON error", err);
    res.status(500).json({ success: false, message: "Internal error" });
  }
};

// Set lead status from finance (only allow DP or LUNAS)
exports.setLeadStatus = async (req, res) => {
  try {
    const id = req.params.id || req.body.id;
    const lead_status = req.body.lead_status;
    if (!id || !lead_status) return res.status(400).send("Missing params");

    // Log actor for debugging
    console.log(
      "setLeadStatus called by user:",
      req.user && (req.user.id || req.user.name),
      "role:",
      req.user && req.user.role,
      "txn:",
      id,
      "status:",
      lead_status,
    );

    // Require finance role (redundant with route middleware but keeps defense-in-depth)
    if (!req.user || req.user.role !== "finance") {
      if (req.accepts && req.accepts("json"))
        return res.status(403).json({ success: false, message: "Forbidden" });
      return res.status(403).send("Forbidden");
    }

    if (!["DP", "LUNAS"].includes(lead_status)) {
      return res.status(400).send("Invalid lead status");
    }

    await db.query(
      `INSERT INTO lead_statuses (transaction_id, status, updated_at) VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW()`,
      [id, lead_status],
    );

    if (lead_status === "DP") {
      // DP is recorded in lead_statuses; do NOT set payment_status to an unsupported value like 'dp'
      // Keep transactions.payment_status as-is (or explicitly ensure it remains 'pending')
      try {
        await db.query(
          `UPDATE transactions SET payment_status = 'pending' WHERE id = ?`,
          [id],
        );
      } catch (e) {
        // Ignore warnings about truncation if any (defensive). We'll log as a warning but not fail the whole request.
        if (e && e.code === "WARN_DATA_TRUNCATED") {
          console.warn(
            "Ignored DB warning when setting payment_status for DP",
            e.sql,
          );
        } else {
          throw e;
        }
      }
    } else if (lead_status === "LUNAS") {
      // full payment: mark as paid and advance to stage_2_approved
      await db.query(
        `UPDATE transactions SET payment_status = 'paid', status = 'stage_2_approved' WHERE id = ?`,
        [id],
      );

      // award commission for stage 2 if service available
      try {
        const {
          awardCommissionForTransaction,
        } = require("./commissionService");
        await awardCommissionForTransaction(id, 2);
      } catch (e) {
        console.error("Error awarding commission (stage 2) after LUNAS", e);
      }
    }

    // Log finance lead verification activity
    try {
      const actorId = req.user?.id || null;
      await db.query(
        `INSERT INTO activity_logs (approved_by, action, target_type, target_id, new_status, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          actorId,
          "LEAD_STATUS_UPDATE_FINANCE",
          "transaction",
          id,
          lead_status,
          `Finance updated lead status to ${lead_status} for transaction #${id}`,
        ],
      );
      res.locals.auditLogged = true;
    } catch (e) {
      console.warn("Failed to log finance lead status update", e && (e.message || e));
    }

    // If AJAX / fetch expecting JSON, return JSON success; otherwise redirect
    if (req.accepts && req.accepts("json")) {
      return res.json({ success: true });
    }

    res.redirect("/finance/payment-verification");
  } catch (err) {
    // Treat MySQL warnings like WARN_DATA_TRUNCATED as non-fatal (data usually saved)
    if (err && err.code === "WARN_DATA_TRUNCATED") {
      console.warn("Non-fatal DB warning in setLeadStatus, ignoring:", err.sql);
      if (req.accepts && req.accepts("json"))
        return res.json({ success: true });
      return res.redirect("/finance/payment-verification");
    }

    console.error("setLeadStatus error", err);
    res.status(500).send("Error setting lead status");
  }
};

// Verify (approve) payment
exports.approvePayment = async (req, res) => {
  try {
    const id = req.params.id || req.body.id;
    if (!id) return res.status(400).send("Transaction id required");

    // Require finance role
    if (!req.user || req.user.role !== "finance") {
      return res.status(403).send("Forbidden");
    }

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

    // Require finance role
    if (!req.user || req.user.role !== "finance") {
      return res.status(403).send("Forbidden");
    }

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
