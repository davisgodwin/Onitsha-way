// v0.51: Paystack checkout for billboard ads, in TEST MODE ONLY.
// The secret key stays on the server: from the environment (PAYSTACK_SECRET_KEY / PAYSTACK_PUBLIC_KEY) or from
// server/paystack.local.json, which is git-ignored and never packed into a zip. Live keys (sk_live_) are refused:
// this build takes test payments only.
import fs from 'node:fs';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const PAYSTACK_FILE = fileURLToPath(new URL('./paystack.local.json', import.meta.url));

/** Read the keys. Returns { secretKey, publicKey, problem } — problem says why Paystack is off. */
export function loadPaystackKeys({ env = process.env, file = PAYSTACK_FILE } = {}) {
  let secretKey = env.PAYSTACK_SECRET_KEY || '', publicKey = env.PAYSTACK_PUBLIC_KEY || '';
  if (!secretKey && fs.existsSync(file)) { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); secretKey = String(j.secretKey || ''); publicKey = String(j.publicKey || ''); } catch { return { problem: 'server/paystack.local.json is not valid JSON.' }; } }
  secretKey = secretKey.trim(); publicKey = publicKey.trim();
  if (!secretKey) return { problem: 'No Paystack key set.' };
  if (/^sk_live_/.test(secretKey) || /^pk_live_/.test(publicKey)) return { problem: 'Live Paystack keys are refused: this build takes test payments only. Use your sk_test_ / pk_test_ keys.' };
  if (!/^sk_test_[A-Za-z0-9]{20,}$/.test(secretKey)) return { problem: 'The Paystack secret key must start with sk_test_.' };
  if (publicKey && !/^pk_test_[A-Za-z0-9]{20,}$/.test(publicKey)) return { problem: 'The Paystack public key must start with pk_test_.' };
  // tests only: point at a fake Paystack on this machine (never anywhere else)
  const base = env.PAYSTACK_API_BASE && /^http:\/\/127\.0\.0\.1:\d+$/.test(env.PAYSTACK_API_BASE) ? env.PAYSTACK_API_BASE : undefined;
  return { secretKey, publicKey, baseUrl: base };
}

export function createPaystack({ secretKey, publicKey = '', baseUrl,  fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) {
  baseUrl ||= 'https://api.paystack.co';
  const call = async (method, path, body) => {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
    let res, json;
    try {
      res = await fetchImpl(baseUrl + path, { method, signal: ctl.signal, headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      json = await res.json().catch(() => ({}));
    } catch (e) { throw Error(e.name === 'AbortError' ? 'Paystack did not answer in time. Try again.' : 'Could not reach Paystack. Check your internet connection.'); }
    finally { clearTimeout(t); }
    if (!res.ok || json.status !== true) throw Error(`Paystack: ${json.message || 'request failed (' + res.status + ')'}`);
    return json.data;
  };
  return {
    publicKey, mode: 'test',
    /** Start a transaction. amountKobo is an integer number of kobo (₦1 = 100 kobo). */
    initialize: ({ email, amountKobo, reference, callbackUrl, metadata }) => call('POST', '/transaction/initialize', { email, amount: amountKobo, currency: 'NGN', reference, callback_url: callbackUrl || undefined, metadata: metadata ? JSON.stringify(metadata) : undefined, channels: ['card', 'bank', 'ussd', 'bank_transfer'] }),
    /** Ask Paystack what happened to a transaction (never trust the browser alone). */
    verify: (reference) => call('GET', '/transaction/verify/' + encodeURIComponent(reference)),
    /** Webhooks are signed: HMAC-SHA512 of the raw body with the secret key, in x-paystack-signature. */
    signatureOK(rawBody, signature) {
      if (typeof signature !== 'string' || !/^[0-9a-f]{128}$/i.test(signature)) return false;
      const want = createHmac('sha512', secretKey).update(rawBody).digest();
      return timingSafeEqual(want, Buffer.from(signature, 'hex'));
    },
  };
}

/** Does a verified Paystack transaction pay for this ad exactly? */
export function paysFor(tx, ad) {
  return !!tx && tx.status === 'success' && tx.reference === ad.paystack?.reference && tx.currency === 'NGN' && Number(tx.amount) === ad.amount * 100;
}
