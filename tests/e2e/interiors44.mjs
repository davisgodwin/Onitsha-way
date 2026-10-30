// v0.44: every establishment has a walk-in interior that looks the part: police station, EFCC office, hospital,
// bank, Magistrate Court, Shoprite and the four home stores. Walk in, find the counter, use it, walk out.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4244', OUT = 'qa/v44'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message));
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 });
 await p.evaluate(() => { const g = __game; g.clock.setMode('game'); g.clock.rate = 0; g.clock.minutes = 10 * 60; });
 const places = [
  ['police', 'g.story.enterOffice(g.story.offices.find((o) => o.id === "police"))', 'g.story.exitOffice()', /Charge room/],
  ['efcc', 'g.story.enterOffice(g.story.offices.find((o) => o.id === "efcc"))', 'g.story.exitOffice()', /EFCC reception/],
  ['hospital', 'g.hospitals.enter(g.hospitals.list[0])', 'g.civic.exit()', /Reception|Consulting|Ward|Pharmacy/],
  ['bank', 'g.business.enterBank(g.business.branches[0])', 'g.civic.exit()', /Teller|Customer service|ATM/],
  ['bank-2', 'g.business.enterBank(g.business.branches[1])', 'g.civic.exit()', /Teller|Customer service|ATM/],
  ['court', 'g.justice.enterCourt()', 'g.civic.exit()', /Registry|bench|magistrate/i],
  ['shoprite', 'g.civic.enter(g.world.landmarks.list.find((l) => l.kind === "mall"))', 'g.civic.exit()', /Shoprite departments|Checkout/],
  ...['furniture', 'electronics', 'lighting', 'decor'].map((s) => [`store-${s}`, `g.homeStores.enter(...(() => { const st = g.homeStores.stores.find((x) => x.shop === "${s}"); return [st, st, { name: st.name }]; })())`, 'g.civic.exit()', /browse & buy/]),
 ];
 for (const [name, enter, exit, counter] of places) {
  const r = await p.evaluate(({ enter }) => { const g = __game; g.closeChoice?.(); const ok = new Function('g', `return ${enter}`)(g); return { ok: ok !== false, inside: !!(g.civic.inside || g.story.inside) }; }, { enter });
  await p.waitForTimeout(1800); await p.screenshot({ path: `${OUT}/${name}.png` });
  const found = await p.evaluate(() => { const g = __game, pos = g.player.position, labels = []; for (const it of g.interactions.items) { if (it.enabled && !it.enabled()) continue; if (Math.hypot(it.x - pos.x, it.z - pos.z) > 30) continue; labels.push(typeof it.label === 'function' ? it.label() : it.label); } return labels; });
  const left = await p.evaluate(({ exit }) => { const g = __game; new Function('g', exit)(g); return !(g.civic.inside || g.story.inside); }, { exit });
  check(`${name}: walk in, the counters are there, walk out`, r.inside && found.some((l) => counter.test(l)) && left, JSON.stringify({ ...r, found: found.slice(0, 5), left }));
 }
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`interiors44: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
