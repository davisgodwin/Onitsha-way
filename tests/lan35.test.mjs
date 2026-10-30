import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { WebSocket } from 'ws';
import { createService } from '../server/service.mjs';
import { createGateway, CA_PATH } from '../server/lanGateway.mjs';
import { ensureLanCert, makeLeaf } from '../server/lanCert.mjs';
import tlsMod from 'node:tls';
import { VEHICLE_MODELS } from '../src/data/housing.js';

const listen = (srv, host = '127.0.0.1') => new Promise((r) => srv.listen(0, host, () => r(srv.address().port)));
const get = (url, opts = {}) => new Promise((res, rej) => https.get(url, opts, (r) => { let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: b })); }).on('error', rej));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('https LAN gateway: real certificate, http redirect on the same port, CA download, secure WebSocket', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow35-')), dist = fs.mkdtempSync(path.join(os.tmpdir(), 'ow35-dist-'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<title>Onitsha Way</title>');
  const tls = await ensureLanCert(path.join(dir, 'lan-cert'), ['127.0.0.1']);
  const secret = 'x'.repeat(40), svc = createService({ dataDir: dir, lan: { secret, joinCode: 'ABCDEF' } }); const backendPort = await listen(svc.server);
  const gw = createGateway({ distDir: dist, backendPort, secret, tls }); const port = await listen(gw);
  try {
    let r = await get(`https://127.0.0.1:${port}/`, { ca: tls.caCert }); assert.equal(r.status, 200, 'TLS verifies against the local CA'); assert.match(r.body, /Onitsha Way/);
    await assert.rejects(get(`https://127.0.0.1:${port}/`), /self-signed|unable to verify|certificate/i, 'and is not trusted without it (phones show a warning)');
    r = await fetch(`http://127.0.0.1:${port}/map?x=1`, { redirect: 'manual' }); assert.equal(r.status, 301); assert.equal(r.headers.get('location'), `https://127.0.0.1:${port}/map?x=1`, 'plain http on the same port → https');
    r = await fetch(`http://127.0.0.1:${port}${CA_PATH}`); assert.equal(r.status, 200); assert.match(await r.text(), /BEGIN CERTIFICATE/, 'the CA certificate can be downloaded for installing on a phone');
    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'lan-cert', 'ca.crt'), 'utf8'), /PRIVATE/);
    r = await get(`https://127.0.0.1:${port}/api/session`, { ca: tls.caCert }); assert.equal(r.status, 401, 'API passes through over https');
    const reg = await new Promise((res, rej) => { const q = https.request({ host: '127.0.0.1', port, path: '/api/register', method: 'POST', ca: tls.caCert, headers: { 'Content-Type': 'application/json', Origin: `https://localhost:${port}` } }, (x) => { let b = ''; x.on('data', (c) => { b += c; }); x.on('end', () => res(JSON.parse(b))); }); q.on('error', rej); q.end(JSON.stringify({ username: 'tls_ada', password: 'tls-test-password', adult: true })); });
    assert.ok(reg.ok, 'register over https from the host computer');
    const ws = new WebSocket(`wss://127.0.0.1:${port}/socket`, { ca: tls.caCert, headers: { Origin: `https://localhost:${port}` } }); const got = [];
    ws.on('message', (b) => got.push(JSON.parse(b))); await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
    ws.send(JSON.stringify({ type: 'auth', token: reg.token })); for (let i = 0; i < 200 && !got.some((m) => m.me); i++) await sleep(10);
    assert.equal(got.find((m) => m.me)?.me.username, 'tls_ada', 'secure WebSocket (wss) works'); ws.close();
  } finally { gw.close(); await svc.close(); }
});

