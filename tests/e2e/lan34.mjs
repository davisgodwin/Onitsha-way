// v0.34 browser test: npm run lan, a host PC browser (localhost) and a phone-sized browser on the network address.
// The phone page is plain http on a non-localhost address — the same "insecure context" a real phone gets.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [], errors = []; const check = (n, ok) => { if (!ok) throw Error(n); checks.push(n); console.log('PASS', n); };
const ip = Object.values(os.networkInterfaces()).flat().find((a) => a && !a.internal && (a.family === 'IPv4' || a.family === 4))?.address;
if (!ip) { console.log('SKIP: no network address on this machine'); process.exit(0); }
const port = 5180, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ow34-e2e-'));
let lan, browser, out = '';
fs.mkdirSync('.qa', { recursive: true });
try {
  lan = spawn(process.execPath, ['scripts/lan.mjs', '--no-build', '--http', '--port', String(port)], { env: { ...process.env, DATA_DIR: tmp, OW_LAN_EXTRA_NETS: `${ip}/32` }, stdio: ['ignore', 'pipe', 'pipe'] });
  lan.stdout.on('data', (b) => { out += b; }); lan.stderr.on('data', (b) => { out += b; });
  for (let i = 0; i < 200 && !/JOIN CODE/.test(out); i++) await sleep(150);
  const code = /JOIN CODE[^:]*:\s+([A-Z0-9]{6})/.exec(out)?.[1];
  check('npm run lan prints the address for phones and a join code', out.includes(`http://${ip}:${port}`) && !!code);
  check('the account server stays on 127.0.0.1 (not reachable from the network)', await fetch(`http://${ip}:8787/api/health`).then(() => false, () => true));

  browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-proxy-server'] }); // talk to the LAN address directly, as a phone would
  const init = () => { localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: true })); window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); };
  const pcCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await pcCtx.addInitScript(init);
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await phoneCtx.addInitScript(init);
  const watch = (p) => { p.setDefaultTimeout(300000); p.on('pageerror', (e) => errors.push(e.message)); return p; };
  const pc = watch(await pcCtx.newPage()), phone = watch(await phoneCtx.newPage());
  for (const p of [pc, phone]) p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 200)); });
  const signup = async (p, user, name, join) => {
    await p.getByRole('form', { name: 'Create player account', exact: true }).waitFor();
    await p.getByLabel('Display name', { exact: true }).fill(name); await p.getByLabel('Username', { exact: true }).fill(user);
    await p.getByLabel('Password', { exact: true }).fill('lan-e2e-password'); if (join) await p.getByLabel('Join code', { exact: true }).fill(join);
    await p.getByLabel('I am 18 or older.', { exact: false }).check();
    await p.getByRole('button', { name: 'Create account & continue →', exact: true }).click();
  };

  // host PC: localhost, no join code asked
  await pc.goto(`http://localhost:${port}/`);
  await pc.getByRole('form', { name: 'Create player account', exact: true }).waitFor();
  check('the host computer is not asked for a join code', await pc.getByLabel('Join code', { exact: true }).count() === 0);
  await signup(pc, 'host_ada', 'Ada Host');
  await pc.waitForFunction(() => window.__game?.state === 'creator', null, { timeout: 300000 });
  await pc.evaluate(() => { __game.touch = true; __game.startFromCreator(); });
  await pc.waitForFunction(() => __game.state === 'playing' && __game.online.connected && !!__game.online.data);
  await pc.evaluate(() => __game.renderer.renderer.setAnimationLoop(null)); // pause the PC's rendering while the phone loads (slow test machine)

  // phone on the Wi-Fi address
  await phone.goto(`http://${ip}:${port}/`);
  check('the phone page is a plain-http, non-secure page (like a real phone on LAN)', await phone.evaluate(() => location.protocol === 'http:' && !window.isSecureContext));
  await phone.getByRole('form', { name: 'Create player account', exact: true }).waitFor();
  check('the phone sees a Join code field', await phone.getByLabel('Join code', { exact: true }).isVisible());
  await phone.screenshot({ path: '.qa/lan34-phone-signup.png' });
  await signup(phone, 'phone_obi', 'Obi Phone', 'WRONG9');
  await phone.waitForFunction(() => /join code/i.test(document.querySelector('.entry-status')?.textContent ?? ''));
  check('a wrong join code is refused with a clear message', true);
  await phone.getByLabel('Join code', { exact: true }).fill(code.toLowerCase());
  await phone.getByLabel('Password', { exact: true }).fill('lan-e2e-password');
  await phone.getByRole('button', { name: 'Create account & continue →', exact: true }).click();
  await phone.waitForFunction(() => window.__game?.state === 'creator', null, { timeout: 300000 });
  check('with the right code the phone creates an account and reaches character creation', true);
  await phone.evaluate(() => { __game.touch = true; __game.startFromCreator(); });
  await phone.waitForFunction(() => __game.state === 'playing' && __game.online.connected && !!__game.online.data);
  check('the phone joins the live server over the network', true);
  await pc.evaluate(() => { __game.renderer.renderer.setPixelRatio(0.6); __game.renderer.renderer.setAnimationLoop(() => __game.frame()); });
  await phone.waitForFunction(() => __game.online.players.some((p) => p.username === 'host_ada'), null, { timeout: 180000 });
  await pc.waitForFunction(() => __game.online.players.some((p) => p.username === 'phone_obi'), null, { timeout: 180000 });
  check('PC and phone see each other in the city', true);
  const mail = await phone.evaluate(async () => { const r = await __game.online.request('mailFind', { username: '@host_ada' }); return r.peer?.username; });
  check('online actions work on the plain-http phone page (no crypto.randomUUID crash)', mail === 'host_ada');
  const sent = await phone.evaluate(async () => { const id = (await __game.online.request('mailFind', { username: '@host_ada' })).peer.id; const r = await __game.online.request('mailSend', { target: id, text: 'Nnoo from my phone!', key: crypto.randomUUID() }); return !!r.thread; });
  await pc.waitForFunction(() => (__game.online.data.mail?.threads ?? []).some((t) => t.unread > 0), null, { timeout: 60000 });
  check('a message from the phone reaches the PC', sent);
  // cloud save from the phone
  await phone.evaluate(() => { __game.pause?.(); __game.openSettings(); }); await phone.locator('[data-slot=cloud-sync]').dispatchEvent('click');
  await phone.waitForFunction(() => /Saved to your account at/.test(document.querySelector('[data-slot=cloud-status]').textContent));
  check('the phone\'s game saves to the account on the host computer', true);
  await phone.evaluate(() => __game.ui.show('settings', false));
  // voice is honest about needing https
  const voice = await phone.evaluate(async () => { try { await __game.online.voice.enable('nearby'); return 'started'; } catch (e) { return e.message; } });
  check('voice chat on the phone explains it needs https instead of failing silently', /HTTPS/i.test(voice));
  await phone.screenshot({ path: '.qa/lan34-phone-city.png' });
  check('no page errors on either device', errors.length === 0);
  console.log(`\n${checks.length} checks passed`);
} catch (e) {
  console.error('FAIL', e.message, errors.slice(0, 5), out.slice(-800)); process.exitCode = 1;
  for (const p of (browser?.contexts() ?? []).flatMap((c) => c.pages())) console.error('DIAG', p.url(), await p.evaluate(() => ({ state: window.__game?.state, connected: window.__game?.online?.connected, data: !!window.__game?.online?.data, ws: window.__game?.online?.ws?.readyState, notice: window.__game?.online?.lastNotice, toasts: window.__toasts })).catch((x) => x.message));
}
finally { await browser?.close().catch(() => {}); lan?.kill('SIGINT'); await sleep(800); }
