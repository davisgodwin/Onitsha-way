// v0.43: hospitals, banks and the court are purpose-built buildings on their own plots, clear of the home stores.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4243', OUT = 'qa/v43'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message));
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 });
 const info = await p.evaluate(() => {
  const g = __game, stores = g.homeStores.stores.map((s) => ({ name: s.name, x: s.door.stand.x, z: s.door.stand.z, id: s.buildingId }));
  const venues = [...g.hospitals.list.map((h) => ({ name: h.name, venue: !!h.venue, x: h.place.x, z: h.place.z, bid: h.buildingId ?? null })), ...g.business.branches.map((br) => ({ name: br.name, venue: !!br.venue, x: br.x, z: br.z, bid: br.buildingId ?? null })), { name: 'court', venue: true, x: g.justice.court.x, z: g.justice.court.z }];
  const near = venues.map((v) => ({ name: v.name, nearestStore: Math.round(Math.min(...stores.map((s) => Math.hypot(s.x - v.x, s.z - v.z)))) }));
  // nothing of the city's own buildings stands inside a venue's plot
  const plots = (g.world.venuePlots ?? []).filter((q) => venues.some((v) => Math.hypot(v.x - q.x, v.z - q.z) < 30));
  const inside = (q, x, z) => { const c = Math.cos(q.yaw), s = Math.sin(q.yaw), dx = x - q.x, dz = z - q.z, lx = c * dx - s * dz, lz = s * dx + c * dz; return Math.abs(lx) < q.w / 2 - 0.5 && Math.abs(lz) < q.d / 2 - 0.5; };
  let clash = 0; for (const bd of g.world.map.buildings) { if (bd.layoutHidden) continue; const cx = bd.pts.reduce((a, p) => a + p[0], 0) / bd.pts.length, cz = bd.pts.reduce((a, p) => a + p[1], 0) / bd.pts.length; if (plots.some((q) => inside(q, cx, cz))) clash++; }
  return { venues, near, clash, plots: plots.length };
 });
 check('both hospitals and both banks are purpose-built (not borrowed shop buildings)', info.venues.every((v) => v.venue && !v.bid), JSON.stringify(info.venues.map((v) => [v.name, v.venue])));
 check('no hospital or bank shares a spot with a home store (Ezinne Furniture and the others)', info.near.every((n) => n.nearestStore > 25), JSON.stringify(info.near));
 check('no city building stands inside their plots', info.clash === 0 && info.plots >= 5, JSON.stringify({ clash: info.clash, plots: info.plots }));
 for (const [i, v] of info.venues.entries()) {
  await p.evaluate(({ x, z }) => { const g = __game, h = g.world.venuePlots.find((q) => Math.hypot(q.x - x, q.z - z) < 30); const yaw = h?.yaw ?? 0, ox = Math.sin(yaw) * 16, oz = Math.cos(yaw) * 16; g.clock.setMode('game'); g.clock.minutes = 12 * 60; g.player.teleport(x + ox, z + oz, yaw + Math.PI); g.cameraRig.yaw = yaw; g.cameraRig.pitch = 0.18; g.cameraRig.snapTo(g.player.position); }, v);
  await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/${['hospital-1', 'hospital-2', 'bank-1', 'bank-2', 'court'][i] ?? 'venue-' + i}.png` });
 }
 const near = await p.evaluate(() => { const g = __game, h = g.hospitals.list[0]; g.player.teleport(h.place.x, h.place.z); const br = g.business.branches[0]; return { hospital: g.interactions.update(h.place.x, h.place.z), bank: g.interactions.update(br.x, br.z) }; });
 check('the hospital and bank doors lead inside', /go in/.test(String(near.hospital)) && /go in|ATM/.test(String(near.bank)), JSON.stringify(near));
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`buildings43: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
