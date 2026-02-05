const db = require("../config/database");

/**
 * Get affiliate's commissions yang ready_for_withdraw
 * @param {number} affiliateId
 * @returns {Promise<Array>}
 */
async function getReadyCommissions(affiliateId) {
  try {
    const [results] = await db.query(
      `
      SELECT 
        c.id,
        c.transaction_id,
        c.amount,
        c.commission_status,
        c.created_at,
        t.event_id,
        e.title as event_title,
        c.stage
      FROM commissions c
      JOIN transactions t ON c.transaction_id = t.id
      LEFT JOIN events e ON t.event_id = e.id
      WHERE c.affiliate_id = ? AND c.commission_status = 'ready_for_withdraw'
      ORDER BY c.created_at DESC
    `,
      [affiliateId],
    );

    return results;
  } catch (error) {
    console.error("Error getReadyCommissions:", error);
    throw error;
  }
}

/**
 * Get total amount ready for withdrawal for an affiliate
 * @param {number} affiliateId
 * @returns {Promise<number>}
 */
async function getTotalReadyAmount(affiliateId) {
  try {
    const [[result]] = await db.query(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM commissions
      WHERE affiliate_id = ? AND commission_status = 'ready_for_withdraw'
    `,
      [affiliateId],
    );

    return result.total || 0;
  } catch (error) {
    console.error("Error getTotalReadyAmount:", error);
    throw error;
  }
}

/**
 * Get commission summary for affiliate
 * @param {number} affiliateId
 * @returns {Promise<object>}
 */
async function getCommissionSummary(affiliateId) {
  try {
    const [[pending]] = await db.query(
      `
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM commissions
      WHERE affiliate_id = ? AND commission_status = 'pending'
    `,
      [affiliateId],
    );

    const [[ready]] = await db.query(
      `
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM commissions
      WHERE affiliate_id = ? AND commission_status = 'ready_for_withdraw'
    `,
      [affiliateId],
    );

    const [[paid]] = await db.query(
      `
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM commissions
      WHERE affiliate_id = ? AND commission_status = 'paid'
    `,
      [affiliateId],
    );

    return {
      pending: {
        total: pending.total,
        count: pending.count,
      },
      ready: {
        total: ready.total,
        count: ready.count,
      },
      paid: {
        total: paid.total,
        count: paid.count,
      },
    };
  } catch (error) {
    console.error("Error getCommissionSummary:", error);
    throw error;
  }
}

/**
 * Create withdrawal request (Affiliate initiated)
 * @param {number} affiliateId
 * @param {Array} commissionIds - Optional: specific commission IDs to withdraw
 * @returns {Promise<{success: boolean, payout_id?: number, total_amount?: number, error?: string}>}
 */
async function createWithdrawalRequest(affiliateId, commissionIds = null) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Get ready commissions for this affiliate
    let query = `
      SELECT id, amount
      FROM commissions
      WHERE affiliate_id = ? AND commission_status = 'ready_for_withdraw'
    `;
    const params = [affiliateId];

    if (commissionIds && commissionIds.length > 0) {
      query += ` AND id IN (${commissionIds.map(() => "?").join(",")})`;
      params.push(...commissionIds);
    }

    const [readyCommissions] = await connection.query(query, params);

    if (!readyCommissions || readyCommissions.length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: "No ready commissions found for withdrawal",
      };
    }

    // Calculate total amount
    const totalAmount = readyCommissions.reduce(
      (sum, c) => sum + parseFloat(c.amount),
      0,
    );

    if (totalAmount <= 0) {
      await connection.rollback();
      return {
        success: false,
        error: "Invalid withdrawal amount",
      };
    }

    // Create payout request
    const [payoutResult] = await connection.query(
      `
      INSERT INTO payouts (affiliate_id, total_amount, status, created_at)
      VALUES (?, ?, 'pending', NOW())
    `,
      [affiliateId, totalAmount],
    );

    const payoutId = payoutResult.insertId;

    // Link commissions to payout and update their status to pending (in payment process)
    for (const commission of readyCommissions) {
      await connection.query(
        `
        INSERT INTO payout_details (payout_id, commission_id)
        VALUES (?, ?)
      `,
        [payoutId, commission.id],
      );

      // Update commission status from ready_for_withdraw to pending (in payment process)
      await connection.query(
        `
        UPDATE commissions
        SET commission_status = 'pending'
        WHERE id = ?
      `,
        [commission.id],
      );
    }

    // Log activity
    const [user] = await connection.query(
      `SELECT name FROM users WHERE id = ?`,
      [affiliateId],
    );
    const affiliateName = user[0]?.name || "Unknown";

    await connection.query(
      `
      INSERT INTO activity_logs (
        approved_by, 
        action, 
        target_type, 
        target_id, 
        new_status, 
        description, 
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        affiliateId,
        "REQUEST_WITHDRAWAL",
        "payout",
        payoutId,
        "pending",
        `Affiliate ${affiliateName} requested withdrawal: IDR ${totalAmount.toLocaleString("id-ID")}`,
      ],
    );

    await connection.commit();

    return {
      success: true,
      payout_id: payoutId,
      total_amount: totalAmount,
      commission_count: readyCommissions.length,
    };
  } catch (error) {
    await connection.rollback();
    console.error("Error createWithdrawalRequest:", error);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    connection.release();
  }
}

