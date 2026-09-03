const nodemailer = require('nodemailer');

/**
 * SMTP-based mailer. Works with any SMTP provider — Gmail (with an App
 * Password), Mailtrap (great for local testing), SendGrid, Resend's SMTP
 * relay, etc. Configure via backend/.env — see .env.example.
 *
 * If SMTP isn't configured, every send() call falls back to logging the
 * email to the console instead of throwing, so the rest of the app (and
 * local dev without a mail provider) keeps working.
 */

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASSWORD,
  MAIL_FROM,
  FRONTEND_URL,
} = process.env;

const isConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASSWORD);

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true', // true for port 465, false for 587/25 (STARTTLS)
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
} else {
  console.warn(
    '[mailer] SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing in .env) — ' +
    'emails will be logged to the console instead of sent. See backend/.env.example.'
  );
}

const fromAddress = MAIL_FROM || '"JESI-COSMETIC" <no-reply@jesi-cosmetic.local>';

/**
 * Sends an email, or logs it to the console if SMTP isn't configured.
 * Never throws — a failed/unsent email should not break the calling request
 * (e.g. registration or checkout should still succeed).
 */
async function sendMail({ to, subject, html, text }) {
  if (!to) return { sent: false, reason: 'no recipient' };

  if (!transporter) {
    console.log(`\n[mailer] (SMTP not configured) Would send to ${to}:`);
    console.log(`  Subject: ${subject}`);
    console.log(`  ${text || html}\n`);
    return { sent: false, reason: 'smtp not configured' };
  }

  try {
    await transporter.sendMail({ from: fromAddress, to, subject, html, text });
    return { sent: true };
  } catch (err) {
    console.error(`[mailer] Failed to send "${subject}" to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

function baseUrl() {
  return FRONTEND_URL || 'http://localhost:8080';
}

async function sendPasswordResetEmail(to, rawToken) {
  const link = `${baseUrl()}/reset-password.html?token=${rawToken}`;
  return sendMail({
    to,
    subject: 'Reset your JESI-COSMETIC password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#222;">
        <h2 style="letter-spacing:1px;">JESI — COSMETIC</h2>
        <p>We received a request to reset your password. This link expires in 30 minutes.</p>
        <p style="margin:24px 0;">
          <a href="${link}" style="background:#111;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">
            Reset password
          </a>
        </p>
        <p style="font-size:13px;color:#666;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
        <p style="font-size:12px;color:#999;">Or paste this link into your browser: ${link}</p>
      </div>
    `,
    text: `Reset your JESI-COSMETIC password: ${link} (expires in 30 minutes). If you didn't request this, ignore this email.`,
  });
}

async function sendBackInStockEmail(to, productName, productId) {
  const link = `${baseUrl()}/shop.html?product=${productId}`;
  return sendMail({
    to,
    subject: `"${productName}" is back in stock!`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#222;">
        <h2 style="letter-spacing:1px;">JESI — COSMETIC</h2>
        <p>Good news — an item on your wishlist is back in stock:</p>
        <p style="font-size:16px;font-weight:bold;margin:16px 0;">${productName}</p>
        <p style="margin:24px 0;">
          <a href="${link}" style="background:#111;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">
            View product
          </a>
        </p>
        <p style="font-size:13px;color:#666;">Stock is limited — grab it before it sells out again.</p>
      </div>
    `,
    text: `"${productName}" is back in stock! View it here: ${link}`,
  });
}

module.exports = { sendMail, sendPasswordResetEmail, sendBackInStockEmail, isConfigured };
