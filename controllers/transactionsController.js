const db = require("../config/database");

async function createTransaction(req, res) {
  try {
    let {
      customer_name,
      customer_email,
      customer_phone,
      payment_method,
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
    if (!customer_name || !customer_phone || !payment_method) {
      return res.status(400).send("Missing required fields");
    }

    // 1) Find or create customer. If found, update name/email if different.
    let rows;
    // Prefer exact email match first (if provided), then fallback to phone.
    if (customer_email) {
      [rows] = await db.query(
        "SELECT id, name, email FROM customers WHERE email = ? LIMIT 1",
        [customer_email],
      );
      if (rows.length === 0) {
        [rows] = await db.query(
          "SELECT id, name, email FROM customers WHERE phone = ? LIMIT 1",
          [customer_phone],
        );
      }
    } else {
      [rows] = await db.query(
        "SELECT id, name, email FROM customers WHERE phone = ? LIMIT 1",
        [customer_phone],
      );
    }
    let customerId;
    if (rows.length > 0) {
      customerId = rows[0].id;
      // update name/email only if existing values are empty/null so we don't
      // overwrite historical data with incoming values. This prevents replacing
      // an existing customer's name/email when the new submission belongs to
      // a different person that shares phone/email by coincidence.
      const existing = rows[0];
      const updates = [];
      const params = [];
      if (customer_name && (!existing.name || existing.name.trim() === "")) {
        updates.push("name = ?");
        params.push(customer_name);
      }
      if (customer_email && (!existing.email || existing.email.trim() === "")) {
        updates.push("email = ?");
        params.push(customer_email);
      }
      if (updates.length > 0) {
        params.push(customerId);
        await db.query(
          `UPDATE customers SET ${updates.join(", ")} WHERE id = ?`,
          params,
        );
      }
    } else {
      const [resIns] = await db.query(
        "INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)",
        [customer_name, customer_email || null, customer_phone],
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
        "SELECT event_type, price_promo, price_original FROM events WHERE id = ? LIMIT 1",
        [resolvedEventId],
      );
      if (evRows.length > 0) {
        const ev = evRows[0];
        totalAmount =
          ev.event_type === "berbayar"
            ? ev.price_promo || ev.price_original || 0
            : 0;
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
      `INSERT INTO transactions (event_id, affiliate_id, customer_id, customer_name, payment_method, payment_status, total_amount, status)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, 'pending')`,
      [
        resolvedEventId,
        affiliateId,
        customerId,
        customer_name || null,
        payment_method,
        totalAmount,
      ],
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

    // Fetch event bank details to return for client-side flow
    let bankInfo = null;
    if (resolvedEventId) {
      const [evRows2] = await db.query(
        "SELECT bank_name, bank_account_name, bank_account_number, payment_methods FROM events WHERE id = ? LIMIT 1",
        [resolvedEventId],
      );
      if (evRows2.length > 0) bankInfo = evRows2[0];
    }

    // If client expects JSON (AJAX), return JSON with transaction id and bank info
    if (req.is("application/json") || req.xhr) {
      return res.json({
        success: true,
        transactionId: trxRes.insertId,
        bankInfo,
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
