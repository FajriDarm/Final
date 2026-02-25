const axios = require("axios");
const db = require("../config/database");

const PROVIDER = (process.env.WA_PROVIDER || "mock").toLowerCase();
// WA_FORCE_TO (if set) will act as a fallback override only. Use WA_COPY_TO to send a copy to a tester number.
const WA_FORCE_TO = process.env.WA_FORCE_TO || null;
// Only send copy if explicitly configured
const WA_COPY_TO = process.env.WA_COPY_TO || null;
const WABA_TOKEN = process.env.WABA_TOKEN || process.env.WHATSAPP_TOKEN;
const WABA_PHONE_NUMBER_ID = process.env.WABA_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;

function normalizePhone(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  // remove +, spaces, punctuation
  s = s.replace(/[^0-9]/g, "");
  if (s.length === 0) return null;
  // common local formats: 0812... or 812... => convert to 62...
  if (s.startsWith("0")) s = `62${s.slice(1)}`;
  if (s.startsWith("8")) s = `62${s}`;
  // already starts with 62 -> keep
  if (!s.startsWith("62")) {
    // fallback: return as-is only if looks like an international number
    // (we keep a minimal validation here)
  }
  if (s.length < 9) return null;
  return s;
}

function formatIDR(amount) {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch (e) {
    return `Rp ${amount || 0}`;
  }
}

async function sendViaWABA(to, message) {
  if (!WABA_TOKEN || !WABA_PHONE_NUMBER_ID) {
    throw new Error("WABA credentials missing (WABA_TOKEN / WABA_PHONE_NUMBER_ID)");
  }

  const url = `https://graph.facebook.com/v16.0/${WABA_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    text: { body: message },
    type: "text",
  };

  const resp = await axios.post(url, body, {
    headers: { Authorization: `Bearer ${WABA_TOKEN}` },
    timeout: 10_000,
  });
  return resp.data;
}

async function sendMock(to, message) {
  console.log("MOCK WA ->", to + ":", message.substring(0, 400));
  return { mock: true };
}

async function sendTextWA(toRaw, message, opts = {}) {
  // primary recipient = customer's number (normalize)
  const primaryCandidate = (toRaw && String(toRaw)) || "";
  let primaryTo = normalizePhone(primaryCandidate);

  // fallback to WA_FORCE_TO only when customer number missing/invalid
  if (!primaryTo && WA_FORCE_TO) primaryTo = normalizePhone(WA_FORCE_TO);
  if (!primaryTo) throw new Error("invalid phone");

  const action = opts.action || "SEND_WA";
  const target_type = opts.target_type || null;
  const target_id = opts.target_id || null;

  // helper to send using configured provider
  async function sendOnce(to, body) {
    if (PROVIDER === "waba") return sendViaWABA(to, body);
    return sendMock(to, body);
  }

  // 1) send to primary (customer)
  let primaryResult = null;
  try {
    primaryResult = await sendOnce(primaryTo, message);
  } catch (err) {
    // propagate failure for caller to handle if needed
    throw err;
  }

  // write activity log for primary (best-effort)
  try {
    const description = `WA sent to ${primaryTo} via ${PROVIDER}`;
    await db.query(
      `INSERT INTO activity_logs (approved_by, action, target_type, target_id, description, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
      [null, action, target_type, target_id, description],
    );
  } catch (e) {
    console.warn("Failed to write WA activity log (primary)", e && (e.message || e));
  }

  // 2) optionally send COPY to tester number (WA_COPY_TO) — non‑blocking
  if (WA_COPY_TO) {
    try {
      const copyTo = normalizePhone(WA_COPY_TO);
      if (copyTo && copyTo !== primaryTo) {
        const copyMessage = `[COPY] ${message}`;
        await sendOnce(copyTo, copyMessage);
        try {
          const description = `WA COPY sent to ${copyTo} via ${PROVIDER}`;
          await db.query(
            `INSERT INTO activity_logs (approved_by, action, target_type, target_id, description, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
            [null, `${action}_COPY`, target_type, target_id, description],
          );
        } catch (e) {
          console.warn("Failed to write WA activity log (copy)", e && (e.message || e));
        }
      }
    } catch (e) {
      console.warn("WA copy send failed", e && (e.message || e));
    }
  }

  return primaryResult;
}

async function notifyCustomerCheckout(transactionId) {
  const [rows] = await db.query(
    `SELECT t.id, t.total_amount, COALESCE(t.customer_name, c.name) AS customer_name, c.phone AS customer_phone, e.title AS event_name, t.payment_method
     FROM transactions t
     LEFT JOIN customers c ON t.customer_id = c.id
     LEFT JOIN events e ON t.event_id = e.id
     WHERE t.id = ? LIMIT 1`,
    [transactionId],
  );

  if (!rows || rows.length === 0) return { success: false, error: "transaction not found" };
  const t = rows[0];
  const to = t.customer_phone;
  if (!to) return { success: false, error: "no customer phone" };

  const name = t.customer_name || "";
  const eventName = t.event_name || "(event)";
  const paymentMethod = t.payment_method || "-";
  const amount = formatIDR(t.total_amount || 0);

  const message = `Assalamu'alaikum ${name},\n\nAlhamdulillah, pendaftaran Anda untuk:\n${eventName}\n\nTelah berhasil kami terima.\n\nMetode Pembayaran: ${paymentMethod}\nTotal Pembayaran: ${amount}\n\nTim kami akan segera memproses data Anda.\nJika ada pertanyaan, silakan balas pesan ini.\n\nTerima kasih atas kepercayaannya 🙏`;

  await sendTextWA(to, message, { action: "SEND_WA_CUSTOMER", target_type: "transaction", target_id: transactionId });
  return { success: true };
}

async function notifyPayoutPaid(payoutId) {
  const [rows] = await db.query(
    `SELECT p.id, p.total_amount, p.paid_at, u.name AS affiliate_name, u.no_wa AS affiliate_phone, u.bank_name, u.bank_account_name, u.bank_account_number
     FROM payouts p
     JOIN users u ON p.affiliate_id = u.id
     WHERE p.id = ? LIMIT 1`,
    [payoutId],
  );

  if (!rows || rows.length === 0) return { success: false, error: "payout not found" };
  const p = rows[0];
  const to = p.affiliate_phone;
  if (!to) return { success: false, error: "no affiliate phone" };

  const amount = formatIDR(p.total_amount || 0);
  const bank = p.bank_name || p.bank_account_name || "-";
  const date = p.paid_at ? new Date(p.paid_at).toLocaleDateString("id-ID") : new Date().toLocaleDateString("id-ID");

  const message = `Assalamu'alaikum ${p.affiliate_name},\n\nAlhamdulillah 🎉\nPenarikan komisi Anda telah berhasil diproses.\n\nJumlah Cair: ${amount}\nBank: ${bank}\nTanggal: ${date}\n\nDana telah ditransfer ke rekening Anda.\n\nTerima kasih atas kerja samanya 🙏`;

  await sendTextWA(to, message, { action: "SEND_WA_PAYOUT", target_type: "payout", target_id: payoutId });
  return { success: true };
}

module.exports = {
  notifyCustomerCheckout,
  notifyPayoutPaid,
  // helpers exported for tests
  sendTextWA,
  normalizePhone,
};
