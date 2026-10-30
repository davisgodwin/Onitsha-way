// v0.48 audit: read-only facts about the map, transport, vehicles and neighbourhoods, plus reference screenshots.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4243', OUT = 'qa/audit48'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000);
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 });
 const info = await p.evaluate(() => {
  const g = __game, m = g.world.map, legacyMinX = m.meta.legacy.playBounds.minX;
  const net = g.transport.net;
  const stops = net.stops.map(s => ({ name: s.name, named: s.named, x: Math.round(s.x), z: Math.round(s.z), plats: s.platforms.length, lines: [...s.lines].map(l => l.id ?? l) }));
  const asabaHomes = g.homes.listings.filter(h => (h.door?.x ?? h.x ?? 0) < legacyMinX).length;
  const homes = g.homes.listings.length;
  const types = {}; for (const ch of g.world.city.chunks.values()) for (const it of ch.items) { const t = it.plan?.type ?? it.kind ?? 'other'; types[t] = (types[t] || 0) + 1; }
  const asabaBld = m.buildings.filter(bd => bd.pts[0][0] < legacyMinX).length;
  const lm = g.world.landmarks.list.map(l => ({ id: l.id, kind: l.kind, x: Math.round(l.x), z: Math.round(l.z) }));
  const traffic = {}; for (const v of g.traffic.vehicles ?? []) { const k = v.model ?? v.type ?? '?'; traffic[k] = (traffic[k] || 0) + 1; }
  const areas = m.areas.map(a => ({ kind: a.kind, x: Math.round(a.pts.reduce((s, q) => s + q[0], 0) / a.pts.length), z: Math.round(a.pts.reduce((s, q) => s + q[1], 0) / a.pts.length) }));
  return { bounds: m.bounds, legacyMinX, stops: stops.length, namedStops: stops.filter(s => s.named).map(s => s.name + ' ' + s.lines.join('/')), platforms: stops.reduce((a, s) => a + s.plats, 0), asabaStops: stops.filter(s => s.x < legacyMinX).map(s => s.name), homes, asabaHomes, asabaBld, types, lm, traffic, areas, lots: g.vehicles.dealerships?.length ?? null, owned: Object.keys(g.saveData.vehicles ?? {}).length, infill: g.world.infill?.houses?.length ?? g.infill?.houses?.length ?? null };
 });
 fs.writeFileSync(OUT + '/facts.json', JSON.stringify(info, null, 1)); console.log(JSON.stringify(info).slice(0, 3000));
 const shot = async (name, x, z, yaw, pitch = 0.2, dist) => { await p.evaluate(({ x, z, yaw, pitch }) => { const g = __game; g.clock.setMode('game'); g.clock.minutes = 12 * 60; g.player.teleport(x, z, yaw); g.cameraRig.yaw = yaw; g.cameraRig.pitch = pitch; g.cameraRig.snapTo(g.player.position); }, { x, z, yaw, pitch }); await p.waitForTimeout(3500); await p.screenshot({ path: `${OUT}/${name}.png` }); };
 const pk = info.lm.find(l => l.id === 'upper-iweka-park'); await shot('upper-iweka-park', pk.x + 30, pk.z + 30, Math.PI / 4, 0.45);
 const st = await p.evaluate(() => { const s = __game.transport.net.stops.find(s => !s.named) ?? __game.transport.net.stops[0]; const pl = s.platforms[0]; return { x: pl.poleX + pl.dx * 8, z: pl.poleZ + pl.dz * 8, yaw: Math.atan2(pl.dx, pl.dz) }; });
 await shot('busstop-small', st.x, st.z, st.yaw, 0.15);
 const ns = await p.evaluate(() => { const s = __game.transport.net.stops.find(s => s.named); const pl = s.platforms[0]; return { x: pl.poleX + pl.dx * 9, z: pl.poleZ + pl.dz * 9, yaw: Math.atan2(pl.dx, pl.dz) }; });
 await shot('busstop-named', ns.x, ns.z, ns.yaw, 0.15);
 const sh = info.lm.find(l => l.id === 'shoprite'); await shot('east-near-mall', sh.x + 150, sh.z - 120, 0, 0.3);
 const fe = info.lm.find(l => l.id === 'fegge'); await shot('fegge-street', fe.x, fe.z, 0.5, 0.25);
 const as = info.lm.find(l => l.id === 'asaba'); await shot('asaba-bank', as.x, as.z, Math.PI / 2, 0.3);
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { await b.close(); }
