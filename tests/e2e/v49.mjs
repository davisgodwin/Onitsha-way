// v0.49: the new map screen, the city filled in rows of walled houses, more places, big COMING SOON gantries, the
// house under the Niger Bridge ramp gone, traffic lights and wardens, and vehicles that never drive through each other.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4243', OUT = 'qa/v49'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const open = async (vp = { width: 1280, height: 800 }) => { const c = await b.newContext({ viewport: vp }); await c.addInitScript(() => { localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); }); const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message)); await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 }); return p; };
const fixed = async (p, name, from, to) => { await p.evaluate(({ from, to }) => { const g = __game; g.clock.setMode('game'); g.clock.minutes = 12 * 60; g.player.teleport(to.x, to.z); g.world.city.buildAround(to.x, to.z, 260); g.cameraRig.setMode('fixed'); const cam = g.cameraRig.camera; cam.position.set(from.x, from.y, from.z); cam.lookAt(to.x, to.y, to.z); }, { from, to }); await p.waitForTimeout(4500); await p.screenshot({ path: `${OUT}/${name}.png` }); await p.evaluate(() => __game.cameraRig.setMode('follow')); };
try {
 const p = await open();
 const s = await p.evaluate(() => { const g = __game, w = g.world; return {
  lots: w.orderly.houses.length, lotsFenced: w.orderly.houses.every((h) => h.compound), infillFenced: w.infill.houses.filter((h) => !h.removed).every((h) => h.compound), osmFenced: w.stats.fencedBuildings?.n,
  rows: (() => { // houses of one street side stand on one line: their fronts are the same distance from the street
   const byRoad = new Map(); for (const h of w.orderly.houses.slice(0, 3000)) { const k = h.tier + ':' + Math.round(h.plot.x / 400) + ',' + Math.round(h.plot.z / 400); if (!byRoad.has(k)) byRoad.set(k, []); byRoad.get(k).push(h); }
   let ok = 0, n = 0; for (const list of byRoad.values()) for (const h of list) { n++; const d = Math.hypot(h.x - h.plot.x, h.z - h.plot.z); if (Math.abs(d - (h.plot.hd - (h.tier === 'gra' ? 5.5 : h.tier === 'old' ? 3.5 : 4.6) - h.d / 2)) < 0.05) ok++; } return { ok, n }; })(),
  bridge: w.infill.houses.filter((h) => h.removedBy === 'bridge').length,
  underDeck: (() => { const segs = w.map.segments.filter((x) => x.road.elevated); let n = 0; for (const h of [...w.infill.houses.filter((h) => !h.removed), ...w.orderly.houses]) for (const [x, z] of h.pts) if (segs.some((q) => { const dx = q.bx - q.ax, dz = q.bz - q.az, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - q.ax) * dx + (z - q.az) * dz) / L)); return Math.hypot(x - q.ax - t * dx, z - q.az - t * dz) < q.road.width / 2; })) { n++; break; } return n; })(),
  soon: { gantries: w.comingSoon.edges.length, billboards: w.comingSoon.billboards },
  more: g.morePlaces.stats, listings: g.homes.listings.length, newHomes: g.homes.listings.filter((h) => /home:(lot|infill):/.test(h.id)).length,
  control: g.traffic.control.stats(),
 }; });
 console.log(JSON.stringify(s));
 check('the empty land is filled: thousands of new houses in rows, each in its own walled compound with a gate', s.lots >= 5000 && s.lotsFenced && s.infillFenced, JSON.stringify({ lots: s.lots }));
 check('rows and columns: in a row every house stands the same distance back from the street', s.rows.ok / s.rows.n > 0.99, JSON.stringify(s.rows));
 check('other houses and small businesses got walls and gates too', s.osmFenced > 1500, String(s.osmFenced));
 check('no house stands under the Niger Bridge ramp or a flyover deck', s.bridge >= 1 && s.underDeck === 0, JSON.stringify({ removed: s.bridge, under: s.underDeck }));
 check('COMING SOON: big gantries on every road out of Onitsha and billboards along the line', s.soon.gantries >= 20 && s.soon.billboards >= 8, JSON.stringify(s.soon));
 const M = s.more;
 check('more places: fuel, hotels, bars, clubs, eateries, recreation, mini pitches, markets, schools, churches, police, showrooms', M.fuel >= 6 && M.hotel >= 4 && M.bar >= 6 && M.club >= 3 && M.eatery >= 5 && M.recreation >= 4 && M.field >= 5 && M.market >= 3 && M.school >= 5 && M.church >= 6 && M.police >= 3 && M.showroom >= 2, JSON.stringify(M));
 check('more homes to rent or buy, in walled houses', s.newHomes >= 100 && s.listings >= 190, JSON.stringify({ listings: s.listings, newHomes: s.newHomes }));
 check('traffic lights and wardens at the busy junctions', s.control.lights >= 100 && s.control.wardens >= 8, JSON.stringify(s.control));
 // a new home: walk up, rent it, go in
 const rent = await p.evaluate(() => { const g = __game, h = g.homes.listings.find((x) => /home:lot:/.test(x.id)); g.economy.transact({ key: 'qa49-rent', amount: 500000, reason: 'qa' }); g.player.teleport(h.door.stand.x, h.door.stand.z); g.interactions.update(h.door.stand.x, h.door.stand.z); const label = g.interactions.current?.label; const r = g.homes.housing.rent(h.id); return { id: h.id, label: typeof label === 'function' ? label() : label, ok: r.ok, status: g.homes.housing.status(h.id) }; });
 check('a new walled house: its door says to let, and renting it works', /let|Rent|view|Enter your home/i.test(String(rent.label)) && rent.ok && rent.status === 'tenant', JSON.stringify(rent));
 // the new places work: a filling station desk, a school and a church to go into, a pitch
 const pl = await p.evaluate(() => { const g = __game, f = g.story.city.services.find((x) => x.id === 'fuel49:0'), sc = g.world.landmarks.get('school49:0'), ch = g.world.landmarks.get('church49:0'), fd = g.morePlaces.list.find((x) => x.kind === 'field');
  const lab = (x, z) => { g.player.teleport(x, z); g.interactions.update(x, z); const l = g.interactions.current?.label; return typeof l === 'function' ? l() : l; };
  return { fuel: lab(f.x, f.z), school: lab(sc.site.door.stand.x, sc.site.door.stand.z), church: lab(ch.site.door.stand.x, ch.site.door.stand.z), field: fd && lab(g.morePlaces.sites.find((s) => s.id === fd.id).at(0, -2).x, g.morePlaces.sites.find((s) => s.id === fd.id).at(0, -2).z) }; });
 check('the new places can be used (fuel desk, school, church, mini pitch)', /fuel desk/.test(pl.fuel) && /go in|opens/.test(pl.school) && /go in|opens/.test(pl.church) && /kick-about/.test(pl.field), JSON.stringify(pl));
 // traffic: a light-controlled approach stops on red; and in two simulated minutes at Upper Iweka no vehicle drives into another
 const tr = await p.evaluate(() => { const g = __game, T = g.traffic, C = T.control, n = [...C.nodes.values()].find((x) => !x.warden), a = n.approaches.find((q) => !q.oneway);
  const red = C.phase(n, a.group) === 'red' ? 'red' : (() => { for (let i = 0; i < 400 && C.phase(n, a.group) !== 'red'; i++) C.update(0.1); return C.phase(n, a.group); })(), st = C.state(n.node, a.e, a.fwd);
  T.vehicles = []; T.crashCount = 0; const f = g.world.landmarks.get('upper-iweka'); let overlaps = 0, samples = 0;
  for (let i = 0; i < 2400; i++) { C.update(0.05); T.update(0.05, f, 10, { x: f.x, z: f.z }, []); if (i % 10) continue; const V = T.near; for (let x = 0; x < V.length; x++) for (let y = x + 1; y < V.length; y++) { const A = V[x], B = V[y]; if (A.ghostT > 0 || B.ghostT > 0 || Math.abs(A.y - B.y) > 1.5) continue; samples++; if (Math.hypot(A.x - B.x, A.z - B.z) < Math.min(A.T.len, B.T.len) * 0.45) overlaps++; } }
  return { red, light: st?.light, overlaps, crashes: T.crashCount, near: T.near.length }; });
 check('a driver at a red light is told to stop', tr.red === 'red' && tr.light === 'red', JSON.stringify(tr));
 check('vehicles never drive through each other near you (2 simulated minutes at Upper Iweka)', tr.overlaps === 0 && tr.crashes <= 4, JSON.stringify(tr));
 // screenshots: a filled street, GRA rows, a gantry, lights, a warden, the new places
 const at = await p.evaluate(() => { const g = __game, w = g.world, C = g.traffic.control, e = w.comingSoon.edges[0], lt = [...C.nodes.values()].find((n) => !n.warden && n.approaches.length >= 3), wd = [...C.nodes.values()].find((n) => n.warden), lot = w.orderly.houses[200], gra = w.orderly.houses.find((h) => h.tier === 'gra'), sc = g.world.landmarks.get('school49:0'), ch = g.world.landmarks.get('church49:0'), rec = g.morePlaces.list.find((x) => x.kind === 'recreation');
  return { e: { x: e.x, z: e.z, dx: e.board.yaw }, lt: { x: lt.x, z: lt.z, a: lt.approaches[0] && { dx: lt.approaches[0].dx, dz: lt.approaches[0].dz } }, wd: { x: wd.stand.x, z: wd.stand.z }, lot: { x: lot.plot.x, z: lot.plot.z }, gra: gra && { x: gra.plot.x, z: gra.plot.z }, sc: { x: sc.x, z: sc.z }, ch: { x: ch.x, z: ch.z }, rec: { x: rec.x, z: rec.z } }; });
 await fixed(p, 'rows-street', { x: at.lot.x + 60, y: 55, z: at.lot.z + 60 }, { x: at.lot.x, y: 0, z: at.lot.z });
 if (at.gra) await fixed(p, 'rows-gra', { x: at.gra.x + 70, y: 60, z: at.gra.z + 70 }, { x: at.gra.x, y: 0, z: at.gra.z });
 await fixed(p, 'coming-soon-gantry', { x: at.e.x - Math.sin(at.e.dx) * -30, y: 6, z: at.e.z - Math.cos(at.e.dx) * -30 }, { x: at.e.x, y: 7, z: at.e.z });
 await fixed(p, 'traffic-lights', { x: at.lt.x - at.lt.a.dx * 40, y: 8, z: at.lt.z - at.lt.a.dz * 40 }, { x: at.lt.x, y: 4, z: at.lt.z });
 await fixed(p, 'traffic-warden', { x: at.wd.x + 10, y: 5, z: at.wd.z + 10 }, { x: at.wd.x, y: 1.5, z: at.wd.z });
 await fixed(p, 'new-school', { x: at.sc.x + 35, y: 25, z: at.sc.z + 35 }, { x: at.sc.x, y: 3, z: at.sc.z });
 await fixed(p, 'new-church', { x: at.ch.x + 35, y: 25, z: at.ch.z + 35 }, { x: at.ch.x, y: 5, z: at.ch.z });
 await fixed(p, 'new-recreation', { x: at.rec.x + 22, y: 14, z: at.rec.z + 22 }, { x: at.rec.x, y: 1, z: at.rec.z });
 // the map: search, chips, GRA labelled, every place named
 await p.evaluate(() => __game.openMap()); await p.waitForFunction(() => !!__game.minimap.view); await p.waitForTimeout(500);
 await p.screenshot({ path: `${OUT}/map-default.png` });
 const mp = await p.evaluate(() => { const m = __game.minimap, out = []; const old = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { out.push(String(t)); return old.call(this, t, ...r); };
  const a = __game.world.districts.premium[0]; Object.assign(m.view, { cx: a.x, cz: a.z, ppm: 0.5 }); m.drawBig(); CanvasRenderingContext2D.prototype.fillText = old; return { texts: out, area: document.querySelector('[data-slot=map-area-name]').textContent, chips: document.querySelectorAll('.map-chip').length }; });
 await p.screenshot({ path: `${OUT}/map-gra.png` });
 check('the map names GRA and shows where you are looking', mp.texts.some((t) => /GRA PHASE I\b/.test(t)) && /GRA/.test(mp.area), JSON.stringify({ area: mp.area, sample: mp.texts.slice(0, 12) }));
 check('category chips on the map', mp.chips >= 9, String(mp.chips));
 await p.fill('[data-slot=map-search]', 'church'); await p.waitForTimeout(300);
 const res = await p.locator('[data-slot=map-results] li').allTextContents();
 await p.screenshot({ path: `${OUT}/map-search.png` });
 check('search finds places by name', res.length >= 3 && res.some((t) => /Parish|Chapel|Church/.test(t)), JSON.stringify(res.slice(0, 4)));
 await p.locator('[data-slot=map-results] li').first().click(); await p.waitForTimeout(300);
 check('choosing a result marks it on the map', await p.evaluate(() => !!__game.waypoint), '');
 await p.fill('[data-slot=map-search]', '');
 await p.locator('.map-chip[data-cat=food]').click(); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/map-filter-food.png` });
 check('a chip shows only that kind of place', await p.evaluate(() => __game.minimap.filter === 'food' && __game.minimap.visiblePlaces().every((x) => ['eatery', 'market', 'plaza'].includes(x.kind) || /mine$/.test(x.kind))), '');
 await p.locator('.map-chip[data-cat=food]').click();
 await p.locator('[data-action=map-legend]').click(); await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}/map-key.png` }); await p.locator('[data-action=map-legend]').click();
 await p.evaluate(() => { const m = __game.minimap, a = __game.world.districts.premium[0]; Object.assign(m.view, { cx: a.x, cz: a.z, ppm: 2.2 }); m.drawBig(); }); await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}/map-gra-close.png` });
 await p.evaluate(() => { const m = __game.minimap; Object.assign(m.view, { cx: 1000, cz: -1000, ppm: 0.12 }); m.drawBig(); }); await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}/map-whole.png` });
 await p.context().close();
 // the map on a phone
 const q = await open({ width: 390, height: 844 });
 await q.evaluate(() => __game.openMap()); await q.waitForTimeout(800); await q.screenshot({ path: `${OUT}/map-phone.png` });
 check('the map fits a phone screen', await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.map-search').getBoundingClientRect().right <= innerWidth), '');
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`v49: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
