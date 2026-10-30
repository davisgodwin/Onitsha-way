// End-to-end smoke test in a real browser (optional: needs `npm i -D playwright-core` and a Chromium,
// Chrome or Edge — set CHROME_PATH if it isn't found). Builds nothing: run `npm run build` first.
// It starts the account server with a throwaway data folder (your server/data is never touched), serves
// dist/, signs up a new account, creates a character, walks, saves, reloads, gets back into the game,
// and fails on any page error or if the game loop stops.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let chromium;
try { ({ chromium } = await import('playwright-core')); } catch { console.log('playwright-core is not installed — skipping the browser smoke test (npm i -D playwright-core).'); process.exit(0); }
const candidates = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/local/bin/chromium'].filter(Boolean);
const exe = candidates.find((p) => existsSync(p));
if (!exe) { console.log('No Chrome/Chromium/Edge found — set CHROME_PATH. Skipping.'); process.exit(0); }

const port = 4199;
// the account server (the preview proxies /api and /socket to 127.0.0.1:8787)
try { await fetch('http://127.0.0.1:8787/api/health', { signal: AbortSignal.timeout(800) }); console.error('Port 8787 is in use (is `npm run dev` running?). Stop it, then run the smoke test again.'); process.exit(1); } catch { /* free */ }
const dataDir = mkdtempSync(join(tmpdir(), 'onitsha-smoke-'));
const backend = spawn(process.execPath, [fileURLToPath(new URL('../../server/service.mjs', import.meta.url))], { stdio: 'ignore', env: { ...process.env, PORT: '8787', HOST: '127.0.0.1', DATA_DIR: dataDir } });
const viteBin = fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url));
const server = spawn(process.execPath, [viteBin, 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const url = `http://localhost:${port}/`;
for (let i = 0; i < 60; i++) { try { const r = await fetch(url); const h = await fetch('http://127.0.0.1:8787/api/health'); if (r.ok && h.ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }

const errors = [];
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const step = (m) => console.log('  ✓', m);
try {
  const p = await b.newPage({ viewport: { width: 1100, height: 640 } });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(url, { waitUntil: 'load' });
  const username = 'smoke' + Date.now().toString(36);
  await p.getByLabel('Display name').fill('Smoke Test', { timeout: 240000 }); step('loads to the signup screen');
  await p.getByLabel('Username').fill(username);
  await p.getByLabel('Password', { exact: true }).fill('smoke-test-password-1');
  await p.getByText('I am 18 or older').click();
  await p.getByRole('button', { name: /continue/i }).click();
  await p.waitForFunction(() => ['creator', 'playing'].includes(window.__game?.state), null, { timeout: 240000 }); step('account created');
  if (await p.evaluate(() => __game.state === 'creator')) await p.click('[data-action=start]');
  await p.waitForFunction(() => __game.state === 'playing', null, { timeout: 120000 }); step('character created, in the city');
  await p.evaluate(() => document.activeElement?.blur?.());
  await p.keyboard.down('KeyW');
  const dist = () => p.evaluate(() => Math.hypot(__game.player.position.x - __game.spawn.x, __game.player.position.z - __game.spawn.z));
  for (let i = 0; i < 40 && (await dist()) < 0.6; i++) await p.waitForTimeout(500); // software rendering can be slow
  await p.keyboard.up('KeyW');
  const moved = await dist();
  if (!(moved > 0.5)) throw new Error('the player did not move'); step(`walked ${moved.toFixed(1)} m`);
  if (!(await p.evaluate(() => __game.saveGame()))) throw new Error('save failed'); step('saved');
  await p.reload({ waitUntil: 'load' });
  // a remembered session resumes by itself; otherwise log in again
  await p.waitForFunction(() => window.__game?.state === 'playing' || !!document.querySelector('form[aria-label]'), null, { timeout: 240000 });
  if (await p.evaluate(() => window.__game?.state !== 'playing')) {
    if (await p.getByRole('button', { name: 'Log in', exact: true }).count()) await p.getByRole('button', { name: 'Log in', exact: true }).click();
    await p.getByLabel('Username').fill(username);
    await p.getByLabel('Password', { exact: true }).fill('smoke-test-password-1');
    await p.getByRole('button', { name: /continue/i }).click();
  }
  await p.waitForFunction(() => __game.state === 'playing', null, { timeout: 240000 }); step('back in the game after a reload');
  const back = await dist();
  if (!(Math.abs(back - moved) < 3)) throw new Error(`the saved position was not restored (${moved.toFixed(1)} m before, ${back.toFixed(1)} m after)`); step('saved position restored');
  const f0 = await p.evaluate(() => __game.renderer.renderer.info.render.frame);
  let f1 = f0;
  for (let i = 0; i < 30 && f1 <= f0 + 1; i++) { await p.waitForTimeout(1000); f1 = await p.evaluate(() => __game.renderer.renderer.info.render.frame); } // software rendering is slow
  if (!(f1 > f0 + 1)) throw new Error('the game loop stopped after returning to the game'); step('the game keeps running');
  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('\nBrowser smoke test passed.');
} catch (e) {
  console.error('\nBrowser smoke test FAILED:', e.message); process.exitCode = 1;
} finally { await b.close(); server.kill(); backend.kill(); try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* ignore */ } }
