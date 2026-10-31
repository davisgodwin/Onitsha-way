// v0.55: record the city plan files (public/plan/<key>-<quality>.bin) for this exact code and map.
// Run after any change to src/ or the map:  npm run bake   (needs playwright-core and Chrome/Chromium; CHROME_PATH)
// It builds the game, loads it once per graphics setting in a headless browser with ?planrecord, saves each
// recording, removes plan files of older builds, and builds again so dist/ has them too.
// Without a matching plan file the game still works: it lays the city out itself (slower).
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { planKey } from './plan-key.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core')); } catch { console.error('playwright-core is not installed (npm i -D playwright-core).'); process.exit(1); }
const exe = [process.env.CHROME_PATH, '/usr/local/bin/chromium', '/usr/bin/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && fs.existsSync(p));
if (!exe) { console.error('No Chrome/Chromium found: set CHROME_PATH.'); process.exit(1); }
const qualities = (process.argv[2] ?? 'low,medium,high').split(',');
const vite = path.join(root, 'node_modules/vite/bin/vite.js');
const key = planKey(), planDir = path.join(root, 'public/plan');
console.log('plan key', key);
execFileSync(process.execPath, [vite, 'build'], { cwd: root, stdio: 'inherit' });

const dist = path.join(root, 'dist'), types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(dist, u.endsWith('/') ? u + 'index.html' : u); if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': types[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/?quickstart&planrecord`;
fs.mkdirSync(planDir, { recursive: true });
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const q of qualities) {
    const t0 = Date.now(), c = await b.newContext({ viewport: { width: 412, height: 846 } });
    await c.addInitScript((q) => { try { const k = 'onitshaway:settings', s = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...s, quality: q })); } catch { /* ignore */ } }, q);
    const p = await c.newPage(); p.on('pageerror', (e) => console.log('  page error:', e.message));
    await p.goto(url);
    await p.waitForFunction(() => window.__planFile || /could not finish/.test(document.querySelector('.load-status')?.textContent ?? ''), null, { timeout: 1800000 });
    const got = await p.evaluate(() => { if (!window.__planFile) return { err: document.querySelector('.load-status')?.textContent }; let s = ''; const a = window.__planFile; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return { b64: btoa(s), q: window.__planQuality }; });
    await c.close();
    if (!got.b64) throw Error(`recording ${q} failed: ${got.err}`);
    if (got.q !== q) throw Error(`asked for ${q}, the game loaded ${got.q}`);
    const buf = Buffer.from(got.b64, 'base64'), out = path.join(planDir, `${key}-${q}.bin`);
    fs.writeFileSync(out, buf); console.log(`  ${q}: ${(buf.length / 1024).toFixed(0)} KB in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
} finally { await b.close(); server.close(); }
for (const f of fs.readdirSync(planDir)) if (f.endsWith('.bin') && !f.startsWith(key + '-')) { fs.unlinkSync(path.join(planDir, f)); console.log('  removed old', f); }
execFileSync(process.execPath, [vite, 'build'], { cwd: root, stdio: 'inherit' });
console.log('done: plan files for', key);
