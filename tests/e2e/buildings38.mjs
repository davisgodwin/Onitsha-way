// v0.38 buildings: building kit types, houses on empty land with compounds, flats, night lights, performance.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4238', OUT = 'qa/v38'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const c = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'medium', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
  const p = await c.newPage(); p.setDefaultTimeout(300000);
  p.on('pageerror', (e) => errors.push(e.message));
  const t0 = Date.now();
  await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 400000 });
  const loadS = (Date.now() - t0) / 1000;
  await p.evaluate(() => { const g = __game; g.clock.setMode('game'); g.clock.minutes = 12 * 60; g.clock.rate = 0; document.querySelector('#screen-hud').style.visibility = 'hidden'; });
  const s = await p.evaluate(() => { const g = __game, w = g.world; return { types: w.city.stats.buildingTypes, infill: w.stats.infillHouses, compounds: w.stats.infillCompounds, ms: w.stats.infillMs, neighbours: w.stats.compoundNeighbours, imported: [...w.city.chunks.values()].reduce((n, ch) => n + ch.items.filter((i) => i.imported).length, 0), buildings: w.city.stats.buildings }; });
  console.log('STATS', JSON.stringify(s), 'load', loadS + 's');
  check('all eight Onitsha building types are in the city', ['oldbungalow', 'tenement', 'modernbungalow', 'duplex', 'storeyflats', 'apartment', 'shopsrooms', 'selfcon'].every((t) => s.types[t] > 100), JSON.stringify(s.types));
  check('thousands of houses fill empty land, most in walled compounds', s.infill >= 3000 && s.compounds >= 1500, `${s.infill} houses, ${s.compounds} compounds`);
  check('no supplied-pack buildings', s.imported === 0);
  check('neighbours stand at compound gates', s.neighbours > 300, String(s.neighbours));
  const safety = await p.evaluate(async () => {
    const g = __game, w = g.world, { roadConflict } = await import('/src/world/StreetLayout.js').catch(() => ({}));
    const keep = w.landmarks.list.filter((l) => ['market', 'mall', 'monument', 'church', 'stadium', 'park', 'interchange', 'school'].includes(l.kind));
    const inKeep = w.infill.houses.filter((h) => keep.some((l) => Math.hypot(h.x - l.x, h.z - l.z) < Math.min((l.radius ?? 60) + 20, 195))).length;
    const onRoad = w.infill.houses.filter((h) => h.pts.some(([x, z]) => w.map.onCarriageway(x, z, 0.5))).length;
    const doorsBlocked = g.homes.listings.filter((h) => !w.collision.isFree(h.door.stand.x, h.door.stand.z, 0.4)).map((h) => h.id);
    const gatesOpen = w.infill.compounds.slice(0, 300).filter((c) => { const [g0, g1] = c.gate, mx = (g0[0] + g1[0]) / 2, mz = (g0[1] + g1[1]) / 2, nx = Math.sin(c.yaw), nz = Math.cos(c.yaw); return w.collision.raycast(mx + nx * 1.5, mz + nz * 1.5, mx - nx * 1.2, mz - nz * 1.2) >= 0.99; }).length;
    const wallsBlock = w.infill.compounds.slice(0, 300).filter((c) => { const nx = Math.sin(c.yaw), nz = Math.cos(c.yaw), sx = c.x - nx * (c.hd + 1.5), sz = c.z - nz * (c.hd + 1.5); return w.collision.raycast(sx, sz, sx + nx * 2.5, sz + nz * 2.5) < 0.99; }).length;
    return { inKeep, onRoad, doorsBlocked, gatesOpen, wallsBlock, listings: g.homes.listings.length, flats: g.homes.listings.filter((h) => h.multiUnit).length };
  });
  console.log('SAFETY', JSON.stringify(safety));
  check('no new house in markets, parks, schools, churches, monuments, the mall or the stadium', safety.inKeep === 0, String(safety.inKeep));
  check('no new house on a road', safety.onRoad === 0, String(safety.onRoad));
  check('every home door (original and new flats) is still clear', safety.doorsBlocked.length === 0, safety.doorsBlocked.join(','));
  check('compound gates are open to walk through and the back walls are solid', safety.gatesOpen >= 290 && safety.wallsBlock >= 290, `${safety.gatesOpen}/300 open, ${safety.wallsBlock}/300 back walls solid`);
  check('90 rentable homes: the 46 originals plus 44 flats in multi-unit buildings', safety.listings === 90 && safety.flats === 44);

  // rent and enter a flat, save, reload, still yours
  const flat = await p.evaluate(() => { const g = __game, h = g.homes.listings.find((x) => x.multiUnit && x.type === 'flat') ?? g.homes.listings.find((x) => x.multiUnit); g.economy.transact({ key: 'qa38', amount: 100000, reason: 'qa' }); const r = g.homes.housing.rent(h.id); g.homes.enter(h, { fade: false }); const ok = r.ok !== false && !!g.homes.inside; g.homes.exit(); g.saveGameNow?.() ?? g.saveGame(); return { id: h.id, ok, status: g.homes.housing.status(h.id) }; });
  check('a flat in a block can be rented and entered', flat.ok && flat.status === 'tenant', JSON.stringify(flat));

  // performance and looks at street level, aerial and night
  const spots = await p.evaluate(() => { const w = __game.world; const pick = (f) => w.infill.houses.filter(f)[25]; return [pick((h) => h.old), pick((h) => !h.old && h.compound), pick((h) => h.levels > 1)].filter(Boolean).map((h) => [h.x, h.z, h.yaw]); });
  const settle = async () => { await p.waitForTimeout(1500); await p.waitForFunction(() => { const g = __game, c = g.world.city, q = g.player.position; return !c.job && ![...c.chunks.values()].some((ch) => !ch.group && Math.hypot(ch.cx - q.x, ch.cz - q.z) < 260); }, null, { timeout: 240000 }).catch(() => {}); await p.waitForTimeout(3000); };
  const info = () => p.evaluate(() => { const r = __game.renderer.renderer; r.info.reset?.(); __game.renderer.render?.(); const i = r.info.render; return { calls: i.calls, tris: i.triangles }; });
  const perf = []; let k = 0;
  for (const [x, z, yaw] of spots) {
    await p.evaluate(([x, z, yaw]) => { const g = __game, d = 20; g.player.teleport(x + Math.sin(yaw) * d, z + Math.cos(yaw) * d); g.cameraRig.yaw = yaw; g.cameraRig.pitch = 0.16; g.cameraRig.distance = 5; g.cameraRig.snapTo(g.player.position.clone().add({ x: 0, y: 2, z: 0 })); }, [x, z, yaw]);
    await settle(); const a = await info(); perf.push(a); await p.screenshot({ path: `${OUT}/street-${++k}.png` });
    await p.evaluate(([x, z, yaw]) => { const g = __game, cam = g.renderer.camera; g.cameraRig.setMode('fixed'); cam.position.set(x + Math.sin(yaw) * 70, 75, z + Math.cos(yaw) * 70); cam.lookAt(x, 0, z); cam.updateMatrixWorld(); g.renderer.sky.position.copy(cam.position); }, [x, z, yaw]); await settle(); perf.push(await info()); await p.screenshot({ path: `${OUT}/aerial-${k}.png` });
    await p.evaluate(() => { __game.cameraRig.setMode('follow'); });
  }
  console.log('PERF', JSON.stringify(perf));
  check('draw calls and triangles stay in the earlier range (medium quality)', perf.every((q) => q.calls < 450 && q.tris < 1.3e6), JSON.stringify(perf));
  await p.evaluate(() => { const g = __game; g.clock.minutes = 22 * 60; });
  // wait for the frame loop to reach night (a few frames a second on this software renderer)
  await p.waitForFunction(() => (__game.atmosphere.nightK ?? 0) > 0.8 && (__game.world.city.glowMaterial?.opacity ?? 0) > 0.5, null, { timeout: 120000 }).catch(() => {});
  const night = await p.evaluate(() => ({ glow: __game.world.city.glowMaterial?.opacity ?? 0 }));
  check('windows and security lights glow at night', night.glow > 0.5, JSON.stringify(night));
  await p.evaluate(() => { __game.cameraRig.distance = 9; __game.cameraRig.pitch = 0.12; }); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/night.png` });
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(`buildings38: ${checks.length} checks passed; load ${loadS}s; infill planning ${JSON.stringify(s.ms)}`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
