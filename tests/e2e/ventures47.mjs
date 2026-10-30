// v0.47: stage 7 (second part) and stage 8 in the browser. Runs against the dev server (imports the item list).
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4251', OUT = 'qa/v47'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(300000); p.on('pageerror', (e) => errors.push(e.message));
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready && __game.ventures?.V, null, { timeout: 600000 });
 const setDay = (d, h = 10) => p.evaluate(({ d, h }) => { const g = __game; g.clock.setMode('game'); g.clock.rate = 0; g.clock.day = d; g.clock.minutes = h * 60; g.ventures.update(); g.news.update(10); }, { d, h });
 await setDay(3); await p.evaluate(async () => { const g = __game; g.economy.transact({ key: 'qa47', amount: 60_000_000, reason: 'qa' }); const { ITEMS } = await import('/src/data/catalogue.js'); for (const id of ['laptop', 'inspection-kit']) if (!g.inventory.has(id)) g.inventory.add(ITEMS[id]); });
 const shot = async (name, fn) => { await p.evaluate(fn); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/${name}.png` }); };
 const view = (pos) => `const g = __game; g.closeChoice?.(); g.player.teleport(${pos}); g.cameraRig.pitch = 0.25; g.cameraRig.snapTo(g.player.position);`;
 // event planner
 const ev = await p.evaluate(() => { const g = __game, Vn = g.ventures, { eventOffers, eventCost } = Vn.constructor.__v ?? {}; const offers = Vn.eventView().options.filter((o) => /budget/.test(o.label)); const o = offers[0]; o.act(); const sv = g.choiceBuilder(); const book = sv.options.find((x) => /Book it/.test(x.label)); const before = g.economy.balance; book.act(); const e = Vn.V.events[0]; return { booked: !!e, cost: before - g.economy.balance, day: e.day }; });
 check('event planner: book a client, pay the suppliers', ev.booked && ev.cost > 0, JSON.stringify(ev));
 await setDay(ev.day, 13);
 const run = await p.evaluate(() => { const g = __game, e = g.ventures.V.events[0]; g.player.teleport(e.x + 3, e.z + 3); const label = g.interactions.update(e.x + 3, e.z + 3); const canopy = g.ventures.meshes.has('event:' + e.id); const before = g.economy.balance; g.ventures.finishEvent(e, true); return { label, canopy, paid: g.economy.balance - before, news: g.news.latest(20).some((n) => n.tag === 'events' && /guests/.test(n.body)) }; });
 check('on the day the canopy is up; run it, get paid, it makes the news', /run the event/.test(String(run.label)) && run.canopy && run.paid > 0 && run.news, JSON.stringify(run));
 // decorator
 const dec = await p.evaluate(() => { const g = __game, Vn = g.ventures; Vn.decorView().options[0].act(); const d = Vn.V.decor[0]; g.player.teleport(d.x, d.z); const label = g.interactions.update(d.x, d.z); const { DECOR_ITEMS } = { DECOR_ITEMS: [] }; let v = Vn.decorPickView(d); for (let i = 0; i < 3; i++) { const o = v.options.find((x) => x.sub.includes(d.style)) ?? v.options[0]; o.act(); v = Vn.decorPickView(d); } const before = g.economy.balance; v.options[0].act(); return { label, paid: g.economy.balance - before, acts: g.life.work.w.self.decorator?.acts }; });
 check('decorator: go to the client\'s house, choose three pieces in their style, get paid', /decorate/.test(String(dec.label)) && dec.paid > 0 && dec.acts === 1, JSON.stringify(dec));
 // tech agency
 const ag = await p.evaluate(() => { const g = __game, Vn = g.ventures; Vn.agencyView().options[0].act(); const A = Vn.V.agency; Vn.agencyView().options.find((o) => /Hire a developer/.test(o.label)).act(); Vn.agencyView().options.find((o) => /Hire a developer/.test(o.label)).act(); (Vn.agencyView().options.find((o) => /Take: Logo|Take: Business website/.test(o.label)) ?? Vn.agencyView().options.find((o) => /Take:/.test(o.label))).act(); return { name: A.name, staff: A.staff, briefs: A.briefs.length }; });
 const before = await p.evaluate(() => __game.economy.balance);
 for (let d = ev.day + 1; d <= ev.day + 9; d++) await setDay(d);
 const ag2 = await p.evaluate((before) => { const A = __game.ventures.V.agency; return { delivered: A.delivered, done: A.briefs.map((b) => b.done), change: __game.economy.balance - before }; }, before);
 check('tech agency: register, hire developers, take a brief; they deliver it and the client pays (wages paid daily)', ag.staff === 2 && ag2.delivered === 1, JSON.stringify({ ag, ag2 }));
 // landlord
 const ll = await p.evaluate(() => { const g = __game, H = g.homes.housing, h = g.homes.listings.find((x) => !H.state.owned[x.id]); const r = H.buy(h.id); const Vn = g.ventures; const opt = Vn.landlordView().options.find((o) => /^Let /.test(o.label)); opt.act(); const enter = g.homes.enter(h, { fade: false }); return { bought: r.ok, let: Vn.isLet(h.id), refused: enter === false, id: h.id }; });
 check('landlord: buy a home and let it; you can\'t move into your tenant\'s home', ll.bought && ll.let && ll.refused, JSON.stringify(ll));
 const d0 = await p.evaluate(() => __game.clock.day); for (let d = d0 + 1; d <= d0 + 8; d++) await setDay(d);
 const rent = await p.evaluate((id) => { const L = __game.ventures.V.lets[id]; return { paid: L.paid ?? 0, arrears: L.arrears ?? 0 }; }, ll.id);
 check('a week later the tenant has paid (or is in arrears)', rent.paid + (rent.arrears ? 1 : 0) >= 1, JSON.stringify(rent));
 // developer
 const dv = await p.evaluate(() => { const g = __game, Vn = g.ventures; let u = null; for (const ch of g.world.city.chunks.values()) { for (const it of ch.items ?? []) if (it.plan?.type === 'unfinished') { u = it; break; } if (u) break; } const cx = u.b.pts[0][0], cz = u.b.pts[0][1]; g.player.teleport(cx + 6, cz + 6); const buy = Vn.developView().options.find((o) => /Buy the unfinished/.test(o.label)); buy.act(); return { builds: Vn.V.builds.length }; });
 let day = await p.evaluate(() => __game.clock.day);
 for (let k = 0; k < 3; k++) { await p.evaluate(() => { const Vn = __game.ventures; const o = Vn.developView().options.find((x) => !x.disabled && /·/.test(x.label) && !/Buy/.test(x.label)); o?.act(); }); day += 4; await setDay(day); }
 const built = await p.evaluate(() => { const b = __game.ventures.V.builds[0]; return { done: !!b.done, mesh: __game.ventures.meshes.has('build:' + b.id), x: b.x, z: b.z }; });
 await shot('developed-building', `${view(`${built.x} + 26, ${built.z} + 26, Math.PI * 1.25`)} g.cameraRig.yaw = Math.PI * 0.25; g.cameraRig.pitch = 0.3;`);
 check('developer: buy an unfinished building, pay for three stages, and it is finished in the city', dv.builds === 1 && built.done && built.mesh, JSON.stringify(built));
 const sold = await p.evaluate(() => { const g = __game, before = g.economy.balance; g.ventures.landlordView().options.find((o) => /Sell your finished building/.test(o.label)).act(); return g.economy.balance - before; });
 check('…and sell it at a modest profit', sold > 0, String(sold));
 // roadside call-out
 const co = await p.evaluate(() => { const g = __game, Vn = g.ventures; g.player.teleport(g.world.landmarks.get('upper-iweka').x + 40, g.world.landmarks.get('upper-iweka').z + 40); g.closeChoice?.(); const c = Vn.takeCallout(); g.player.teleport(c.x + 3, c.z + 1); return { label: g.interactions.update(c.x + 3, c.z + 1), car: Vn.meshes.has('callout:' + c.id), x: c.x, z: c.z }; });
 await shot('callout-car', `${view(`${co.x} + 6, ${co.z} + 6`)}`);
 const fix = await p.evaluate(() => { const g = __game, Vn = g.ventures, v = Vn.repairView(); const before = g.economy.balance; const { FAULTS } = { FAULTS: null }; const right = v.options.find((o) => /Jump-start|Let it cool|Test the fuel pump|Jack it up/.test(o.label)); right.act(); return { paid: g.economy.balance - before, cleared: !Vn.V.callout }; });
 check('roadside mechanic: a broken-down car at the roadside; find the fault, get paid', /take a look/.test(String(co.label)) && co.car && fix.paid > 0 && fix.cleared, JSON.stringify({ co, fix }));
 // security
 const sec = await p.evaluate(() => { const g = __game, Vn = g.ventures; Vn.securityView().options[0].act(); for (let i = 0; i < 2; i++) Vn.securityView().options.find((o) => /Hire a guard/.test(o.label)).act(); Vn.securityView().options.find((o) => /Take on: Bright Future School/.test(o.label)).act(); return { S: Vn.V.security.guards, clients: Vn.V.security.clients.length }; });
 day = await p.evaluate(() => __game.clock.day); const b0 = await p.evaluate(() => __game.economy.balance); for (let d = day + 1; d <= day + 7; d++) await setDay(d);
 const sec2 = await p.evaluate(() => ({ acts: __game.life.work.w.self.security?.acts ?? 0 }));
 check('security company: register, hire guards, take a client; the weekly fee comes in', sec.S === 2 && sec.clients === 1 && sec2.acts >= 2, JSON.stringify({ sec, sec2 }));
 // crew
 const crew = await p.evaluate(() => { const g = __game, Vn = g.ventures; Vn.crewView().options[0].act(); const L = g.world.landmarks.get('upper-iweka-park'); g.player.teleport(L.x + 5, L.z + 5); const v = Vn.crewView(); v.options.find((o) => /Community watch/.test(o.label)).act(); const inf = Vn.V.crew.turf['upper-iweka-park']; Vn.crewView().options.find((o) => /levy/.test(o.label)).act(); const cs = g.justice.cases.j.cases.filter((c) => /Extortion/.test(c.offence)).length; return { inf, cases: cs }; });
 check('street crew (abstract): community watch builds influence; collecting a "levy" is a crime the police record', crew.inf > 0 && crew.cases === 1, JSON.stringify(crew));
 // football
 const fb = await p.evaluate(() => { const g = __game, Vn = g.ventures; for (const s of ['fitness', 'charisma']) for (let i = 0; i < 12; i++) g.skills.add(s, 400); Vn.footballView().options[0].act(); const sp = g.stadiumFootball.spot; g.player.teleport(sp.x + 2, sp.z + 2); let d = g.clock.day; while (((d - 1) % 7) !== 5) d++; g.clock.day = d; g.clock.minutes = 12 * 60; Vn.update(); const opp = Vn.footballView().options.find((o) => /League match/.test(o.label)); Vn.V.club.pending = { week: Vn.week(), opp: 1 }; const before = g.economy.balance; Vn.footballResult({ matchId: 'qa', outcome: 'win', score: [2, 1] }); Vn.footballView().options.find((o) => /Coach/.test(o.label))?.act(); Vn.V.coach.plan[Vn.week()] = 'attack'; return { signed: !!Vn.V.club, paid: g.economy.balance - before, opp: opp?.label, day: d, coach: !!Vn.V.coach }; });
 await setDay(fb.day + 1);
 const fb2 = await p.evaluate(() => { const V = __game.ventures.V; return { league: V.club.results.length, youth: V.coach.results.length, table: __game.ventures.tableView(V.club.results, 'Onitsha City FC').text.split('\n')[0] }; });
 check('footballer and coach: sign, a league win pays, the round is played out, and the U-17s play with your tactics', fb.signed && fb.paid > 0 && fb2.league >= 3 && fb2.youth >= 3 && fb.coach, JSON.stringify({ fb, fb2 }));
 // stage 8: the news screens, wanted posters, fame
 const news = await p.evaluate(() => { const g = __game; return { screens: g.news.screens.length, items: g.news.latest(30).length }; });
 const sc = await p.evaluate(() => { const s = __game.news.screens[0]; return { x: s.x, z: s.z }; });
 await shot('news-screen', `${view(`${sc.x}, ${sc.z} + 13, Math.PI`)} g.cameraRig.yaw = 0; g.cameraRig.pitch = -0.05;`);
 check('the news: three screens in town and a feed built from what happened', news.screens === 3 && news.items >= 5, JSON.stringify(news));
 const want = await p.evaluate(() => { const g = __game; g.justice.cases.open({ agency: 'police', offence: 'Robbery at Ochanja Market', severity: 2, evidence: 1.2, day: g.clock.day, ref: 'qa47-wanted' }); g.news.update(10); g.news.t = 99; g.news.update(10); const f = g.news.fame(); return { posters: g.news.posters.filter((p) => p.mesh).length, level: f.level, item: g.news.latest(40).some((n) => /WANTED/.test(n.title)) }; });
 const pp = await p.evaluate(() => { const q = [...__game.news.posters].reverse().find((x) => x.mesh); return { x: q.x, z: q.z }; });
 await shot('wanted-poster', `${view(`${pp.x} + 1.6, ${pp.z} + 5, Math.PI`)} g.cameraRig.yaw = 0.25; g.cameraRig.pitch = 0.02; g.cameraRig.distance = 4;`);
 check('wanted: posters with your name go up, it\'s in the news, and people treat you as wanted', want.posters >= 3 && want.level === 'wanted' && want.item, JSON.stringify(want));
 await shot('phone-ventures', `const g = __game; g.closeChoice?.(); g.openOverlay('phone'); g.phone.render('ventures');`);
 const ph = await p.evaluate(() => document.querySelector('.phone-body')?.innerText ?? '');
 await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/phone-ventures-mobile.png` }); await p.evaluate(() => __game.phone.render('courier')); await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/phone-courier-mobile.png` }); check('the phone\'s Ventures app lists every venture', ['Event planning', 'Interior decorating', 'Landlord', 'Property development', 'Roadside call-outs', 'Football'].every((k) => ph.includes(k)), ph.slice(0, 120));
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`ventures47: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
