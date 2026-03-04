const db = require("../config/database");
const leadEvents = require("../services/leadEvents");

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

// Combined view for sales to manage leads (stage1 + stage3)
exports.getVerifyLeads = async (req, res) => {
  try {
    const [transactions] = await db.query(`
      SELECT t.id, t.total_amount, t.status, t.payment_method, t.payment_status, t.created_at, t.event_id, e.title AS event_name,
             COALESCE(t.customer_name, c.name) AS customer_name, u.name AS affiliate_name,
             ls.status AS lead_status, ls.updated_at AS lead_updated_at,
             COALESCE(cs.total_commission, 0) AS commission_amount
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
      WHERE t.status IN ('pending', 'stage_2_approved')
      AND (ls.status IS NULL OR ls.status NOT IN ('SEDANG BERANGKAT','REJECTED'))
      ORDER BY t.created_at DESC
    `);

    // Default missing lead statuses to 'LEAD BARU'
    try {
      const missing = (transactions || [])
        .filter((t) => !t.lead_status)
        .map((t) => t.id);
      if (missing.length > 0) {
        const placeholders = missing.map(() => "(?, ?, NOW())").join(",");
        const params = [];
        missing.forEach((id) => {
          params.push(id, "LEAD BARU");
        });
        await db.query(
          `INSERT INTO lead_statuses (transaction_id, status, updated_at) VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE status = status, updated_at = updated_at`,
          params,
        );
        transactions.forEach((t) => {
          if (!t.lead_status) {
            t.lead_status = "LEAD BARU";
            t.lead_updated_at = new Date();
          }
        });
      }
    } catch (e) {
      console.error("verifyLeads: set default lead status error", e);
    }

    // Compute projected commission for each transaction without per-row DB round-trips.
    try {
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

      for (const t of transactions) {
        const stagesToTry = [3, 2, 1];
        let projectedAmount = null;
        for (const s of stagesToTry) {
          const selectedRule = pickRule(buckets, t.event_id, s);
          const amount = calculateProjectedAmount(t.total_amount, selectedRule);
          if (amount !== null) {
            projectedAmount = amount;
            break;
          }
        }
        t.projected_commission = projectedAmount;
      }
    } catch (e) {
      // ignore missing commission service
    }

    // Query history: leads set to SEDANG BERANGKAT or REJECTED within last 7 days
    let recentDepartures = [];
    try {
      const [rows] = await db.query(`
        SELECT ls.transaction_id as id, ls.updated_at, ls.status, t.total_amount, COALESCE(t.customer_name, c.name) AS customer_name, u.name AS affiliate_name, e.title AS event_name
        FROM lead_statuses ls
        LEFT JOIN transactions t ON t.id = ls.transaction_id
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN users u ON t.affiliate_id = u.id
        LEFT JOIN events e ON t.event_id = e.id
        WHERE ls.status IN ('SEDANG BERANGKAT','REJECTED') AND ls.updated_at >= (NOW() - INTERVAL 7 DAY)
        ORDER BY ls.updated_at DESC
      `);
      recentDepartures = rows || [];
    } catch (e) {
      console.error("Error fetching recent history", e);
    }

    res.render("sales/verify_leads", {
      title: "Verifikasi Leads",
      transactions,
      recentDepartures,
    });
  } catch (err) {
    console.error("getVerifyLeads error:", err);
    res.status(500).send("Error loading verifikasi leads");
  }
};

// SSE stream endpoint for real-time lead events
exports.leadEventsStream = (req, res) => {
  // Headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  // send a ping
  res.write(": connected\n\n");

  // Add to client set
  leadEvents.addClient(res);

  req.on("close", () => {
    leadEvents.removeClient(res);
  });
};

