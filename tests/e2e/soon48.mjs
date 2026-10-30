// v0.48: Onitsha only. Asaba and the Delta island are COMING SOON; nothing can take a player there.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4243', OUT = 'qa/v48'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message));
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 });
 const info = await p.evaluate(() => {
  const g = __game, pa = g.world.playArea, L = (x, z) => pa.locked(x, z);
  const inter = [...g.interactions.items].filter((it) => { try { return Number.isFinite(it.x) && L(it.x, it.z) && (!it.enabled || it.enabled()) && (g.interactions.update(it.x, it.z), g.interactions.current === it); } catch { return false; } }).map((it) => { try { return typeof it.label === 'function' ? it.label() : it.label; } catch { return '?'; } });
  const pins = g.activityPlaces.flatMap((a) => { try { return a.places?.() ?? []; } catch { return []; } }).filter((q) => L(q.x, q.z)).map((q) => q.name ?? q.label);
  return {
   barriers: g.world.comingSoon.barriers.length, edges: g.world.comingSoon.edges, inter, pins,
   stops: g.transport.net.stops.filter((s) => L(s.x, s.z)).map((s) => s.name),
   homes: g.homes.listings.filter((h) => L(h.door.stand.x, h.door.stand.z)).length, lockedHomes: g.homes.lockedListings.length,
   lockedEdges: g.graph.edges.filter((e) => e.locked).length, asaba: g.world.landmarks.get('asaba').name,
   market: g.world.landmarks.get('main-market'), bridgehead: !L(g.world.landmarks.get('bridgehead').x, g.world.landmarks.get('bridgehead').z),
  };
 });
 console.log(JSON.stringify(info).slice(0, 1500));
 check('a barrier closes the Niger Bridge at mid-river', info.barriers >= 1, String(info.barriers));
 check('COMING SOON boards where main roads leave the map', info.edges.length >= 2, JSON.stringify(info.edges.map((e) => e.to)));
 check('no bus stop, home, job or map pin in Asaba or on the Delta island', !info.stops.length && !info.homes && !info.inter.length && !info.pins.length, JSON.stringify({ s: info.stops, i: info.inter, p: info.pins }));
 check('traffic and walkers are kept out (locked road edges)', info.lockedEdges > 50, String(info.lockedEdges));
 check('Asaba is labelled COMING SOON; Bridgehead and the markets stay open', /COMING SOON/.test(info.asaba) && info.bridgehead, info.asaba);
 const out = await p.evaluate(() => { const g = __game, pa = g.world.playArea, m = g.world.map.meta; const pts = { okpoko: [6.1202, 6.7861], nkpor: [6.1456, 6.8331], obosi: [6.1164, 6.8331] }; const r = {}; for (const [k, [lat, lon]] of Object.entries(pts)) { const x = (lon - m.origin.lon) * m.metresPerDegree.lon, z = -(lat - m.origin.lat) * m.metresPerDegree.lat; r[k] = pa.lockedAt(x, z)?.id ?? null; } const gra = g.world.districts.premium.map((a) => pa.lockedAt(a.x, a.z)?.id ?? 'open'); return { r, gra, lga: !!pa.polygons }; });
 check('outside the Onitsha LGA lines (Okpoko, Nkpor, Obosi) is COMING SOON; GRA is open', out.lga && Object.values(out.r).every(Boolean) && out.gra.every((x) => x === 'open'), JSON.stringify(out));
 // the GPS won't take you there
 const wp = await p.evaluate(() => { const g = __game, a = g.world.landmarks.get('asaba'); g.setWaypoint({ x: a.x, z: a.z, name: 'Asaba' }); return g.waypoint; });
 check('the GPS refuses Asaba', !wp);
 // drive west across the Niger Bridge: you stop at the barrier
 const drive = await p.evaluate(async () => {
  const g = __game, bar = g.world.comingSoon.barriers[0];
  g.economy.transact({ key: 'qa48-car', amount: 5000000, reason: 'QA' });
  const sp = g.vehicles.sys.forSale().find((s) => s.model === 'toyota_camry') ?? g.vehicles.sys.forSale()[0], r = g.vehicles.sys.buy(sp.id); g.vehicles.addOwned(r.vehicle);
  const v = r.vehicle; v.fuel = 30; v.x = bar.x + Math.sin(bar.yaw) * 40; v.z = bar.z + Math.cos(bar.yaw) * 40; v.heading = bar.yaw + Math.PI;
  g.player.teleport(v.x + 2, v.z); g.vehicles._doorReady = true; g.vehicles.startDriving(v); g.vehicles._doorReady = false;
  const gm = g.input.getMove.bind(g.input); g.input.getMove = () => ({ x: 0, y: 1, mag: 1 });
  let minLine = Infinity; for (let i = 0; i < 600; i++) { g.vehicles.update(1 / 30, g.input); minLine = Math.min(minLine, v.x - g.world.playArea.lineX(v.z)); }
  g.input.getMove = gm; const at = { x: v.x, z: v.z }; return { minLine, locked: g.world.playArea.locked(at.x, at.z), dist: Math.hypot(at.x - bar.x, at.z - bar.z) };
 });
 check('driving west on the Niger Bridge stops at the barrier, still in Onitsha', !drive.locked && drive.minLine > 0, JSON.stringify(drive));
 await p.evaluate(() => __game.vehicles.stopDriving({ silent: true }));
 const view = async (name, x, z, yaw, y = 0, pitch = 0.12) => { await p.evaluate(({ x, z, yaw, y, pitch }) => { const g = __game; g.clock.setMode('game'); g.clock.minutes = 12 * 60; g.player.teleport(x, z, yaw + Math.PI, y); g.cameraRig.yaw = yaw; g.cameraRig.pitch = pitch; g.cameraRig.snapTo(g.player.position); }, { x, z, yaw, y, pitch }); await p.waitForTimeout(3500); await p.screenshot({ path: `${OUT}/${name}.png` }); };
 // a save standing in Asaba starts at Bridgehead
 const moved = await p.evaluate(() => { const g = __game, a = g.world.landmarks.get('asaba'); g.saveData.player = { x: a.x, z: a.z, heading: 0 }; g.enterWorld(g.saveData.character, g.saveData.player); const q = g.player.position; return { locked: g.world.playArea.locked(q.x, q.z), d: Math.round(Math.hypot(q.x - g.world.landmarks.get('bridgehead').x, q.z - g.world.landmarks.get('bridgehead').z)) }; });
 check('a player saved in Asaba starts at Bridgehead', !moved.locked && moved.d < 120, JSON.stringify(moved));
 // a fixed camera looking at a point (cutscene mode), then back to following the player
 const fixed = async (name, from, to) => { await p.evaluate(({ from, to }) => { const g = __game; g.clock.setMode('game'); g.clock.minutes = 12 * 60; g.player.teleport(to.x + 30, to.z + 30); g.world.city.buildAround(to.x, to.z, 200); g.cameraRig.setMode('fixed'); const cam = g.cameraRig.camera; cam.position.set(from.x, from.y, from.z); cam.lookAt(to.x, to.y, to.z); }, { from, to }); await p.waitForTimeout(4000); await p.screenshot({ path: `${OUT}/${name}.png` }); await p.evaluate(() => __game.cameraRig.setMode('follow')); };
 const bar = await p.evaluate(() => __game.world.comingSoon.barriers[0]);
 await fixed('bridge-barrier', { x: bar.x + Math.sin(bar.yaw) * 26, y: bar.y + 4, z: bar.z + Math.cos(bar.yaw) * 26 }, { x: bar.x, y: bar.y + 3, z: bar.z });
 for (const [i, e] of info.edges.slice(0, 3).entries()) if (e.board) await fixed(`edge-coming-soon-${i}`, { x: e.board.x + Math.sin(e.board.yaw) * 14, y: 3, z: e.board.z + Math.cos(e.board.yaw) * 14 }, { x: e.board.x, y: 3.2, z: e.board.z });
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`soon48: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
