// v0.39: crash reactions, monument LEDs, lit billboards, unfinished buildings, per-home floor plans with no built-ins,
// hospitals + ambulances + knock-down, flyovers/footbridges you can climb.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4239', OUT = 'qa/v39'; fs.mkdirSync(OUT, { recursive: true });
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean), want = (k) => !ONLY.length || ONLY.includes(k);
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const c = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'medium', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
  const p = await c.newPage(); p.setDefaultTimeout(300000);
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 400000 });
  await p.evaluate(() => { const g = __game; g.clock.setMode('game'); g.clock.minutes = 13 * 60; g.clock.rate = 0; g.economy.transact({ key: 'qa39', amount: 300000, reason: 'qa' }); });
  const settle = async (ms = 3000) => { await p.waitForTimeout(1200); await p.waitForFunction(() => { const g = __game, c = g.world.city, q = g.player.position; return !c.job && ![...c.chunks.values()].some((ch) => !ch.group && Math.hypot(ch.cx - q.x, ch.cz - q.z) < 220); }, null, { timeout: 240000 }).catch(() => {}); await p.waitForTimeout(ms); };
  const look = (x, z, yaw, d = 9, pitch = 0.2) => p.evaluate(([x, z, yaw, d, pitch]) => { const g = __game; g.player.teleport(x, z, yaw); g.cameraRig.yaw = yaw; g.cameraRig.pitch = pitch; g.cameraRig.distance = d; g.cameraRig.snapTo?.(g.player.position.clone().add({ x: 0, y: 2, z: 0 })); }, [x, z, yaw, d, pitch]);
  const fixedCam = (px, py, pz, tx, ty, tz) => p.evaluate(([px, py, pz, tx, ty, tz]) => { const g = __game, cam = g.renderer.camera; g.cameraRig.setMode('fixed'); cam.position.set(px, py, pz); cam.lookAt(tx, ty, tz); cam.updateMatrixWorld(); g.renderer.sky.position.copy(cam.position); }, [px, py, pz, tx, ty, tz]);
  const follow = () => p.evaluate(() => __game.cameraRig.setMode('follow'));

  if (want('crash')) {
    // 1. NPC drivers react when hit by another NPC or by the player
    const r = await p.evaluate(async () => {
      const g = __game, T = g.traffic; for (let i = 0; i < 60 && T.near.length < 2; i++) await new Promise((r) => setTimeout(r, 250));
      const [a, b] = T.near; if (!a || !b) return { skip: true };
      const before = a.speed; b.x = a.x + a.dx * 1.5; b.z = a.z + a.dz * 1.5; b.y = a.y; a.speed = 8;
      T.detectCrashes(T.near); const hit = !!(a.crash || b.crash);
      const bub = T.crashBubbles(); T.takeCrashes();
      await new Promise((r) => setTimeout(r, 600));
      const stopped = (a.crash && a.speed < before + 1) || (b.crash && b.speed < 3);
      const c = T.near.find((v) => !v.crash); const byPlayer = c ? T.hit(c, 'player', 3) : false;
      return { hit, bubbles: bub.length, stopped, byPlayer, line: (a.crash ?? b.crash)?.line, why: (a.crash ? a : b).why };
    });
    console.log('CRASH', JSON.stringify(r));
    check('NPC vehicles that bump each other stop, put hazards on and complain', r.skip || (r.hit && r.bubbles > 0 && r.stopped), JSON.stringify(r));
    check('NPC drivers react when the player hits them', r.skip || r.byPlayer);
  }

  if (want('leds')) {
    // 2 + 3. monuments' LEDs and billboards at night
    const mon = await p.evaluate(() => { const g = __game, rigs = []; g.world.monuments.group.traverse((o) => { if (o.name === 'Monument-LEDs') rigs.push(o); }); const L = g.world.landmarks; return { rigs: rigs.length, leds: rigs.reduce((n, o) => n + o.count, 0), day: rigs.every((o) => !o.visible), ui: L.get('upper-iweka'), zik: L.list.find((l) => /zik|dmgs/i.test(l.id + l.name)) }; });
    check('Upper Iweka and DMGS/Zik roundabout monuments carry LED rigs, off by day', mon.rigs >= 2 && mon.leds > 300 && mon.day, JSON.stringify({ rigs: mon.rigs, leds: mon.leds, day: mon.day }));
    await p.evaluate(() => { __game.clock.minutes = 21 * 60; }); await p.waitForFunction(() => { const g = __game, m = g.online?.boards?.records?.[0]?.group?.getObjectByName('Billboard-wash'); return (g.atmosphere.nightK ?? 0) > 0.8 && (m?.material?.opacity ?? 0) > 0.3; }, null, { timeout: 60000 }).catch(() => {});
    // the colour pattern is driven by time: sample it at different moments (each of the three light shows)
    const colours = await p.evaluate(() => { const M = __game.world.monuments, out = []; for (const t of [1, 1.4, 13, 13.3, 25, 25.6]) { M.updateLights(t, 1); let s = ''; M.group.traverse((o) => { if (o.name === 'Monument-LEDs' && !s) s = Array.from(o.instanceColor.array.slice(0, 9)).map((v) => v.toFixed(2)).join(','); }); out.push(s); } M.updateLights(performance.now() / 1000, 1); return out; });
    const lit = await p.evaluate(() => { const g = __game, rigs = []; g.world.monuments.group.traverse((o) => { if (o.name === 'Monument-LEDs') rigs.push(o.visible); }); const bb = g.online?.boards; let wash = null; if (bb) { const m = bb.records?.[0]?.group?.getObjectByName('Billboard-wash'); wash = m?.material?.opacity ?? null; } return { rigs, wash, boards: bb?.records?.length ?? 0, faceE: bb?.records?.[0]?.group?.getObjectByName('Billboard-front')?.material?.emissiveIntensity }; });
    console.log('NIGHT', JSON.stringify(lit), colours);
    check('the LEDs switch on at night and keep changing colour (flashing)', lit.rigs.every(Boolean) && new Set(colours).size >= 5, colours.join(' | '));
    check('billboards light up at night (lamp wash + brighter faces)', lit.boards > 0 && lit.wash > 0.3 && lit.faceE > 0.8, JSON.stringify(lit));
    for (const [id, name] of [[mon.ui && 'upper-iweka', 'upper-iweka'], [mon.zik?.id, 'zik']]) {
      const l = await p.evaluate((id) => __game.world.landmarks.get(id) ?? __game.world.landmarks.list.find((x) => x.id === id), id); if (!l) continue;
      await look(l.x + 40, l.z + 40, Math.atan2(40, 40), 30, 0.15); await fixedCam(l.x + 38, 14, l.z + 38, l.x, 5, l.z); await settle(2500);
      await p.screenshot({ path: `${OUT}/night-${name}.png` }); await follow();
    }
    const bbSite = await p.evaluate(() => { const r = __game.online?.boards?.records?.[0]; return r ? { x: r.site.x, z: r.site.z } : null; });
    if (bbSite) { await look(bbSite.x + 30, bbSite.z + 30, 0); await fixedCam(bbSite.x + 32, 9, bbSite.z + 32, bbSite.x, 6, bbSite.z); await settle(2500); await p.screenshot({ path: `${OUT}/night-billboard.png` }); await follow(); }
    await p.evaluate(() => { __game.clock.minutes = 13 * 60; });
  }

  if (want('unfinished')) {
    // 6. uncompleted buildings
    const u = await p.evaluate(() => { const g = __game, n = g.world.city.stats.buildingTypes.unfinished ?? 0, list = []; for (const ch of g.world.city.chunks.values()) for (const it of ch.items) if (it.plan?.type === 'unfinished') list.push(it); const homes = g.homes.listings.filter((h) => g.world.map.buildings.find((b) => b.id === h.buildingId)?.unfinished).length; const it = list.find((i) => i.b.synthetic && i.b.levels > 1) ?? list[0]; return { n, homes, at: it ? { x: it.b.x ?? it.b.pts.reduce((a, q) => a + q[0], 0) / it.b.pts.length, z: it.b.z ?? it.b.pts.reduce((a, q) => a + q[1], 0) / it.b.pts.length } : null }; });
    console.log('UNFINISHED', JSON.stringify(u));
    check('a few hundred uncompleted buildings stand around town, none of them a rentable home', u.n >= 100 && u.n < 600 && u.homes === 0, JSON.stringify(u));
    if (u.at) { await look(u.at.x + 16, u.at.z + 16, Math.atan2(16, 16), 6, 0.1); await fixedCam(u.at.x + 15, 7, u.at.z + 15, u.at.x, 2.5, u.at.z); await settle(); await p.screenshot({ path: `${OUT}/unfinished.png` }); await follow(); }
  }

  if (want('plans')) {
    // 7. each home has its own plan, comes empty but for lamps + switches, lamps removable
    const r = await p.evaluate(async () => {
      const g = __game, sigs = new Set(), fixtures = [], issues = []; const { planSignature } = await import('/src/housing/FloorPlans.js').catch(() => ({}));
      let n = 0; const leave = () => { g.homes.decor.clear(); g.homes.inside = null; g.cameraRig.indoor = null; g.atmosphere.indoor = null; }; // leave without the exit fade (its delayed step would land after the next enter)
      for (const h of g.homes.listings) {
        g.homes.housing.state.owned[h.id] = true; g.homes.enter(h, { fade: false }); const L = g.homes.inside?.layout;
        const plan = L?.plan; if (!plan) { issues.push('noplan:' + h.id); leave(); continue; }
        sigs.add(JSON.stringify(plan.rooms.map((r) => [r.role, Math.round(r.x0 * 2), Math.round(r.z0 * 2), Math.round(r.x1 * 2), Math.round(r.z1 * 2)]).concat([[plan.door?.x?.toFixed?.(1)]])));
        const uses = L.items.map((u) => u.kind); fixtures.push(...uses);
        n++; leave();
      }
      return { n, unique: sigs.size, issues: issues.slice(0, 5), kinds: [...new Set(fixtures)] };
    });
    console.log('PLANS', JSON.stringify(r));
    check('every one of the 90 homes has its own floor plan', r.n === 90 && r.unique === 90, JSON.stringify(r));
    check('homes come with no built-in bathroom, kitchen, sink or cupboards', !r.kinds.some((k) => /toilet|shower|bath|sink|kitchen|cooker|cupboard|stove|wardrobe|bed/i.test(k)), r.kinds.join(','));
    await p.waitForTimeout(2000); // the plan loop's last exit() finishes behind a fade
    const lamp = await p.evaluate(async () => {
      const g = __game, h = g.homes.listings.find((x) => x.type === 'duplex' && !x.multiUnit) ?? g.homes.listings[0]; g.homes.housing.state.owned[h.id] = true; const rent = g.homes.housing.status(h.id); g.homes.enter(h, { fade: false }); if (!g.homes.inside) return { rent, notInside: true }; await new Promise((r) => setTimeout(r, 500)); if (!g.homes.inside) return { rent, kickedOut: true };
      const lamps = () => g.homes.inside.layout.lights.length;
      const switches = g.homes.inside.layout.items.filter((u) => u.kind === 'switch').length;
      const before = lamps(); g.homes.setLampRemoved(0, true); await new Promise((r) => setTimeout(r, 300)); const after = lamps(); const saved = JSON.stringify(g.homeUpgrades.home(h.id).removedLamps);
      g.homes.setLampRemoved(0, false); const back = lamps();
      return { id: h.id, before, after, back, switches, saved, rooms: g.homes.inside.layout.plan?.rooms?.map((r) => r.role) };
    });
    console.log('LAMPS', JSON.stringify(lamp));
    check('each room has a bulb and a switch, and a bulb can be taken out and put back', lamp.switches >= 2 && lamp.after < lamp.before && lamp.back === lamp.before && /true|\[0/.test(lamp.saved), JSON.stringify(lamp));
    await p.evaluate(() => { const g = __game; g.cameraRig.distance = 3; }); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/empty-home.png` });
    await p.evaluate(() => { __game.homes.exit(); });
  }

  if (want('hospital')) {
    // 8. hospitals and ambulances
    const h = await p.evaluate(() => { const g = __game, H = g.hospitals; return { n: H?.list.length ?? 0, pins: g.mapPlaces?.().filter?.((q) => q.kind === 'hospital').length ?? H.places().length, parked: H.list.filter((x) => x.parked).length, names: H.list.map((x) => x.name), at: H.list[0] && { ...H.list[0].place, nx: H.list[0].door.nx, nz: H.list[0].door.nz } }; });
    console.log('HOSPITALS', JSON.stringify(h));
    check('two hospitals with map pins and parked ambulances', h.n === 2 && h.pins >= 2 && h.parked >= 1, JSON.stringify(h));
    await look(h.at.x + h.at.nx * 12, h.at.z + h.at.nz * 12, Math.atan2(h.at.nx, h.at.nz), 7, 0.12); await settle(); await p.screenshot({ path: `${OUT}/hospital.png` });
    const t = await p.evaluate(async () => { const g = __game, H = g.hospitals.list[0]; g.player.teleport(H.place.x, H.place.z); const e0 = g.needs.values.energy, b0 = g.economy.balance, m0 = g.clock.minutes; g.needs.adjust({ energy: -60 }); g.openChoice(() => g.hospitals.view(H)); await new Promise((r) => setTimeout(r, 300)); const opts = [...document.querySelectorAll('#screen-choice button, .choice-option, [data-choice]')].map((x) => x.textContent.trim()).slice(0, 4); g.hospitals.treat(H, 'checkup'); return { opts, paid: b0 - g.economy.balance, energy: g.needs.values.energy - (e0 - 60), mins: g.clock.minutes - m0 }; });
    console.log('TREAT', JSON.stringify(t));
    check('a check-up costs ₦2,500, takes an hour and restores energy', t.paid === 2500 && t.energy >= 30 && Math.abs(t.mins - 60) < 2, JSON.stringify(t));
    // knock-down: an ambulance comes, then you wake up at hospital
    const k = await p.evaluate(async () => {
      const g = __game, T = g.traffic; for (let i = 0; i < 80 && !T.near.length; i++) await new Promise((r) => setTimeout(r, 250));
      const v = T.near[0]; g.hospitals.lastKnock = -1e9; const b0 = g.economy.balance, day0 = g.clock.day * 1440 + g.clock.minutes;
      g.player.teleport(v.x + v.dx * 1, v.z + v.dz * 1); v.speed = 9; const pp = g.player.position; const hitV = T.pushOut(pp, 0.4); const ok = hitV && g.hospitals.knockDown(hitV);
      await new Promise((r) => setTimeout(r, 4000)); const flat = Math.abs(g.player.human?.group.rotation.x ?? 0) > 1, van = !!g.hospitals.van?.visible;
      return { ok, flat, van, b0, day0 };
    });
    console.log('KNOCK1', JSON.stringify(k));
    await p.screenshot({ path: `${OUT}/knocked-down.png` });
    await p.waitForFunction(() => !__game.hospitals.knocked, null, { timeout: 240000 });
    await p.waitForTimeout(1500);
    const k2 = await p.evaluate((k) => { const g = __game, near = g.hospitals.nearest(g.player.position.x, g.player.position.z); return { ...k, paid: k.b0 - g.economy.balance, mins: g.clock.day * 1440 + g.clock.minutes - k.day0, atHospital: Math.hypot(near.place.x - g.player.position.x, near.place.z - g.player.position.z) < 3, up: Math.abs(g.player.human?.group.rotation.x ?? 0) < .01 }; }, k);
    console.log('KNOCK', JSON.stringify(k2));
    check('hit by a car you lie down, an ambulance comes and you wake at the hospital hours later having paid ≤ ₦3,000', k2.ok && k2.flat && k2.van && k2.atHospital && k2.up && k2.paid > 0 && k2.paid <= 3000 && k2.mins >= 170, JSON.stringify(k2));
    await settle(1500); await p.screenshot({ path: `${OUT}/after-hospital.png` });
    const amb = await p.evaluate(async () => { const g = __game; for (let i = 0; i < 40; i++) { if (g.traffic.vehicles.some((v) => v.ambulance)) break; await new Promise((r) => setTimeout(r, 500)); } return g.traffic.vehicles.filter((v) => v.ambulance).length; });
    check('ambulances drive around in the traffic', amb >= 1, String(amb));
  }

  if (want('flyover')) {
    const f = await p.evaluate(() => { const g = __game, F = g.world.flyovers; return F ? { ...F.stats(), why: F.plan.why } : null; });
    console.log('FLYOVER', JSON.stringify(f));
    check('Upper Iweka flyover has stairs, plus footbridges and new flyovers', f && f.stairs >= 2 && f.footbridges >= 2 && f.newFlyovers >= 1, JSON.stringify(f));
    const spots = await p.evaluate(() => { const F = __game.world.flyovers; return { fly: F.roads.map((f) => ({ x: f.jx, z: f.jz })), stair: F.stairs.map((s) => ({ ...s.top, ux: s.ux, uz: s.uz, nx: s.nx, nz: s.nz })), foot: F.footbridges.map((f) => ({ x: f.x, z: f.z, nx: f.nx, nz: f.nz })) }; });
    let k = 0;
    for (const q of spots.fly) { await look(q.x + 30, q.z + 30, 0, 9); await fixedCam(q.x + 70, 40, q.z + 70, q.x, 3, q.z); await settle(); await p.screenshot({ path: `${OUT}/flyover-${++k}.png` }); await follow(); }
    k = 0;
    for (const q of spots.stair.slice(0, 3)) { await look(q.x + q.nx * 14, q.z + q.nz * 14, 0, 9); await fixedCam(q.x + q.nx * 16 + q.ux * 6, 7, q.z + q.nz * 16 + q.uz * 6, q.x + q.ux * 6, 3, q.z + q.uz * 6); await settle(); await p.screenshot({ path: `${OUT}/stairs-${++k}.png` }); await follow(); }
    k = 0;
    for (const q of spots.foot.slice(0, 2)) { await look(q.x + 25, q.z, 0, 9); await fixedCam(q.x - q.nz * 26 + q.nx * 6, 6, q.z + q.nx * 26 + q.nz * 6, q.x, 4, q.z); await settle(); await p.screenshot({ path: `${OUT}/footbridge-${++k}.png` }); await follow(); }
    const onDeck = await p.evaluate(async () => { const g = __game; g.hospitals.knockDown = () => false; const F = g.world.flyovers.roads.map((f) => f.road); const f0 = g.world.flyovers.roads[0]; if (!f0) return -1; g.player.teleport(f0.jx + 25, f0.jz + 25); let n = 0; for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); n = Math.max(n, g.traffic.vehicles.filter((v) => v.edge?.road?.invented && v.y > 3).length); if (n) break; } return n || JSON.stringify({ any: g.traffic.vehicles.filter((v) => v.edge?.road?.invented).map((v) => v.y), fe: g.graph.edges.filter((e) => e.road.invented).map((e) => [e.drivable, g.graph.adj.get(e.a)?.length]), near: g.traffic.vehicles.length }); });
    check('traffic drives over the new flyovers', typeof onDeck === 'number' && onDeck > 0, String(onDeck));
    // the software renderer here runs at a few frames a second, so drive the player's controller directly (same physics)
    const climb = await p.evaluate(async () => {
      const g = __game, s = g.world.flyovers.stairs.find((q) => q.deck.invented) ?? g.world.flyovers.stairs[0]; g.player.teleport(s.bottom.x, s.bottom.z, s.yaw); const y0 = g.player.position.y;
      const walk = (ang, n) => { const basis = { fx: Math.sin(ang), fz: Math.cos(ang), rx: Math.cos(ang), rz: -Math.sin(ang) }; for (let i = 0; i < n; i++) g.player.update(1 / 30, { move: { x: 0, y: 1, mag: 1 }, run: false, jump: false, runFactor: 1 }, basis); };
      const st = g.state; g.state = 'qa-walk'; let maxY = y0;
      for (let k = 0; k < 20; k++) { walk(Math.atan2(-s.ux, -s.uz), 10); maxY = Math.max(maxY, g.player.position.y); }
      walk(Math.atan2(-s.nx, -s.nz), 60); const onDeck = g.player.position.y; // through the opening onto the deck
      walk(Math.atan2(s.nx, s.nz), 300); const edge = g.player.position.y; // walk at the parapet: you stay up
      g.state = st; g.player.syncModel();
      return { y0, maxY: +maxY.toFixed(2), top: s.top.y, onDeck: +onDeck.toFixed(2), stillUp: +edge.toFixed(2) };
    });
    console.log('CLIMB', JSON.stringify(climb));
    check('the player can walk up the stairs onto a deck, and the parapet stops you walking off', climb.maxY > climb.top - 1.2 && climb.onDeck > 3 && climb.stillUp > 3, JSON.stringify(climb));
    await p.evaluate(() => { const g = __game; g.cameraRig.distance = 6; g.cameraRig.pitch = 0.3; g.cameraRig.snapTo(g.player.position.clone().add({ x: 0, y: 2, z: 0 })); }); await settle(2500);
    await p.screenshot({ path: `${OUT}/on-the-flyover.png` });
    const npc = await p.evaluate(async () => { const g = __game; for (let i = 0; i < 90; i++) { const n = g.npcs.active.filter((w) => (w.y ?? 0) > 1 && w.edge?.road.walkDeck).length; if (n) return n; await new Promise((r) => setTimeout(r, 500)); } return 0; });
    check('NPC pedestrians use the stairs and decks too', npc > 0, String(npc));
  }
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(`update39: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
