// v0.45: the palace visitors' hall, churches, school, ICT hub, hotel and the new eateries have proper rooms; an
// eatery menu and a date with someone you know.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4246', OUT = 'qa/v45'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message));
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 });
 await p.evaluate(() => { const g = __game; g.clock.setMode('game'); g.clock.rate = 0; g.clock.minutes = 13 * 60; });
 const L = (id) => `g.civic.enter(g.world.landmarks.list.find((l) => l.id === "${id}"))`;
 const places = [
  ['palace', L('ime-obi'), 'palace', /Visitors' book/],
  ['church-basilica', L('basilica'), 'church', /reflect/],
  ['church-all-saints', L('all-saints'), 'church', /reflect/],
  ['school', L('ckc'), 'school', /evening classes/],
  ['ict', L('metadav'), 'ictlab', /Equipment desk/],
  ['hotel', 'g.civic.enter(g.world.landmarks.list.find((l) => l.kind === "hotel"))', 'hotel', /Reception/],
  ...[0, 1, 2].map((i) => [`eatery-${i + 1}`, `g.eateries.enter(g.eateries.list[${i}])`, 'eatery', /order food/]),
 ];
 for (const [name, enter, kind, counter] of places) {
  const r = await p.evaluate(({ enter }) => { const g = __game; g.closeChoice?.(); if (g.civic.inside) g.civic.exit({ quiet: true }); const ok = new Function('g', `return ${enter}`)(g); return { ok: ok !== false, inside: !!g.civic.inside, room: !!g.civic.room, seats: g.civic.room?.seats.length ?? 0 }; }, { enter });
  await p.waitForTimeout(1800); await p.screenshot({ path: `${OUT}/${name}.png` });
  const found = await p.evaluate(() => { const g = __game, pos = g.player.position, labels = []; for (const it of g.interactions.items) { if (it.enabled && !it.enabled()) continue; if (Math.hypot(it.x - pos.x, it.z - pos.z) > 30) continue; labels.push(typeof it.label === 'function' ? it.label() : it.label); } return labels; });
  check(`${name}: a proper ${kind} room (not the old plain box), seats, its counters`, r.inside && r.room && r.seats > 4 && found.some((l) => counter.test(l)), JSON.stringify({ ...r, found: found.slice(0, 6) }));
 }
 await p.evaluate(() => __game.civic.exit({ quiet: true }));
 check('the eateries are on the map', await p.evaluate(() => __game.eateries.places().length === 3));
 // order food
 const ord = await p.evaluate(() => { const g = __game; g.economy.transact({ key: 'qa45-food', amount: 50000, reason: 'qa' }); const e = g.eateries.list[0]; g.eateries.enter(e); g.needs.state.hunger = 20; const before = g.economy.balance; const v = g.eateries.menuView(e); const o = v.options[0]; o.act(); return { label: o.label, spent: before - g.economy.balance, hunger: g.needs.state.hunger }; });
 check('order at the counter: you pay and it fills you up', ord.spent > 0 && ord.hunger > 50, JSON.stringify(ord));
 // a date with someone you know
 const dt = await p.evaluate(() => { const g = __game, e = g.eateries.list[2]; g.civic.exit({ quiet: true }); g.eateries.enter(e); g.npcs.rels['qa-date'] = { name: 'Chioma', role: 'trader', talks: 6, positive: 3, negative: 0, knowsName: true, bumps: 0, lastDay: 0 }; const v = g.eateries.inviteView(e); const o = v.options.find((x) => /Chioma/.test(x.label)); o.act(); return { invited: !!g.eateries.date, rig: !!g.eateries.date?.rig }; });
 check('invite someone you know: they come and sit at a table for two', dt.invited && dt.rig, JSON.stringify(dt));
 const sat = await p.evaluate(() => { const g = __game, d = g.eateries.date; g.eateries.sitAt(d.eatery, d.table); const v = g.eateries.dateView(); return { kind: g.player.posture?.kind, title: v.title, n: v.options.length }; });
 check('sit with them: you sit down and the date begins', sat.kind === 'sit' && /Chioma/.test(sat.title), JSON.stringify(sat));
 await p.evaluate(() => { __game.closeChoice(); __game.cameraRig.pitch = 0.3; __game.cameraRig.yaw = Math.PI; }); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/date.png` });
 const end = await p.evaluate(() => { const g = __game, d = g.eateries.date, run = () => g.eateries.dateView(); let v = run(); v.options[0].act(); for (let i = 0; i < 3; i++) { v = run(); const best = v.options.reduce((a, b, k) => (g.eateries.date.topics[k].score > g.eateries.date.topics[a].score ? k : a), 0); v.options[best].act(); } v = run(); const text = v.text; v.options[0].act(); const r = g.npcs.rels['qa-date']; return { text, dates: r.dates, positive: r.positive, over: !g.eateries.date }; });
 check('order for two, talk three rounds, say goodnight: the relationship grows', end.over && end.dates === 1 && end.positive > 3, JSON.stringify(end));
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`interiors45: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
