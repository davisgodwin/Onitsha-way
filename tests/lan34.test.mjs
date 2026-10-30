import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { WebSocket } from 'ws';
import { createService } from '../server/service.mjs';
import { createGateway } from '../server/lanGateway.mjs';
import { isLocalNetwork, isLocalHostname, normalizeIp, parseNets } from '../server/net.mjs';

/*
 * v0.34 LAN play. To act as "a phone on the Wi-Fi" the test connects through this machine's own network address
 * (not 127.0.0.1), so the gateway sees a non-loopback client. Skips those parts if the machine has no such address.
 */
const myIp = Object.values(os.networkInterfaces()).flat().find((a) => a && !a.internal && (a.family === 'IPv4' || a.family === 4))?.address;
const listen = (srv, host = '127.0.0.1') => new Promise((r) => srv.listen(0, host, () => r(srv.address().port)));
const raw = (port, host, p, headers = {}) => new Promise((res, rej) => { const q = http.request({ host, port, path: p, headers }, (r) => { let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: b })); }); q.on('error', rej); q.end(); });

test('which addresses count as the local network', () => {
  for (const ip of ['127.0.0.1', '::1', '10.4.0.9', '172.16.3.3', '172.31.255.1', '192.168.1.20', '::ffff:192.168.0.7', 'fe80::1%en0', 'fd12::5', '169.254.10.1']) assert.ok(isLocalNetwork(ip), ip);
  for (const ip of ['8.8.8.8', '172.32.0.1', '100.64.0.1', '41.58.1.2', '192.0.2.2', '2001:4860::8888', '', 'not-an-ip']) assert.ok(!isLocalNetwork(ip), ip);
  assert.ok(isLocalNetwork('192.0.2.2', parseNets('192.0.2.0/24')), 'extra networks can be added for testing');
  assert.ok(isLocalHostname('localhost') && isLocalHostname('my-pc.local') && isLocalHostname('192.168.0.4') && !isLocalHostname('evil.example') && !isLocalHostname('41.58.1.2'));
  assert.equal(normalizeIp('::ffff:10.0.0.1'), '10.0.0.1');
  assert.throws(() => parseNets('nonsense/99'));
});

