// v0.48: bus stops are built stops (pad, shelter, benches, sign with the stop's name), sized to the street.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4243', OUT = 'qa/v48'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (/stops\]/.test(m.text())) console.log('CONSOLE', m.text()); });
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 });
 const info = await p.evaluate(() => { const g = __game, st = g.transport.shelters.userData.stats, plats = g.transport.net.stops.flatMap((s) => s.platforms.map((pl) => ({ s: s.name, named: s.named, sh: pl.shelter ?? null, x: pl.x, z: pl.z, dx: pl.dx, dz: pl.dz }))); return { st, onRoad: plats.filter((q) => q.sh && g.world.map.onCarriageway(q.sh.x, q.sh.z, 0)).length, named: plats.filter((q) => q.named), plats }; });
 console.log(JSON.stringify(info.st));
 check('most stops are built stops, not a bare sign', (info.st.large + info.st.medium + info.st.small + info.st.mini) >= info.st.platforms * 0.8, JSON.stringify(info.st));
 check('three sizes: large at the named stops, medium on busy roads, small on quiet streets', info.st.large >= 6 && info.st.medium >= 5 && info.st.small >= 5, JSON.stringify(info.st));
 check('no shelter stands on a carriageway', info.onRoad === 0, String(info.onRoad));
 const fixed = async (name, q, back = 9) => { await p.evaluate(({ q, back }) => { const g = __game, rx = -q.dz, rz = q.dx; g.clock.setMode('game'); g.clock.minutes = 12 * 60; g.player.teleport(q.x - rx * 3, q.z - rz * 3); g.world.city.buildAround(q.x, q.z, 150); g.cameraRig.setMode('fixed'); const cam = g.cameraRig.camera; cam.position.set(q.x - rx * back + q.dx * 4, 2.6, q.z - rz * back + q.dz * 4); cam.lookAt(q.x + rx * 1.5 - q.dx * 2, 1.4, q.z + rz * 1.5 - q.dz * 2); }, { q, back }); await p.waitForTimeout(4500); await p.screenshot({ path: `${OUT}/${name}.png` }); await p.evaluate(() => __game.cameraRig.setMode('follow')); };
 for (const tier of ['large', 'medium', 'small']) { const q = info.plats.find((x) => x.sh?.tier === tier && !/Asaba/.test(x.s)); if (q) await fixed(`busstop-${tier}`, q, tier === 'large' ? 12 : 9); }
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`stops48: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
