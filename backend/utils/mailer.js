const nodemailer = require('nodemailer');

/**
 * Mailer with three ways to send, picked automatically from backend/.env:
 *
 *   1. Brevo API   — BREVO_API_KEY            (HTTPS, works on Render's free plan)
 *   2. Resend API  — RESEND_API_KEY           (HTTPS, works on Render's free plan)
 *   3. SMTP        — SMTP_HOST/USER/PASSWORD  (Gmail, Mailtrap, SendGrid, ...)
 *                    NOTE: Render's free plan blocks SMTP ports 25/465/587,
 *                    so SMTP only works locally or on a paid Render instance.
 *
 * Force one with MAIL_PROVIDER=brevo | resend | smtp. If nothing is
 * configured, emails are logged to the console instead (fine for local dev).
 *
 * sendMail() never throws — a failed email must not break registration,
 * checkout, etc.
 */

const {
  MAIL_PROVIDER,
  BREVO_API_KEY,
  RESEND_API_KEY,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASSWORD,
  MAIL_FROM,
  FRONTEND_URL,
} = process.env;

const smtpConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASSWORD);

function pickProvider() {
  const forced = (MAIL_PROVIDER || '').trim().toLowerCase();
  if (forced === 'brevo'  && BREVO_API_KEY)  return 'brevo';
  if (forced === 'resend' && RESEND_API_KEY) return 'resend';
  if (forced === 'smtp'   && smtpConfigured) return 'smtp';
  if (forced) console.warn(`[mailer] MAIL_PROVIDER="${forced}" is set but its credentials are missing — trying the others.`);

  if (BREVO_API_KEY)  return 'brevo';
  if (RESEND_API_KEY) return 'resend';
  if (smtpConfigured) return 'smtp';
  return null;
}

const provider = pickProvider();
const isConfigured = provider !== null;

let transporter = null;
if (provider === 'smtp') {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true', // true for port 465, false for 587/25 (STARTTLS)
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    // fail fast instead of hanging the request if the host blocks SMTP
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

if (isConfigured) {
  console.log(`[mailer] Sending emails with: ${provider}`);
} else {
  console.warn(
    '[mailer] No email provider configured (set BREVO_API_KEY, RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASSWORD) — ' +
    'emails will be logged to the console instead of sent. See backend/env.example.'
  );
}

const fromAddress = MAIL_FROM || '"JESI-COSMETIC" <no-reply@jesi-cosmetic.local>';

/** '"JESI-COSMETIC" <me@gmail.com>'  ->  { name: 'JESI-COSMETIC', email: 'me@gmail.com' } */
function parseFrom(from) {
  const m = String(from).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || 'JESI-COSMETIC', email: m[2].trim() };
  return { name: 'JESI-COSMETIC', email: String(from).trim() };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function postJson(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 300); } catch (_) {}
    throw new Error(`${res.status} ${res.statusText} ${detail}`.trim());
  }
}

async function sendViaBrevo({ to, subject, html, text, replyTo }) {
  const from = parseFrom(fromAddress);
  await postJson('https://api.brevo.com/v3/smtp/email', { 'api-key': BREVO_API_KEY }, {
    sender: from,
    to: [{ email: to }],
    subject,
    htmlContent: html || `<p>${escapeHtml(text || '')}</p>`,
    ...(replyTo ? { replyTo: { email: replyTo } } : {}),
  });
}

async function sendViaResend({ to, subject, html, text, replyTo }) {
  await postJson('https://api.resend.com/emails', { authorization: `Bearer ${RESEND_API_KEY}` }, {
    from: fromAddress,
    to: [to],
    subject,
    html,
    text,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });
}

/**
 * Sends an email, or logs it to the console if nothing is configured.
 * Returns { sent: boolean, reason? } and never throws.
 */
async function sendMail({ to, subject, html, text, replyTo }) {
  if (!to) return { sent: false, reason: 'no recipient' };

  if (!isConfigured) {
    console.log(`\n[mailer] (not configured) Would send to ${to}:`);
    console.log(`  Subject: ${subject}`);
    console.log(`  ${text || html}\n`);
    return { sent: false, reason: 'mailer not configured' };
  }

  try {
    if (provider === 'brevo')       await sendViaBrevo({ to, subject, html, text, replyTo });
    else if (provider === 'resend') await sendViaResend({ to, subject, html, text, replyTo });
    else                            await transporter.sendMail({ from: fromAddress, to, subject, html, text, replyTo });
    return { sent: true };
  } catch (err) {
    console.error(`[mailer] Failed to send "${subject}" to ${to} via ${provider}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

function baseUrl() {
  return (FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
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
        <p style="font-size:16px;font-weight:bold;margin:16px 0;">${escapeHtml(productName)}</p>
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

/**
 * Tells the shop owner about a new "Contact us" message.
 * Goes to CONTACT_EMAIL (or, if unset, the address in MAIL_FROM). Reply-To is
 * the customer, so hitting "Reply" in your inbox answers them directly.
 */
async function sendContactNotification({ name, email, subject, message }) {
  const owner = process.env.CONTACT_EMAIL || parseFrom(fromAddress).email;
  return sendMail({
    to: owner,
    replyTo: email,
    subject: `[JESI Contact] ${subject} — ${name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222;">
        <h2 style="letter-spacing:1px;">New message from the website</h2>
        <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;<br>
           <strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <div style="white-space:pre-wrap;background:#f6f1ee;padding:14px 16px;border-radius:6px;">${escapeHtml(message)}</div>
        <p style="font-size:12px;color:#999;margin-top:16px;">Press Reply to answer ${escapeHtml(name)} directly. You can also manage messages in the admin dashboard.</p>
      </div>
    `,
    text: `New message from ${name} <${email}>\nSubject: ${subject}\n\n${message}`,
  });
}

module.exports = { sendMail, sendPasswordResetEmail, sendBackInStockEmail, sendContactNotification, isConfigured };