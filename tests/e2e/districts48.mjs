// v0.48: neighbourhoods look different: trees on middle-income streets, drains in the old districts, painted kerbs
// on main roads; GRA Phase I and II (from the OpenStreetMap export) with villas, palms, lawns and good cars.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4243', OUT = 'qa/v48'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const open = async (q) => { const c = await b.newContext({ viewport: { width: 1280, height: 800 } }); await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); }); const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (/districts\]/.test(m.text())) console.log('CONSOLE', m.text()); }); await p.goto(URL + '/?quickstart' + q); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 }); return p; };
const fixed = async (p, name, from, to) => { await p.evaluate(({ from, to }) => { const g = __game; g.clock.setMode('game'); g.clock.minutes = 12 * 60; g.player.teleport(to.x, to.z); g.world.city.buildAround(to.x, to.z, 220); g.cameraRig.setMode('fixed'); const cam = g.cameraRig.camera; cam.position.set(from.x, from.y, from.z); cam.lookAt(to.x, to.y, to.z); }, { from, to }); await p.waitForTimeout(5000); await p.screenshot({ path: `${OUT}/${name}.png` }); await p.evaluate(() => __game.cameraRig.setMode('follow')); };
try {
 const p = await open('');
 const st = await p.evaluate(() => __game.world.districtDressing.userData.stats);
 console.log(JSON.stringify(st));
 check('street trees on middle-income streets', st.trees > 300, String(st.trees));
 check('open drains along the old districts\' side streets', st.drains > 100, String(st.drains));
 check('painted kerbs on the main roads', st.kerbs > 50, String(st.kerbs));
 check('GRA dressing in the real GRA: palms, lawns, lamp posts, good cars', st.palms > 40 && st.gra > 10, JSON.stringify(st));
 const spots = await p.evaluate(() => { const g = __game, D = g.world.districts, pick = (kind) => { for (const s of g.world.map.segments) { const r = s.road; if (r.elevated || r.width < 6) continue; const mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2; if (D.at(mx, mz, r) === kind && Math.hypot(s.bx - s.ax, s.bz - s.az) > 40) return { x: mx, z: mz, dx: (s.bx - s.ax) / Math.hypot(s.bx - s.ax, s.bz - s.az), dz: (s.bz - s.az) / Math.hypot(s.bx - s.ax, s.bz - s.az) }; } return null; }; return { middle: pick('middle'), dense: pick('dense'), mixed: pick('mixed') }; });
 for (const [k, s] of Object.entries(spots)) if (s) await fixed(p, `district-${k}`, { x: s.x - s.dx * 30, y: 3, z: s.z - s.dz * 30 }, { x: s.x + s.dx * 10, y: 1.5, z: s.z + s.dz * 10 });
 await p.context().close();
 // the real GRA (Phase I and II from the OSM export)
 const q = await open('');
 const gra = await q.evaluate(() => { const g = __game, D = g.world.districts, out = {}; for (const a of D.premium) { const types = {}; for (const ch of g.world.city.chunks.values()) for (const it of ch.items) { if (D.premiumAt(it.cx, it.cz) <= 0.5 || Math.hypot(it.cx - a.x, it.cz - a.z) > a.r) continue; const t = it.plan?.type ?? 'none'; types[t] = (types[t] ?? 0) + 1; } out[a.name] = { x: Math.round(a.x), z: Math.round(a.z), open: !g.world.playArea.locked(a.x, a.z), types }; }
  const tr = g.traffic, prem = new Set(g.vehicles.spots.filter((s) => s.lot === 'lot-premium').map((s) => s.model)), a = D.premium[0], fe = g.world.landmarks.get('fegge'); const share = (x, z) => { let n = 0; for (let i = 0; i < 3000; i++) if (prem.has(tr.pickType({ major: true }, x, z))) n++; return n / 3000; };
  return { areas: out, premiumShare: { gra: share(a.x, a.z), fegge: share(fe.x, fe.z) } }; });
 console.log(JSON.stringify(gra));
 const areas = Object.values(gra.areas), sum = (t, k) => areas.reduce((n, a) => n + (a.types[k] ?? 0), 0);
 check('GRA Phase I and II are in the map, open to play (not COMING SOON)', areas.length >= 2 && areas.every((a) => a.open), JSON.stringify(gra.areas));
 check('GRA houses are villas, mansions and duplexes, never tenements', sum(0, 'villa') + sum(0, 'mansion') > 20 && !sum(0, 'tenement'), JSON.stringify(areas.map((a) => a.types)));
 check('premium cars are common in GRA traffic and rare elsewhere', gra.premiumShare.gra > gra.premiumShare.fegge * 3, JSON.stringify(gra.premiumShare));
 const s2 = await q.evaluate(() => { const g = __game, D = g.world.districts; for (const s of g.world.map.segments) { const r = s.road; if (r.elevated || r.width < 5) continue; const mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2; if (D.at(mx, mz, r) === 'gra' && D.premiumAt(mx, mz) > 0.9 && Math.hypot(s.bx - s.ax, s.bz - s.az) > 35) { const L = Math.hypot(s.bx - s.ax, s.bz - s.az); return { x: mx, z: mz, dx: (s.bx - s.ax) / L, dz: (s.bz - s.az) / L }; } } return null; });
 if (s2) { await fixed(q, 'district-gra', { x: s2.x - s2.dx * 28, y: 3.2, z: s2.z - s2.dz * 28 }, { x: s2.x + s2.dx * 10, y: 1.5, z: s2.z + s2.dz * 10 }); await fixed(q, 'district-gra-air', { x: s2.x - s2.dx * 40 + 30, y: 40, z: s2.z - s2.dz * 40 }, { x: s2.x, y: 0, z: s2.z }); }
 // the player can walk into GRA: the player's position is kept there (not pushed back as COMING SOON)
 const walk = await q.evaluate(async () => { const g = __game, a = g.world.districts.premium[0]; const [x, z] = g.world.findFreeSpot(a.x, a.z, 0.6); g.player.teleport(x, z); await new Promise((r) => setTimeout(r, 1500)); return { d: Math.hypot(g.player.position.x - x, g.player.position.z - z) }; });
 check('the player can be in GRA', walk.d < 3, JSON.stringify(walk));
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`districts48: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
