// v0.51: Paystack checkout for billboard ads (test mode), against a fake Paystack API (the real one isn't reachable
// from the test machine). Checks: keys (live keys refused), initialise with the right amount in kobo, verify before
// activating, wrong amount / failed payment refused, webhook signature, nothing secret sent to other players.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';
import { createHmac } from 'node:crypto';
import { WebSocket } from 'ws';
import { createService } from '../server/service.mjs';
import { loadPaystackKeys, createPaystack, paysFor } from '../server/Paystack.mjs';

const FLYER = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=';
const SK = 'sk_test_' + 'a'.repeat(40), PK = 'pk_test_' + 'b'.repeat(40);

test('keys: test keys accepted, live keys refused, missing keys turn Paystack off', () => {
  assert.equal(loadPaystackKeys({ env: { PAYSTACK_SECRET_KEY: SK, PAYSTACK_PUBLIC_KEY: PK }, file: '/nonexistent' }).secretKey, SK);
  assert.match(loadPaystackKeys({ env: { PAYSTACK_SECRET_KEY: 'sk_live_' + 'a'.repeat(40) }, file: '/nonexistent' }).problem, /test payments only/);
  assert.match(loadPaystackKeys({ env: { PAYSTACK_SECRET_KEY: SK, PAYSTACK_PUBLIC_KEY: 'pk_live_' + 'b'.repeat(40) }, file: '/nonexistent' }).problem, /test payments only/);
  assert.ok(loadPaystackKeys({ env: {}, file: '/nonexistent' }).problem);
});

// a fake Paystack: /transaction/initialize and /transaction/verify/:ref, checking the bearer key
function fakePaystack() {
  const txs = new Map(); let nextStatus = 'success', amountOverride = null;
  const srv = http.createServer(async (req, res) => {
    const json = (code, v) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(v)); };
    if (req.headers.authorization !== 'Bearer ' + SK) return json(401, { status: false, message: 'Invalid key' });
    if (req.method === 'POST' && req.url === '/transaction/initialize') { let b = ''; for await (const c of req) b += c; const d = JSON.parse(b); txs.set(d.reference, d); return json(200, { status: true, message: 'Authorization URL created', data: { authorization_url: 'https://checkout.paystack.com/fake' + d.reference, access_code: 'AC_' + d.reference, reference: d.reference } }); }
    const m = /^\/transaction\/verify\/(.+)$/.exec(req.url); if (m) { const ref = decodeURIComponent(m[1]), d = txs.get(ref); if (!d) return json(400, { status: false, message: 'Transaction reference not found' }); return json(200, { status: true, data: { id: 1, status: nextStatus, reference: ref, amount: amountOverride ?? d.amount, currency: d.currency, channel: 'card', domain: 'test', gateway_response: nextStatus === 'success' ? 'Successful' : 'Declined' } }); }
    json(404, { status: false, message: 'Not found' });
  });
  return { srv, txs, set: (s, a = null) => { nextStatus = s; amountOverride = a; } };
}

