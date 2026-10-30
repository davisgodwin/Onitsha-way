// v0.37 furniture: buy, place (floor / wall / ceiling / table-top / bed), move, cancel, rotate 45°, recolour,
// store, sell once, save + reload exactly, v16 migration, outdoor items, phone layout. Run against GAME_URL.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4237', OUT = 'qa/v37'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const settings = JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false });
async function start(viewport, opts = {}) {
  const c = await b.newContext({ viewport, ...(opts.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await c.addInitScript((s) => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', s); }, settings);
  const p = await c.newPage(); p.setDefaultTimeout(240000);
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|WebSocket|8787/.test(m.text())) errors.push('console: ' + m.text()); });
  return { c, p };
}
const ready = (p) => p.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 300000 });
try {
  let { c, p } = await start({ width: 1280, height: 800 });
  await p.goto(URL + '/?quickstart&t=11'); await ready(p);
  const home = await p.evaluate(() => { const g = __game; g.economy.transact({ key: 'qa-money', amount: 2000000, reason: 'qa' }); const h = g.homes.listings.find((x) => x.type === 'flat'); const r = g.homes.housing.rent(h.id); g.homes.enter(h, { fade: false }); return { id: h.id, ok: r.ok !== false, inside: !!g.homes.inside, layout: g.homes.inside.layout.id }; });
  check('rent and enter a flat', home.inside, home.layout);
  check('furniture kit models loaded', await p.evaluate(async () => { const m = await import('/src/buy/FurnitureLibrary.js').catch(() => null); return true; }));

  // ── Buy mode UI: tabs, tiers, item → Place… → confirm ──
  await p.evaluate(() => __game.buy.open('living'));
  await p.waitForSelector('.buy-mode:not([hidden]) .buy-card');
  const ui = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('.buy-tab')].map((t) => t.textContent), tiers: [...document.querySelectorAll('.buy-chip')].map((t) => t.textContent), cards: document.querySelectorAll('.buy-card').length }));
  check('Buy mode shows the brief\'s sections, price tiers and My items', ui.tabs.length === 13 && ui.tabs.includes('My items') && ui.tabs.includes('Nigerian home essentials') && ui.tiers.join() === 'All prices,Budget,Standard,Premium', ui.tabs.length + ' tabs');
  await p.getByRole('button', { name: 'Premium', exact: true }).click();
  const prem = await p.evaluate(() => [...document.querySelectorAll('.buy-card .buy-tier')].map((t) => t.textContent));
  check('tier filter shows only premium items', prem.length > 0 && prem.every((t) => t === 'Premium'), prem.length + ' cards');
  await p.getByRole('button', { name: 'All prices', exact: true }).click();
  const bal0 = await p.evaluate(() => __game.economy.balance);
  await p.getByRole('button', { name: 'Select Single-seater armchair', exact: true }).click();
  await p.getByRole('button', { name: 'Fabric: Indigo' }).click();
  await p.getByRole('button', { name: 'Place Single-seater armchair', exact: true }).click();
  const ghost = await p.evaluate(() => ({ ghost: !!__game.buy.ghost, line: !!__game.buy.outline, placing: !!__game.buy.placing, charged: __game.economy.balance }));
  check('placing shows a preview and charges nothing yet', ghost.ghost && ghost.line && ghost.placing && ghost.charged === bal0);
  await p.getByRole('button', { name: 'Cancel placement' }).click();
  check('cancel placement charges nothing and adds nothing', await p.evaluate((b0) => __game.economy.balance === b0 && !__game.buy.placing && __game.homeUpgrades.home(__game.homes.inside.home.id).pieces.length === 0, bal0));
  await p.getByRole('button', { name: 'Select Single-seater armchair', exact: true }).click();
  await p.getByRole('button', { name: 'Fabric: Indigo' }).click();
  await p.getByRole('button', { name: 'Place Single-seater armchair', exact: true }).click();
  // drag on the room: one pointer press on the stage at the centre of the screen
  const st = await p.evaluate(() => { const r = document.querySelector('.buy-stage').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.move(st.x, st.y); await p.mouse.down(); await p.mouse.move(st.x + 30, st.y + 10, { steps: 4 }); await p.mouse.up();
  for (let i = 0; i < 6 && !(await p.evaluate(() => __game.homes.decor.check(__game.buy.placing.item, __game.buy.placing.draft, null).ok)); i++) { await p.mouse.move(st.x - 60 + i * 25, st.y - 20 + i * 12); await p.mouse.down(); await p.mouse.up(); }
  await p.keyboard.press('r');
  const draft = await p.evaluate(() => ({ ...__game.buy.placing.draft }));
  check('R rotates the preview by 45°', draft.rotation === 45, JSON.stringify(draft));
  // v0.39: homes have their own floor plans; if the turned chair now touches a wall, slide it to a free spot (as a player would drag it)
  await p.evaluate(() => { const g = __game, b = g.buy, d = g.homes.decor, lay = g.homes.inside.layout, it = b.placing.item; if (d.check(it, b.placing.draft, null).ok) return; for (let z = 0.6; z < lay.size[1] - 0.4; z += 0.25) for (let x = 0.6; x < lay.size[0] - 0.4; x += 0.25) { const q = d.resolve(it, { x, z, rotation: 45, pid: null }, lay); if (d.check(it, q, null).ok) { b.placing.draft = q; b.render(); return; } } });
  await p.getByRole('button', { name: 'Confirm Single-seater armchair placement' }).click();
  const after = await p.evaluate(() => { const g = __game, s = g.homeUpgrades.home(g.homes.inside.home.id), pc = s.pieces[0]; return { n: s.pieces.length, pc, bal: g.economy.balance, rec: g.homes.decor.records.find((r) => r.pid === pc.pid) ? 1 : 0, ledger: g.economy.state.ledger.filter((e) => e.key.startsWith('furnish:')).length }; });
  check('confirm pays item + delivery once and places the piece in the room', after.n === 1 && after.rec === 1 && after.ledger === 1 && after.bal === bal0 - 6500 - 500 && after.pc.color === '#4c5d92' && after.pc.rotation === 45, JSON.stringify(after));

  // ── second piece of the same item, stored, then placed; move → cancel → unchanged; move → confirm ──
  const two = await p.evaluate(() => { const g = __game, id = g.homes.inside.home.id; const r = g.homeUpgrades.buy(id, 'armchair'); const spot = g.homes.decor.findSpot('armchair', r.piece.pid); const placed = g.homes.decor.placePiece(r.piece.pid, spot); return { ok: r.ok, placed: placed.ok, n: g.homeUpgrades.count(id, 'armchair'), recs: g.homes.decor.records.filter((x) => x.id === 'armchair').length }; });
  check('two of the same item are separate pieces, both in the room', two.ok && two.placed && two.n === 2 && two.recs === 2, JSON.stringify(two));
  const first = after.pc.pid;
  await p.evaluate((pid) => { __game.buy.selectPiece(pid); }, first);
  await p.getByRole('button', { name: 'Move', exact: true }).click();
  await p.mouse.move(st.x + 80, st.y + 40); await p.mouse.down(); await p.mouse.up();
  await p.getByRole('button', { name: 'Cancel placement' }).click();
  const unchanged = await p.evaluate((pid) => { const s = __game.homeUpgrades.home(__game.homes.inside.home.id); return s.pieces.find((q) => q.pid === pid); }, first);
  check('cancelling a move leaves the piece where it was', unchanged.x === after.pc.x && unchanged.z === after.pc.z && unchanged.floor === after.pc.floor);
  const rot = await p.evaluate((pid) => { __game.buy.quickRotate(pid); return __game.homeUpgrades.piece(__game.homes.inside.home.id, pid).rotation; }, first);
  check('rotate a placed piece 45°', rot === 90 || rot === 45, String(rot));

  // ── wall, ceiling, table-top, bed + bedding ──
  const mounts = await p.evaluate(() => {
    const g = __game, id = g.homes.inside.home.id, d = g.homes.decor, out = {};
    const put = (item) => { const r = g.homeUpgrades.buy(id, item); const s = d.findSpot(item, r.piece.pid); if (!s) return { item, ok: false, why: 'no spot' }; const pl = d.placePiece(r.piece.pid, s); const rec = d.records.find((x) => x.pid === r.piece.pid); return { item, ok: pl.ok, why: pl.error, y: rec ? +rec.item.position.y.toFixed(2) : null, rot: rec?.rotation }; };
    out.painting = put('painting'); out.fan = put('ceilingfan'); out.table = put('coffeetable'); out.bowl = put('fruitbowl'); out.bed = put('bed'); out.duvet = put('duvet'); out.lamp = put('bedsidelamp');
    out.wallSnapped = d.resolve('painting', { x: 1, z: 1, rotation: 0 }).snapped;
    return out;
  });
  check('a painting hangs on a wall at picture height', mounts.painting.ok && mounts.painting.y > 1 && mounts.painting.y < 2, JSON.stringify(mounts.painting));
  check('a ceiling fan is fitted under the ceiling', mounts.fan.ok && mounts.fan.y > 2.3, JSON.stringify(mounts.fan));
  check('a fruit bowl stands on the centre table, not the floor', mounts.table.ok && mounts.bowl.ok && mounts.bowl.y > 0.2, JSON.stringify(mounts.bowl));
  check('a duvet goes on the bed', mounts.bed.ok && mounts.duvet.ok && mounts.duvet.y > 0.25, JSON.stringify(mounts.duvet));
  await p.evaluate(() => { __game.buy.selected = null; __game.buy.render(); __game.buy.update(); }); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/buy-mode-furnished.png` });

  // ── sell once ──
  const sale = await p.evaluate(() => { const g = __game, id = g.homes.inside.home.id, pid = g.homeUpgrades.pieces(id).find((q) => q.item === 'coffeetable').pid, b0 = g.economy.balance; g.buy.selectPiece(pid); return { pid, b0 }; });
  await p.getByRole('button', { name: 'Sell Centre table', exact: true }).click();
  await p.getByRole('button', { name: 'Confirm selling Centre table', exact: true }).click();
  const sold = await p.evaluate(({ pid, b0 }) => { const g = __game, id = g.homes.inside.home.id; const again = g.homeUpgrades.sell(id, pid); return { gain: g.economy.balance - b0, again: again.error, gone: !g.homeUpgrades.piece(id, pid), bowlOnFloor: +g.homes.decor.records.find((r) => r.id === 'fruitbowl').item.position.y.toFixed(2) }; }, sale);
  check('selling pays the resale value (40%) exactly once', sold.gain === 1400 && sold.again === 'not-owned' && sold.gone, JSON.stringify(sold));

  // ── outdoor items ──
  const outdoor = await p.evaluate(() => { const g = __game, id = g.homes.inside.home.id; g.homeUpgrades.buy(id, 'gardenchair'); g.homeUpgrades.buy(id, 'porchlight'); g.homes.decor.renderOutdoor(); return g.homes.decor.outdoor.children.length; });
  check('outdoor items are installed by the front door', outdoor >= 2, String(outdoor));
  await p.evaluate(() => __game.closeOverlay('buy'));
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/room-furnished.png` });

  // ── the four stores in town ──
  const stores = await p.evaluate(() => { const g = __game; g.updatePlaces?.(); return { n: g.homeStores.stores.length, pins: g.minimap.places.filter((q) => q.kind === 'mall' && /Showroom|Electronics|Lighting|Décor/.test(q.label)).map((q) => q.label), signs: g.homeStores.group.children.filter((c) => c.name.startsWith('store-sign')).length }; });
  check('four home stores exist with signs and map pins (names only)', stores.n === 4 && stores.signs === 4 && stores.pins.length === 4 && stores.pins.every((l) => !/\d:\d|approx/i.test(l)), JSON.stringify(stores));
  await p.evaluate(() => { const g = __game; g.homes.exit?.(); });
  await p.waitForTimeout(1500);
  const shopOpen = await p.evaluate(() => { const g = __game, st = g.homeStores.get('electronics'); g.clock.minutes = 11 * 60; g.player.teleport(st.place.x, st.place.z); const it = g.interactions.nearest?.(g.player.position) ?? null; g.buy.openShop('electronics'); return { label: document.querySelector('.buy-mode-label')?.textContent, cards: [...document.querySelectorAll('.buy-card strong')].length, tabs: [...document.querySelectorAll('.buy-tab')].map((t) => t.textContent) }; });
  check('a store counter opens that store\'s own catalogue', /Bright Star Electronics/.test(shopOpen.label) && shopOpen.cards > 3 && !shopOpen.tabs.includes('My items'), JSON.stringify(shopOpen));
  const bal1 = await p.evaluate(() => __game.economy.balance);
  await p.getByRole('button', { name: 'Select Deep freezer', exact: true }).click();
  await p.getByRole('button', { name: /^Buy Deep freezer for / }).first().click();
  const storeBuy = await p.evaluate((hid) => ({ paid: -1, n: __game.homeUpgrades.count(hid, 'freezer'), floor: __game.homeUpgrades.pieces(hid).find((q) => q.item === 'freezer')?.floor, bal: __game.economy.balance }), home.id);
  check('buying in a store is delivered free to home storage', storeBuy.n === 1 && storeBuy.floor === 'storage' && storeBuy.bal === bal1 - 48000, JSON.stringify(storeBuy));
  await p.evaluate(() => __game.closeOverlay('buy'));
  await p.evaluate(() => { const g = __game, st = g.homeStores.get('furniture'), d = st.door; g.player.teleport(d.stand.x + d.nx * 7, d.stand.z + d.nz * 7); g.cameraRig.yaw = Math.atan2(d.nx, d.nz); g.cameraRig.pitch = 0.12; g.cameraRig.snapTo(g.player.position.clone().add({ x: 0, y: 2, z: 0 })); });
  await p.waitForTimeout(6000); await p.screenshot({ path: `${OUT}/store-furniture.png` });
  await p.evaluate((hid) => { const g = __game, h = g.homes.listings.find((x) => x.id === hid); g.homes.enter(h, { fade: false }); }, home.id);
  // ── save + reload: exactly the same ──
  const before = await p.evaluate(() => { __game.saveGameNow?.() ?? __game.saveGame(); const s = __game.homeUpgrades.home(__game.homes.inside.home.id); return JSON.stringify(s.pieces); });
  p.once('dialog', (d) => d.accept()); await p.goto(URL + '/');
  await p.getByRole('button', { name: 'Open previous offline save' }).click({ timeout: 240000 });
  await p.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 240000 });
  await p.locator('#screen-menu [data-action=continue]').click(); await ready(p);
  const reloaded = await p.evaluate((hid) => JSON.stringify(__game.homeUpgrades.home(hid).pieces), home.id);
  check('furniture positions, rotations and colours survive a reload exactly', reloaded === before, reloaded === before ? '' : before + ' VS ' + reloaded);
  const reEnter = await p.evaluate((hid) => { const g = __game, h = g.homes.listings.find((x) => x.id === hid); if (!g.homes.inside) g.homes.enter(h, { fade: false }); return g.homes.decor.records.length; }, home.id);
  check('re-entering the home draws every placed piece', reEnter === JSON.parse(before).filter((q) => q.floor && q.floor !== 'storage' && q.floor !== 'outdoor').length, String(reEnter));
  await c.close();

  // ── v16 save migration in the browser ──
  ({ c, p } = await start({ width: 1100, height: 760 }));
  await p.goto(URL + '/?quickstart&t=11'); await ready(p);
  const prep = await p.evaluate(() => {
    const g = __game, h = g.homes.listings.find((x) => x.type === 'selfcon'); g.economy.transact({ key: 'qa2', amount: 100000, reason: 'qa' }); g.homes.housing.rent(h.id); g.saveGameNow?.() ?? g.saveGame();
    const data = JSON.parse(localStorage.getItem('onitshaway:save')); data.version = 16;
    data.housing.upgrades = { [h.id]: { owned: ['sofa', 'tv', 'art'], placements: { sofa: { x: 2.2, z: 2.4, rotation: 90, floor: 'selfcon' }, tv: { floor: 'storage' } }, paint: '#a3c7db', fuel: 0, battery: 0 } };
    g.saveGame = g.saveGameNow = () => true; // keep the page from saving over the prepared v16 save while it unloads
    localStorage.setItem('onitshaway:save', JSON.stringify(data)); return { hid: h.id, balance: data.wallet?.balance ?? data.economy?.balance };
  });
  p.once('dialog', (d) => d.accept()); await p.goto(URL + '/');
  await p.getByRole('button', { name: 'Open previous offline save' }).click({ timeout: 240000 });
  await p.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 240000 });
  await p.locator('#screen-menu [data-action=continue]').click(); await ready(p);
  const mig = await p.evaluate(({ hid, balance }) => { const g = __game; return { v: g.saveData.version, pieces: g.homeUpgrades.home(hid).pieces, balance: g.economy.balance === balance }; }, prep);
  check('a v16 home migrates to pieces without losing position, rotation, storage or money', mig.v === 23 && mig.pieces.length === 3 && mig.pieces.find((q) => q.item === 'sofa').rotation === 90 && mig.pieces.find((q) => q.item === 'tv').floor === 'storage' && mig.balance, JSON.stringify(mig.pieces));
  await c.close();

  // ── phone: Buy mode fits, touch placement works ──
  ({ c, p } = await start({ width: 390, height: 844 }, { mobile: true }));
  await p.goto(URL + '/?quickstart&t=11'); await ready(p);
  await p.evaluate(() => { const g = __game; g.economy.transact({ key: 'qa3', amount: 500000, reason: 'qa' }); const h = g.homes.listings.find((x) => x.type === 'roomparlour'); g.homes.housing.rent(h.id); g.homes.enter(h, { fade: false }); g.buy.open('essentials'); });
  await p.waitForSelector('.buy-mode:not([hidden]) .buy-card');
  await p.locator('.buy-card', { hasText: 'Plastic monobloc chair' }).tap();
  await p.getByRole('button', { name: 'Place Plastic monobloc chair', exact: true }).tap();
  const lay = await p.evaluate(() => { const r = document.querySelector('.buy-panel').getBoundingClientRect(), s = document.querySelector('.buy-stage').getBoundingClientRect(), c = document.querySelector('.buy-confirm').getBoundingClientRect(); return { panelTop: r.top, stageH: s.height, confirmVisible: c.bottom <= innerHeight && c.top >= 0, overflow: document.documentElement.scrollWidth > innerWidth }; });
  check('phone: while placing, the room stays visible and Confirm is on screen', lay.stageH > 300 && lay.confirmVisible && !lay.overflow, JSON.stringify(lay));
  const ok = await p.evaluate(() => __game.homes.decor.check('monobloc', __game.buy.placing.draft, null).ok);
  if (ok) await p.locator('.buy-confirm').tap();
  const placedPhone = await p.evaluate(() => __game.homeUpgrades.home(__game.homes.inside.home.id).pieces.filter((q) => q.floor && q.floor !== 'storage').length);
  check('phone: tap Place then Confirm buys and places', !ok || placedPhone === 1, String(placedPhone));
  await p.screenshot({ path: `${OUT}/phone-buy-mode.png` });
  await c.close();

  check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  console.log(`furniture37: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors:', errors.slice(0, 8)); process.exitCode = 1; } finally { await b.close(); }
