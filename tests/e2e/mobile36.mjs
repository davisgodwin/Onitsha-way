// v0.36 phone fixes: no ghost picks at the car stand / house door, compact car & home cards, minimisable dashboard,
// invitations that work (banner with Accept, buttons that explain), visiting and leaving through the door.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [], errors = []; const check = (n, ok) => { if (!ok) throw Error(n); checks.push(n); console.log('PASS', n); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ow36-e2e-')), shots = '.qa/v36'; fs.mkdirSync(shots, { recursive: true });
let server = spawn(process.execPath, ['server/service.mjs'], { env: { ...process.env, DATA_DIR: tmp }, stdio: 'ignore' });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:5173/api/health')).ok) break; } catch {} await sleep(200); }
  browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const init = () => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: true })); window.__toasts = []; new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent); }).observe(document, { childList: true, subtree: true }); };
  const pcCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await pcCtx.addInitScript(init);
  const phCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await phCtx.addInitScript(init);
  const watch = (p) => { p.setDefaultTimeout(180000); p.on('pageerror', (e) => errors.push(e.message)); p.on('crash', () => console.log('TEST-BROWSER CRASH (software renderer)', p.viewportSize())); return p; };
  let pc = watch(await pcCtx.newPage()), ph = watch(await phCtx.newPage());
  const enter = async (p, user) => { await p.goto('http://127.0.0.1:5173/'); await p.getByRole('form', { name: 'Create player account', exact: true }).waitFor(); await p.getByLabel('Display name', { exact: true }).fill(user); await p.getByLabel('Username', { exact: true }).fill(user); await p.getByLabel('Password', { exact: true }).fill('mobile36-password'); await p.getByLabel('I am 18 or older.', { exact: false }).check(); await p.getByRole('button', { name: 'Create account & continue →', exact: true }).click(); await p.waitForFunction(() => window.__game?.state === 'creator', null, { timeout: 300000 }); await p.evaluate(() => { __game.touch = matchMedia('(pointer: coarse)').matches; __game.startFromCreator(); }); await p.waitForFunction(() => __game.state === 'playing' && __game.online.connected && !!__game.online.data, null, { timeout: 300000 }); };
  await enter(pc, 'host_ada'); await pc.evaluate(() => __game.renderer.renderer.setAnimationLoop(null));
  // the slow software renderer in this test machine occasionally crashes a page while building the city; retry once
  try { await enter(ph, 'phone_obi'); } catch (e) { console.log('RETRY phone sign-in after:', e.message.slice(0, 80)); await ph.close().catch(() => {}); ph = watch(await phCtx.newPage()); await ph.goto('http://127.0.0.1:5173/'); await ph.getByRole('button', { name: 'Log in', exact: true }).first().click(); await ph.getByLabel('Username', { exact: true }).fill('phone_obi'); await ph.getByLabel('Password', { exact: true }).fill('mobile36-password'); await ph.getByRole('button', { name: 'Log in & continue →', exact: true }).click().catch(() => {}); await ph.waitForFunction(() => ['creator', 'playing'].includes(window.__game?.state), null, { timeout: 300000 }); await ph.evaluate(() => { __game.touch = true; if (__game.state === 'creator') __game.startFromCreator(); }); await ph.waitForFunction(() => __game.state === 'playing' && __game.online.connected && !!__game.online.data, null, { timeout: 300000 }); }
  const st = (p) => p.evaluate(() => ({ state: __game.state, title: document.querySelector('[data-slot=choice-title]')?.textContent, sheet: document.querySelector('#screen-choice').classList.contains('choice-sheet') }));
  const cdp = await phCtx.newCDPSession(ph);
  // a real thumb press: finger down on Use, the panel opens while it's still down, then the finger lifts
  const holdUse = async () => {
    const box = await ph.locator('.tbtn-interact').boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await ph.waitForFunction(() => __game.state === 'overlay', null, { timeout: 60000 }); await sleep(300);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(1500);
  };
  await ph.evaluate(() => __game.economy.transact({ key: 'qa36', amount: 60000000, reason: 'QA' }));

  // ---------- 1. car stand: nothing gets picked for you
  await ph.evaluate(() => { const g = __game, d = g.vehicles.dealerships[0]; g.player.teleport(d.desk.x, d.desk.z); });
  await ph.waitForFunction(() => !document.querySelector('.tbtn-interact').hidden);
  await holdUse(); let s = await st(ph);
  check('car stand: pressing Use opens the stand list — no vehicle is chosen for you', /Automobile|Motors|Autos|Company|Stand|Cars/i.test(s.title) && s.title === await ph.evaluate(() => __game.vehicles.dealerships[0].name));
  await ph.locator('.choice-opt').first().tap(); await sleep(1200); s = await st(ph);
  check('…and tapping a vehicle yourself still works', s.title !== await ph.evaluate(() => __game.vehicles.dealerships[0].name));
  await ph.evaluate(() => __game.closeChoice());
  // ---------- 2. house door
  await ph.evaluate(() => { const g = __game, h = g.homes.listings[0]; g.player.teleport(h.door.stand.x, h.door.stand.z); });
  await ph.waitForFunction(() => !document.querySelector('.tbtn-interact').hidden);
  const rentedBefore = await ph.evaluate(() => Object.keys(__game.saveData.housing.rentals || {}).length);
  await holdUse(); s = await st(ph);
  check('house door: pressing Use opens the house page — not "Buy …?"', !/^Buy /.test(s.title) && await ph.evaluate((n) => Object.keys(__game.saveData.housing.rentals || {}).length === n, rentedBefore));
  await ph.screenshot({ path: `${shots}/house-door.png` });
  await ph.evaluate(() => __game.closeChoice());

  // ---------- 3. compact card for your own car and your front door
  await ph.evaluate(() => { const g = __game, sp = g.vehicles.sys.forSale().find((x) => x.model === 'toyota_corolla') ?? g.vehicles.sys.forSale()[0], r = g.vehicles.sys.buy(sp.id); g.vehicles.addOwned(r.vehicle); g.player.teleport(r.vehicle.x + 2.5, r.vehicle.z); });
  await ph.waitForFunction(() => !document.querySelector('.tbtn-interact').hidden);
  await holdUse(); s = await st(ph);
  const card = await ph.evaluate(() => { const r = document.querySelector('#screen-choice .choice').getBoundingClientRect(); return { top: r.top, h: r.height, vh: innerHeight }; });
  check('your car: a compact card at the bottom, the street still visible above it', s.sheet && card.top > card.vh * 0.45 && card.h < card.vh * 0.52);
  check('…titled with the car name in normal case', /^Your Toyota Corolla$/.test(s.title));
  await ph.screenshot({ path: `${shots}/car-card.png` });
  await ph.mouse.click(195, 120); await sleep(800); // tapping the street above the card closes it
  check('tapping above the card closes it', (await st(ph)).state === 'playing');
  await holdUse(); await ph.locator('.choice-opt.primary').tap(); await ph.waitForFunction(() => !!__game.vehicles.driving, null, { timeout: 30000 });
  check('Drive works from the card', true);

  // ---------- 4. dashboard: compact radio on phones, minimisable
  const dash = () => ph.evaluate(() => { const r = document.querySelector('.hud-drive').getBoundingClientRect(); return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, radioCollapsed: document.querySelector('.car-radio')?.dataset.collapsed, exit: !!document.querySelector('.hud-drive [data-action=drive-exit]').offsetParent }; });
  await ph.waitForFunction(() => { const e = document.querySelector('.hud-drive'); return e && !e.hidden && e.getBoundingClientRect().height > 100; }, null, { timeout: 60000 }); await sleep(800); const full = await dash();
  check('the car radio starts folded on phones', full.radioCollapsed === 'true');
  await ph.screenshot({ path: `${shots}/dash-full.png` });
  await ph.locator('.drive-min-btn').tap(); await ph.waitForFunction(() => document.body.classList.contains('drive-minimized'), null, { timeout: 20000 }); await sleep(600); const mini = await dash();
  check('▾ shrinks the dashboard to a small pill', mini.h < 70 && mini.w < full.w && mini.h < full.h / 2);
  check('…with Get out still there', mini.exit);
  await ph.screenshot({ path: `${shots}/dash-mini.png` });
  await ph.reload(); await ph.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 300000 });
  await ph.evaluate(() => { if (__game.vehicles.driving) __game.vehicles.stopDriving({ silent: true }); }); await sleep(1500);
  check('the dashboard pill disappears once you get out', await ph.evaluate(() => { const e = document.querySelector('.hud-drive'); return e.hidden && e.getBoundingClientRect().height === 0; }));
  check('the minimised choice is remembered', await ph.evaluate(() => document.body.classList.contains('drive-minimized') && __game.settings.driveMinimized === true));
  await ph.evaluate(() => { const g = __game; if (g.vehicles.driving) g.vehicles.stopDriving({ silent: true }); });
  // home card
  await ph.evaluate(() => { const g = __game, h = g.homes.listings[0]; g.homes.housing.rent(h.id); g.player.teleport(h.door.stand.x, h.door.stand.z); });
  await ph.waitForFunction(() => !document.querySelector('.tbtn-interact').hidden);
  await holdUse(); s = await st(ph);
  check('your front door: the same compact card (Enter home first)', s.sheet && await ph.locator('.choice-opt.primary').textContent().then((t) => /Enter home/.test(t)));
  await ph.screenshot({ path: `${shots}/home-card.png` });
  await ph.evaluate(() => __game.closeChoice());

  await ph.waitForFunction(() => __game.online.connected && !!__game.online.data, null, { timeout: 300000 });
  // ---------- 5. invitations
  await pc.evaluate(() => { __game.renderer.renderer.setPixelRatio(0.6); __game.renderer.renderer.setAnimationLoop(() => __game.frame()); });
  const openChat = async (p, user) => { await p.evaluate(() => { if (__game.state === 'overlay') __game.closeChoice?.(); __game.phone.openMessages(); }); await p.getByPlaceholder('Message someone: @username').fill('@' + user); await p.locator('.msg-start').click(); await p.locator('.msg-action.invite').waitFor(); };
  // the PC page is very slow in this software renderer; check the button really is on top, then click it
  const pcTap = async (sel) => { await pc.waitForFunction((q) => { const b = document.querySelector(q); if (!b) return false; const r = b.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === b; }, sel, { timeout: 60000 }); await pc.locator(sel).dispatchEvent('click'); };
  const status = (p) => p.evaluate(() => document.querySelector('.msg-status')?.textContent ?? '');
  await openChat(ph, 'host_ada');
  check('not friends yet: "＋ Add friend" is right there', await ph.locator('.msg-action.add-friend').isVisible());
  await ph.locator('.msg-action.invite').tap(); await sleep(400);
  check('Invite home explains instead of doing nothing', /Add friend first/.test(await status(ph)));
  await ph.screenshot({ path: `${shots}/chat-not-friends.png` });
  await ph.locator('.msg-action.add-friend').tap();
  await pc.waitForFunction(() => !document.querySelector('.invite-banner').hidden && /wants to be your friend/.test(document.querySelector('.invite-text').textContent), null, { timeout: 30000 });
  check('the PC player sees the friend request on screen straight away', true);
  await pc.screenshot({ path: `${shots}/pc-friend-banner.png` });
  await pcTap('.invite-banner:not([hidden]) .invite-yes');
  await ph.waitForFunction(() => __game.online.data.friends.length === 1, null, { timeout: 30000 });
  check('Accept on the card makes them friends', true);
  await ph.waitForFunction(() => !document.querySelector('.msg-action.add-friend'), null, { timeout: 10000 }).catch(() => {});
  await ph.locator('.msg-action.visit').tap(); await sleep(400);
  check('Visit explains when the friend is not at home', /not inside their home/.test(await status(ph)));
  // the PC player goes home and invites the phone player
  await pc.evaluate(() => { const g = __game, h = g.homes.listings[1]; g.economy.transact({ key: 'qa36pc', amount: 1000000, reason: 'QA' }); g.homes.housing.rent(h.id); g.homes.enter(h, { fade: false }); g.online.sendPresence(); });
  await openChat(pc, 'phone_obi'); await sleep(600);
  await pc.locator('.msg-action.invite').click();
  await ph.waitForFunction(() => !document.querySelector('.invite-banner').hidden && /invites you to their home/.test(document.querySelector('.invite-text').textContent), null, { timeout: 30000 });
  check('the phone player sees "invites you to their home" on screen', true);
  await ph.evaluate(() => __game.closeOverlay?.('phone'));
  await ph.screenshot({ path: `${shots}/phone-home-invite.png` });
  await ph.locator('.invite-yes').tap();
  await ph.waitForFunction(() => !!__game.homes.inside && !!__game.online.guestHost, null, { timeout: 90000 });
  console.log('guest inside');
  const same = await ph.evaluate(() => __game.online.scene()) === await pc.evaluate(() => __game.online.scene());
  check('Accept takes the phone player into the host\'s home', same);
  await pc.waitForFunction(() => window.__toasts.some((t) => /phone_obi has arrived/.test(t)), null, { timeout: 30000 });
  check('the host is told their guest arrived', true);
  await ph.waitForFunction(() => __game.online.players.some((p) => p.username === 'host_ada'), null, { timeout: 30000 });
  check('host and guest see each other inside', true);
  // v0.37: the guest sees the host's furniture, and changes the host makes while they are there
  const hostPieces = await pc.evaluate(() => { const g = __game, id = g.homes.inside.home.id, d = g.homes.decor; for (const item of ['armchair', 'painting', 'lamp']) { const r = g.homeUpgrades.buy(id, item, { color: item === 'armchair' ? '#b8473a' : null }); const spot = d.findSpot(item, r.piece.pid); d.placePiece(r.piece.pid, spot); } g.online.shareDecor(); return g.homeUpgrades.pieces(id).filter((p) => p.floor === g.homes.inside.layout.id).map((p) => p.item).sort(); });
  await sleep(3000); console.log('DECOR', JSON.stringify(hostPieces), JSON.stringify(await ph.evaluate(() => ({ snap: __game.online.hostDecor, recs: __game.homes.decor.records.map((r) => r.id), viewing: __game.homes.inside?.viewing, guest: __game.online.guestHost, lay: __game.homes.inside?.layout.id }))));
  await ph.waitForFunction((n) => __game.homes.decor.records.length === n, hostPieces.length, { timeout: 30000 });
  const guestSees = await ph.evaluate(() => __game.homes.decor.records.map((r) => r.id).sort());
  check('the guest sees the host\'s furniture', JSON.stringify(guestSees) === JSON.stringify(hostPieces));
  const moved = await pc.evaluate(() => { const g = __game, id = g.homes.inside.home.id, p = g.homeUpgrades.pieces(id).find((q) => q.item === 'armchair'); const r = g.homes.decor.placePiece(p.pid, { x: p.x, z: p.z, rotation: (p.rotation + 90) % 360 }); g.online.shareDecor(); return r.ok ? (p.rotation) : null; });
  await ph.waitForFunction((rot) => __game.homes.decor.records.some((r) => r.id === 'armchair' && r.rotation === rot), moved, { timeout: 30000 });
  check('when the host rotates a chair, the guest sees it turn', moved != null);
  await ph.screenshot({ path: `${shots}/phone-visiting.png` });
  // leave through the door: straight outside, no renting pop-up
  await ph.evaluate(() => { const g = __game, door = g.homes.inside.layout.items?.find((i) => i.kind === 'door') ?? { kind: 'door' }; g.homes.useItem(door); });
  await ph.waitForFunction(() => !__game.homes.inside && !__game.online.guestHost, null, { timeout: 30000 });
  check('leaving through the door ends the visit — no "rent this home" pop-up', (await st(ph)).state === 'playing');
  // now the phone asks to visit (host is home)
  await ph.waitForFunction(() => __game.online.data.friends.some((f) => f.canVisit), null, { timeout: 30000 });
  await openChat(ph, 'host_ada'); await ph.locator('.msg-action.visit').tap(); await sleep(500);
  check('Visit sends a request when the friend is at home', /Visit request sent/.test(await status(ph)));
  await pc.evaluate(() => __game.closeOverlay?.('phone'));
  await pc.waitForFunction(() => !document.querySelector('.invite-banner').hidden && /wants to visit your home/.test(document.querySelector('.invite-text').textContent), null, { timeout: 30000 });
  await pcTap('.invite-banner:not([hidden]) .invite-yes');
  await ph.waitForFunction(() => !!__game.homes.inside && !!__game.online.guestHost, null, { timeout: 30000 });
  check('the host accepts on the card and the phone player walks in', true);
  // ---------- 6. the server restarts (or the Wi-Fi drops): both players reconnect on their own
  server.kill(); await new Promise((r) => server.once('exit', r));
  await ph.waitForFunction(() => !__game.online.connected, null, { timeout: 30000 });
  server = spawn(process.execPath, ['server/service.mjs'], { env: { ...process.env, DATA_DIR: tmp }, stdio: 'ignore' });
  await ph.waitForFunction(() => __game.online.connected, null, { timeout: 90000 }); await pc.waitForFunction(() => __game.online.connected, null, { timeout: 90000 });
  check('after the server restarts, both players reconnect by themselves', true);
  check('no page errors', errors.length === 0);
  console.log(`\n${checks.length} checks passed`);
} catch (e) {
  console.error('FAIL', e.message, errors.slice(0, 5)); process.exitCode = 1;
  for (const p of (browser?.contexts() ?? []).flatMap((c) => c.pages())) { console.error('DIAG', await p.evaluate(() => ({ state: __game?.state, title: document.querySelector('[data-slot=choice-title]')?.textContent, msg: document.querySelector('.msg-status')?.textContent, banner: document.querySelector('.invite-banner')?.hidden === false ? document.querySelector('.invite-banner').textContent : null, toasts: window.__toasts?.slice(-3), guard: globalThis.__tapGuardLog?.slice(-4), min: document.body.classList.contains('drive-minimized'), hit: (() => { const b = document.querySelector('.invite-banner:not([hidden]) .invite-yes'); if (!b) return null; const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { dis: b.disabled, anims: document.querySelector('.invite-banner').getAnimations().map((x) => x.playState + ':' + Math.round(x.currentTime ?? -1)), rect: [r.x, r.y, r.width, r.height].map(Math.round), top: e && (e.id || e.className || e.tagName), parents: e && [e.parentElement?.id || e.parentElement?.className, e.parentElement?.parentElement?.id || e.parentElement?.parentElement?.className] }; })(), dash: (() => { const r = document.querySelector('.hud-drive')?.getBoundingClientRect(); return r && [Math.round(r.width), Math.round(r.height)]; })() })).catch((x) => x.message)); await p.screenshot({ path: `${shots}/fail-${p.viewportSize().width}.png` }).catch(() => {}); }
}
finally { await browser?.close().catch(() => {}); server.kill(); vite.kill(); }
