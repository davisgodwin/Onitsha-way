// v0.33 browser test: accounts + cloud saves on MySQL/MariaDB through the real game UI.
// Laptop (desktop browser) creates a life; a phone-sized browser with empty storage logs in and continues it;
// changes made on the phone come back to the laptop; everything survives a server restart.
// Needs a MySQL/MariaDB server on 127.0.0.1:3306 (root, no password — XAMPP defaults); uses a throwaway database.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawn, execFileSync } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const mysql = (await import('mysql2/promise')).default;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [], errors = []; const check = (n, ok) => { if (!ok) throw Error(n); checks.push(n); console.log('PASS', n); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ow33-e2e-')), database = `ow_e2e_${process.pid}`;
const env = { ...process.env, DATA_DIR: tmp, MYSQL_DATABASE: database, HOST: '127.0.0.1', PORT: '8787' };
let server, vite, browser, db;
const startServer = async () => { server = spawn(process.execPath, ['server/service.mjs'], { env, stdio: ['ignore', 'pipe', 'inherit'] }); let out = ''; server.stdout.on('data', (b) => { out += b; }); for (let i = 0; i < 100; i++) { try { const h = await (await fetch('http://127.0.0.1:8787/api/health')).json(); if (h.ok) return { h, out }; } catch {} await sleep(150); } throw Error('server did not start'); };
fs.mkdirSync('.qa', { recursive: true });
try {
  console.log(execFileSync(process.execPath, ['scripts/db.mjs', 'setup'], { env, encoding: 'utf8' }).trim().split('\n').slice(-3).join('\n'));
  let { h } = await startServer();
  check('server runs on MySQL after npm run db:setup', h.database.driver === 'mysql' && h.database.ok && h.database.database === database);
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5173/')).ok) break; } catch {} await sleep(200); }
  db = await mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'root', password: '', database });
  browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const settings = () => { localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: true })); window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); };
  const laptopCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await laptopCtx.addInitScript(settings);
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await phoneCtx.addInitScript(settings);
  const watch = (p) => { p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message)); return p; };
  const laptop = watch(await laptopCtx.newPage()), phone = watch(await phoneCtx.newPage());
  const sync = async (p) => { await p.evaluate(() => { __game.pause?.(); __game.openSettings(); }); await p.locator('[data-slot=cloud-sync]').waitFor({ state: 'visible' }); await p.locator('[data-slot=cloud-sync]').dispatchEvent('click'); await p.waitForFunction(() => /Saved to your account at/.test(document.querySelector('[data-slot=cloud-status]').textContent)).catch(async (e) => { throw Error(e.message + ' · status: ' + await p.locator('[data-slot=cloud-status]').textContent()); }); const t = await p.locator('[data-slot=cloud-status]').textContent(); await p.evaluate(() => { __game.ui.show('settings', false); __game.resume?.(); }); return t; };
  const row = async () => (await db.query('SELECT character_name, rev, size FROM game_saves'))[0];

  // 1. Laptop: new account through the normal signup screen, make a character, earn some money
  await laptop.goto('http://127.0.0.1:5173/');
  await laptop.getByRole('form', { name: 'Create player account', exact: true }).waitFor(); // signup is shown first
  await laptop.getByLabel('Display name', { exact: true }).fill('Ada Cloud'); await laptop.getByLabel('Username', { exact: true }).fill('ada_cloud');
  await laptop.getByLabel('Password', { exact: true }).fill('cloud-e2e-password'); await laptop.getByLabel('I am 18 or older.', { exact: false }).check();
  await laptop.getByRole('button', { name: 'Create account & continue →', exact: true }).click();
  await laptop.waitForFunction(() => window.__game?.state === 'creator', null, { timeout: 300000 });
  check('a new account with no save anywhere opens character creation', true);
  const [[acct]] = await db.query("SELECT id, username FROM users WHERE username='ada_cloud'"); check('the account is a row in MySQL', !!acct);
  await laptop.evaluate(() => { __game.touch = true; __game.startFromCreator(); });
  await laptop.waitForFunction(() => __game.state === 'playing');
  const name = await laptop.evaluate(() => __game.saveData.character.name);
  const balance = await laptop.evaluate(() => { __game.economy.transact({ key: 'e2e-cloud-gift', amount: 12345, reason: 'QA gift' }); __game.saveGame(); return __game.economy.balance; });
  let status = await sync(laptop);
  check('Settings shows the account save line after Sync now', /Saved to your account at \d/.test(status));
  let r = await row(); check('the save is in MySQL (game_saves) with the character name', r.length === 1 && r[0].character_name === name && r[0].size > 1000);
  // v0.43 server authority: the account server keeps the books, and corrects money edited into the save
  await laptop.evaluate(() => __game.authority.sync()); await laptop.waitForFunction(() => __game.saveData.authority?.opened === String(__game.saveData.createdAt), null, { timeout: 60000 });
  let ab = null; for (let i = 0; i < 40 && ab !== balance; i++) { const [rows] = await db.query('SELECT data FROM authority WHERE user_id=?', [acct.id]); ab = rows[0] ? JSON.parse(rows[0].data).ledgers.wallet.balance : null; if (ab !== balance) await new Promise((r) => setTimeout(r, 500)); }
  check('the account server keeps the books (its row in MySQL matches the wallet)', ab === balance, `${ab} vs ${balance}`);
  const fixed = await laptop.evaluate(async () => { __game.saveData.wallet.balance = 999999999; await __game.authority.sync(); return __game.economy.balance; });
  check('money edited into the save is corrected by the account server', fixed === balance, String(fixed));
  await laptop.screenshot({ path: '.qa/cloud33-laptop.png' });

  // 2. Phone: empty browser storage, log in → straight into the same life (no character creator)
  await phone.goto('http://127.0.0.1:5173/');
  await phone.getByRole('button', { name: 'Log in', exact: true }).first().click();
  await phone.getByLabel('Username', { exact: true }).fill('ada_cloud'); await phone.getByLabel('Password', { exact: true }).fill('cloud-e2e-password');
  await phone.getByRole('button', { name: 'Log in & continue →', exact: true }).click();
  await phone.waitForFunction(() => window.__game && ['playing', 'creator'].includes(__game.state), null, { timeout: 300000 });
  check('phone skips character creation — the save came from the account', await phone.evaluate(() => __game.state === 'playing'));
  check('same character and the money earned on the laptop', await phone.evaluate(([n, b]) => __game.saveData.character.name === n && __game.economy.balance === b, [name, balance]));
  check('phone was told where the save came from', await phone.evaluate(() => window.__toasts.some((t) => /loaded from your account/.test(t))));
  await phone.screenshot({ path: '.qa/cloud33-phone.png' });
  const phoneBalance = await phone.evaluate(() => { __game.economy.transact({ key: 'e2e-cloud-spend', amount: -2000, reason: 'QA spend' }); __game.saveGame(); return __game.economy.balance; });
  await sync(phone);
  await phone.evaluate(() => __game.openSettings()); await phone.screenshot({ path: '.qa/cloud33-phone-settings.png' });
  check('the account line fits on a phone without sideways scrolling', await phone.evaluate(() => { const el = document.querySelector('[data-slot=cloud-save]'); const b = el.getBoundingClientRect(); return b.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth; }));
  await phone.evaluate(() => __game.ui.show('settings', false));

  // 3. The phone took over the account's live connection: the laptop tab steps aside instead of overwriting the phone
  await laptop.waitForFunction(() => document.querySelector('[data-slot=cloud-status]')?.dataset.state === 'elsewhere', null, { timeout: 120000 });
  check('laptop tab stops uploading once the account is opened on the phone', true);
  check('…and says so', await laptop.evaluate(() => window.__toasts.some((t) => /opened on another device/.test(t))));
  await laptop.evaluate(() => { __game.economy.transact({ key: 'e2e-cloud-late', amount: 1, reason: 'late autosave' }); __game.saveGame(); });
  // Laptop reloads (still logged in): it picks up the phone's progress, not its own later autosave
  await laptop.reload(); await laptop.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 300000 });
  check('laptop continues with the phone\'s newer game', await laptop.evaluate((b) => __game.economy.balance === b, phoneBalance));

  // 4. Restart the account server: accounts, logins and saves come back from MySQL
  server.kill('SIGTERM'); await new Promise((res) => server.once('exit', res));
  ({ h } = await startServer());
  await phoneCtx.clearCookies(); await phone.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('onitshaway:account:')) localStorage.removeItem(k); sessionStorage.clear(); });
  await phone.goto('http://127.0.0.1:5173/');
  await phone.getByRole('button', { name: 'Log in', exact: true }).first().click();
  await phone.getByLabel('Username', { exact: true }).fill('ada_cloud'); await phone.getByLabel('Password', { exact: true }).fill('cloud-e2e-password');
  await phone.getByRole('button', { name: 'Log in & continue →', exact: true }).click();
  await phone.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 300000 });
  check('after a server restart and a wiped phone, logging in restores the same game', await phone.evaluate((b) => __game.economy.balance === b, phoneBalance));
  check('no page errors', errors.length === 0);
  console.log(`\n${checks.length} checks passed`);
} catch (e) { console.error('FAIL', e.message, errors.slice(0, 5)); process.exitCode = 1; }
finally {
  await browser?.close().catch(() => {}); server?.kill(); vite?.kill();
  if (db) { await db.query(`DROP DATABASE IF EXISTS \`${database}\``).catch(() => {}); await db.end(); }
}
