// v0.46: real buildings for the cathedrals, the palace, CKC and Shanahan University (door outside, room inside);
// workplaces you enter first; the Metadav hub; hotel rooms you can see and book; the car door on your side; stage 7.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4248', OUT = 'qa/v46'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message));
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 });
 await p.evaluate(() => { const g = __game; g.clock.setMode('game'); g.clock.rate = 0; g.clock.day = 2; g.clock.minutes = 10 * 60; g.economy.transact({ key: 'qa46', amount: 3_000_000, reason: 'qa' }); });
 const labels = () => p.evaluate(() => { const g = __game, pos = g.player.position, out = []; for (const it of g.interactions.items) { if (it.enabled && !it.enabled()) continue; if (Math.hypot(it.x - pos.x, it.z - pos.z) > 30) continue; out.push(typeof it.label === 'function' ? it.label() : it.label); } return out; });
 const sites = await p.evaluate(() => (__game.world.civicSites ?? []).map((s) => ({ id: s.id, style: s.style, x: s.x, z: s.z, yaw: s.yaw, d: s.d, stand: s.door.stand })));
 check('five landmark buildings stand in the city: Holy Trinity, All Saints, Ime Obi, CKC, Shanahan University', ['basilica', 'all-saints', 'ime-obi', 'ckc', 'shanahan'].every((id) => sites.some((s) => s.id === id)), JSON.stringify(sites.map((s) => s.id)));
 const noHomes = await p.evaluate(() => { const g = __game, inside = (s, x, z) => { const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), dx = x - s.x, dz = z - s.z, a = c * dx - sn * dz, bb = sn * dx + c * dz; return Math.abs(a) < s.w / 2 - 1 && Math.abs(bb) < s.d / 2 - 1; }; return g.homes.listings.filter((h) => g.world.civicSites.some((s) => inside(s, h.door.x, h.door.z))).length; });
 check('no rentable home sits inside any of the new grounds', noHomes === 0, String(noHomes));
 const styles = { basilica: 'church', 'all-saints': 'church', 'ime-obi': 'palace', ckc: 'school', shanahan: 'university' };
 for (const s of sites) {
  await p.evaluate((s) => { const g = __game; g.closeChoice?.(); if (g.civic.inside) g.civic.exit({ quiet: true }); const f = { x: Math.sin(s.yaw), z: Math.cos(s.yaw) }, D = s.d / 2 + 24; g.player.teleport(s.x + f.x * D, s.z + f.z * D, s.yaw + Math.PI); g.cameraRig.yaw = s.yaw; g.cameraRig.pitch = 0.22; g.cameraRig.snapTo(g.player.position); }, s);
  await p.waitForTimeout(3500); await p.screenshot({ path: `${OUT}/site-${s.id}.png` });
  const at = await p.evaluate((s) => { const g = __game; g.player.teleport(s.stand.x, s.stand.z); return { free: g.world.collision.isFree(s.stand.x, s.stand.z, 0.4), label: g.interactions.update(s.stand.x, s.stand.z) }; }, s);
  const inside = await p.evaluate(() => { __game.interactions.trigger(); return { kind: __game.civic.inside?.interior?.kind ?? null, room: __game.civic.room ? __game.civic.room.seats.length : 0, spec: __game.civic.anchors ? Object.keys(__game.civic.anchors).length : 0 }; });
  await p.waitForTimeout(1600); await p.screenshot({ path: `${OUT}/inside-${s.id}.png` });
  const kind = await p.evaluate(() => { const l = __game.civic.inside; return l ? (__game.civic.defaultSpec(l)?.kind ?? null) : null; });
  check(`${s.id}: the door is outside on open ground ("go in"), and it leads into the ${styles[s.id]}`, at.free && /go in/.test(String(at.label)) && kind === styles[s.id] && inside.room > 4, JSON.stringify({ at, kind, inside }));
 }
 await p.evaluate(() => __game.civic.exit({ quiet: true }));
 // Metadav: go in first, then apply/train at the desks
 const md = await p.evaluate(() => { const g = __game, s = g.story.city.sites.find((x) => x.id === 'metadav'); g.player.teleport(s.x, s.z); const label = g.interactions.update(s.x, s.z); g.interactions.trigger(); const inside = g.civic.inside?.id; const pos = g.player.position; const desk = []; for (const it of g.interactions.items) { if (it.enabled && !it.enabled()) continue; if (Math.hypot(it.x - pos.x, it.z - pos.z) > 30) continue; desk.push(typeof it.label === 'function' ? it.label() : it.label); } const v = g.civic.view(); return { label, inside, desk, opts: v.options.map((o) => o.label) }; });
 await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/inside-metadav.png` });
 check('Metadav: the door says "go in"; jobs and training are at the desks inside', /go in/.test(md.label) && md.inside === 'metadav' && md.desk.some((l) => /apply, work, train/.test(l)) && md.opts.some((o) => /Apply|Train/.test(o)), JSON.stringify(md));
 await p.evaluate(() => { const g = __game, s = g.story.city.sites.find((x) => x.id === 'metadav'); g.civic.exit({ quiet: true }); const f = { x: Math.sin(s.yaw ?? 0), z: Math.cos(s.yaw ?? 0) }; g.player.teleport(s.x + f.x * 14, s.z + f.z * 14, (s.yaw ?? 0) + Math.PI); g.cameraRig.yaw = s.yaw ?? 0; g.cameraRig.pitch = 0.2; g.cameraRig.snapTo(g.player.position); });
 await p.waitForTimeout(3000); await p.screenshot({ path: `${OUT}/metadav-outside.png` });
 const wp = await p.evaluate(() => { const g = __game, s = g.story.city.sites.find((x) => x.id === 'motors'); g.player.teleport(s.x, s.z); const label = g.interactions.update(s.x, s.z); g.interactions.trigger(); return { label, kind: g.civic.inside?.kind, trade: g.civic.defaultSpec(g.civic.inside)?.opts?.trade }; });
 await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/inside-workshop.png` });
 check('the other workplaces work the same way (the motors workshop has its own room)', /go in/.test(wp.label) && wp.kind === 'workplace' && wp.trade === 'motors', JSON.stringify(wp));
 // hotel rooms
 const ht = await p.evaluate(() => { const g = __game; g.civic.exit({ quiet: true }); const v = g.world.landmarks.list.find((l) => l.kind === 'hotel'); g.player.teleport(v.x, v.z); g.interactions.update(v.x, v.z); g.interactions.trigger(); const rooms = g.story.city.hotelRooms(v); const ox = g.civic.ox, A = g.civic.anchors; g.player.teleport(ox + A.room3.x, A.room3.z + 1.5, Math.PI); g.cameraRig.yaw = 0; g.cameraRig.pitch = 0.3; return { inside: g.civic.inside?.id === v.id, prices: rooms.map((r) => r.price), anchors: [0, 1, 2, 3].every((k) => !!A['room' + k]) }; });
 await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/hotel-suite.png` });
 check('a hotel has four rooms you can walk into, dearer as they get better', ht.inside && ht.anchors && ht.prices.every((x, i) => i === 0 || x > ht.prices[i - 1]), JSON.stringify(ht));
 const bk = await p.evaluate(() => { const g = __game, v = g.civic.inside, before = g.economy.balance; g.needs.state.energy = 20; g.story.city.bookRoom(v, 0, 'rest'); return { paid: before - g.economy.balance, energy: g.needs.state.energy, pose: g.player.posture?.kind }; });
 check('book the standard room for a rest: you pay, lie on its bed, and feel rested', bk.paid > 0 && bk.energy > 50 && bk.pose === 'lie', JSON.stringify(bk));
 await p.evaluate(() => { __game.player.stand(); __game.civic.exit({ quiet: true }); });
 // eatery name
 check('the eatery by the Main Market is Mama Blessing\'s Kitchen', await p.evaluate(() => __game.eateries.list.some((e) => e.name === "Mama Blessing's Kitchen") && !__game.eateries.list.some((e) => /Nne Ada/.test(e.name))));
 // car doors: only the door on your side opens
 const door = await p.evaluate(async () => { const g = __game, sp = g.vehicles.sys.forSale()[0]; const r = g.vehicles.sys.buy(sp.id); if (!r.ok) return { err: r.error }; g.vehicles.syncSale(); g.vehicles.addOwned(r.vehicle); const v = r.vehicle, m = g.vehicles.meshes.get(v.id), lx = Math.cos(v.heading), lz = -Math.sin(v.heading);
  g.player.teleport(v.x - lx * 1.6, v.z - lz * 1.6); g.vehicles.startDriving(v); await new Promise((res) => setTimeout(res, 120)); const targets = m.userData.doors.map((d) => [Math.sign(d.hinge.position.x), d.target]); return { n: targets.length, targets }; });
 check('getting into a car opens only the door on your side', door.n >= 2 && door.targets.every(([side, t]) => (side === -1 ? t === 1 : t === 0)), JSON.stringify(door));
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`buildings46: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
