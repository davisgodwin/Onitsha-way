// v0.51 browser test: pay for a billboard ad with Paystack (TEST mode) through the phone's Business ads app, against a
// fake Paystack on this machine (the real API and js.paystack.co can't be reached from the test machine). Because the
// popup script can't load here, the game falls back to opening the Paystack page in a new tab, as it would offline.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http'; import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [], errors = []; const check = (n, ok, extra = '') => { if (!ok) throw Error(n + ' ' + extra); checks.push(n); console.log('PASS', n, extra); };
const OUT = 'qa/v51'; fs.mkdirSync(OUT, { recursive: true });
const SK = 'sk_test_' + 'c'.repeat(40), PK = 'pk_test_' + 'd'.repeat(40);
const FLYER = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=';
// fake Paystack
const txs = new Map(); let paid = false;
const fake = http.createServer(async (req, res) => { const json = (c, v) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(v)); };
 if (req.headers.authorization !== 'Bearer ' + SK) return json(401, { status: false, message: 'Invalid key' });
 if (req.url === '/transaction/initialize') { let b = ''; for await (const c of req) b += c; const d = JSON.parse(b); txs.set(d.reference, d); return json(200, { status: true, data: { authorization_url: 'http://127.0.0.1:5173/?fake-paystack=' + d.reference, access_code: 'AC' + d.reference, reference: d.reference } }); }
 const m = /^\/transaction\/verify\/(.+)$/.exec(req.url); if (m) { const d = txs.get(decodeURIComponent(m[1])); return json(200, { status: true, data: { id: 7, status: paid ? 'success' : 'abandoned', reference: decodeURIComponent(m[1]), amount: d.amount, currency: 'NGN', channel: 'card', domain: 'test' } }); }
 json(404, { status: false }); });