// API to set/update lead status for a transaction
exports.postUpdateLeadStatus = async (req, res) => {
  const { id, lead_status } = req.body;
  if (!id || !lead_status)
    return res.status(400).json({ success: false, message: "Missing params" });
  try {
    // diagnostic array for any payouts created during this update
    let createdPayouts = [];

    // Feature-flag: control whether system auto-creates & auto-marks payouts when lead -> SEDANG BERANGKAT
    // Default: false (safe) — enable with AUTO_PAYOUT_ON_STAGE3=true in environment if you explicitly want auto-pay behavior.
    const autoPayoutEnabled = (process.env.AUTO_PAYOUT_ON_STAGE3 || "false").toString().toLowerCase() === "true";

    // upsert
    await db.query(
      `INSERT INTO lead_statuses (transaction_id, status, updated_at) VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW()`,
      [id, lead_status],
    );

    // Log sales lead verification activity
    try {
      const actorId = req.user?.id || req.body.user_id || req.query.user_id || null;
      await db.query(
        `INSERT INTO activity_logs (approved_by, action, target_type, target_id, new_status, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          actorId,
          "LEAD_STATUS_UPDATE_SALES",
          "transaction",
          id,
          lead_status,
          `Sales updated lead status to ${lead_status} for transaction #${id}`,
        ],
      );
      res.locals.auditLogged = true;
    } catch (e) {
      console.warn("Failed to log sales lead status update", e && (e.message || e));
    }

    // If lead moved to SEDANG BERANGKAT, attempt to award commission for stage 3
    if ((lead_status || "").toString().toUpperCase() === "SEDANG BERANGKAT") {
      // Ensure transaction is marked as paid so finance dashboard counts it
      try {
        await db.query(
          `UPDATE transactions SET payment_status = 'paid' WHERE id = ?`,
          [id],
        );
      } catch (e) {
        console.error(
          "Failed to set transaction payment_status to paid for id",
          id,
          e,
        );
      }

      try {
        const {
          awardCommissionForTransaction,
        } = require("./commissionService");
        // award stage 3 commission (function should be idempotent)
        await awardCommissionForTransaction(id, 3);

        // Mark any stage-3 commission for this transaction as ready for withdrawal
        // (same behavior as when Sales performs an explicit Stage-3 approval)
        try {
          await db.query(
            `UPDATE commissions SET commission_status = 'ready_for_withdraw' 
             WHERE transaction_id = ? AND stage = 3`,
            [id],
          );
          console.debug(
            "Marked commission(s) ready_for_withdraw for transaction",
            id,
          );
        } catch (e) {
          console.error(
            "Failed to set commission_status to ready_for_withdraw for transaction",
            id,
            e,
          );
        }

        // optionally advance transaction status to stage_3_approved
        await db.query(
          `UPDATE transactions SET status = 'stage_3_approved' WHERE id = ?`,
          [id],
        );
      } catch (e) {
        console.error("Error awarding commission for SEDANG BERANGKAT", e);
      }
    }

    // --- AUTOMATICALLY CREATE & MARK PAYOUT(S) AS PAID for stage-3 commissions
    // This will: find stage-3 commissions for this transaction, group by affiliate,
    // create payouts and mark them 'paid', update commissions to 'paid', and
    // set transaction.payment_status = 'paid' so finance dashboard reflects incoming payments.
    // Auto-create & mark payouts only when the feature-flag is enabled. Otherwise leave commissions `ready_for_withdraw` so Finance processes payouts manually.
    if (autoPayoutEnabled && (lead_status || "").toString().toUpperCase() === "SEDANG BERANGKAT") {
      try {
        const conn = await db.getConnection();
        try {
          await conn.beginTransaction();

          // find stage-3 commissions for this transaction
          const [commRows] = await conn.query(
            `SELECT id, affiliate_id, amount FROM commissions WHERE transaction_id = ? AND stage = 3 AND commission_status IN ('ready_for_withdraw','pending','pending_payment')`,
            [id],
          );

          if (commRows && commRows.length > 0) {
            // group by affiliate
            const groups = {};
            commRows.forEach((c) => {
              const a = c.affiliate_id || 0;
              groups[a] = groups[a] || [];
              groups[a].push(c);
            });

            for (const affIdStr of Object.keys(groups)) {
              const affId = parseInt(affIdStr, 10);
              const items = groups[affIdStr];
              const total = items.reduce(
                (s, it) => s + parseFloat(it.amount || 0),
                0,
              );

              if (total <= 0) continue;

              // create payout marked as paid
              const [pRes] = await conn.query(
                `INSERT INTO payouts (affiliate_id, total_amount, status, created_at, paid_at) VALUES (?, ?, 'paid', NOW(), NOW())`,
                [affId, total],
              );
              const payoutId = pRes.insertId;
              createdPayouts.push(payoutId);

              // insert payout_details and mark commissions as paid
              const commissionIds = items.map((c) => c.id);
              for (const cid of commissionIds) {
                await conn.query(
                  `INSERT INTO payout_details (payout_id, commission_id) VALUES (?, ?)`,
                  [payoutId, cid],
                );
              }

              await conn.query(
                `UPDATE commissions SET commission_status = 'paid' WHERE id IN (${commissionIds.map(() => "?").join(",")})`,
                commissionIds,
              );

              // Log activity
              await conn.query(
                `INSERT INTO activity_logs (approved_by, action, target_type, target_id, new_status, description, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                [
                  affId,
                  "AUTO_MARK_PAYOUT_PAID",
                  "payout",
                  payoutId,
                  "paid",
                  `Auto-marked payout #${payoutId} paid for affiliate ${affId} (transaction ${id})`,
                ],
              );
            }

            // mark transaction payment_status as paid so dashboard counts it
            await conn.query(
              `UPDATE transactions SET payment_status = 'paid' WHERE id = ?`,
              [id],
            );
            console.debug("Auto-set transaction.payment_status=paid for", id);
          }

          await conn.commit();
        } catch (e) {
          await conn.rollback();
          console.error("Auto-create/mark payout failed", e);
        } finally {
          conn.release();
        }
      } catch (e) {
        console.error("Auto payout flow error", e);
      }
    } else if ((lead_status || "").toString().toUpperCase() === "SEDANG BERANGKAT") {
      // Feature-flag disabled: do not auto-create payouts. commissions remain `ready_for_withdraw` and Finance will process payouts manually.
      console.debug('AUTO_PAYOUT_ON_STAGE3 is disabled — skipping auto payout for transaction', id);
    }

    // fetch updated row for broadcasting
    let updatedRow = null;
    try {
      const [rows] = await db.query(
        `
        SELECT t.id, t.total_amount, COALESCE(t.customer_name, c.name) as customer_name, u.name as affiliate_name, e.title as event_name,
               ls.status as status, ls.updated_at
        FROM lead_statuses ls
        LEFT JOIN transactions t ON t.id = ls.transaction_id
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN users u ON t.affiliate_id = u.id
        LEFT JOIN events e ON t.event_id = e.id
        WHERE ls.transaction_id = ?
        LIMIT 1
      `,
        [id],
      );
      updatedRow = rows && rows[0] ? rows[0] : null;
    } catch (e) {
      console.error("Error fetching updated lead for broadcast", e);
    }

    // broadcast to SSE clients
    try {
      if (updatedRow) {
        leadEvents.broadcast("status_update", updatedRow);
        const s = (updatedRow.status || "").toString().toUpperCase();
        if (s === "SEDANG BERANGKAT" || s === "REJECTED") {
          leadEvents.broadcast("history", updatedRow);
        }
      }
    } catch (e) {
      console.error("Broadcast error", e);
    }

    // return updated status with timestamp for client UI
    try {
      const [r] = await db.query(
        `SELECT status, updated_at FROM lead_statuses WHERE transaction_id = ?`,
        [id],
      );
      const updated = r && r[0] ? r[0] : null;
      // fetch transaction payment_status for diagnostics
      let payment_status = null;
      try {
        const [trows] = await db.query(
          `SELECT payment_status FROM transactions WHERE id = ? LIMIT 1`,
          [id],
        );
        payment_status = trows && trows[0] ? trows[0].payment_status : null;
      } catch (e) {
        console.error("Error querying transaction payment_status", e);
      }

      return res.json({
        success: true,
        status: updated ? updated.status : lead_status,
        updated_at: updated ? updated.updated_at : null,
        payment_status: payment_status,
        created_payouts: createdPayouts,
      });
    } catch (e) {
      return res.json({ success: true, created_payouts: createdPayouts });
    }
  } catch (err) {
    console.error("postUpdateLeadStatus error:", err);
    res.status(500).json({ success: false, message: "Internal error" });
  }
};
