// v0.44 browser test: two players on the real server (JSON storage) meet in the street: the meet menu, a payment,
// a pickpocket attempt with the victim told and able to report it, peace mode from the phone, and safe areas.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [], errors = []; const check = (n, ok, extra = '') => { if (!ok) throw Error(n + ' ' + extra); checks.push(n); console.log('PASS', n, extra); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ow44-e2e-')), OUT = 'qa/v44'; fs.mkdirSync(OUT, { recursive: true });
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
 const ada = await player('Ada Street', 'ada_street'), obi = await player('Obi Street', 'obi_street');
 // a quiet street away from police, hospitals, banks and the court
 const spot = await ada.evaluate(() => { const g = __game; for (let r = 150; r < 2000; r += 60) for (let a = 0; a < 12; a++) { const x = g.spawn.x + Math.cos(a) * r, z = g.spawn.z + Math.sin(a) * r; g.player.teleport(x, z); if (!g.together.safe() && g.world.collision.isFree(x, z, 0.6) && g.world.collision.isFree(x + 1, z, 0.6)) return { x, z }; } return null; });
 check('a quiet street that is not a safe area', !!spot, JSON.stringify(spot));
 await obi.evaluate(({ x, z }) => { __game.player.teleport(x + 1, z); __game.online.sendPresence(); }, spot); await ada.evaluate(({ x, z }) => { __game.player.teleport(x, z); __game.online.sendPresence(); }, spot);
 await ada.waitForFunction(() => !!__game.together.nearest(), null, { timeout: 60000 });
 const label = await ada.evaluate(() => { const g = __game, p = g.player.position; return g.interactions.update(p.x, p.z); });
 check('walk up to another player: "Obi Street — meet"', /Obi Street — meet/.test(String(label)), String(label));
 await ada.evaluate(() => { const g = __game; g.openChoice(() => g.together.view(g.together.nearest())); }); await ada.waitForTimeout(400); await ada.screenshot({ path: `${OUT}/meet-player.png` });
 const opts = await ada.evaluate(() => [...document.querySelectorAll('#screen-choice button')].map((b) => b.textContent));
 check('the meet menu: give money, message, the crime options, report', opts.some((t) => /Give Obi Street ₦1,000/.test(t)) && opts.some((t) => /Pick their pocket/.test(t)) && opts.some((t) => /Report this player/.test(t)), opts.join(' | ').slice(0, 200));
 // a payment
 const obi0 = await obi.evaluate(() => __game.economy.balance);
 await ada.getByRole('button', { name: /Give Obi Street ₦1,000/ }).click(); await sleep(1500); await obi.evaluate(() => __game.authority.sync());
 const obi1 = await obi.evaluate(() => ({ bal: __game.economy.balance, last: __game.saveData.wallet.ledger.at(-1)?.reason }));
 check('Ada gives Obi ₦1,000: it arrives as "From Ada Street"', obi1.bal === obi0 + 1000 && /From Ada Street/.test(obi1.last), JSON.stringify({ obi0, ...obi1 }));
 // a pickpocket attempt
 await ada.evaluate(() => { const g = __game; g.openChoice(() => g.together.view(g.together.nearest())); }); await ada.waitForTimeout(300);
 await ada.getByRole('button', { name: /Pick their pocket/ }).click(); await ada.getByRole('button', { name: /Do it/ }).click(); await ada.waitForFunction(() => /You got it|Empty pockets|It went wrong/.test(document.querySelector('#screen-choice:not([hidden])')?.innerText ?? ''), null, { timeout: 20000 }).catch(() => {}); // v0.51: wait for the server's answer (a fixed 1.5 s was too short on a busy machine)
 const result = await ada.evaluate(() => ({ toasts: window.__toasts.slice(-3), text: document.querySelector('#screen-choice')?.innerText ?? '', case: __game.justice.j.cases.find((c) => /from a person/.test(c.offence)) }));
 check('the attempt is decided by the server; a police case opens against Ada', /You got it|Empty pockets|It went wrong/.test(result.text) && !!result.case, result.text.slice(0, 80) + ' ' + JSON.stringify(result.toasts));
 await obi.waitForFunction(() => /You were robbed|Someone tried to rob you/.test(document.querySelector('#screen-choice')?.innerText ?? ''), null, { timeout: 30000 });
 await obi.screenshot({ path: `${OUT}/robbed.png` });
 check('Obi is told who it was', await obi.evaluate(() => /Ada Street/.test(document.querySelector('#screen-choice').innerText)));
 const ev0 = result.case.evidence;
 await obi.getByRole('button', { name: /Report it to the police/ }).click();
 await ada.waitForFunction((ev0) => (__game.justice.j.cases.find((c) => /from a person/.test(c.offence))?.evidence ?? 0) > ev0 || __game.justice.cases.wanted(), ev0, { timeout: 30000 });
 check('Obi reports it: the police case against Ada gets stronger', true);
 // peace mode from the phone, safe areas
 await obi.evaluate(() => { __game.closeChoice(); __game.openOverlay('phone'); __game.together.status = null; __game.phone.render('law'); });
 await obi.waitForFunction(() => /Peace mode is (on|off)/.test(document.querySelector('#phone-content')?.innerText ?? ''), null, { timeout: 30000 });
 await obi.getByRole('button', { name: /Peace mode is off/ }).click(); await obi.waitForFunction(() => /Peace mode is on/.test(document.querySelector('#phone-content')?.innerText ?? ''), null, { timeout: 30000 });
 await obi.screenshot({ path: `${OUT}/phone-peace.png` });
 const peace = await ada.evaluate(async () => { try { await __game.together.req('pvpCrime', { target: __game.together.nearest()?.id, kind: 'rob' }); return 'allowed'; } catch (e) { return e.message; } });
 check('Obi in peace mode can\'t be targeted (or the cooldown holds)', /peace mode|Wait a few minutes|targeted a short while ago/.test(peace), peace);
 const safe = await ada.evaluate(() => { const g = __game, post = g.police.posts[0]; g.player.teleport(post.x + 5, post.z); return { safe: g.together.safe(), view: g.together.view({ id: 'x', name: 'X' }).options.filter((o) => /Pick their pocket|Rob them/.test(o.label)).every((o) => o.disabled) }; });
 check('near the police it is a safe area: the crime options are off', safe.safe && safe.view, JSON.stringify(safe));
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`together44: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; }
finally { await browser?.close(); server?.kill(); vite?.kill(); }
