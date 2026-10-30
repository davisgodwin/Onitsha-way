/**
 * npm run lan — play on phones and other computers on the same Wi-Fi.
 *   builds the game, starts the account server (still on 127.0.0.1 only) and the LAN gateway, then prints the
 *   address to open on other devices and the join code new players need to create an account.
 * Options: --port 5180   --new-code (make a new join code)   --no-build (reuse the last build)   --http (no https; voice then
 *          works on the host computer only)
 * https is the default because phones only allow the microphone (voice chat) on secure pages.
 * Same data as npm run dev: the same accounts, MySQL database (if set up) and cloud saves.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../server/version.mjs';
import { createGateway, CA_PATH } from '../server/lanGateway.mjs';
import { ensureLanCert } from '../server/lanCert.mjs';
import { lanAddresses, parseNets } from '../server/net.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const argv = process.argv.slice(2), flag = (n) => argv.includes(`--${n}`), opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const port = Number(opt('port') ?? process.env.LAN_PORT ?? 5180), backendPort = Number(process.env.BACKEND_PORT ?? 8787);
const dataDir = process.env.DATA_DIR || path.join(root, 'server', 'data'), distDir = path.join(root, 'dist');
const extraNets = parseNets(process.env.OW_LAN_EXTRA_NETS);
const children = []; let stopping = false, gateway;
function stop(code = 0) { if (stopping) return; stopping = true; gateway?.close(); for (const p of children) p.kill(); process.exitCode = code; setTimeout(() => process.exit(code), 400).unref(); }
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => stop(0));

console.log(`\nONITSHA WAY v${VERSION} · LAN play`);

// 1. join code (kept in server/data/lan.json so it stays the same between sessions)
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const lanFile = path.join(dataDir, 'lan.json');
let lan = {}; try { lan = JSON.parse(fs.readFileSync(lanFile, 'utf8')); } catch { /* first run */ }
if (!lan.joinCode || flag('new-code')) {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
  lan.joinCode = [...randomBytes(6)].map((b) => abc[b % abc.length]).join('');
  fs.writeFileSync(lanFile, JSON.stringify(lan, null, 2) + '\n', { mode: 0o600 });
}

// 2. build the game (phones get the production build: smaller, faster, no source files on the network)
if (!flag('no-build') || !fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log('Building the game for other devices (about a minute)…');
  const b = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
  if (b.status !== 0) { console.error('The build failed (see above). Nothing was changed.'); process.exit(1); }
}

// 3. account server, exactly as npm run dev starts it, plus the gateway secret and join code
const secret = randomBytes(24).toString('hex'), startupId = randomUUID();
const backend = spawn(process.execPath, ['server/service.mjs'], { cwd: root, stdio: 'inherit',
  env: { ...process.env, PORT: String(backendPort), HOST: '127.0.0.1', ONITSHA_STARTUP_ID: startupId, OW_GATEWAY_SECRET: secret, OW_JOIN_CODE: lan.joinCode } });
children.push(backend);
backend.on('exit', (code, sig) => { if (!stopping) { console.error(`The account server stopped (${sig || code}). LAN play is stopping.`); stop(code || 1); } });
let ready = false;
for (let i = 0; i < 80 && !stopping; i++) {
  try { const h = await (await fetch(`http://127.0.0.1:${backendPort}/api/health`, { signal: AbortSignal.timeout(600) })).json(); if (h.ok && h.version === VERSION && h.startupId === startupId) { ready = true; break; } } catch {}
  await new Promise((r) => setTimeout(r, 150));
}
if (!ready) { if (!stopping) { console.error(`The account server did not start on port ${backendPort}. If npm run dev is still running, stop it first (Ctrl+C in its terminal) — LAN play starts its own.`); stop(1); } }
else {
  // 4. the LAN gateway: listens on every network adapter, but only answers this computer and the local network
  const useHttps = !flag('http'), addrs = lanAddresses(extraNets);
  let tls = null;
  if (useHttps) {
    try { tls = await ensureLanCert(path.join(dataDir, 'lan-cert'), addrs.map((a) => a.address), { extraNets: String(process.env.OW_LAN_EXTRA_NETS || '').split(',').filter(Boolean).map((c) => { const [ip, b = '32'] = c.trim().split('/'); return [ip, Number(b)]; }) }); }
    catch (e) { console.error(`Could not make the https certificate (${e.message}). Starting without https: voice will only work on this computer.`); }
  }
  const scheme = tls ? 'https' : 'http';
  gateway = createGateway({ distDir, backendPort, secret, extraNets, tls });
  gateway.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is busy. Try: npm run lan -- --port 5181` : `LAN gateway error: ${e.message}`); stop(1); });
  gateway.listen(port, '0.0.0.0', () => {
    console.log(`\n────────────────────────────────────────────────────────────`);
    console.log(` On this computer:  ${scheme}://localhost:${port}`);
    if (addrs.length) {
      console.log(` On phones / other PCs on the same Wi-Fi, open:`);
      for (const a of addrs) console.log(`   ${scheme}://${a.address}:${port}${a.virtual ? `   (${a.name} — probably not your Wi-Fi)` : ''}`);
    } else console.log(' This computer has no Wi-Fi/LAN address right now. Connect it to the same Wi-Fi as the phones (or to a phone hotspot).');
    console.log(`\n JOIN CODE for new accounts on other devices:  ${lan.joinCode}`);
    console.log(` (logging in to an existing account doesn't need it; npm run lan -- --new-code makes a new one)`);
    console.log(`────────────────────────────────────────────────────────────`);
    if (tls) {
      console.log(' First visit on each phone: the browser warns "Your connection is not private" because this certificate');
      console.log(' was made by this computer, not a public authority. Tap Advanced → Proceed (Android) or Show Details →');
      console.log(' visit this website (iPhone). Or install the certificate once to remove the warning — see UPDATE_35.md:');
      console.log(`   ${scheme}://${addrs[0]?.address ?? 'localhost'}:${port}${CA_PATH}`);
      console.log(` Certificate fingerprint (SHA-256): ${tls.caFingerprint}`);
    } else console.log(' Plain http (--http): voice chat works on this computer only.');
    console.log(' Only devices on your local network can connect. Use your own Wi-Fi or a phone hotspot, not public Wi-Fi.');
    console.log(' Windows may ask about Node.js and the firewall: allow PRIVATE networks only. Keep this terminal open; Ctrl+C stops everything.\n');
  });
}