test('pay for an ad with Paystack: start, verify with Paystack, activate; failures and bad webhooks refused', async () => {
  const fake = fakePaystack(); await new Promise((r) => fake.srv.listen(0, '127.0.0.1', r));
  const paystack = createPaystack({ secretKey: SK, publicKey: PK, baseUrl: `http://127.0.0.1:${fake.srv.address().port}` });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow-paystack-')); const svc = createService({ dataDir: dir, paystack }); await svc.listen(0);
  const base = `http://127.0.0.1:${svc.server.address().port}`; const socks = [];
  const join = async (name) => { const r = await (await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: name, password: 'qa-password-051', adult: true }) })).json();
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/socket'); socks.push(ws); const pending = new Map(), q = []; ws.on('message', (b) => { const m = JSON.parse(b); q.push(m); if (m.requestId && pending.has(m.requestId)) { pending.get(m.requestId)(m); pending.delete(m.requestId); } });
    await new Promise((r) => ws.once('open', r)); ws.send(JSON.stringify({ type: 'auth', token: r.token })); for (let i = 0; i < 50 && !q.find((m) => m.type === 'state'); i++) await new Promise((r) => setTimeout(r, 20));
    let n = 0; return { q, act: (action, data = {}) => new Promise((res) => { const requestId = 'r' + (++n) + name; pending.set(requestId, res); ws.send(JSON.stringify({ type: 'action', action, requestId, ...data })); }) }; };
  try {
    const a = await join('payer51'), b = await join('other51');
    assert.equal(a.q.find((m) => m.type === 'state').paystack.enabled, true);
    assert.equal(a.q.find((m) => m.type === 'state').paystack.publicKey, PK);
    const ad = (await a.act('adCreate', { image: FLYER, area: 'main-market', slots: 2, key: 'paystack-checkout-1' })).ad;
    let r = await a.act('adPayCheck', { id: ad.id }); assert.ok(!r.ok, 'check before starting');
    r = await a.act('adPayStart', { id: ad.id, email: 'not-an-email' }); assert.ok(!r.ok);
    r = await b.act('adPayStart', { id: ad.id, email: 'b@example.com' }); assert.ok(!r.ok, 'someone else cannot pay into your order');
    r = await a.act('adPayStart', { id: ad.id, email: 'Ada@Example.com', returnUrl: 'http://127.0.0.1:5173/?x=1#frag' });
    assert.ok(r.ok && r.accessCode && r.authorizationUrl && r.publicKey === PK, JSON.stringify(r));
    const sent = fake.txs.get(r.reference); assert.equal(sent.amount, ad.amount * 100); assert.equal(sent.currency, 'NGN'); assert.equal(sent.email, 'ada@example.com'); assert.match(sent.callback_url, /ow_ad=/); assert.ok(!/#frag/.test(sent.callback_url));
    // not paid yet / wrong amount → stays waiting
    fake.set('abandoned'); r = await a.act('adPayCheck', { id: ad.id }); assert.ok(r.ok && !r.paid);
    fake.set('success', 100); r = await a.act('adPayCheck', { id: ad.id }); assert.ok(r.ok && !r.paid, 'an underpayment does not count');
    assert.equal(svc.db.ads[0].status, 'awaiting_test_payment');
    // a webhook with a bad signature is refused and changes nothing
    const hook = (body, sig) => fetch(base + '/api/paystack/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sig }, body });
    fake.set('success'); const ev = JSON.stringify({ event: 'charge.success', data: { reference: r.ad ? svc.db.ads[0].paystack.reference : '' } });
    assert.equal((await hook(ev, 'f'.repeat(128))).status, 401); assert.equal(svc.db.ads[0].status, 'awaiting_test_payment');
    // paid → the server verifies with Paystack and the flyer goes up
    r = await a.act('adPayCheck', { id: ad.id }); assert.ok(r.ok && r.paid && r.ad.status === 'active', JSON.stringify(r));
    const stored = svc.db.ads[0]; assert.equal(stored.paidVia, 'paystack-test'); assert.equal(stored.paystack.amountKobo, ad.amount * 100); assert.ok(stored.endsAt > stored.startsAt);
    // nothing about the payment (email, access code) is broadcast to other players
    await new Promise((r) => setTimeout(r, 100)); const seen = JSON.stringify(b.q.filter((m) => m.type === 'state').at(-1));
    assert.ok(!seen.includes('ada@example.com') && !seen.includes('AC_'), 'payment details leaked');
    // a second order paid through a correctly signed webhook
    const ad2 = (await a.act('adCreate', { image: FLYER, area: 'shoprite', slots: 1, key: 'paystack-checkout-2' })).ad;
    const s2 = await a.act('adPayStart', { id: ad2.id, email: 'ada@example.com' });
    const body = JSON.stringify({ event: 'charge.success', data: { reference: s2.reference } }), sig = createHmac('sha512', SK).update(body).digest('hex');
    assert.equal((await hook(body, sig)).status, 200); assert.equal(svc.db.ads.find((x) => x.id === ad2.id).status, 'active');
    assert.ok(paysFor({ status: 'success', reference: 'x', currency: 'NGN', amount: 300000 }, { amount: 3000, paystack: { reference: 'x' } }));
    assert.ok(!paysFor({ status: 'success', reference: 'x', currency: 'USD', amount: 300000 }, { amount: 3000, paystack: { reference: 'x' } }));
  } finally { for (const s of socks) s.close(); await svc.close(); fake.srv.close(); }
});