test('LAN gateway: serves the game, passes accounts through, guards the door', { skip: myIp ? false : 'this machine has no non-loopback IPv4 address' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow34-lan-')), dist = fs.mkdtempSync(path.join(os.tmpdir(), 'ow34-dist-'));
  fs.mkdirSync(path.join(dist, 'assets')); fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Onitsha Way</title>');
  fs.writeFileSync(path.join(dist, 'assets', 'index-abc.js'), 'console.log("game");'.repeat(200)); fs.writeFileSync(path.join(dist, 'data.json'), '{"ok":true}');
  const secret = 'gateway-secret-for-tests-0123456789', joinCode = 'KQ7M2P', extra = `${myIp}/32`;
  const svc = createService({ dataDir: dir, lan: { secret, joinCode, extraNets: extra } }); const backendPort = await listen(svc.server);
  const gw = createGateway({ distDir: dist, backendPort, secret, extraNets: parseNets(extra) }); const port = await listen(gw, '0.0.0.0');
  const closed = createGateway({ distDir: dist, backendPort, secret }); const closedPort = await listen(closed, '0.0.0.0');
  const phone = `http://${myIp}:${port}`, pc = `http://127.0.0.1:${port}`;
  const post = (base, route, body, headers = {}) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  try {
    // the game files
    let r = await fetch(phone + '/'); assert.equal(r.status, 200); assert.match(await r.text(), /Onitsha Way/);
    r = await fetch(phone + '/some/page'); assert.match(await r.text(), /Onitsha Way/, 'page addresses fall back to the game');
    r = await raw(port, myIp, '/assets/index-abc.js', { 'accept-encoding': 'gzip' });
    assert.equal(r.headers['content-encoding'], 'gzip'); assert.match(r.headers['cache-control'], /immutable/, 'hashed assets cached long and compressed');
    for (const p of ['/%2e%2e/%2e%2e/etc/passwd', '/..%2f..%2fpackage.json', '/assets/../../package.json']) { r = await raw(port, myIp, p); assert.ok([403, 404].includes(r.status) || !/"dependencies"/.test(r.body), `no files outside the build: ${p}`); assert.ok(!/root:|dependencies/.test(r.body)); }
    assert.equal((await fetch(phone + '/missing.png')).status, 404);

    // a device outside the local network is turned away (here: the same address without the test allowance)
    r = await raw(closedPort, myIp, '/'); assert.equal(r.status, 403, 'non-local addresses are refused');
    r = await raw(closedPort, myIp, '/api/health'); assert.equal(r.status, 403);

    // join code: needed for new accounts from other devices, not on the host computer, not for logging in
    r = await fetch(phone + '/api/session', { headers: { Origin: phone } }); assert.equal(r.status, 401); assert.equal((await r.json()).joinCodeRequired, true);
    r = await fetch(pc + '/api/session'); assert.equal((await r.json()).joinCodeRequired, false, 'the host computer itself needs no code');
    const acct = { username: 'lan_ada', password: 'lan-test-password', name: 'Ada', adult: true };
    r = await post(phone, '/api/register', acct, { Origin: phone }); assert.equal(r.status, 400); assert.match(r.body.error, /join code/);
    r = await post(phone, '/api/register', { ...acct, joinCode: 'WRONG1' }, { Origin: phone }); assert.equal(r.status, 400);
    r = await post(phone, '/api/register', { ...acct, joinCode: ' kq7m2p ' }, { Origin: phone }); assert.equal(r.status, 200, 'code is not case-sensitive'); const ada = r.body;
    r = await post(pc, '/api/register', { ...acct, username: 'host_obi' }); assert.equal(r.status, 200, 'host computer registers without a code');
    r = await post(phone, '/api/login', { username: 'lan_ada', password: 'lan-test-password' }, { Origin: phone }); assert.equal(r.status, 200, 'logging in needs no code');

    // origins: the LAN page address is accepted through the gateway, a foreign website is not
    r = await post(phone, '/api/login', { username: 'lan_ada', password: 'lan-test-password' }, { Origin: 'http://evil.example' }); assert.match(r.body.error, /Origin not permitted/);
    r = await fetch(`http://127.0.0.1:${backendPort}/api/session`, { headers: { Origin: phone } }); assert.match((await r.json()).error, /Origin not permitted/, 'the account server itself still only trusts localhost origins');

    // a browser can't pretend to be the gateway or another address
    r = await fetch(`http://127.0.0.1:${backendPort}/api/session`, { headers: { 'x-ow-gateway': 'guess', 'x-ow-client-ip': '192.168.1.50' } }); assert.equal((await r.json()).joinCodeRequired, false, 'forged client address ignored');
    r = await fetch(phone + '/api/session', { headers: { 'x-ow-gateway': secret.replace('0', '1'), 'x-ow-client-ip': '127.0.0.1', Origin: phone } }); assert.equal((await r.json()).joinCodeRequired, true, 'headers sent by the phone are replaced by the gateway');

    // rate limits are per device, so one busy phone doesn't lock everyone out
    for (let i = 0; i < 30; i++) await post(phone, '/api/login', { username: 'lan_ada', password: 'wrong-password-x' }, { Origin: phone });
    r = await post(phone, '/api/login', { username: 'lan_ada', password: 'lan-test-password' }, { Origin: phone }); assert.match(r.body.error, /Too many/);
    r = await post(pc, '/api/login', { username: 'host_obi', password: 'lan-test-password' }); assert.equal(r.status, 200, 'other devices are unaffected');

    // live connection through the gateway (multiplayer + chat)
    const ws = new WebSocket(phone.replace('http', 'ws') + '/socket', { headers: { Origin: phone } }); const got = [];
    ws.on('message', (b) => got.push(JSON.parse(b))); await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
    ws.send(JSON.stringify({ type: 'auth', token: ada.token })); for (let i = 0; i < 200 && !got.some((m) => m.me); i++) await new Promise((res) => setTimeout(res, 10));
    assert.equal(got.find((m) => m.me)?.me.username, 'lan_ada', 'WebSocket works from another device'); ws.close();
    const bad = new WebSocket(phone.replace('http', 'ws') + '/socket', { headers: { Origin: 'http://evil.example' } });
    await new Promise((res) => { bad.once('error', res); bad.once('close', res); }); assert.notEqual(bad.readyState, WebSocket.OPEN, 'foreign websites cannot open the live connection');

    // cloud save from the phone
    r = await fetch(phone + '/api/save', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ada.token}`, Origin: phone }, body: JSON.stringify({ raw: JSON.stringify({ version: 16, character: { name: 'Ada', gender: 'female' }, clock: { day: 2 } }), baseRev: 0 }) });
    assert.equal(r.status, 200, 'saves upload through the gateway');
    assert.equal((await (await fetch(phone + '/api/health')).json()).lan, true);
  } finally { gw.close(); closed.close(); await svc.close(); }
});

test('without LAN mode nothing changes: only localhost origins, no join code', async () => {
  const svc = createService({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ow34-plain-')), lan: {} }); const port = await listen(svc.server);
  try {
    let r = await fetch(`http://127.0.0.1:${port}/api/session`, { headers: { Origin: 'http://192.168.1.4:5173' } }); assert.match((await r.json()).error, /Origin not permitted/);
    r = await fetch(`http://127.0.0.1:${port}/api/session`); assert.equal((await r.json()).joinCodeRequired, false);
    assert.equal((await (await fetch(`http://127.0.0.1:${port}/api/health`)).json()).lan, false);
  } finally { await svc.close(); }
});

test('crypto.randomUUID fallback for plain-http LAN pages', async () => {
  const real = globalThis.crypto.randomUUID; try {
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true, writable: true });
    await import(`../src/core/polyfills.js?${Date.now()}`);
    const ids = new Set(Array.from({ length: 500 }, () => crypto.randomUUID()));
    assert.equal(ids.size, 500); for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally { Object.defineProperty(globalThis.crypto, 'randomUUID', { value: real, configurable: true, writable: true }); }
});
