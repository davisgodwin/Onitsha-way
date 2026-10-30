// v0.50: television you can watch (seven channels, a picture on the TV and big on screen), big WELCOME TO GRA gateways,
// and the rebuilt nightclub: crowd, DJ requests with shout-outs, spraying money, Dorime bottle service, two DJ mixes.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4243', OUT = 'qa/v50'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const open = async (vp = { width: 1280, height: 800 }) => { const c = await b.newContext({ viewport: vp }); await c.addInitScript(() => { localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); }); const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message)); await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 600000 }); return p; };
const label = (p, x, z) => p.evaluate(({ x, z }) => { const g = __game; g.interactions.update(x, z); const l = g.interactions.current?.label; return typeof l === 'function' ? l() : l ?? null; }, { x, z });
try {
 const p = await open();
 // ---------------------------------------------------------------- GRA gateways
 const gra = await p.evaluate(() => { const g = __game, gates = g.world.graWelcome.gates; g.updatePlaces(); return { gates, names: [...new Set(gates.map((x) => x.name))], inside: gates.map((x) => g.world.districts.premiumAt(x.x, x.z)), onMap: (g.minimap.places ?? []).filter((q) => /^Welcome to GRA/.test(q.label)).length, boards: g.world.graWelcome.group.children.filter((m) => m.name === 'gra-welcome').length }; });
 console.log(JSON.stringify({ gates: gra.gates.length, names: gra.names, onMap: gra.onMap }));
 check('a big WELCOME TO GRA gateway on the main roads into both GRAs', gra.names.includes('GRA Phase I') && gra.names.includes('GRA Phase II') && gra.gates.length >= 3 && gra.boards === gra.gates.length * 2, JSON.stringify(gra.names));
 check('each gateway stands just inside GRA, where the road enters', gra.inside.every((k) => k > 0));
 const g0 = gra.gates.find((x) => x.name === 'GRA Phase I') ?? gra.gates[0];
 await p.evaluate((s) => { const g = __game; g.clock.setMode('game'); g.clock.minutes = 12 * 60; g.player.teleport(s.x, s.z); g.world.city.buildAround(s.x, s.z, 260); g.cameraRig.setMode('fixed'); const cam = g.cameraRig.camera, dx = Math.sin(s.yaw), dz = Math.cos(s.yaw); cam.position.set(s.x - dx * 34 + dz * 6, 6, s.z - dz * 34 - dx * 6); cam.lookAt(s.x, 7, s.z); }, g0);
 await p.waitForTimeout(4500); await p.screenshot({ path: `${OUT}/gra-welcome.png` });
 const g1 = gra.gates.find((x) => x.name === 'GRA Phase II');
 if (g1) { await p.evaluate((s) => { const g = __game; g.player.teleport(s.x, s.z); g.world.city.buildAround(s.x, s.z, 260); const cam = g.cameraRig.camera, dx = Math.sin(s.yaw), dz = Math.cos(s.yaw); cam.position.set(s.x - dx * 40 - dz * 8, 5, s.z - dz * 40 + dx * 8); cam.lookAt(s.x, 7, s.z); }, g1); await p.waitForTimeout(4500); await p.screenshot({ path: `${OUT}/gra-welcome-phase2.png` }); }
 await p.evaluate(() => __game.cameraRig.setMode('follow'));
 check('the gateways are on the map', gra.onMap === gra.gates.length, String(gra.onMap));
 // ---------------------------------------------------------------- TV
 const tv = await p.evaluate(() => { const g = __game; g.clock.minutes = 20 * 60; g.economy.transact({ key: 'qa50-tv', amount: 900000, reason: 'Browser test only' }); const h = g.homes.listings.find((h) => h.type === 'flat'); g.homes.housing.rent(h.id); g.homes.enter(h, { fade: false }); const id = h.id; g.homeUpgrades.buy(id, 'tv'); g.homes.refreshDecor();
  const d = g.homes.decor, lay = g.homes.inside.layout; let placed = null; const spots = []; for (let z = 1; z < lay.size[1] - 1; z += .4) for (let x = 1; x < lay.size[0] - 1; x += .4) spots.push([x, z]); spots.sort((a, b) => Math.hypot(a[0] - lay.size[0] / 2, a[1] - lay.size[1] / 2) - Math.hypot(b[0] - lay.size[0] / 2, b[1] - lay.size[1] / 2)); for (const [x, z] of spots) { const r = d.place('tv', { x, z, rotation: 180 }); if (r.ok) { placed = { x, z }; break; } }
  g.homes.refreshDecor(); const view0 = g.homes.tvView(); const sw = view0.options.find((o) => /Switch on/.test(o.label)); g.homeUpgrades.home(id).generatorOn = true; g.homeUpgrades.home(id).fuel = 20; if (g.weather) g.weather.power.on = true; sw?.act();
  const v = g.homes.tvView(); return { placed, homeId: id, options: v.options.map((o) => ({ label: o.label, sub: o.sub, disabled: !!o.disabled })) }; });
 console.log(JSON.stringify(tv.options.map((o) => o.label)));
 const watchOpts = tv.options.filter((o) => /^Watch /.test(o.label));
 check('a TV that is on offers channels: Nollywood, Hollywood-style action, comedy skits, news, football, music videos, cartoons', ['Nollywood', 'Hollywood', 'Comedy', 'News', 'Football', 'Music', 'Cartoons'].every((k) => watchOpts.some((o) => o.label.includes(k))) && watchOpts.every((o) => !o.disabled), JSON.stringify(watchOpts.map((o) => o.label)));
 const scr = await p.evaluate(() => { const g = __game, r = g.homes.decor.records.find((r) => r.id === 'tv'); let screen = null; r.item.traverse((n) => { if (n.name === 'appliance-screen') screen = n; }); g.homes.decor.updateAppliances(.1); g.homes.decor.updateAppliances(.1); const V = screen.position.constructor, pos = screen.getWorldPosition(new V()), n = new V(0, 0, 1).applyQuaternion(screen.getWorldQuaternion(r.item.quaternion.clone())); const lay = g.homes.inside.layout, cx = lay.origin.x + lay.size[0] / 2, cz = lay.origin.z + lay.size[1] / 2; return { usesTV: screen.material === g.tvShows.material, p: pos.toArray(), n: n.toArray(), c: [cx, cz] }; });
 check('the screen of the TV in the room shows the programme', scr.usesTV);
 // look at the TV in the room
 await p.evaluate((s) => { const g = __game; g.tvShows.setChannel('nollywood'); for (let i = 0; i < 40; i++) g.homes.decor.updateAppliances(1 / 30); g.cameraRig.setMode('fixed'); const cam = g.cameraRig.camera; cam.position.set(s.p[0] + s.n[0] * 1.7 + s.n[2] * .5, s.p[1] + .25, s.p[2] + s.n[2] * 1.7 - s.n[0] * .5); cam.lookAt(s.p[0], s.p[1], s.p[2]); g.player.teleport(s.p[0] + s.n[0] * 1.6, s.p[2] + s.n[2] * 1.6); }, scr);
 await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/tv-in-room.png` });
 await p.evaluate(() => __game.cameraRig.setMode('follow'));
 // watch each channel: the big view opens with a picture, then finish one and check the rewards and the clock
 const shots = [];
 for (const id of ['nollywood', 'hollywood', 'comedy', 'news', 'football', 'music', 'cartoon']) {
  await p.evaluate((id) => { const g = __game, o = g.homes.tvView().options.find((o) => o.label === 'Watch ' + { nollywood: 'Nollywood drama', hollywood: 'Hollywood-style action', comedy: 'Comedy skit', news: 'News', football: 'Football highlights', music: 'Music videos', cartoon: 'Cartoons' }[id]); o.act(); }, id);
  await p.waitForTimeout(2500);
  const st = await p.evaluate(() => { const w = __game.tvShows.watching; if (!w) return { why: { inside: !!__game.homes.inside, pos: __game.player.position.toArray(), speed: __game.player.speed, state: __game.state } }; const _w = w, c = w?.big; if (!c) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const seen = new Set(); for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4)); return { id: w.id, colours: seen.size, visible: !!document.querySelector('.tv-watch canvas') }; });
  shots.push(st); await p.screenshot({ path: `${OUT}/tv-${id}.png` });
  await p.evaluate(() => __game.tvShows.stop(true));
 }
 check('each channel opens a big picture that is really drawn (many colours on the canvas)', shots.every((s) => s?.visible && s.colours > 12), JSON.stringify(shots));
 const done = await p.evaluate(async () => { const g = __game; g.homes.tvView().options.find((o) => /Comedy/.test(o.label)).act(); const before = { fun: g.needs.state.fun, min: g.clock.minutes + g.clock.day * 1440 }; g.needs.state.fun = 20; const w = g.tvShows.watching; w.elapsed = w.length - .05; g.tvShows.updateWatch(.1); return { open: !!document.querySelector('.tv-watch'), fun: g.needs.state.fun, minutes: g.clock.minutes + g.clock.day * 1440 - before.min }; });
 check('watching to the end: the big view closes, the clock moves on, fun goes up', !done.open && done.fun > 20 && done.minutes >= 15, JSON.stringify(done));
 await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => { const g = __game, o = g.homes.tvView().options.find((o) => /Football/.test(o.label)); o.act(); }); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/tv-mobile.png` });
 check('the TV view fits a phone', await p.evaluate(() => { const r = document.querySelector('.tv-watch .tv-box').getBoundingClientRect(); return r.width <= innerWidth && document.documentElement.scrollWidth <= innerWidth; }));
 const stopEarly = await p.evaluate(() => { const g = __game; g.tvShows.watching.elapsed = 3; document.querySelector('.tv-watch [data-stop]').click(); return !document.querySelector('.tv-watch') && !g.tvShows.watching; });
 check('Stop watching closes the TV view', stopEarly);
 await p.setViewportSize({ width: 1280, height: 800 });
 await p.evaluate(() => { const g = __game; g.homes.exit(); });
 await p.waitForFunction(() => !__game.homes.inside, null, { timeout: 30000 }).catch(() => {});
 // ---------------------------------------------------------------- the club
 const club = await p.evaluate(() => { const g = __game; g.closeChoice(); g.clock.minutes = 22 * 60; const v = g.cityLife.venues.find((v) => v.kind === 'club'); g.player.teleport(v.x, v.z); const ok = g.club.enter(v); const c = g.club; const roles = {}; for (const q of c.people) roles[q.role] = (roles[q.role] ?? 0) + 1; return { ok, people: c.people.length, roles, merge: c.mergeStats, tracks: g.venueMusic.clubTracks.map((t) => t.id) }; });
 console.log(JSON.stringify(club));
 check('the rebuilt club: a crowd (20 dancers), VIP and bar guests, DJ, hype man, bar staff, waitresses, bouncers', club.ok && club.people >= 30 && club.roles.dance >= 20 && club.roles.dj === 1 && club.roles.hype === 1 && club.roles.bouncer === 2 && club.roles.waitress === 3 && club.roles.serve === 2, JSON.stringify(club.roles));
 check('the static parts of the room are merged into a few meshes', club.merge.after < club.merge.before / 3, JSON.stringify(club.merge));
 const where = await p.evaluate(() => { const c = __game.club; return { ox: c.ox }; });
 const labels = {}; for (const [k, x, z] of [['dj', 15, 5.6], ['floor', 15, 9.5], ['bar', 24, 11.5], ['vip', 5.5, 12], ['wc', 27.5, 21.5], ['exit', 15, 22]]) labels[k] = await label(p, where.ox + x, z);
 console.log(JSON.stringify(labels));
 check('the DJ, dance floor, bar, VIP lounge, bathroom and exit all answer (the v0.46 bug that hid four of them is fixed)', /DJ/.test(labels.dj) && /Dance/.test(labels.floor) && /Bar/.test(labels.bar) && /VIP/.test(labels.vip) && /bathroom/.test(labels.wc) && /Exit/.test(labels.exit), JSON.stringify(labels));
 check('the club playlist: the Afrobeats DJ mix and the amapiano mixtape first', club.tracks[0] === 'onitsha-nights' && club.tracks[1] === 'amapiano-sunday');
 // the mixes are on the server and are real audio
 const files = await p.evaluate(async () => { const out = []; for (const u of ['audio/club/onitsha-nights-afrobeats-mix.mp3', 'audio/club/amapiano-sunday-mixtape.mp3']) { const r = await fetch(u, { headers: { Range: 'bytes=0-3' } }); const buf = new Uint8Array(await r.arrayBuffer()); out.push({ u, ok: r.ok, len: Number(r.headers.get('content-range')?.split('/')[1] ?? r.headers.get('content-length')), head: [...buf.slice(0, 3)] }); } return out; });
 check('both mixes are served as MP3 files of several MB', files.every((f) => f.ok && f.len > 3e6 && (f.head[0] === 0x49 || f.head[0] === 0xff)), JSON.stringify(files));
 // a camera view of the club
 const shot = async (name, from, to) => { await p.evaluate(({ from, to }) => { const g = __game, c = g.club; g.cameraRig.setMode('fixed'); const cam = g.cameraRig.camera; cam.position.set(c.ox + from[0], from[1], from[2]); cam.lookAt(c.ox + to[0], to[1], to[2]); }, { from, to }); await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/${name}.png` }); };
 await p.evaluate(() => { const g = __game; for (let i = 0; i < 30; i++) g.club.update(1 / 30); });
 await shot('club-floor', [15, 3.4, 21], [15, 2, 4]); await shot('club-dj', [15, 2.2, 11], [15, 2.6, 1]); await shot('club-bar-vip', [14, 3.2, 13], [27, 1.4, 11]); await shot('club-vip', [10, 2.6, 15], [2, 1, 10]);
 await p.evaluate(() => __game.cameraRig.setMode('follow'));
 // request a song with a shout-out
 const req = await p.evaluate(() => { const g = __game, c = g.club, bal = g.economy.balance; g.player.teleport(c.ox + 15, 5.6); const v = c.djView(); const t = g.venueMusic.clubTracks.find((t) => t.id === 'amapiano-sunday'); const tip = c.tipView(t); tip.options[1].act(); return { opts: v.options.map((o) => o.label), now: g.venueMusic.track.id, shout: c.shoutText, paid: bal - g.economy.balance }; });
 check('request a song from the DJ: the amapiano mixtape plays, the DJ is paid, a shout-out goes up on the LED wall', req.now === 'amapiano-sunday' && req.paid === 5000 && /SHOUT OUT/.test(req.shout), JSON.stringify(req));
 // spray money
 const spray = await p.evaluate(() => { const g = __game, c = g.club, bal = g.economy.balance; g.player.teleport(c.ox + 15, 10); const o = c.activityView('dance').options.find((o) => /Spray ₦50,000/.test(o.label)); o.act(); for (let i = 0; i < 90; i++) c.update(1 / 30); return { paid: bal - g.economy.balance, notes: c.notes.count, flying: c.noteState.filter((n) => n.y > .1).length, hype: c.hypeUntil > c.t }; });
 await shot('club-spray', [17, 2.6, 15.5], [15, 1.2, 9]);
 for (let i = 0; i < 3; i++) await p.evaluate(() => { for (let i = 0; i < 30; i++) __game.club.update(1 / 30); });
 const landed = await p.evaluate(() => __game.club.noteState.filter((n) => n.y <= .03).length);
 check('spray money: ₦50,000 leaves the wallet, the notes fly over the floor and land on it, the crowd hypes', spray.paid === 50000 && spray.notes > 50 && spray.hype && landed > 30, JSON.stringify({ ...spray, landed }));
 await shot('club-notes-floor', [16, 2, 13], [15, 0, 9]);
 // Dorime bottle service
 const dor = await p.evaluate(() => { const g = __game, c = g.club, bal = g.economy.balance; for (let i = 0; i < 200; i++) c.update(1 / 30); g.player.teleport(c.ox + 5.5, 12); const o = c.activityView('lounge').options.find((o) => /^Dorime/.test(o.label)); o.act(); const w0 = c.waitresses.map((w) => w.h.group.position.x); for (let i = 0; i < 6 * 30; i++) c.update(1 / 30); const w1 = c.waitresses.map((w) => w.h.group.position.x); return { paid: bal - g.economy.balance, show: c.show?.kind, moved: w1.map((x, i) => w0[i] - x), bottles: c.bottles.filter((b) => b.visible).length, sparks: c.sparks.visible, wall: c.shoutText }; });
 await shot('club-dorime', [9.5, 2.4, 16], [4, 1.2, 12]);
 check('Dorime: bottle service is paid, the waitresses carry the bottles with sparklers to your table, "DORIME" on the LED wall', dor.paid === 30000 && dor.show === 'dorime' && dor.moved.every((d) => d > 10) && dor.bottles === 2 && dor.sparks && /DORIME/.test(dor.wall), JSON.stringify(dor));
 const after = await p.evaluate(() => { const c = __game.club; for (let i = 0; i < 12 * 30; i++) c.update(1 / 30); return { show: c.show, home: c.waitresses.every((w) => Math.hypot(w.h.group.position.x - w.home.x, w.h.group.position.z - w.home.z) < .1), sparks: c.sparks.visible }; });
 check('after the bottles arrive the waitresses go back to the bar and the sparklers go out', !after.show && after.home && !after.sparks, JSON.stringify(after));
 const poor = await p.evaluate(() => { const g = __game, bal = g.economy.balance; g.economy.transact({ key: 'qa50-drain', amount: -(bal - 1000), reason: 'qa' }); const o = g.club.activityView('dance').options.find((o) => /Spray ₦100,000/.test(o.label)); const d = g.club.activityView('lounge').options.find((o) => /^Dorime/.test(o.label)); return { spray: !!o.disabled, dorime: !!d.disabled }; });
 check('you can\'t spray money or order Dorime without the money', poor.spray && poor.dorime);
 await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => { const g = __game; g.openChoice(() => g.club.djView()); }); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/club-dj-mobile.png` });
 check('the DJ menu fits a phone', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
 const left = await p.evaluate(() => { const g = __game; g.closeChoice(); g.club.exit({ quiet: true }); return { inside: !!g.club.inside, notes: g.club.noteState.length }; });
 check('leaving the club', !left.inside);
 const kid = await p.evaluate(() => { const g = __game, a = g.saveData.character.ageGroup; g.saveData.character.ageGroup = 'child'; const ok = g.club.enter(g.cityLife.venues.find((v) => v.kind === 'club')); g.saveData.character.ageGroup = a; return ok; });
 check('child characters still cannot enter a nightclub', kid === false);
 check('no page errors', errors.length === 0, JSON.stringify(errors.slice(0, 3)));
 console.log(`\nv50: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.log('ERRORS', JSON.stringify(errors.slice(0, 5))); process.exitCode = 1; } finally { await b.close(); }