/**
 * Get affiliate's withdrawal requests
 * @param {number} affiliateId
 * @returns {Promise<Array>}
 */
async function getAffiliateWithdrawals(affiliateId) {
  try {
    const [results] = await db.query(
      `
      SELECT 
        p.id,
        p.affiliate_id,
        p.total_amount,
        p.status,
        p.created_at,
        COUNT(pd.id) as commission_count
      FROM payouts p
      LEFT JOIN payout_details pd ON p.id = pd.payout_id
      WHERE p.affiliate_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `,
      [affiliateId],
    );

    return results;
  } catch (error) {
    console.error("Error getAffiliateWithdrawals:", error);
    throw error;
  }
}

/**
 * Get withdrawal detail with linked commissions
 * @param {number} payoutId
 * @returns {Promise<object>}
 */
async function getWithdrawalDetail(payoutId) {
  try {
    const [payoutRows] = await db.query(
      `
      SELECT 
        p.id,
        p.affiliate_id,
        u.name as affiliate_name,
        u.email as affiliate_email,
        u.bank_name,
        u.bank_account_name,
        u.bank_account_number,
        u.no_wa,
        p.total_amount,
        p.status,
        p.created_at
      FROM payouts p
      LEFT JOIN users u ON p.affiliate_id = u.id
      WHERE p.id = ?
    `,
      [payoutId],
    );

    if (!payoutRows || payoutRows.length === 0) {
      return null;
    }

    const payout = payoutRows[0];

    const [commissions] = await db.query(
      `
      SELECT 
        c.id,
        c.transaction_id,
        c.amount,
        c.commission_status,
        c.stage,
        c.created_at,
        t.event_id,
        e.title as event_title,
        t.total_amount as transaction_amount
      FROM payout_details pd
      JOIN commissions c ON pd.commission_id = c.id
      JOIN transactions t ON c.transaction_id = t.id
      LEFT JOIN events e ON t.event_id = e.id
      WHERE pd.payout_id = ?
      ORDER BY c.created_at DESC
    `,
      [payoutId],
    );

    // Get proof file if exists
    const [proofRows] = await db.query(
      `SELECT proof_file FROM payment_proofs WHERE payout_id = ? AND proof_type = 'payout_transfer' LIMIT 1`,
      [payoutId],
    );

    const proof_file =
      proofRows && proofRows.length > 0 ? proofRows[0].proof_file : null;

    return {
      ...payout,
      commissions: commissions,
      proof_file: proof_file,
    };
  } catch (error) {
    console.error("Error getWithdrawalDetail:", error);
    throw error;
  }
}

/**
 * Get all pending withdrawal requests for Finance
 * @returns {Promise<Array>}
 */
async function getPendingWithdrawals() {
  try {
    const [results] = await db.query(`
      SELECT 
        p.id,
        p.affiliate_id,
        u.name as affiliate_name,
        u.email,
        u.no_wa,
        u.bank_name,
        u.bank_account_name,
        u.bank_account_number,
        p.total_amount,
        p.status,
        p.created_at,
        COUNT(pd.id) as commission_count
      FROM payouts p
      LEFT JOIN users u ON p.affiliate_id = u.id
      LEFT JOIN payout_details pd ON p.id = pd.payout_id
      WHERE p.status IN ('pending', 'approved')
      GROUP BY p.id
      ORDER BY p.created_at ASC
    `);

    return results;
  } catch (error) {
    console.error("Error getPendingWithdrawals:", error);
    throw error;
  }
}

