/**
 * ABA PayWay (Ecommerce Checkout) helper.
 * Docs: https://developer.payway.com.kh/ecommerce-checkout-3158159f0
 *
 * Flow used by this shop:
 *   1. buildPurchase()   -> the browser POSTs these fields to PayWay (hosted checkout page)
 *   2. PayWay calls our callback; verifyCallbackSignature() checks it really came from them
 *   3. checkTransaction() asks PayWay directly "was this paid?" — we never trust the
 *      callback or the browser alone to mark an order paid.
 *
 * Settings (backend/.env or Render environment):
 *   PAYWAY_MERCHANT_ID, PAYWAY_API_KEY   from ABA (sandbox keys come from the sandbox sign-up)
 *   PAYWAY_BASE_URL    defaults to the SANDBOX https://checkout-sandbox.payway.com.kh
 *                      set to the production URL ABA gives you when you go live
 *   PAYWAY_CURRENCY    USD (default) or KHR
 */
const crypto = require('crypto');

const PURCHASE_PATH = '/api/payment-gateway/v1/payments/purchase';
const CHECK_PATH    = '/api/payment-gateway/v1/payments/check-transaction-2';

function cfg() {
  return {
    merchantId: process.env.PAYWAY_MERCHANT_ID || '',
    apiKey:     process.env.PAYWAY_API_KEY || '',
    baseUrl:    (process.env.PAYWAY_BASE_URL || 'https://checkout-sandbox.payway.com.kh').replace(/\/+$/, ''),
    currency:   (process.env.PAYWAY_CURRENCY || 'USD').toUpperCase(),
  };
}

function isEnabled() {
  const c = cfg();
  return Boolean(c.merchantId && c.apiKey);
}

/** UTC timestamp in PayWay's format: YYYYMMDDHHmmss */
function reqTime(date = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
         `${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`;
}

/** Base64( HMAC-SHA512( data, apiKey ) ) — the raw digest, then Base64 */
function sign(data, apiKey = cfg().apiKey) {
  return crypto.createHmac('sha512', apiKey).update(data, 'utf8').digest('base64');
}

const b64 = s => Buffer.from(s, 'utf8').toString('base64');

// Order PayWay documents for the Purchase hash. Absent optional fields count as ''.
const PURCHASE_HASH_ORDER = [
  'req_time', 'merchant_id', 'tran_id', 'amount', 'items', 'shipping',
  'firstname', 'lastname', 'email', 'phone', 'type', 'payment_option',
  'return_url', 'cancel_url', 'continue_success_url', 'return_deeplink',
  'currency', 'custom_fields', 'return_params', 'payout', 'lifetime',
  'additional_params', 'google_pay_token', 'skip_success_page',
];

/**
 * Build everything the browser needs to start a payment.
 * @param {object} o  { tranId, amount (number), items:[{name,quantity,price}], firstname, lastname,
 *                      email, callbackUrl, cancelUrl, successUrl, lifetimeMinutes }
 * @returns {{ action: string, fields: Record<string,string> }}
 */
function buildPurchase(o) {
  const c = cfg();
  const fields = {
    req_time:    reqTime(),
    merchant_id: c.merchantId,
    tran_id:     o.tranId,
    amount:      Number(o.amount).toFixed(2),
    currency:    c.currency,
    type:        'purchase',
    items:       b64(JSON.stringify((o.items || []).slice(0, 50).map(i => ({
                   name: String(i.name).slice(0, 60), quantity: Number(i.quantity), price: Number(i.price),
                 })))),
    firstname:   (o.firstname || '').slice(0, 100),
    lastname:    (o.lastname  || '').slice(0, 100),
    email:       (o.email && o.email.length <= 50) ? o.email : '',
    return_url:  b64(o.callbackUrl),   // PayWay wants this Base64-encoded
    cancel_url:  o.cancelUrl,
    continue_success_url: o.successUrl,
    lifetime:    String(o.lifetimeMinutes || 60),
  };
  // Drop empties so we only post what we mean to; the hash treats them as ''.
  for (const k of Object.keys(fields)) if (fields[k] === '') delete fields[k];

  fields.hash = sign(PURCHASE_HASH_ORDER.map(k => fields[k] ?? '').join(''), c.apiKey);
  fields.view_type = 'hosted_view'; // not part of the hash

  return { action: `${c.baseUrl}${PURCHASE_PATH}`, fields };
}

/**
 * Verify the X-PayWay-HMAC-SHA512 header on a callback:
 * sort the JSON keys ascending, concatenate the values (arrays/objects JSON-encoded),
 * HMAC-SHA512 with the API key, Base64, compare in constant time.
 */
function callbackSignatureValid(body, headerValue) {
  if (!body || typeof body !== 'object' || !headerValue) return false;
  const joined = Object.keys(body).sort().map(k => {
    const v = body[k];
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? '1' : '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }).join('');
  const expected = Buffer.from(sign(joined));
  const given    = Buffer.from(String(headerValue));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/**
 * Ask PayWay for the real status of a transaction (valid for 7 days after creation).
 * payment_status_code: 0 approved, 2 pending, 3 declined, 4 refunded, 7 cancelled.
 * Never throws for "not found"-style answers; throws on network/format problems.
 */
async function checkTransaction(tranId) {
  const c = cfg();
  const time = reqTime();
  const res = await fetch(`${c.baseUrl}${CHECK_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      req_time: time,
      merchant_id: c.merchantId,
      tran_id: tranId,
      hash: sign(`${time}${c.merchantId}${tranId}`, c.apiKey),
    }),
    signal: AbortSignal.timeout(15000),
  });
  let json;
  try { json = await res.json(); } catch (_) { throw new Error(`PayWay returned HTTP ${res.status} with a non-JSON body`); }

  const data   = json && json.data;
  const status = json && json.status;
  if (!data || data.payment_status_code === undefined) {
    return { found: false, code: status && status.code, message: status && status.message };
  }
  return {
    found: true,
    statusCode: Number(data.payment_status_code),
    statusText: data.payment_status,
    amount: Number(data.payment_amount ?? data.total_amount),
    currency: data.payment_currency,
    apv: data.apv ? String(data.apv) : null,
  };
}

module.exports = { isEnabled, cfg, reqTime, sign, buildPurchase, callbackSignatureValid, checkTransaction, PURCHASE_HASH_ORDER };
