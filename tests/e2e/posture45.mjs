// v0.45: your character sits and lies down: on the ground anywhere (X / Z), on a bench in the court, on a hospital
// ward bed, on your own sofa and bed at home; moving gets you up; the pose is shared with other players.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4245', OUT = 'qa/v45'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message));
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 });
 await p.evaluate(() => { const g = __game; g.clock.setMode('game'); g.clock.rate = 0; g.clock.minutes = 10 * 60; g.cameraRig.pitch = 0.25; });
 const shot = async (name) => { await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/${name}.png` }); };
 const state = () => p.evaluate(() => { const g = __game, q = g.player.posture; return { kind: q?.kind ?? null, y: +g.player.human.group.position.y.toFixed(2), pres: g.posture.presence() }; });
 // on the ground, anywhere
 await p.keyboard.press('KeyX'); await p.waitForFunction(() => !!__game.player.posture, null, { timeout: 15000 }).catch(() => {}); let s = await state();
 check('X sits you down on the ground', s.kind === 'ground' && s.y < -0.7, JSON.stringify(s)); await shot('sit-ground');
 check('other players see the pose', s.pres?.pose === 'ground');
 await p.keyboard.down('KeyW'); await p.waitForFunction(() => !__game.player.posture, null, { timeout: 15000 }).catch(() => {}); await p.keyboard.up('KeyW'); await p.waitForTimeout(300); s = await state();
 check('moving gets you up', s.kind === null && Math.abs(s.y) < 0.05, JSON.stringify(s));
 await p.keyboard.press('KeyZ'); await p.waitForFunction(() => !!__game.player.posture, null, { timeout: 15000 }).catch(() => {}); s = await state();
 check('Z lies you down on the ground', s.kind === 'lie' && s.y < -0.7, JSON.stringify(s)); await shot('lie-ground');
 await p.keyboard.press('KeyZ'); await p.waitForFunction(() => !__game.player.posture, null, { timeout: 15000 }).catch(() => {}); s = await state(); check('Z again gets you up', s.kind === null);
 // a bench in the court
 await p.evaluate(() => __game.justice.enterCourt()); await p.waitForTimeout(500);
 const bench = await p.evaluate(() => { const g = __game, seat = g.civic.room.seats.find((x) => x.kind === 'seat'); g.player.teleport(seat.x, seat.z + 0.8); return { label: g.interactions.update(seat.x, seat.z + 0.8), n: g.civic.room.seats.length }; });
 check('in the courtroom, walking up to a bench offers "Sit down"', /Sit down/.test(String(bench.label)) && bench.n > 20, JSON.stringify(bench));
 await p.keyboard.press('KeyE'); await p.waitForFunction(() => !!__game.player.posture, null, { timeout: 15000 }).catch(() => {}); s = await state();
 check('E sits you on the bench', s.kind === 'sit' && s.y > -0.5 && s.y < -0.2, JSON.stringify(s)); await shot('sit-court-bench');
 const up = await p.evaluate(() => { const g = __game, pos = g.player.position; return g.interactions.update(pos.x, pos.z); });
 check('while seated, E means "Stand up"', /Stand up/.test(String(up)), String(up)); await p.keyboard.press('KeyE'); await p.waitForFunction(() => !__game.player.posture, null, { timeout: 30000 }).catch(() => {}); await p.evaluate(() => { __game.player.stand(); __game.closeChoice?.(); });
 await p.evaluate(() => __game.civic.exit());
 // a ward bed in the hospital
 await p.evaluate(() => __game.hospitals.enter(__game.hospitals.list[0])); await p.waitForTimeout(500);
 const ward = await p.evaluate(() => { const g = __game, bed = g.civic.room.seats.find((x) => x.kind === 'bed'); g.player.teleport(bed.x + 1.1, bed.z + 0.4); return { label: g.interactions.update(bed.x + 1.1, bed.z + 0.4) }; });
 check('next to a ward bed: "Lie down"', /Lie down/.test(String(ward.label)), JSON.stringify(ward));
 await p.keyboard.press('KeyE'); await p.waitForFunction(() => !!__game.player.posture, null, { timeout: 15000 }).catch(() => {}); s = await state();
 check('E lies you on the bed', s.kind === 'lie' && s.y > -0.25 && s.y < 0, JSON.stringify(s));
 await p.evaluate(() => { const g = __game; g.cameraRig.yaw = Math.PI / 2; g.cameraRig.pitch = 0.45; }); await shot('lie-hospital-bed');
 await p.evaluate(() => { __game.player.stand(); __game.civic.exit(); });
 // your own sofa and bed at home
 const home = await p.evaluate(() => { const g = __game; g.economy.transact({ key: 'qa45-home', amount: 2000000, reason: 'qa' }); const h = g.homes.listings.find((x) => x.type === 'flat') ?? g.homes.listings[0]; g.homes.housing.rent(h.id); g.homes.enter(h, { fade: false }); const id = h.id, d = g.homes.decor, put = (item) => { const r = g.homeUpgrades.buy(id, item); const sp = d.findSpot(item, r.piece.pid); return sp ? d.placePiece(r.piece.pid, sp).ok !== false : false; }; return { sofa: put('sofa'), bed: put('bed') }; });
 check('a sofa and a bed bought and placed at home', home.sofa && home.bed, JSON.stringify(home));
 const sofa = await p.evaluate(() => { const g = __game; g.posture.cache.t = -1; const s = g.posture.seats().find((x) => x.kind === 'seat'); g.player.teleport(s.x, s.z); g.posture.sit(); return { kind: g.player.posture?.kind, y: g.player.human.group.position.y }; });
 check('sit on your sofa', sofa.kind === 'sit', JSON.stringify(sofa)); await p.evaluate(() => { __game.cameraRig.pitch = 0.4; }); await shot('sit-home-sofa');
 await p.evaluate(() => __game.player.stand());
 const bedv = await p.evaluate(() => { const g = __game; g.posture.cache.t = -1; const s = g.posture.seats().find((x) => x.kind === "bed"); g.player.teleport(s.x + 1, s.z); const view = g.homes.upgradeView(g.homes.decor.records.find((r) => r.id === 'bed').id); const opt = view.options[0]; opt.act(); return { first: opt.label, kind: g.player.posture?.kind }; });
 check('your bed\'s menu starts with "Lie down", and it lies you down', bedv.first === 'Lie down' && bedv.kind === 'lie', JSON.stringify(bedv)); await p.evaluate(() => { __game.cameraRig.pitch = 0.6; }); await shot('lie-home-bed');
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`posture45: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
