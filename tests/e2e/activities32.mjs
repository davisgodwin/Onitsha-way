/**
 * Browser checks for v0.32 city activities: pool, draughts, street food, barbershop, game zone, viewing centre,
 * basketball, jogging, car wash, weekly events. Run `npm run build` first; serves dist/ on port 4232 (quickstart).
 * Real keyboard/touch input is used for controls; long waits (matches, racks, laps) are fast-forwarded through the
 * engines because software-rendered frames are much slower than real time.
 */
import fs from 'node:fs'; import assert from 'node:assert/strict'; import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const port = 4232, base = `http://127.0.0.1:${port}`, dir = 'qa/v32'; fs.mkdirSync(dir, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 250)); }
const checks = []; const check = (name, ok, info = '') => { checks.push(name); assert.ok(ok, `${name} ${info}`); console.log('PASS', name); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const choose = async (p, re) => { await p.waitForFunction((src) => [...document.querySelectorAll('#screen-choice button')].some((x) => new RegExp(src).test(x.textContent)), re.source, { timeout: 30000 }).catch(() => {}); return p.evaluate((src) => { const b = [...document.querySelectorAll('#screen-choice button')].find((x) => new RegExp(src).test(x.textContent)); if (!b || b.disabled) return false; b.click(); return true; }, re.source); };
const panelBtn = (p, re) => p.evaluate((src) => { const b = [...document.querySelectorAll('.act-buttons button')].find((x) => new RegExp(src).test(x.textContent)); if (!b) return false; b.click(); return true; }, re.source);
const at = (p, expr, u, w) => p.evaluate(([e, u, w]) => { const s = eval(e), q = s.at(u, w); __game.player.teleport(q.x, q.z); }, [expr, u, w]);
const inActivity = (p) => p.waitForFunction(() => __game.state === 'activity', null, { timeout: 60000 });
const recorded = (p) => p.waitForFunction(() => __game.activities.current?.recorded, null, { timeout: 60000 });
const prompt = (p, src) => p.waitForFunction((src) => new RegExp(src).test(__game.interactions.current?.label?.() ?? ''), src, { timeout: 30000 }).then(() => true, () => false);
const bal = (p) => p.evaluate(() => __game.economy.balance);
async function open(p) {
  await p.goto(base + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 300000 });
  await p.evaluate(() => { const g = __game; g.clock.setMode('game'); g.clock.minutes = 15 * 60; g.needs.state.energy = 90; g.needs.state.hunger = 80; for (let i = 0; i < 6; i++) g.economy.transact({ key: 'qa:funds:' + i, amount: 100000, reason: 'QA funds' }); });
}
try {
  const p = await browser.newPage({ viewport: { width: 1100, height: 640 } }); const errors = [];
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(m.text()); if (/could not place/.test(m.text())) errors.push(m.text()); });
  await open(p);
  check('all activity places found road-fronting plots', await p.evaluate(() => { const g = __game; return !!(g.parlour.site && g.streetServices.stalls.length === 4 && g.streetServices.barber && g.entertainment.zone && g.entertainment.view && g.court.site && g.jogging.startSpot && g.carWash.site); }));
  check('the map directory lists every new place', await p.evaluate(() => { __game.updatePlaces(); const L = __game.minimap.places.map((x) => x.label).join('|'); return ['Market Corner Pool', 'Suya', 'corn', 'puff-puff', 'Mama Put', 'Barbing', 'Game Zone', 'Viewing Centre', 'Community Court', 'running track', 'Car Wash', '5-a-side'].every((k) => L.toLowerCase().includes(k.toLowerCase())); }));

  // -------- pool, with a stake
  await at(p, '__game.parlour.site', 0, -3.3); await p.waitForTimeout(2500);
  check('pool prompt at the table', await prompt(p, '8-ball'));
  await p.evaluate(() => { __game.parlour.poolOpts = { opp: 0, stake: 1 }; }); await p.keyboard.press('KeyE'); await p.waitForTimeout(1500);
  const b0 = await bal(p); check('pool menu: rack them up', await choose(p, /Rack them up/)); await inActivity(p); await p.waitForTimeout(2000);
  check('₦200 stake taken once at the start', (await bal(p)) === b0 - 200);
  await p.keyboard.press('Space'); await p.waitForFunction(() => __game.activities.current.game.phase === 'aim', null, { timeout: 30000 });
  await p.keyboard.down('KeyD'); await p.waitForTimeout(2500); await p.keyboard.up('KeyD');
  check('A/D aims the cue', await p.evaluate(() => Math.abs(__game.activities.current.aim) > 0.0001));
  await p.keyboard.press('Space'); await p.waitForFunction(() => __game.activities.current.game.phase !== 'aim' || __game.activities.current.game.shotNo > 0, null, { timeout: 30000 });
  check('Space breaks', await p.evaluate(() => __game.activities.current.game.shotNo === 1));
  await p.screenshot({ path: `${dir}/pool.png` });
  await p.evaluate(() => { const a = __game.activities.current, g = a.game; let n = 0; while (g.phase !== 'over' && n++ < 300) { if (g.phase === 'moving') { g.settle(); } else { const pl = g.plan(); if (g.phase === 'place') g.place(pl.place.x, pl.place.z); g.shoot(pl.angle, pl.power); g.settle(); } for (const e of g.drainEvents()) a.onEvent(e); } });
  await recorded(p);
  const pool = await p.evaluate(() => ({ won: __game.activities.current.game.winner === 0, rec: __game.saveData.activities.pool }));
  check('pool result recorded once; payout only for a win', pool.rec.played === 1 && (await bal(p)) === b0 - 200 + (pool.won ? 350 : 0));
  check('a second finish cannot pay or record again', await p.evaluate(() => { const a = __game.activities.current; a.recorded = null; a.finish(); return __game.saveData.activities.pool.played === 1; }) && (await bal(p)) === b0 - 200 + (pool.won ? 350 : 0));
  await panelBtn(p, /Leave the table/); await p.waitForTimeout(1500);

  // -------- draughts
  await at(p, '__game.parlour.site', 3.7, -0.7); await prompt(p, 'Draughts');
  await p.evaluate(() => { __game.parlour.draughtsLevel = 0; __game.interactions.trigger(); }); await p.waitForTimeout(1200);
  check('draughts menu', await choose(p, /Set up the board/)); await inActivity(p); await p.waitForTimeout(1500);
  await p.locator('.dr-cell[data-sq="61"]').dispatchEvent('click'); await p.waitForTimeout(400);
  check('tapping a man shows only legal destinations', await p.evaluate(() => [...document.querySelectorAll('.dr-cell.dest')].map((c) => +c.dataset.sq).sort().join() === '50,52'));
  await p.locator('.dr-cell[data-sq="52"]').dispatchEvent('click');
  await p.waitForFunction(() => __game.activities.current.game.moveNo >= 2, null, { timeout: 60000 });
  check('the opponent replies with a legal move', await p.evaluate(() => __game.activities.current.game.side === 1));
  await p.screenshot({ path: `${dir}/draughts.png` });
  await p.evaluate(() => { const a = __game.activities.current, g = a.game; let n = 0; while (!g.result && n++ < 500) a.play(g.think()); });
  await recorded(p); await p.waitForTimeout(1200);
  check('draughts result recorded', await p.evaluate(() => __game.saveData.activities.games.draughts.played === 1));
  await panelBtn(p, /Leave the table/); await p.waitForTimeout(1000);
  check('the draughts board overlay is gone after leaving', await p.evaluate(() => !document.querySelector('.dr-wrap') && __game.state === 'playing'));

  // -------- street food & barber
  await p.evaluate(() => { __game.clock.minutes = 18 * 60; __game.needs.state.energy = 40; __game.needs.state.hunger = 30; });
  await at(p, '__game.streetServices.stalls[0].site', -1.4, -0.7); await prompt(p, 'Suya');
  await p.evaluate(() => __game.interactions.trigger()); await p.waitForTimeout(1000);
  const f0 = await p.evaluate(() => ({ b: __game.economy.balance, e: __game.needs.energy }));
  check('buy and eat suya', await choose(p, /Suya \(big/)); await p.waitForTimeout(700);
  check('suya: paid once, energy and hunger up', await p.evaluate((f) => __game.economy.balance === f.b - 2500 && __game.needs.energy > f.e + 25, f0));
  await p.evaluate(() => { __game.closeChoice(); __game.clock.minutes = 10 * 60; }); await p.evaluate(() => __game.interactions.trigger()); await p.waitForTimeout(800);
  check('the suya spot is closed in the morning (items disabled)', await p.evaluate(() => [...document.querySelectorAll('#screen-choice button')].filter((b) => /Suya/.test(b.textContent)).every((b) => b.disabled)));
  await p.evaluate(() => { __game.closeChoice(); __game.clock.minutes = 15 * 60; });
  await at(p, '__game.streetServices.barber', 0, -2.2); await prompt(p, 'Barbing');
  await p.evaluate(() => __game.interactions.trigger()); await p.waitForTimeout(800);
  check('barber: pick taper fade', await choose(p, /Taper fade/)); await p.waitForTimeout(800);
  check('haircut saved to the character', await p.evaluate(() => __game.player.appearance.hair === 'fade' && __game.saveData.character.hair === 'fade'));
  await p.evaluate(() => __game.closeChoice());

  // -------- game zone & viewing centre
  const g0 = await bal(p); await p.evaluate(() => __game.entertainment.startGaming('easy')); await inActivity(p); await p.waitForTimeout(1500);
  check('game zone fee ₦300 paid once', (await bal(p)) === g0 - 300);
  await p.keyboard.press('Space'); await p.waitForFunction(() => __game.activities.current.match.phase === 'play', null, { timeout: 30000 });
  check('console football: kick-off pass with Space, drawn on the screen', await p.evaluate(() => __game.activities.current.match.user.stats.passes === 1 && document.querySelector('.console-screen').width > 300));
  await p.screenshot({ path: `${dir}/game-zone.png` });
  await p.evaluate(() => { const m = __game.activities.current.match; for (let k = 0; k < 2; k++) { m.clock = m.halfSeconds - 0.05; if (m.phase !== 'play') { m.phase = 'play'; m.restart = null; } m.update(0.2); if (m.phase === 'halftime') m.startSecondHalf(); } });
  await recorded(p); await panelBtn(p, /^Leave$/); await p.waitForTimeout(1000);
  const v0 = await bal(p); await p.evaluate(() => __game.entertainment.startViewing()); await inActivity(p); await p.waitForTimeout(2000);
  check('viewing centre gate fee ₦100', (await bal(p)) === v0 - 100);
  await p.keyboard.down('KeyZ'); await p.waitForTimeout(2500); await p.keyboard.up('KeyZ'); await p.waitForTimeout(1500);
  check('Z zooms to the big screen', await p.evaluate(() => !document.querySelector('.console-wrap.viewing').hidden));
  await p.screenshot({ path: `${dir}/viewing.png` });
  await p.evaluate(() => { const m = __game.activities.current.match; for (let k = 0; k < 2; k++) { m.clock = m.halfSeconds - 0.05; if (m.phase !== 'play') { m.phase = 'play'; m.restart = null; } m.update(0.2); if (m.phase === 'halftime') m.startSecondHalf(); } });
  await recorded(p); check('watched match recorded', await p.evaluate(() => __game.saveData.activities.games.viewing.played === 1)); await panelBtn(p, /^Leave$/); await p.waitForTimeout(1000);

  // -------- basketball
  await p.evaluate(() => __game.court.start()); await inActivity(p); await p.waitForTimeout(1500);
  await p.keyboard.down('Space'); await p.waitForTimeout(1500); await p.keyboard.up('Space'); await p.waitForTimeout(2000);
  check('hold and release Space takes a shot', await p.evaluate(() => __game.activities.current.round.shots === 1));
  await p.screenshot({ path: `${dir}/court.png` });
  check('a perfect release scores from every spot', await p.evaluate(() => { const a = __game.activities.current; const before = a.round.makes; for (let i = 0; i < 6; i++) { a.goSpot(i); a.charge = 0.5; a.release(); a.flight = null; } return a.round.makes - before === 6; }));
  await p.evaluate(() => { __game.activities.current.round.time = 0.01; }); await recorded(p);
  check('best score saved', await p.evaluate(() => __game.saveData.activities.games.basketball.best >= 15)); await panelBtn(p, /Leave the court/); await p.waitForTimeout(1000);

  // -------- jogging
  await p.evaluate(() => { const s = __game.jogging.startSpot; __game.player.teleport(s.x, s.z); }); await p.waitForTimeout(2000);
  check('track prompt', await prompt(p, 'jogging'));
  await p.evaluate(() => __game.jogging.start());
  for (const [x, z] of [[30, 38.5], [60, 0], [0, -38.5], [-60, 0]]) { await p.evaluate(([x, z]) => { const w = __game.jogging.toWorld(x, z); __game.player.teleport(w.x, w.z); }, [x, z]); await p.waitForTimeout(2000); }
  await p.evaluate(() => { __game.jogging.session.counter.lapStart -= 80; const w = __game.jogging.toWorld(0, 38.5); __game.player.teleport(w.x, w.z); }); await p.waitForTimeout(2500);
  check('a lap through the four gates is timed and earns Fitness XP', await p.evaluate(() => __game.jogging.session.counter.laps === 1 && (__game.saveData.skills.fitness ?? 0) > 0));
  await p.evaluate(() => { const w = __game.jogging.toWorld(-30, 0); __game.player.teleport(w.x, w.z); }); await p.waitForTimeout(2000);
  check('cutting across the pitch voids the lap in progress', await p.evaluate(() => __game.jogging.session.counter.cut === true));
  await p.evaluate(() => __game.jogging.stop('test')); await p.evaluate(() => __game.closeChoice());

  // -------- car wash
  const cw = await p.evaluate(() => { const g = __game, sp = g.vehicles.sys.forSale()[0], r = g.vehicles.sys.buy(sp.id); g.vehicles.addOwned(r.vehicle); const v = r.vehicle, bay = g.carWash.bay; v.x = bay.x; v.z = bay.z; g.vehicles.sys.burn(v, 15000); return v.dirt; });
  await at(p, '__game.carWash.site', -3.5, -1.6); await prompt(p, 'Car Wash'); await p.evaluate(() => __game.interactions.trigger()); await p.waitForTimeout(800);
  const w0 = await bal(p); check('car wash lists the parked car', await choose(p, /Exterior wash/)); await p.waitForTimeout(800);
  check('car wash: ₦1,500 once, dust gone', cw > 0.5 && (await bal(p)) === w0 - 1500 && await p.evaluate(() => __game.vehicles.sys.list.at(-1).dirt === 0));
  await p.evaluate(() => __game.closeChoice());

  // -------- weekly events
  const sat = await p.evaluate(() => { const g = __game; g.clock.minutes = 11 * 60; for (let d = g.clock.day; d < g.clock.day + 8; d++) { g.clock.day = d; if (g.events.active('cup')) return d; } return null; });
  check('Saturday Community Cup is on', sat != null);
  await p.waitForTimeout(2500);
  await p.waitForFunction(() => __game.saveData.phone.messages.some((x) => x.from === 'Coach Uzo'), null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(3000);
  check('friends invite you by phone message (once per event)', await p.evaluate(() => { const m = __game.saveData.phone.messages; return m.filter((x) => x.from === 'Coach Uzo').length === 1; }));
  await p.evaluate(() => { const s = __game.stadiumFootball.spot; __game.player.teleport(s.x, s.z); }); await prompt(p, '5-a-side'); await p.evaluate(() => __game.interactions.trigger());
  const c0 = await bal(p); const cupOpt = await p.evaluate(() => [...document.querySelectorAll('#screen-choice button')].map((b) => `${b.textContent}|${b.disabled}|${b.title}`).join(' ## ') + ` || state ${__game.state} energy ${Math.round(__game.needs.energy)} why ${__game.stadiumFootball.why()}`);
  check('cup match option on the football board', await choose(p, /Community Cup match/), cupOpt); await inActivity(p); await p.waitForTimeout(1500);
  check('cup entry ₦500 paid at kick-off', (await bal(p)) === c0 - 500);
  await p.evaluate(() => { const a = __game.activities.current, m = a.match; m.teams[0].score = 2; for (let k = 0; k < 2; k++) { m.clock = m.halfSeconds - 0.05; if (m.phase !== 'play') { m.phase = 'play'; m.restart = null; } m.update(0.2); if (m.phase === 'halftime') m.startSecondHalf(); } });
  await recorded(p);
  check('cup win pays the ₦1,500 prize once', (await bal(p)) === c0 - 500 + 1500);
  await panelBtn(p, /Leave the pitch/); await p.waitForTimeout(1000);
  await p.evaluate(() => { __game.clock.minutes = 20 * 60; }); await p.waitForFunction(() => __game.events.party.visible, null, { timeout: 60000 }).catch(() => {});
  check('street party set appears on party night', await p.evaluate(() => __game.events.party.visible === true && __game.events.dancers[0].schedule[0] === 19));
  await p.evaluate(() => { __game.pause(); }); await p.waitForTimeout(800);
  check("pause screen shows what's on today", await p.evaluate(() => /What's on today/.test(document.querySelector('[data-slot=pause-status]').textContent) && /Community/.test(document.querySelector('[data-slot=pause-status]').textContent)));
  await p.evaluate(() => __game.resume());
  check('no page errors on desktop', errors.length === 0, JSON.stringify(errors.slice(0, 4)));
  await p.close();

  // -------- phone
  const m = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); const merr = [];
  m.on('pageerror', (e) => merr.push(e.message));
  await open(m);
  await m.evaluate(() => __game.parlour.startPool({ opp: 0, stake: 0 })); await inActivity(m); await m.waitForTimeout(1500);
  await m.locator('.act-btn-shoot').dispatchEvent('pointerdown'); await m.locator('.act-btn-shoot').dispatchEvent('pointerup');
  await m.waitForFunction(() => __game.activities.current.game.phase === 'aim', null, { timeout: 30000 });
  const a0 = await m.evaluate(() => __game.activities.current.aim);
  await m.locator('.act-btn-right').dispatchEvent('pointerdown'); await m.waitForTimeout(2500); await m.locator('.act-btn-right').dispatchEvent('pointerup');
  check('phone: hold ▶ aims the cue', await m.evaluate((a) => __game.activities.current.aim !== a, a0));
  check('phone: pool buttons fit and do not overlap', await m.evaluate(() => { const r = [...document.querySelectorAll('.act-btn')].map((e) => e.getBoundingClientRect()); for (const x of r) if (x.left < 0 || x.right > innerWidth || x.top < 0 || x.bottom > innerHeight) return false; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i], c = r[j]; if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) return false; } return true; }));
  await m.screenshot({ path: `${dir}/phone-pool.png` });
  await m.evaluate(() => __game.activities.end({ abandon: true })); await m.waitForTimeout(1000);
  await m.evaluate(() => __game.parlour.startDraughts('easy')); await inActivity(m); await m.waitForTimeout(1500);
  check('phone: draughts board fits', await m.evaluate(() => { const r = document.querySelector('.dr-board').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 250; }));
  await m.evaluate(() => __game.activities.end({ abandon: true }));
  check('no page errors on phone', merr.length === 0, JSON.stringify(merr.slice(0, 3)));
  console.log(`PASS ACTIVITIES32 ${checks.length}`);
} finally { await browser.close(); server.kill(); }