test('certificate is reused, and renewed when the Wi-Fi address changes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow35-cert-'));
  const a = await ensureLanCert(dir, ['192.168.1.20']); assert.equal(a.renewed, true);
  const b = await ensureLanCert(dir, ['192.168.1.20']); assert.equal(b.renewed, false); assert.equal(a.cert, b.cert);
  const c = await ensureLanCert(dir, ['192.168.0.7']); assert.equal(c.renewed, true); assert.equal(c.caFingerprint, a.caFingerprint, 'same CA, so an installed CA keeps working');
  for (const f of ['ca.key', 'server.key']) assert.equal(fs.statSync(path.join(dir, f)).mode & 0o077, 0, `${f} is private to the owner`);
});

test('every vehicle model the game sells reaches other players (not only the first 12)', async () => {
  const svc = createService({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ow35-veh-')) }); const port = await listen(svc.server), base = `http://127.0.0.1:${port}`;
  try {
    const reg = async (u) => (await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: 'vehicle-test-pw', adult: true }) })).json();
    const a = await reg('veh_ada'), b = await reg('veh_obi');
    const open = async (t) => { const ws = new WebSocket(base.replace('http', 'ws') + '/socket'); const q = []; ws.on('message', (m) => q.push(JSON.parse(m))); await new Promise((r) => ws.once('open', r)); ws.send(JSON.stringify({ type: 'auth', token: t })); for (let i = 0; i < 100 && !q.some((m) => m.me); i++) await sleep(5); return { ws, q }; };
    const A = await open(a.token), B = await open(b.token);
    const models = Object.keys(VEHICLE_MODELS); assert.ok(models.length > 36);
    for (const model of models) {
      A.ws.send(JSON.stringify({ type: 'presence', p: { x: 10, y: 0.4, z: 20, heading: 1, scene: 'city', speed: 0, appearance: { ageGroup: 'adult', gender: 'male' }, vehicle: { id: 'v1', model, paint: '#aa3322', speed: 5 }, voice: 'off' } }));
      let seen; for (let i = 0; i < 100 && !seen; i++) { await sleep(5); seen = svc.clients.get(a.me.id)?.p?.vehicle?.model === model; }
      assert.ok(seen, `${model} kept by the server`);
    }
    A.ws.send(JSON.stringify({ type: 'presence', p: { x: 10, y: 0, z: 20, heading: 1, scene: 'city', speed: 0, appearance: { ageGroup: 'adult' }, vehicle: { id: 'v1', model: '__proto__', paint: '#aa3322' }, voice: 'off' } }));
    await sleep(80); assert.equal(svc.clients.get(a.me.id).p.vehicle, null, 'unknown models are still refused');
    A.ws.close(); B.ws.close();
  } finally { await svc.close(); }
});

test('the local CA can only vouch for local addresses, never a real website', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow35-nc-')), mine = await ensureLanCert(dir, ['192.168.1.20']);
  const ca = { cert: fs.readFileSync(path.join(dir, 'ca.crt'), 'utf8'), key: fs.readFileSync(path.join(dir, 'ca.key'), 'utf8') };
  const tryTls = (leaf, servername, host = '127.0.0.1') => new Promise((res) => {
    const srv = https.createServer({ key: leaf.key, cert: leaf.cert }, (q, r) => r.end('ok')).listen(0, '127.0.0.1', () => {
      const s = tlsMod.connect({ host, port: srv.address().port, ca: ca.cert, servername, checkServerIdentity: () => undefined }, () => { s.end(); srv.close(); res('trusted'); });
      s.on('error', (e) => { srv.close(); res(e.code || e.message); });
    });
  });
  assert.equal(await tryTls(mine, 'localhost'), 'trusted', 'its own LAN certificate is trusted');
  const fake = await makeLeaf(ca, ['8.8.8.8'], ['www.google.com']);
  const r = await tryTls(fake, 'www.google.com');
  assert.notEqual(r, 'trusted', 'a certificate for a real site signed with this CA is rejected'); // OpenSSL: "permitted subtree violation" (Node reports it as UNSPECIFIED)
  const ip = await tryTls(await makeLeaf(ca, ['8.8.8.8'], []), undefined); assert.notEqual(ip, 'trusted', 'nor for a public IP address');
});