await new Promise((r) => fake.listen(0, '127.0.0.1', r));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ow51-e2e-'));
const env = { ...process.env, DATA_DIR: tmp, DB_DRIVER: 'json', HOST: '127.0.0.1', PORT: '8787', PAYSTACK_SECRET_KEY: SK, PAYSTACK_PUBLIC_KEY: PK, PAYSTACK_API_BASE: `http://127.0.0.1:${fake.address().port}` };
let server, vite, browser;
try {
 server = spawn(process.execPath, ['server/service.mjs'], { env, stdio: ['ignore', 'pipe', 'inherit'] }); let log = ''; server.stdout.on('data', (d) => log += d);
 for (let i = 0; i < 100; i++) { try { if ((await (await fetch('http://127.0.0.1:8787/api/health')).json()).ok) break; } catch {} await sleep(200); }
 const health = await (await fetch('http://127.0.0.1:8787/api/health')).json();
 check('the server says Paystack is on, in test mode', health.paystack?.enabled === true && health.paystack.mode === 'test' && /Paystack: on \(test keys\)/.test(log), JSON.stringify(health.paystack));
 vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
 for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5173/')).ok) break; } catch {} await sleep(200); }
 browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
 const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(() => localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: true, hints: false })));
 const p = await ctx.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message));
 await p.goto('http://127.0.0.1:5173/'); await p.getByRole('form', { name: 'Create player account', exact: true }).waitFor();
 await p.getByLabel('Display name', { exact: true }).fill('Ada Pay'); await p.getByLabel('Username', { exact: true }).fill('ada_pay'); await p.getByLabel('Password', { exact: true }).fill('paystack-e2e-password'); await p.getByLabel('I am 18 or older.', { exact: false }).check();
 await p.getByRole('button', { name: 'Create account & continue →', exact: true }).click(); await p.waitForFunction(() => window.__game?.state === 'creator', null, { timeout: 300000 });
 await p.evaluate(() => { __game.touch = true; __game.startFromCreator(); }); await p.waitForFunction(() => __game.state === 'playing'); await p.waitForFunction(() => __game.online?.connected && __game.online.data, null, { timeout: 120000 });
 check('the game gets the public key only (never the secret)', await p.evaluate((sk) => __game.online.data.paystack?.publicKey?.startsWith('pk_test_') && !JSON.stringify(__game.online.data).includes(sk), SK));
 // an order, made through the server (the flyer upload UI is covered by earlier tests), then pay in the phone's ads app
 await p.evaluate(async (img) => { const o = __game.online; await o.request('adCreate', { area: 'main-market', slots: 2, image: 'data:image/png;base64,' + img, key: 'e2e-paystack-order-1' }); }, FLYER);
 await p.evaluate(() => __game.online.panel.open('ads')); await p.waitForTimeout(800);
 const payBtn = p.getByRole('button', { name: /Pay ₦6,000 with Paystack \(test\)/ });
 check('the order shows "Pay ₦6,000 with Paystack (test)", an email box and the test-card hint', await payBtn.count() === 1 && await p.getByLabel('Email for the Paystack receipt').count() === 1 && await p.getByText(/Paystack TEST mode/).count() >= 1);
 check('no "simulate payment" button while Paystack is on', await p.getByRole('button', { name: /Simulate successful payment/ }).count() === 0);
 await p.screenshot({ path: `${OUT}/ads-pay-button.png` });
 await payBtn.click(); await p.waitForTimeout(500);
 check('a bad email is refused before anything is sent', txs.size === 0);
 await p.getByLabel('Email for the Paystack receipt').fill('ada@example.com');
 const popup = ctx.waitForEvent('page', { timeout: 40000 });
 await p.getByRole('button', { name: /Pay ₦6,000 with Paystack \(test\)/ }).click();
 const tab = await popup; const ref = [...txs.keys()][0], sent = txs.get(ref);
 check('Paystack is asked for ₦6,000 (600,000 kobo, NGN) for that email, and the payment page opens', sent?.amount === 600000 && sent.currency === 'NGN' && sent.email === 'ada@example.com' && tab.url().includes('fake-paystack=' + ref), JSON.stringify({ sent, url: tab.url() }));
 await tab.close(); await p.waitForTimeout(1500);
 await p.getByRole('button', { name: 'I have paid — check' }).click(); await p.waitForTimeout(1500);
 check('"I have paid — check" before paying: still waiting', await p.evaluate(() => __game.online.data.campaigns[0].status === 'awaiting_test_payment'));
 paid = true; await p.getByRole('button', { name: 'I have paid — check' }).click();
 await p.waitForFunction(() => __game.online.data.campaigns[0]?.status === 'active', null, { timeout: 20000 });
 check('after paying, the server checks with Paystack and the flyer goes live', true);
 await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/ads-paid.png` });
 // returning from the Paystack page (callback URL with ?ow_ad=…) checks the order by itself
 const second = await p.evaluate(async (img) => { const o = __game.online; const r = await o.request('adCreate', { area: 'shoprite', slots: 1, image: 'data:image/png;base64,' + img, key: 'e2e-paystack-order-2' }); const s = await o.request('adPayStart', { id: r.ad.id, email: 'ada@example.com', returnUrl: location.href }); return { id: r.ad.id, ref: s.reference }; }, FLYER);
 const back = new URL(txs.get(second.ref).callback_url); back.searchParams.set('reference', second.ref);
 await p.goto(back.href); await p.waitForFunction(() => window.__game && ['menu', 'playing'].includes(__game.state), null, { timeout: 300000 });
 await p.evaluate(() => { if (__game.state === 'menu') __game.continueGame(); }); await p.waitForFunction(() => __game.state === 'playing' && __game.online?.connected, null, { timeout: 300000 });
 await p.waitForFunction((id) => __game.online?.data?.campaigns?.find((c) => c.id === id)?.status === 'active', second.id, { timeout: 120000 });
 check('coming back from the Paystack page checks the payment and tidies the address bar', !/ow_ad|reference/.test(await p.evaluate(() => location.search)));
 check('no page errors', errors.length === 0, JSON.stringify(errors.slice(0, 3)));
 console.log(`\npaystack51: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.log('ERRORS', JSON.stringify(errors.slice(0, 5))); process.exitCode = 1; }
finally { await browser?.close(); server?.kill(); vite?.kill(); fake.close(); }
