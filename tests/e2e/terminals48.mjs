// v0.48: Upper Iweka and Bridgehead motor parks are real terminals; buses come in, load at bays and leave.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4243', OUT = 'qa/v48'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (/terminals/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 400)); });
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 });
 console.log(JSON.stringify(await p.evaluate(() => ({ why: __game.terminals.why, ms: __game.terminals.ms }))));
 const info = await p.evaluate(() => { const g = __game; return g.terminals.list.map((t) => ({ id: t.id, name: t.name, W: t.W, D: t.D, bays: t.bays.length, x: t.x, z: t.z, yaw: t.yaw, removed: t.removedBuses, lines: t.lines, roadType: t.road.type, n: t.n, f: t.f, O: t.O })); });
 console.log(JSON.stringify(info));
 check('two terminals: Upper Iweka Motor Park and Bridgehead Motor Park', info.length === 2 && info.some((t) => /Upper Iweka/.test(t.name)) && info.some((t) => /Bridgehead/.test(t.name)), info.map((t) => t.name).join(', '));
 check('each has at least 4 numbered loading bays on a yard at least 40 m wide', info.every((t) => t.bays >= 4 && t.W >= 40), JSON.stringify(info.map((t) => [t.W, t.D, t.bays])));
 const clash = await p.evaluate(() => { const g = __game; let n = 0; const inP = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }; for (const t of g.terminals.list) for (const bd of g.world.map.buildings) { if (bd.layoutHidden) continue; const cx = bd.pts.reduce((a, q) => a + q[0], 0) / bd.pts.length, cz = bd.pts.reduce((a, q) => a + q[1], 0) / bd.pts.length; if (inP(cx, cz, t.pts)) n++; } return n; });
 check('no building stands in a yard', clash === 0, String(clash));
 // go to Upper Iweka and let the yard work (stepping the yard directly; the frame loop is slow in software rendering)
 const run = await p.evaluate(async () => {
  const g = __game, t = g.terminals.list.find((q) => /Upper/.test(q.name)), c = t.P(0, -6);
  g.player.teleport(c.x, c.z); g.clock.setMode('game'); g.clock.minutes = 11 * 60;
  const seen = new Set(), handed = []; let enteredBay = false;
  const watch = new Map();
  for (let i = 0; i < 2400; i++) {
   g.terminals.update(0.25);
   for (const v of g.traffic.vehicles) { if (v.scripted?.step) v.scripted.step(v, 0.25); if (v.terminal || watch.has(v)) watch.set(v, true); }
   for (const bay of t.bays) seen.add(bay.state); 
   for (const v of watch.keys()) if (!v.terminal && v.edge && !handed.includes(v.id)) handed.push(v.id);
   if (t.bays.some((b) => b.state === 'unloading')) enteredBay = true;
   if (handed.length >= 2 && enteredBay) break;
  }
  return { states: [...seen], handed: handed.length, enteredBay, loading: t.bays.filter((b) => b.state === 'loading').length };
 });
 check('a bus comes in from the road, pulls into a free bay and unloads', run.enteredBay, JSON.stringify(run));
 check('buses load, reverse out, leave through the exit and rejoin the traffic', run.handed >= 1 && run.states.includes('leaving'), JSON.stringify(run));
 const ticket = await p.evaluate(() => { const g = __game, t = g.terminals.list[0], c = t.P(t.W / 2 - 6, 0.6); g.player.teleport(c.x, c.z); const label = g.interactions.update(c.x, c.z); g.interactions.trigger(); const v = g.terminals.ticketView(t); g.closeChoice?.(); return { label, body: v.body }; });
 check('the ticket office explains the city lines; intercity travel is COMING SOON', /Ticket office/.test(ticket.label) && /COMING SOON/.test(ticket.body), JSON.stringify(ticket).slice(0, 220));
 const fixed = async (name, from, to) => { await p.evaluate(({ from, to }) => { const g = __game; g.clock.setMode('game'); g.clock.minutes = 12 * 60; g.world.city.buildAround(to.x, to.z, 200); g.cameraRig.setMode('fixed'); const cam = g.cameraRig.camera; cam.position.set(from.x, from.y, from.z); cam.lookAt(to.x, to.y, to.z); }, { from, to }); await p.waitForTimeout(4500); await p.screenshot({ path: `${OUT}/${name}.png` }); await p.evaluate(() => __game.cameraRig.setMode('follow')); };
 for (const t of info) {
  const P = (u, v) => ({ x: t.O.x + t.f.x * u + t.n.x * v, z: t.O.z + t.f.z * u + t.n.z * v }), k = /Upper/.test(t.name) ? 'upper-iweka' : 'bridgehead';
  await p.evaluate(({ x, z }) => { __game.player.teleport(x, z); __game.terminals.update(0.1); }, P(0, -8));
  const a = P(-t.W * 0.55, -16), m = P(0, t.D * 0.55); await fixed(`terminal-${k}`, { x: a.x, y: 16, z: a.z }, { x: m.x, y: 0, z: m.z });
  const s = P(-4, 4), sm = P(4, 14); await fixed(`terminal-${k}-shed`, { x: s.x, y: 2.2, z: s.z }, { x: sm.x, y: 1.6, z: sm.z });
 }
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`terminals48: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
