// v0.45 stage 6 in the browser: register, join a party, stand for councillor, campaign (rally, posters, debate), vote
// on election day, win, commission a project that is built in the city, and what happens if you steal from the budget.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4247', OUT = 'qa/v45'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message));
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready && __game.politics?.P, null, { timeout: 400000 });
 const day = (d, h = 10) => p.evaluate(({ d, h }) => { const g = __game; g.clock.setMode('game'); g.clock.rate = 0; g.clock.day = d; g.clock.minutes = h * 60; g.politics.update(); }, { d, h });
 await day(2);
 const setup = await p.evaluate(() => { const g = __game, C = g.politics; g.economy.transact({ key: 'qa45-pol', amount: 3_000_000, reason: 'qa' }); return { office: !!C.office, grounds: C.grounds.length, onMap: g.politics.places().some((x) => x.kind === 'office') }; });
 check('the Electoral Offices and four rally grounds are in the city, on the map', setup.office && setup.grounds >= 3 && setup.onMap, JSON.stringify(setup));
 const inside = await p.evaluate(() => { const g = __game; g.politics.enter(); const pos = g.player.position, labels = []; for (const it of g.interactions.items) { if (it.enabled && !it.enabled()) continue; if (Math.hypot(it.x - pos.x, it.z - pos.z) > 30) continue; labels.push(typeof it.label === 'function' ? it.label() : it.label); } return { inside: g.civic.inside?.kind, labels }; });
 await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/electoral-office.png` });
 check('walk in: the INEC and ANSIEC desks, results board, debate stage', inside.inside === 'electoral' && ['register to vote', 'nominations', 'Results', 'debate'].every((k) => inside.labels.some((l) => l.includes(k))), JSON.stringify(inside));
 const kid = await p.evaluate(() => { const g = __game, c = g.saveData.character, was = c.ageGroup; c.ageGroup = 'child'; const v = g.politics.registerView(); c.ageGroup = was; return v.text; });
 check('a child character cannot register', /18/.test(kid), kid);
 const reg = await p.evaluate(() => { const g = __game, C = g.politics; C.registerView().options[0].act(); const joined = C.joinParty('opp'); const v = C.nominateView(); const opt = v.options.find((o) => /Councillor/.test(o.label)); const gov = v.options.find((o) => /Governor/.test(o.label)); opt.act(); return { registered: C.P.registered, joined, party: C.P.party, race: C.myRace()?.office, gov: gov.why }; });
 check('register, join the OPP, stand for councillor (the governorship needs experience)', reg.registered && reg.joined && reg.race === 'councillor' && /another office|standing/.test(reg.gov), JSON.stringify(reg));
 await p.evaluate(() => __game.civic.exit({ quiet: true }));
 // the campaign
 await day(9);
 const camp = await p.evaluate(() => { const g = __game, C = g.politics, gr = C.grounds[0]; g.player.teleport(gr.x + 1, gr.z + 2, Math.PI); const label = g.interactions.update(gr.x + 1, gr.z + 2); g.player.teleport(gr.x + 2, gr.z + 9, Math.PI); const before = C.strengthOf(C.myRace()); C.rallyView(gr).options[0].act(); C.posters(); return { label, before, after: C.strengthOf(C.myRace()), rally: !!C.rallyMesh, posters: C.posterMeshes.length }; });
 check('hold a rally at a rally ground and put up posters: you get stronger, and the stage and posters are there', /rally/.test(String(camp.label)) && camp.after > camp.before && camp.rally && camp.posters > 0, JSON.stringify(camp));
 await p.evaluate(() => { const g = __game, gr = g.politics.grounds[0]; g.closeChoice(); g.cameraRig.yaw = 0; g.cameraRig.pitch = 0.2; g.cameraRig.snapTo(g.player.position); }); await p.waitForTimeout(2000); await p.screenshot({ path: `${OUT}/rally.png` });
 await day(10); const don = await p.evaluate(() => __game.politics.myRace().campaign.fund); check('donations come in the day after a rally', don > 0, String(don));
 await day(14);
 const deb = await p.evaluate(() => { const g = __game, C = g.politics; for (let i = 0; i < 3; i++) C.debateView().options[0].act(); return C.myRace().campaign.debate; });
 check('the debate: three questions, scored', deb >= 6, String(deb));
 const poll = await p.evaluate(() => __game.politics.poll(__game.politics.myRace()));
 // election day
 await day(21, 11);
 const vote = await p.evaluate(() => { const g = __game, C = g.politics; C.enter(); const labels = []; const pos = g.player.position; for (const it of g.interactions.items) { if (it.enabled && !it.enabled()) continue; if (Math.hypot(it.x - pos.x, it.z - pos.z) > 30) continue; labels.push(typeof it.label === 'function' ? it.label() : it.label); }
  const r1 = C.vote('councillor', 'player'), r2 = C.vote('councillor', 'player'); return { polling: labels.some((l) => /Polling unit/.test(l)), r1: r1.ok, r2: r2.error }; });
 await p.evaluate(() => { const g = __game; g.closeChoice(); g.player.teleport(g.civic.ox + 10, 14.5, Math.PI); g.cameraRig.yaw = 0; g.cameraRig.pitch = 0.3; g.cameraRig.snapTo(g.player.position); }); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/polling-unit.png` });
 check('election day: the polling unit is set out; you vote once, a second vote is refused', vote.polling && vote.r1 && /already voted/.test(vote.r2), JSON.stringify(vote));
 await p.evaluate(() => __game.civic.exit({ quiet: true }));
 // results
 await p.evaluate(() => { const r = __game.politics.myRace(); r.campaign.rallies = 6; r.campaign.posters = 3; }); // make this candidate strong enough to be sure of a result to test
 await day(22, 9);
 const res = await p.evaluate(() => { const g = __game, C = g.politics, S = C.P.seasons[0], race = S.races.councillor; const recount = (() => { const t = {}; for (const u of race.record.units) for (const [k, v] of Object.entries(u.votes)) t[k] = (t[k] ?? 0) + v; return t; })(); return { declared: S.declared, winner: race.result.winner, office: C.P.office?.id, same: JSON.stringify(recount) === JSON.stringify(race.result.totals), ballots: race.record.ballots.length, summary: S.summary }; });
 check('results day: every race declared from its polling-unit record; you won and took office', res.declared && res.winner === 'player' && res.office === 'councillor' && res.same && res.ballots === 1, JSON.stringify(res));
 await day(29, 9); const paid = await p.evaluate(() => __game.economy.ledger?.entries?.slice?.(-10).some?.((e) => /Office salary/.test(e.reason)) ?? __game.politics.P.office.paidTo >= 29);
 check('the office pays a weekly salary', paid);
 // a public project, built in the city
 const proj = await p.evaluate(() => { const g = __game, C = g.politics, gr = C.grounds[1]; g.player.teleport(gr.x + 10, gr.z + 10, 0); const r = C.commission('borehole'); return { ...r, n: C.projectMeshes.size, left: C.P.office.budget - C.P.office.spent }; });
 check('commission a borehole: work starts where you stand, out of the public budget', proj.ok && proj.n === 1 && proj.left === 6_000_000, JSON.stringify(proj));
 await day(32, 10);
 const built = await p.evaluate(() => { const g = __game, C = g.politics, pr = C.P.projects[0]; g.closeChoice(); g.cameraRig.yaw = 0; g.cameraRig.pitch = 0.25; g.player.teleport(pr.x, pr.z + 9, Math.PI); g.cameraRig.snapTo(g.player.position); return { done: pr.done, mesh: C.projectMeshes.get(pr.id)?.key }; });
 await p.waitForTimeout(2000); await p.screenshot({ path: `${OUT}/project-borehole.png` });
 check('two days later it is finished, and visible in the city', built.done && /:1$/.test(built.mesh), JSON.stringify(built));
 // corruption
 const cor = await p.evaluate(() => { const g = __game, C = g.politics, before = g.economy.balance, r = C.divert(800_000); const cs = g.justice.cases.j.cases.filter((x) => String(x.ref).startsWith('politics:')); return { ok: r.ok, gained: g.economy.balance - before, cases: cs.map((x) => [x.agency, x.offence]) }; });
 check('diverting public money pays you and opens an EFCC case', cor.ok && cor.gained === 800_000 && cor.cases.some((x) => x[0] === 'efcc' && /Diversion/.test(x[1])), JSON.stringify(cor));
 const removed = await p.evaluate(() => { const g = __game, C = g.politics, c = g.justice.cases.j.cases.find((x) => String(x.ref).startsWith('politics:divert')); c.status = 'closed'; c.outcome = 'convicted'; c.closedDay = g.clock.day; g.clock.day += 1; C.update(); return { office: C.P.office, barred: C.P.barredUntil > g.clock.day }; });
 check('a corruption conviction removes you from office and bars you from standing', removed.office === null && removed.barred, JSON.stringify(removed));
 // the phone app
 await p.evaluate(() => { __game.closeChoice(); __game.openOverlay('phone'); __game.phone.render('politics'); }); await p.waitForTimeout(800);
 const ph = await p.evaluate(() => { const g = __game; if (!document.querySelector('.phone-body')) { g.phone.render('politics'); } g.phone.render('politics'); return document.querySelector('.phone-body')?.innerText ?? ''; });
 await p.screenshot({ path: `${OUT}/phone-politics.png` });
 check('the phone\'s Politics app shows your party, record and projects', /Onward Progress Party/.test(ph) && /Councillor/.test(ph) && /borehole/i.test(ph), ph.slice(0, 200));
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`politics45: ${checks.length} checks passed · poll ${JSON.stringify(poll)}`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
