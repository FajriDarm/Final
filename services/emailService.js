const nodemailer = require("nodemailer");

function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransporter() {
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendPasswordResetEmail({ to, resetUrl, name }) {
  const subject = "Reset Password Akun Affillink";
  const text = `Halo ${name || "Pengguna"},\n\nKlik tautan berikut untuk reset password Anda:\n${resetUrl}\n\nTautan ini berlaku 1 jam.\nJika Anda tidak merasa meminta reset password, abaikan email ini.\n`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin-bottom: 8px;">Reset Password Affillink</h2>
      <p>Halo ${name || "Pengguna"},</p>
      <p>Klik tombol berikut untuk reset password akun Anda:</p>
      <p style="margin: 20px 0;">
        <a href="${resetUrl}" style="background:#059669;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700;">
          Reset Password
        </a>
      </p>
      <p>Atau buka link ini di browser:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p style="margin-top: 20px;">Tautan ini berlaku selama <strong>1 jam</strong>.</p>
      <p>Jika Anda tidak merasa meminta reset password, abaikan email ini.</p>
    </div>
  `;

  if (!isSmtpConfigured()) {
    console.warn("[emailService] SMTP belum dikonfigurasi. Email tidak terkirim.");
    console.warn("[emailService] Reset URL:", resetUrl);
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = createTransporter();
  const from =
    process.env.SMTP_FROM || process.env.SMTP_USER || "farrelgoesty34@gmail.com";
  await transporter.sendMail({ from, to, subject, text, html });
  return { sent: true };
}

module.exports = {
  sendPasswordResetEmail,
};
