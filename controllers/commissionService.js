const db = require("../config/database");

/**
 * Award commission for a transaction and stage if applicable.
 * - Finds applicable commission rule (event-specific override global)
 * - Calculates amount (flat or percentage of transaction total_amount)
 * - Inserts into `commissions` if not already present for the same transaction and stage
 *
 * @param {number} transactionId
 * @param {number} stage (1|2|3)
 * @returns {Promise<{inserted: boolean, amount: number|null, reason?: string}>}
 */
async function awardCommissionForTransaction(transactionId, stage) {
  try {
    // Load transaction details
    const [trxRows] = await db.query(
      `SELECT id, affiliate_id, event_id, total_amount FROM transactions WHERE id = ? LIMIT 1`,
      [transactionId],
    );

    if (!trxRows || trxRows.length === 0) {
      return { inserted: false, amount: null, reason: "transaction_not_found" };
    }

    const trx = trxRows[0];

    if (!trx.affiliate_id) {
      return { inserted: false, amount: null, reason: "no_affiliate" };
    }

    // Check duplicate commission for this transaction & stage
    const [existing] = await db.query(
      `SELECT id FROM commissions WHERE transaction_id = ? AND stage = ? LIMIT 1`,
      [transactionId, stage],
    );

    if (existing && existing.length > 0) {
      return { inserted: false, amount: null, reason: "duplicate" };
    }

    // Find applicable commission rule: prefer event-specific (event_id), fallback to global (event_id IS NULL)
    const [rules] = await db.query(
      `SELECT id, event_id, commission_type, commission_value, min_stage, is_active
       FROM commission_rules
       WHERE is_active = 1 AND min_stage <= ? AND (event_id = ? OR event_id IS NULL)
       ORDER BY (event_id IS NOT NULL) DESC, id DESC
       LIMIT 1`,
      [stage, trx.event_id],
    );

    if (!rules || rules.length === 0) {
      return { inserted: false, amount: null, reason: "no_rule" };
    }

    const rule = rules[0];

    // Calculate amount
    let amount = 0;
    const totalAmount = parseFloat(trx.total_amount) || 0;

    if (rule.commission_type === "flat") {
      amount = parseFloat(rule.commission_value) || 0;
    } else if (rule.commission_type === "percentage") {
      amount = (parseFloat(rule.commission_value) / 100) * totalAmount;
    }

    // Round to 2 decimals
    amount = Math.round((amount + Number.EPSILON) * 100) / 100;

    // If amount is zero, skip inserting
    if (!amount || amount <= 0) {
      return { inserted: false, amount, reason: "zero_amount" };
    }

    // Insert commission record
    const [ins] = await db.query(
      `INSERT INTO commissions (transaction_id, affiliate_id, stage, amount, stage_status, commission_status)
       VALUES (?, ?, ?, ?, 'approved', 'approved')`,
      [transactionId, trx.affiliate_id, stage, amount],
    );

    // Fetch inserted commission for broadcasting
    try {
      const [rows] = await db.query(
        `SELECT id, transaction_id, affiliate_id, stage, amount, created_at FROM commissions WHERE id = ? LIMIT 1`,
        [ins.insertId],
      );
      const commissionRow = rows && rows[0] ? rows[0] : null;
      if (commissionRow) {
        try {
          const leadEvents = require("../services/leadEvents");
          leadEvents.broadcast("commission_awarded", commissionRow);
        } catch (e) {
          console.warn(
            "Failed to broadcast commission_awarded",
            e && (e.message || e),
          );
        }
      }
    } catch (e) {
      console.warn(
        "Failed to fetch inserted commission for broadcast",
        e && (e.message || e),
      );
    }

    return { inserted: true, amount };
  } catch (err) {
    console.error("awardCommissionForTransaction error", err);
    return { inserted: false, amount: null, reason: "error", error: err };
  }
}

/**
 * Get projected commission amount for a transaction and stage using commission rules
 * @param {number} transactionId
 * @param {number} stage
 * @returns {Promise<{amount: number|null, rule: object|null, reason?: string}>}
 */
async function getProjectedCommissionForTransaction(transactionId, stage) {
  try {
    const [trxRows] = await db.query(
      `SELECT id, affiliate_id, event_id, total_amount FROM transactions WHERE id = ? LIMIT 1`,
      [transactionId],
    );

    if (!trxRows || trxRows.length === 0)
      return { amount: null, rule: null, reason: "transaction_not_found" };

    const trx = trxRows[0];
    const [rules] = await db.query(
      `SELECT id, event_id, commission_type, commission_value, min_stage, is_active
       FROM commission_rules
       WHERE is_active = 1 AND min_stage <= ? AND (event_id = ? OR event_id IS NULL)
       ORDER BY (event_id IS NOT NULL) DESC, id DESC
       LIMIT 1`,
      [stage, trx.event_id],
    );

    if (!rules || rules.length === 0)
      return { amount: null, rule: null, reason: "no_rule" };

    const rule = rules[0];
    let amount = 0;
    const totalAmount = parseFloat(trx.total_amount) || 0;

    if (rule.commission_type === "flat") {
      amount = parseFloat(rule.commission_value) || 0;
    } else if (rule.commission_type === "percentage") {
      amount = (parseFloat(rule.commission_value) / 100) * totalAmount;
    }

    amount = Math.round((amount + Number.EPSILON) * 100) / 100;
    return { amount, rule };
  } catch (err) {
    console.error("getProjectedCommissionForTransaction error", err);
    return { amount: null, rule: null, reason: "error" };
  }
}

module.exports = {
  awardCommissionForTransaction,
  getProjectedCommissionForTransaction,
};
