/**
 * npm start — run Onitsha Way on a public host (Render, a VPS…): one port serves the game, the API and the live
 * connection. The account server itself stays on 127.0.0.1 inside the machine; the gateway in front of it is the only
 * door, and tells it each player's real address.
 *
 * Environment:
 *   PORT                 the port the host gives you (Render sets it)
 *   PUBLIC_URL           your site's address, e.g. https://onitsha-way.onrender.com (Render's RENDER_EXTERNAL_URL is used if unset)
 *   EXTRA_ORIGINS        other addresses the game is opened from (comma-separated), e.g. your Vercel or custom domain
 *   DATA_DIR             where accounts and saves are kept (a persistent disk!), default server/data
 *   DB_DRIVER=mysql + MYSQL_HOST/PORT/USER/PASSWORD/DATABASE   to use MySQL instead of the JSON files
 *   PAYSTACK_SECRET_KEY / PAYSTACK_PUBLIC_KEY                  Paystack TEST keys for business ads
 */
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../server/version.mjs';
import { createGateway } from '../server/lanGateway.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)), distDir = path.join(root, 'dist');
const port = Number(process.env.PORT || 10000), backendPort = Number(process.env.BACKEND_PORT || 8787);
const publicUrl = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const origins = [publicUrl, ...(process.env.EXTRA_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/$/, ''))].filter(Boolean);
if (!fs.existsSync(path.join(distDir, 'index.html'))) { console.error('No build found: run `npm run build` first (on Render this is the Build Command).'); process.exit(1); }
if (!origins.length) console.warn('[start] PUBLIC_URL is not set: browsers opening the game from a web address may be refused. Set PUBLIC_URL to your site address.');

console.log(`ONITSHA WAY v${VERSION} · public server on port ${port}${publicUrl ? ' · ' + publicUrl : ''}`);
const secret = randomBytes(24).toString('hex'), startupId = randomUUID();
const backend = spawn(process.execPath, ['server/service.mjs'], { cwd: root, stdio: 'inherit',
  env: { ...process.env, PORT: String(backendPort), HOST: '127.0.0.1', ONITSHA_STARTUP_ID: startupId, OW_GATEWAY_SECRET: secret, OW_JOIN_CODE: '',
    ALLOWED_ORIGINS: [process.env.ALLOWED_ORIGINS, ...origins].filter(Boolean).join(','), COOKIE_SECURE: process.env.COOKIE_SECURE ?? (publicUrl.startsWith('https:') ? 'true' : 'false'), OW_PUBLIC: '1' } });
let stopping = false, gateway;
const stop = (code = 0) => { if (stopping) return; stopping = true; gateway?.close(); backend.kill('SIGTERM'); setTimeout(() => process.exit(code), 1500).unref(); };
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => stop(0));
backend.on('exit', (code, sig) => { if (!stopping) { console.error(`[start] the account server stopped (${sig || code}); exiting so the host restarts us.`); stop(code || 1); } });

let ready = false;
for (let i = 0; i < 200 && !stopping; i++) {
  try { const h = await (await fetch(`http://127.0.0.1:${backendPort}/api/health`, { signal: AbortSignal.timeout(800) })).json(); if (h.ok && h.startupId === startupId) { ready = true; console.log(`[start] account server ready · storage: ${h.database?.driver ?? '?'} · Paystack: ${h.paystack?.enabled ? 'on (test)' : 'off'}`); break; } } catch {}
  await new Promise((r) => setTimeout(r, 200));
}
if (!ready) { console.error('[start] the account server did not start.'); stop(1); }
else {
  gateway = createGateway({ distDir, backendPort, secret, open: true, trustProxy: true });
  gateway.listen(port, '0.0.0.0', () => console.log(`[start] open for players on port ${port}`));
}
