// v0.35: https LAN play, other players' vehicles, voice chat on phones, mobile text — PC (localhost) + phone (network address).
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [], errors = []; const check = (n, ok) => { if (!ok) throw Error(n); checks.push(n); console.log('PASS', n); };
const ip = Object.values(os.networkInterfaces()).flat().find((a) => a && !a.internal && (a.family === 'IPv4' || a.family === 4))?.address;
if (!ip) { console.log('SKIP: no network address'); process.exit(0); }
const port = 5180, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ow35-e2e-')), shots = process.env.SHOTS || '.qa/v35';
fs.mkdirSync(shots, { recursive: true });
let lan, browser, out = '';
try {
  lan = spawn(process.execPath, ['scripts/lan.mjs', '--no-build', '--port', String(port)], { env: { ...process.env, DATA_DIR: tmp, OW_LAN_EXTRA_NETS: `${ip}/32` }, stdio: ['ignore', 'pipe', 'pipe'] });
  lan.stdout.on('data', (b) => { out += b; }); lan.stderr.on('data', (b) => { out += b; });
  for (let i = 0; i < 200 && !/JOIN CODE/.test(out); i++) await sleep(150);
  const code = /JOIN CODE[^:]*:\s+([A-Z0-9]{6})/.exec(out)?.[1];
  check('npm run lan serves https and prints the https address', out.includes(`https://${ip}:${port}`) && !!code);
  const r = await fetch(`http://${ip}:${port}/somewhere?x=1`, { redirect: 'manual' });
  check('typing the address without https:// redirects to https', r.status === 301 && r.headers.get('location') === `https://${ip}:${port}/somewhere?x=1`);

  browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-proxy-server', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const init = () => { localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: true })); window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); };
  // the certificate is made by this computer, so the test browser accepts it the way a player taps "Proceed"
  const pcCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true, permissions: ['microphone'] }); await pcCtx.addInitScript(init);
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, ignoreHTTPSErrors: true, permissions: ['microphone'] }); await phoneCtx.addInitScript(init);
  const watch = (p) => { p.setDefaultTimeout(300000); p.on('pageerror', (e) => errors.push(e.message)); return p; };
  const pc = watch(await pcCtx.newPage()), phone = watch(await phoneCtx.newPage());
  const signup = async (p, user, name, join) => {
    await p.getByRole('form', { name: 'Create player account', exact: true }).waitFor();
    await p.getByLabel('Display name', { exact: true }).fill(name); await p.getByLabel('Username', { exact: true }).fill(user);
    await p.getByLabel('Password', { exact: true }).fill('lan-e2e-password'); if (join) await p.getByLabel('Join code', { exact: true }).fill(join);
    await p.getByLabel('I am 18 or older.', { exact: false }).check();
    await p.getByRole('button', { name: 'Create account & continue →', exact: true }).click();
    await p.waitForFunction(() => window.__game?.state === 'creator', null, { timeout: 300000 });
    await p.evaluate(() => { __game.touch = matchMedia('(pointer: coarse)').matches; __game.startFromCreator(); });
    await p.waitForFunction(() => __game.state === 'playing' && __game.online.connected && !!__game.online.data);
  };
  await pc.goto(`https://localhost:${port}/`); await signup(pc, 'host_ada', 'Ada Host');
  await pc.evaluate(() => __game.renderer.renderer.setAnimationLoop(null));
  await phone.goto(`http://${ip}:${port}/`);
  check('the phone ends up on the https page, which allows the microphone', await phone.evaluate(() => location.protocol === 'https:' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia));
  await signup(phone, 'phone_obi', 'Obi Phone', code);
  await pc.evaluate(() => { __game.renderer.renderer.setPixelRatio(0.6); __game.renderer.renderer.setAnimationLoop(() => __game.frame()); });
  // stand next to each other
  await pc.evaluate(() => { const g = __game, p = g.player.position; window.__spot = { x: p.x, z: p.z }; });
  const spot = await pc.evaluate(() => window.__spot);
  await phone.evaluate((s) => { __game.player.teleport(s.x + 6, s.z + 6); }, spot);
  await phone.waitForFunction(() => __game.online.players.some((p) => p.username === 'host_ada'), null, { timeout: 180000 });
  await pc.waitForFunction(() => __game.online.players.some((p) => p.username === 'phone_obi'), null, { timeout: 180000 });
  check('PC and phone see each other over https', true);

  // ---------- vehicles: the PC player drives one of the models added in v0.25
  const model = await pc.evaluate((s) => {
    const g = __game, old = ['keke', 'sedan', 'executive', 'suv', 'mercedes_c300', 'mercedes_g63', 'lexus_es350', 'lexus_rx350', 'bmw_330i', 'bmw_x5', 'toyota_camry', 'toyota_rav4'];
    g.economy.transact({ key: 'qa-car-funds', amount: 90000000, reason: 'QA' });
    const sp = g.vehicles.sys.forSale().find((x) => !old.includes(x.model) && x.model !== 'motorcycle') ?? g.vehicles.sys.forSale()[0];
    const r = g.vehicles.sys.buy(sp.id); g.vehicles.addOwned(r.vehicle); const v = r.vehicle; v.x = s.x + 4; v.z = s.z; v.fuel = 30;
    g.player.teleport(v.x + 3, v.z); g.vehicles._doorReady = true; g.vehicles.startDriving(v); g.vehicles._doorReady = false; g.vehicles.update(0.01, g.input); g.online.sendPresence(); return v.model;
  }, spot);
  await phone.waitForFunction(() => { const p = __game.online.players.find((x) => x.username === 'host_ada'); return p?.vehicle && [...__game.online.remote.values()].some((r) => r.car?.visible); }, null, { timeout: 120000 });
  const seen = await phone.evaluate(() => { const o = __game.online, p = o.players.find((x) => x.username === 'host_ada'), r = o.remote.get(p.id); const d = r.h.group.position.distanceTo(r.car.position); return { model: p.vehicle.model, d, carAt: Math.hypot(r.car.position.x - p.x, r.car.position.z - p.z) }; });
  check(`the phone sees the PC player's ${model} (a v0.25 model the server used to drop)`, seen.model === model);
  check('…with the driver sitting in it, not floating', seen.d < 2.5 && seen.carAt < 3);
  // drive a little: the car moves on the phone too
  const before = await phone.evaluate(() => { const o = __game.online, p = o.players.find((x) => x.username === 'host_ada'); return o.remote.get(p.id).car.position.clone(); });
  await pc.evaluate(() => { const v = __game.vehicles.driving; v.x += 12; __game.vehicles.car && (__game.vehicles.car.x = v.x); __game.online.sendPresence(); });
  await phone.waitForFunction((b) => { const o = __game.online, p = o.players.find((x) => x.username === 'host_ada'), c = o.remote.get(p.id).car.position; return Math.hypot(c.x - b.x, c.z - b.z) > 6; }, before, { timeout: 60000 });
  check('the car moves on the phone as the PC player drives', true);
  // look at it from 9 m away (+z is south on this map; yaw 0 faces north, towards the car)
  await phone.evaluate(() => { const g = __game, o = g.online, p = o.players.find((x) => x.username === 'host_ada'); g.player.teleport(p.x - 2, p.z + 9); g.cameraRig.yaw = 0; g.cameraRig.pitch = 0.15; g.cameraRig.snapTo(g.player.position.clone().add({ x: 0, y: 2, z: 6 })); });
  await sleep(3000); await phone.screenshot({ path: `${shots}/phone-sees-car.png` });
  await pc.evaluate(() => { __game.vehicles.stopDriving({ silent: true }); __game.online.sendPresence(); });

  // ---------- voice: button, menu, hold to talk
  check('the 🎙 Voice button shows on the phone in online play', await phone.locator('.hud-voice').isVisible());
  await phone.screenshot({ path: `${shots}/phone-hud.png` });
  await phone.locator('.hud-voice').dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await phone.locator('.hud-voice').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await phone.getByText('Talk to players nearby').waitFor();
  check('tapping it opens the voice menu', true);
  await phone.screenshot({ path: `${shots}/phone-voice-menu.png` });
  await phone.getByText('Talk to players nearby').click();
  await phone.waitForFunction(() => __game.online.voice.mode === 'nearby');
  check('Nearby voice starts on the phone (microphone allowed on the https page)', true);
  await pc.locator('.hud-voice').click(); await pc.getByText('Talk to players nearby').click(); await pc.waitForFunction(() => __game.online.voice.mode === 'nearby');
  await phone.evaluate(() => { const o = __game.online, p = o.players.find((x) => x.username === 'host_ada'); __game.player.teleport(p.x + 5, p.z + 5); __game.online.sendPresence(); });
  const connected = () => [...__game.online.voice.peers.values()].some((p) => p.pc.connectionState === 'connected' && p.audio.srcObject?.getAudioTracks().length);
  await phone.waitForFunction(connected, null, { timeout: 90000 }); await pc.waitForFunction(connected, null, { timeout: 90000 });
  check('PC and phone open a direct voice connection with audio both ways', true);
  check('the phone starts muted until you hold the button', await phone.evaluate(() => __game.online.voice.stream.getAudioTracks().every((t) => !t.enabled)));
  await phone.locator('.hud-voice').dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch', isPrimary: true });
  await phone.waitForFunction(() => __game.online.voice.stream.getAudioTracks().every((t) => t.enabled) && document.querySelector('.hud-voice').dataset.state === 'talking');
  await pc.waitForFunction(() => __game.online.players.find((p) => p.username === 'phone_obi')?.talking === true, null, { timeout: 30000 });
  check('holding the button sends the phone\'s voice; the PC sees them talking', true);
  await phone.screenshot({ path: `${shots}/phone-talking.png` });
  await sleep(500);
  await phone.locator('.hud-voice').dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch', isPrimary: true });
  await phone.waitForFunction(() => __game.online.voice.stream.getAudioTracks().every((t) => !t.enabled));
  await pc.waitForFunction(() => __game.online.players.find((p) => p.username === 'phone_obi')?.talking === false, null, { timeout: 30000 });
  check('letting go mutes it again', true);
  check('a long hold doesn\'t open the menu', await phone.evaluate(() => __game.state !== 'overlay'));
  // PC: hold V
  await pc.keyboard.down('v'); await pc.waitForFunction(() => __game.online.voice.stream.getAudioTracks().every((t) => t.enabled)); await pc.keyboard.up('v');
  check('on the PC, holding V still talks', true);

  // ---------- screenshots of phone screens for the text review
  const snap = async (name, fn) => { await phone.evaluate(fn); await sleep(900); await phone.screenshot({ path: `${shots}/${name}.png` }); };
  await snap('phone-phone-app', () => { __game.closeChoice?.(); __game.openOverlay('phone'); });
  await snap('phone-messages', () => { __game.phone.openMessages(); });
  await snap('phone-pause', () => { __game.closeOverlay?.('phone'); __game.pause(); });
  await snap('phone-map', () => { __game.resume(); __game.openMap(); });
  await snap('phone-homes', () => { __game.closeMap(); __game.openOverlay('homes'); });
  await phone.evaluate(() => __game.closeOverlay?.('homes'));
  await phone.setViewportSize({ width: 844, height: 390 }); await sleep(1500);
  await snap('landscape-hud', () => { __game.resume?.(); });
  await snap('landscape-voice-menu', () => { __game.online.voiceButton.openMenu(); });
  await phone.evaluate(() => __game.closeChoice());
  await snap('landscape-phone-app', () => { __game.openOverlay('phone'); });
  await phone.evaluate(() => __game.closeOverlay?.('phone'));
  check('no page errors', errors.length === 0);
  console.log(`\n${checks.length} checks passed`);
} catch (e) {
  console.error('FAIL', e.message, errors.slice(0, 5), out.slice(-600)); process.exitCode = 1;
  for (const p of (browser?.contexts() ?? []).flatMap((c) => c.pages())) { console.error('DIAG', p.url(), await p.evaluate(() => ({ state: window.__game?.state, voice: window.__game?.online?.voice?.mode, peers: [...(window.__game?.online?.voice?.peers?.values() ?? [])].map((x) => x.pc.connectionState), toasts: window.__toasts?.slice(-4) })).catch((x) => x.message)); await p.screenshot({ path: `${shots}/fail-${p.url().includes('localhost') ? 'pc' : 'phone'}.png` }).catch(() => {}); }
}
finally { await browser?.close().catch(() => {}); lan?.kill('SIGINT'); await sleep(800); }
