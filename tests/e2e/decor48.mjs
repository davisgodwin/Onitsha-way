// v0.48 browser test: two players on the real server: the owner hires a friend to decorate their home online.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [], errors = []; const check = (n, ok, extra = '') => { if (!ok) throw Error(n + ' ' + extra); checks.push(n); console.log('PASS', n, extra); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ow48-decor-')), OUT = 'qa/v48'; fs.mkdirSync(OUT, { recursive: true });
const env = { ...process.env, DATA_DIR: tmp, DB_DRIVER: 'json', HOST: '127.0.0.1', PORT: '8787' };
let server, vite, browser;
try {
 server = spawn(process.execPath, ['server/service.mjs'], { env, stdio: ['ignore', 'ignore', 'inherit'] });
 for (let i = 0; i < 100; i++) { try { if ((await (await fetch('http://127.0.0.1:8787/api/health')).json()).ok) break; } catch {} await sleep(200); }
 vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
 for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5173/')).ok) break; } catch {} await sleep(200); }
 browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
 const settings = () => { localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: true, hints: false })); window.__toasts = []; addEventListener('DOMContentLoaded', () => new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document.body, { childList: true, subtree: true })); };
 const player = async (name, username) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(settings); const p = await ctx.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await p.goto('http://127.0.0.1:5173/'); await p.getByRole('form', { name: 'Create player account', exact: true }).waitFor();
  await p.getByLabel('Display name', { exact: true }).fill(name); await p.getByLabel('Username', { exact: true }).fill(username); await p.getByLabel('Password', { exact: true }).fill('together-e2e-password'); await p.getByLabel('I am 18 or older.', { exact: false }).check();
  await p.getByRole('button', { name: 'Create account & continue →', exact: true }).click(); await p.waitForFunction(() => window.__game?.state === 'creator', null, { timeout: 300000 });
  await p.evaluate(() => { __game.touch = true; __game.startFromCreator(); }); await p.waitForFunction(() => __game.state === 'playing');
  await p.waitForFunction(() => __game.online?.connected && __game.saveData.authority?.opened === String(__game.saveData.createdAt), null, { timeout: 120000 }).catch(async () => { await p.evaluate(() => __game.authority.sync()); });
  await p.evaluate(() => { __game.economy.transact({ key: 'e2e-start', amount: 20000, reason: 'Job: errand for a trader' }); return __game.authority.sync(); });
  return p;
 };

 const ada = await player('Ada Home', 'ada_home'), obi = await player('Obi Decor', 'obi_decor');
 // friends
 await ada.waitForFunction(() => __game.online.players?.length > 0, null, { timeout: 60000 });
 await ada.evaluate(async () => { const o = __game.online; await o.request('request', { target: o.players[0].id, kind: 'friend' }); });
 await obi.waitForFunction(() => __game.online.data.requests.some((r) => r.kind === 'friend' && r.to === __game.online.me.id));
 await obi.evaluate(() => __game.online.request('respond', { id: __game.online.data.requests.find((r) => r.kind === 'friend').id, accept: true }));
 await ada.waitForFunction(() => __game.online.data.friends.length === 1, null, { timeout: 30000 });
 // Ada rents a home and goes in
 const home = await ada.evaluate(() => { const g = __game; g.economy.transact({ key: 'qa48-decor-funds', amount: 600000, reason: 'Job: errand for a trader' }); const h = g.homes.listings.find((x) => x.type === 'selfcon' || x.type === 'duplex'); g.homes.housing.rent(h.id); g.homes.enter(h, { fade: false }); g.online.sendPresence(); return { id: h.id, pieces: (g.homeUpgrades.home(h.id).pieces ?? []).length }; });
 await sleep(500);
 // the job offer, from Messages → Hire to decorate (budget and fee chosen in the offer)
 await ada.evaluate(() => { const g = __game, o = g.online; g.openChoice(() => o.decorJobs.hireView({ id: o.data.friends[0].id, username: 'obi_decor' })); });
 await ada.getByRole('button', { name: /Send the job offer/ }).click();
 await obi.waitForFunction(() => __game.online.data.requests.some((r) => r.kind === 'decorate' && r.to === __game.online.me.id), null, { timeout: 30000 });
 const offer = await obi.evaluate(() => __game.online.data.requests.find((r) => r.kind === 'decorate'));
 check('Obi gets the job offer with a budget and a fee', offer.budget === 150000 && offer.fee === 15000, JSON.stringify({ b: offer.budget, f: offer.fee }));
 await obi.evaluate(() => __game.online.request('respond', { id: __game.online.data.requests.find((r) => r.kind === 'decorate').id, accept: true }));
 await obi.waitForFunction(() => !!__game.online.decorJobs.job && !!__game.homes.inside, null, { timeout: 60000 });
 await ada.waitForFunction(() => !!__game.online.decorJobs.hosting, null, { timeout: 30000 });
 check('Obi accepts and arrives inside Ada\'s home; Ada is told', true);
 const label = await obi.evaluate(() => { const g = __game, i = g.homes.inside, x = i.layout.origin.x + i.layout.size[0] / 2, z = i.layout.origin.z + i.layout.size[1] / 2; return g.interactions.update(x, z); });
 check('in the middle of the room: "Decorating for Ada Home · ₦150,000 left"', /Decorating for Ada Home/.test(String(label)), String(label));
 // Obi picks a sofa and a rug and sends the suggestion
 await obi.evaluate(() => { const g = __game; g.openChoice(() => g.online.decorJobs.jobView()); }); await obi.waitForTimeout(300); await obi.screenshot({ path: `${OUT}/decor-job.png` });
 const dump = async (why) => { await obi.screenshot({ path: `${OUT}/decor-fail.png` }); return why + ' ' + JSON.stringify(await obi.evaluate(() => ({ state: __game.state, overlay: __game.overlay, inside: !!__game.homes.inside, guest: __game.online.guestHost, job: !!__game.online.decorJobs.job, buttons: [...document.querySelectorAll('#screen-choice button')].map((b) => b.textContent).slice(0, 30) }))); };
 const tap = async (name) => { const b = obi.getByRole('button', { name }).first(); await b.waitFor({ timeout: 60000 }).catch(async () => { throw Error(await dump('no button ' + name)); }); await b.click(); await obi.waitForTimeout(300); };
 await tap(/Living room/); await tap(/Two-seater sofa/); await tap(/^Back$/);
 await tap(/Rugs & curtains/); await tap(/Living room rug/); await tap(/^Back$/);
 await tap(/Send suggestion \(2\)/);
 await ada.waitForFunction(() => /Obi Decor suggests/.test(document.querySelector('#screen-choice')?.innerText ?? ''), null, { timeout: 30000 });
 await ada.screenshot({ path: `${OUT}/decor-proposal.png` });
 const bal0 = await ada.evaluate(() => __game.economy.balance);
 await ada.getByRole('button', { name: /Accept and pay/ }).click(); await sleep(800);
 const after = await ada.evaluate((id) => ({ bal: __game.economy.balance, pieces: __game.homeUpgrades.home(id).pieces.length, placed: __game.homeUpgrades.home(id).pieces.filter((p) => p.x != null || p.placed || p.floor).length }), home.id);
 check('Ada accepts: the pieces are bought from Ada\'s money and placed in her home', after.bal < bal0 && after.pieces >= home.pieces + 2, JSON.stringify({ bal0, ...after }));
 await obi.waitForFunction(() => __game.online.decorJobs.job.left < 150000, null, { timeout: 30000 });
 const seen = await obi.waitForFunction((n) => (__game.online.hostDecor?.pieces?.length ?? __game.online.hostDecor?.length ?? 0) >= n, home.pieces + 2, { timeout: 30000 }).then(() => true).catch(() => false);
 check('Obi sees the budget go down and the furniture appear', seen, String(seen));
 // finish and get paid
 const obiBal0 = await obi.evaluate(() => __game.economy.balance);
 await obi.evaluate(() => __game.online.request('decorFinish'));
 await ada.waitForFunction(() => /has finished/.test(document.querySelector('#screen-choice')?.innerText ?? ''), null, { timeout: 30000 });
 await ada.getByRole('button', { name: /Pay Obi Decor ₦15,000/ }).click(); await sleep(1500); await obi.evaluate(() => __game.authority.sync()); await sleep(500);
 const obiBal1 = await obi.evaluate(() => __game.economy.balance);
 check('Obi finishes; Ada pays the ₦15,000 fee and Obi receives it', obiBal1 === obiBal0 + 15000, JSON.stringify({ obiBal0, obiBal1 }));
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`decor48: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await browser?.close(); vite?.kill(); server?.kill(); fs.rmSync(tmp, { recursive: true, force: true }); }
