const db = require("../config/database");
const whatsappService = require("../services/whatsappService");
const { syncEventStatusesByActivePeriod } = require("../services/eventStatusService");

async function createTransaction(req, res) {
  try {
    await syncEventStatusesByActivePeriod();

    let {
      customer_name,
      customer_phone,
      event_id,
      affiliate_ref,
    } = req.body;

    // fallback to cookies for tracking refs/event if not provided in form
    if (!affiliate_ref && req.cookies && req.cookies.affiliate_ref) {
      affiliate_ref = req.cookies.affiliate_ref;
    }

    if (!event_id && req.cookies && req.cookies.event_slug) {
      // try to resolve event_id from slug cookie
      try {
        const [evRowsC] = await db.query(
          "SELECT id FROM events WHERE slug = ? LIMIT 1",
          [req.cookies.event_slug],
        );
        if (evRowsC.length > 0) event_id = evRowsC[0].id;
      } catch (e) {
        // ignore
      }
    }

    // Basic validation
    if (!customer_name || !customer_phone) {
      return res.status(400).send("Missing required fields");
    }

    // 1) Find or create customer. If found, update name if different.
    let rows;
    [rows] = await db.query(
      "SELECT id, name FROM customers WHERE phone = ? LIMIT 1",
      [customer_phone],
    );
    let customerId;
    if (rows.length > 0) {
      customerId = rows[0].id;
      const existing = rows[0];
      if (customer_name && (!existing.name || existing.name.trim() === "")) {
        await db.query(
          `UPDATE customers SET name = ? WHERE id = ?`,
          [customer_name, customerId],
        );
      }
    } else {
      const [resIns] = await db.query(
        "INSERT INTO customers (name, phone) VALUES (?, ?)",
        [customer_name, customer_phone],
      );
      customerId = resIns.insertId;
    }

    // 2) Resolve affiliate and event if affiliate_ref provided
    let affiliateId = null;
    let resolvedEventId = event_id || null;
    if (affiliate_ref) {
      const [linkRows] = await db.query(
        "SELECT affiliate_id, event_id FROM affiliate_links WHERE code = ? LIMIT 1",
        [affiliate_ref],
      );
      if (linkRows.length > 0) {
        affiliateId = linkRows[0].affiliate_id || null;
        if (!resolvedEventId) resolvedEventId = linkRows[0].event_id || null;
      }
    }

    // 3) Determine total_amount from event if available
    let totalAmount = 0;
    if (resolvedEventId) {
      const [evRows] = await db.query(
        "SELECT event_type, price_promo, price_original FROM events WHERE id = ? AND status = 'active' LIMIT 1",
        [resolvedEventId],
      );
      if (evRows.length > 0) {
        const ev = evRows[0];
        totalAmount =
          ev.event_type === "berbayar"
            ? ev.price_promo || ev.price_original || 0
            : 0;
      } else {
        return res.status(400).send("Event tidak aktif atau tidak ditemukan");
      }
    }

    // 4) Insert transaction
    // Ensure transactions has `customer_name` snapshot column (best-effort).
    try {
      await db.query(
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100) NULL",
      );
    } catch (err) {
      // Some MySQL versions don't support IF NOT EXISTS for ADD COLUMN; try fallback
      try {
        await db.query(
          "ALTER TABLE transactions ADD COLUMN customer_name VARCHAR(100) NULL",
        );
      } catch (e) {
        // ignore - schema may already exist or DB doesn't permit altering here
      }
    }
    const [trxRes] = await db.query(
      `INSERT INTO transactions (event_id, affiliate_id, customer_id, customer_name, payment_status, total_amount, status)
       VALUES (?, ?, ?, ?, 'pending', ?, 'pending')`,
      [
        resolvedEventId,
        affiliateId,
        customerId,
        customer_name || null,
        totalAmount,
      ],
    );

    // 4.5) Initialize lead status for new transaction so affiliate sees 'Lead baru'
    try {
      await db.query(
        `INSERT INTO lead_statuses (transaction_id, status, updated_at) VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = NOW()`,
        [trxRes.insertId, "LEAD BARU"],
      );

      // Broadcast new lead to SSE clients (best-effort)
      try {
        const leadEvents = require("../services/leadEvents");
        const [rows] = await db.query(
          `SELECT t.id, t.total_amount, COALESCE(t.customer_name, c.name) as customer_name, u.name as affiliate_name, e.title as event_name, ls.status as status, ls.updated_at
           FROM transactions t
           LEFT JOIN customers c ON t.customer_id = c.id
           LEFT JOIN users u ON t.affiliate_id = u.id
           LEFT JOIN events e ON t.event_id = e.id
           LEFT JOIN lead_statuses ls ON ls.transaction_id = t.id
           WHERE t.id = ? LIMIT 1`,
          [trxRes.insertId],
        );
        const newLead = rows && rows[0] ? rows[0] : null;
        if (newLead) leadEvents.broadcast("new_lead", newLead);
      } catch (e) {
        console.warn(
          "Failed to broadcast new lead",
          trxRes.insertId,
          e && (e.message || e),
        );
      }
    } catch (e) {
      // Non-fatal: if table missing or other issue, log and continue
      console.warn(
        "Failed to set initial lead status for transaction",
        trxRes.insertId,
        e && (e.message || e),
      );
    }

    // Send WhatsApp confirmation (fire-and-forget). Uses WA_FORCE_TO for dev testing.
    whatsappService
      .notifyCustomerCheckout(trxRes.insertId)
      .catch((err) =>
        console.warn(
          "WA send failed for txn",
          trxRes.insertId,
          err && (err.message || err),
        ),
      );

    // 5) Optionally record affiliate_referral if affiliate present. Avoid duplicates by
    // checking whether a referral for this affiliate/event/customer already exists.
    if (affiliateId && resolvedEventId) {
      try {
        const [existingRef] = await db.query(
          "SELECT id FROM affiliate_referrals WHERE affiliate_id = ? AND event_id = ? AND referral_code = ? LIMIT 1",
          [affiliateId, resolvedEventId, affiliate_ref],
        );
        if (!existingRef || existingRef.length === 0) {
          // The `referred_user_id` column references `users.id` in the current
          // schema, so we keep it NULL here to avoid FK issues. Referral is
          // tracked via `referral_code`, affiliate_id, and event_id.
          await db.query(
            "INSERT INTO affiliate_referrals (affiliate_id, event_id, referred_user_id, referral_code, converted_at) VALUES (?, ?, NULL, ?, NULL)",
            [affiliateId, resolvedEventId, affiliate_ref],
          );
        }
      } catch (e) {
        // If schema doesn't have referred_user_id or other constraint, fall back to
        // inserting if no identical referral_code exists (best-effort).
        const [fallback] = await db.query(
          "SELECT id FROM affiliate_referrals WHERE affiliate_id = ? AND event_id = ? AND referral_code = ? LIMIT 1",
          [affiliateId, resolvedEventId, affiliate_ref],
        );
        if (!fallback || fallback.length === 0) {
          await db.query(
            "INSERT INTO affiliate_referrals (affiliate_id, event_id, referred_user_id, referral_code, converted_at) VALUES (?, ?, ?, ?, NULL)",
            [affiliateId, resolvedEventId, customerId || null, affiliate_ref],
          );
        }
      }
    }

    // If client expects JSON (AJAX), return JSON with transaction id and bank info
    if (req.is("application/json") || req.xhr) {
      return res.json({
        success: true,
        transactionId: trxRes.insertId,
      });
    }

    // Otherwise redirect back to landing or a thank you page
    return res.redirect("/?transaction_success=1");
  } catch (err) {
    console.error("createTransaction error", err);
    return res.status(500).send("Internal server error");
  }
}

module.exports = {
  createTransaction,
};