/**
 * Approve withdrawal request (Finance -> Admin approval)
 * @param {number} payoutId
 * @param {number} approvedBy - Finance user ID
 * @param {string} note - Optional note
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function approveWithdrawal(payoutId, approvedBy, note = "") {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Update payout status to approved
    const [result] = await connection.query(
      `
      UPDATE payouts 
      SET status = 'approved'
      WHERE id = ? AND status = 'pending'
    `,
      [payoutId],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return {
        success: false,
        error: "Payout not found or not in pending status",
      };
    }

    // Get payout info for logging
    const [payoutInfo] = await connection.query(
      `
      SELECT p.total_amount, u.name as affiliate_name
      FROM payouts p
      LEFT JOIN users u ON p.affiliate_id = u.id
      WHERE p.id = ?
    `,
      [payoutId],
    );

    const payout = payoutInfo[0];

    // Log activity
    const [approver] = await connection.query(
      `SELECT name FROM users WHERE id = ?`,
      [approvedBy],
    );
    const approverName = approver[0]?.name || "Unknown";

    await connection.query(
      `
      INSERT INTO activity_logs (
        approved_by,
        action,
        target_type,
        target_id,
        new_status,
        description,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        approvedBy,
        "APPROVE_WITHDRAWAL",
        "payout",
        payoutId,
        "approved",
        `Finance ${approverName} approved withdrawal for ${payout.affiliate_name}: IDR ${payout.total_amount.toLocaleString("id-ID")}. Note: ${note}`,
      ],
    );

    await connection.commit();

    return { success: true };
  } catch (error) {
    await connection.rollback();
    console.error("Error approveWithdrawal:", error);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    connection.release();
  }
}

/**
 * Reject withdrawal request (Finance rejects and revert commission status)
 * @param {number} payoutId
 * @param {number} rejectedBy - Finance user ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function rejectWithdrawal(payoutId, rejectedBy, reason = "") {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Get payout details first
    const [payoutRows] = await connection.query(
      `
      SELECT affiliate_id, total_amount FROM payouts WHERE id = ?
    `,
      [payoutId],
    );

    if (!payoutRows || payoutRows.length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: "Payout not found",
      };
    }

    const payout = payoutRows[0];

    // Get commission IDs from payout
    const [commissionRows] = await connection.query(
      `
      SELECT commission_id FROM payout_details WHERE payout_id = ?
    `,
      [payoutId],
    );

    // Update payout status to rejected
    await connection.query(
      `
      UPDATE payouts
      SET status = 'rejected'
      WHERE id = ?
    `,
      [payoutId],
    );

    // Revert commissions back to ready_for_withdraw
    if (commissionRows.length > 0) {
      const commissionIds = commissionRows.map((c) => c.commission_id);
      await connection.query(
        `
        UPDATE commissions
        SET commission_status = 'ready_for_withdraw'
        WHERE id IN (${commissionIds.map(() => "?").join(",")})
      `,
        commissionIds,
      );
    }

    // Log activity
    const [rejecter] = await connection.query(
      `SELECT name FROM users WHERE id = ?`,
      [rejectedBy],
    );
    const rejecterName = rejecter[0]?.name || "Unknown";

    await connection.query(
      `
      INSERT INTO activity_logs (
        approved_by,
        action,
        target_type,
        target_id,
        new_status,
        description,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        rejectedBy,
        "REJECT_WITHDRAWAL",
        "payout",
        payoutId,
        "rejected",
        `Finance ${rejecterName} rejected withdrawal: IDR ${payout.total_amount.toLocaleString("id-ID")}. Reason: ${reason}`,
      ],
    );

    await connection.commit();

    return { success: true };
  } catch (error) {
    await connection.rollback();
    console.error("Error rejectWithdrawal:", error);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    connection.release();
  }
}

/**
 * Mark withdrawal as paid (Finance processed transfer)
 * @param {number} payoutId
 * @param {number} processedBy - Finance user ID
 * @param {string} transferMethod - 'bank_transfer' or 'cash'
 * @param {string} transferProof - Reference number or proof
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function markWithdrawalAsPaid(
  payoutId,
  processedBy,
  transferMethod,
  transferProof,
) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Get payout details first
    const [payoutRows] = await connection.query(
      `
      SELECT affiliate_id, total_amount FROM payouts WHERE id = ? AND status = 'approved'
    `,
      [payoutId],
    );

    if (!payoutRows || payoutRows.length === 0) {
      await connection.rollback();
      return {
        success: false,
        error: "Payout not found or not in approved status",
      };
    }

    const payout = payoutRows[0];

    // Get commission IDs from payout
    const [commissionRows] = await connection.query(
      `
      SELECT commission_id FROM payout_details WHERE payout_id = ?
    `,
      [payoutId],
    );

    // Update payout status to paid
    await connection.query(
      `
      UPDATE payouts
      SET status = 'paid', paid_at = NOW()
      WHERE id = ?
    `,
      [payoutId],
    );

    // Update all commissions to paid
    if (commissionRows.length > 0) {
      const commissionIds = commissionRows.map((c) => c.commission_id);
      await connection.query(
        `
        UPDATE commissions
        SET commission_status = 'paid'
        WHERE id IN (${commissionIds.map(() => "?").join(",")})
      `,
        commissionIds,
      );
    }

    // Log activity
    const [processor] = await connection.query(
      `SELECT name FROM users WHERE id = ?`,
      [processedBy],
    );
    const processorName = processor[0]?.name || "Unknown";

    await connection.query(
      `
      INSERT INTO activity_logs (
        approved_by,
        action,
        target_type,
        target_id,
        new_status,
        description,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        processedBy,
        "PROCESS_WITHDRAWAL",
        "payout",
        payoutId,
        "paid",
        `Finance ${processorName} processed withdrawal: IDR ${payout.total_amount.toLocaleString("id-ID")} via ${transferMethod}. Proof: ${transferProof}`,
      ],
    );

    await connection.commit();

    return { success: true };
  } catch (error) {
    await connection.rollback();
    console.error("Error markWithdrawalAsPaid:", error);
    return {
      success: false,
      error: error.message,
    };
  } finally {
    connection.release();
  }
}

module.exports = {
  getReadyCommissions,
  getTotalReadyAmount,
  getCommissionSummary,
  createWithdrawalRequest,
  getAffiliateWithdrawals,
  getWithdrawalDetail,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalAsPaid,
};
