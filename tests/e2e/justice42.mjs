// v0.42 in the real game: crime against NPCs, stolen goods and the dealer, cases and warrants, arrest, custody, the
// Magistrate Court (guilty plea, bail and trial), Hustle Kingdoms and an EFCC raid, the police academy and a duty,
// break-ins and the bank job, children kept out of all of it, the phone app, and everything surviving a reload.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4242', OUT = 'qa/v42'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message));
 const tap = async (re) => { const l = p.getByRole('button', { name: re }).first(); try { await l.click({ timeout: 20000 }); } catch { const opts = await p.evaluate(() => [...document.querySelectorAll('#screen-choice button, .dlg-opt')].map((x) => x.textContent.trim().slice(0, 70))); throw Error('no button ' + re + ' :: ' + opts.join(' | ')); } await p.waitForTimeout(250); };
 const choiceText = () => p.evaluate(() => document.querySelector('#screen-choice')?.innerText ?? '');
 const lucky = (v) => p.evaluate((v) => { const J = __game.justice; J.rng = () => v; J.cases.rng = () => v; }, v);
 const nextDay = () => p.evaluate(() => { const g = __game; g.clock.day += 1; g.bus.emit('clock:day', g.clock.day); });
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 });
 const setup = await p.evaluate(() => { const g = __game; g.clock.setMode('game'); g.clock.rate = 0; g.clock.day = 10; g.clock.minutes = 11 * 60; g.economy.transact({ key: 'seed42', amount: 500000, reason: 'Shift pay: Market porter' }); g.needs.state.energy = 100; return { places: g.justice.places().map((x) => x.kind), court: !!g.justice.court, v: g.saveData.version }; });
 check('the Magistrate Court and the back-street dealer are in town, on the map; save version 23', setup.places.includes('court') && setup.places.includes('dealer') && setup.v === 23, JSON.stringify(setup));
 // pickpocketing from a conversation
 const npc = await p.evaluate(() => { const g = __game, n = g.npcs.active.find((x) => ['walker', 'passenger', 'neighbour', 'hawker'].includes(x.role)) ?? g.npcs.active[0]; g.player.teleport(n.x + 1.2, n.z); window.__npc = n; return { role: n.role, opts: g.justice.dialogueOptions(n).map((o) => o.kind), cop: g.npcs.active.filter((x) => x.role === 'police').map((x) => g.justice.dialogueOptions(x).length) }; });
 check('adults can try crime in a conversation (never with police officers)', npc.opts.length === 1 && npc.cop.every((n) => n === 0), JSON.stringify(npc));
 await p.evaluate(() => __game.startDialogue(window.__npc)); await p.waitForTimeout(400);
 await lucky(0.01); const cash0 = await p.evaluate(() => __game.economy.balance);
 await tap(/pick their pocket|Rob the stall/);
 const conf = await choiceText(); check('you are asked first, with the odds and what can follow', /Your chances: about \d+%/.test(conf) && /investigated/.test(conf), conf.slice(0, 120));
 await p.screenshot({ path: `${OUT}/crime-confirm.png` });
 await tap(/Do it/);
 const pick = await p.evaluate(() => { const J = __game.justice; return { cash: __game.economy.balance, cases: J.j.cases.length, stash: J.j.stash.length, notoriety: __game.life.standing.value('notoriety') }; });
 check('a successful crime pays and the victim reports it: a case is open', (pick.cash > cash0 || pick.stash > 0) && pick.cases === 1 && pick.notoriety > 0, JSON.stringify({ cash0, ...pick }));
 await p.evaluate(() => __game.closeChoice());
 // stolen goods and the dealer
 await p.evaluate(() => { const J = __game.justice; J.resolve('stall', J.crimeCtx(), { place: 'a stall' }); __game.closeChoice(); });
 const stash = await p.evaluate(() => __game.justice.j.stash.length);
 await p.evaluate(() => { const g = __game, d = g.justice.dealer; g.player.teleport(d.x + 1, d.z); g.openChoice(() => g.justice.dealerView()); });
 await p.screenshot({ path: `${OUT}/dealer.png` });
 const c1 = await p.evaluate(() => __game.economy.balance); await tap(stash > 1 ? /Sell everything/ : /Sell the/);
 const sold = await p.evaluate(() => ({ cash: __game.economy.balance, stash: __game.justice.j.stash.length }));
 check('the dealer buys stolen goods for cash', stash > 0 && sold.stash === 0 && sold.cash > c1, JSON.stringify({ stash, c1, ...sold }));
 await tap(/Buy tools/); const kit = await p.evaluate(() => __game.justice.j.kit);
 check('tools bought from the dealer (needed for break-ins and big jobs)', kit === true);
 await p.evaluate(() => __game.closeChoice());
 // a warrant, arrest at a checkpoint, custody and a guilty plea
 await p.evaluate(() => { const J = __game.justice; J.cases.open({ agency: 'police', offence: 'Robbery of a market stall (test)', severity: 2, evidence: 1.3, day: __game.clock.day, ref: 'qa-warrant', amount: 5000 }); });
 const wanted = await p.evaluate(() => ({ w: __game.justice.wanted(), legal: __game.life.legal().word }));
 check('a warrant makes you wanted (shown as your legal status)', wanted.w && /Wanted/.test(wanted.legal), JSON.stringify(wanted));
 await p.evaluate(() => { const g = __game, post = g.police.posts[0]; g.player.teleport(post.x + 4, post.z); g.justice.checkAt = 0; g.justice.watch(1); });
 await p.waitForTimeout(400); const enc = await choiceText();
 check('near a checkpoint the police recognise you: go quietly, run or resist', /UNDER ARREST/i.test(enc) && /Go quietly/.test(enc) && /Resist/.test(enc), enc.slice(0, 100));
 await tap(/Go quietly/); await p.waitForTimeout(500);
 const cust = await p.evaluate(() => ({ arrest: !!__game.story.s.arrest, charges: __game.story.s.arrest?.justice?.caseIds.length, text: document.querySelector('#screen-choice')?.innerText ?? '' }));
 if (!/CHARGED/i.test(cust.text)) await p.evaluate(() => __game.openChoice(() => __game.story.officeView()));
 await p.screenshot({ path: `${OUT}/custody.png` });
 check('in custody you are charged, and choose: plead guilty, trial, bail, or a bribe', cust.arrest && cust.charges === 1 && /Plead guilty/.test(await choiceText()) && /bail/.test(await choiceText()), JSON.stringify({ ...cust, text: cust.text.slice(0, 80) }));
 await tap(/Plead guilty/); const sent = await p.evaluate(() => __game.story.s.arrest.justice.sentence);
 check('pleading guilty gives a sentence: a fine, community service, and handing back the proceeds', sent && sent.fine > 0 && sent.service >= 1 && sent.forfeit === 5000, JSON.stringify(sent));
 await tap(/Pay the fine/); for (let i = 0; i < sent.service; i++) { await p.evaluate(() => { __game.needs.state.energy = 100; }); await tap(/Community service/); }
 await tap(/Ask to be released/); await p.waitForTimeout(400);
 const out1 = await p.evaluate(() => ({ arrest: !!__game.story.s.arrest, conv: __game.justice.j.convictions, rec: __game.life.record.r.entries.some((e) => e.kind === 'conviction'), legal: __game.life.legal().word }));
 check('sentence served: released, the conviction is on your record', !out1.arrest && out1.conv === 1 && out1.rec && /past record/.test(out1.legal), JSON.stringify(out1));
 // bail, a hearing and a trial with a lawyer
 await p.evaluate(() => { const g = __game, J = g.justice; J.cases.open({ agency: 'police', offence: 'Theft (test)', severity: 1, evidence: 1.05, day: g.clock.day, ref: 'qa-bail' }); const o = g.story.offices.find((x) => x.id === 'police'); g.player.teleport(o.x, o.z); g.openChoice(() => ({ title: 'desk', options: J.officeOptions(o) })); });
 await tap(/Turn yourself in/); await p.waitForTimeout(400); if (!/CHARGED/i.test(await choiceText())) await p.evaluate(() => __game.openChoice(() => __game.story.officeView()));
 const cashBail = await p.evaluate(() => __game.economy.balance); await tap(/ask for bail/);
 const bail = await p.evaluate(() => ({ court: __game.justice.j.court, arrest: !!__game.story.s.arrest }));
 check('bail: you go home and the hearing is set for tomorrow', bail.court?.day === 11 && !bail.arrest, JSON.stringify(bail));
 await nextDay(); await lucky(0.99);
 await p.evaluate(() => { const g = __game, ct = g.justice.court; g.player.teleport(ct.x, ct.z); g.openChoice(() => g.justice.courtView()); });
 await p.screenshot({ path: `${OUT}/court.png` });
 await tap(/Go to trial/); await tap(/Private lawyer/); await p.waitForTimeout(300);
 const acq = await p.evaluate(() => ({ court: __game.justice.j.court, cash: __game.economy.balance, cleared: __game.life.record.r.entries.some((e) => e.kind === 'cleared'), text: document.querySelector('#screen-choice')?.innerText ?? '' }));
 check('at trial a lawyer can win an acquittal: cleared, bail returned (less the lawyer\'s fee)', /ACQUITTED|Not guilty/i.test(acq.text) && acq.cleared && !acq.court && acq.cash === cashBail - 60000, JSON.stringify({ cashBail, cash: acq.cash, cleared: acq.cleared }));
 await p.evaluate(() => __game.closeChoice());
 // missing a hearing puts a warrant out
 await p.evaluate(() => { const J = __game.justice; const c = J.cases.open({ agency: 'police', offence: 'Theft (missed)', severity: 1, evidence: 1.05, day: __game.clock.day, ref: 'qa-miss' }); c.status = 'charged'; J.j.court = { day: __game.clock.day, caseIds: [c.id], bond: 20000, agency: 'police' }; });
 await nextDay(); await nextDay();
 const fta = await p.evaluate(() => ({ court: __game.justice.j.court, w: __game.justice.cases.warrants().map((c) => c.offence) }));
 check('miss your hearing and a warrant goes out (failure to appear)', !fta.court && fta.w.some((o) => /Failed to appear/.test(o)), JSON.stringify(fta));
 await p.evaluate(() => { const J = __game.justice; J.cases.close(J.cases.active().map((c) => c.id), 'qa', __game.clock.day); });
 // a Hustle Kingdom, informants, an EFCC raid
 await p.evaluate(() => { __game.openOverlay('phone'); __game.phone.render('law'); }); await p.waitForTimeout(300);
 await tap(/Start a Hustle Kingdom/); await tap(/Bring in /); await tap(/Bring in /);
 await p.evaluate(() => { const k = __game.justice.j.kingdom; for (const m of k.members) m.loyalty = 0.1; k.heat = 120; });
 await lucky(0.01); const c2 = await p.evaluate(() => __game.economy.balance); await tap(/Small scheme/);
 await p.screenshot({ path: `${OUT}/phone-law.png` });
 const k = await p.evaluate(() => { const J = __game.justice, k = J.j.kingdom; return { members: k.members.length, inf: k.members.filter((m) => m.informant).length, cash: __game.economy.balance, caseAgency: J.cases.byId(k.caseId)?.agency }; });
 check('a Hustle Kingdom: members hired, a scheme pays, the EFCC opens a case; nervous members turn informant', k.members === 2 && k.cash > c2 && k.caseAgency === 'efcc' && k.inf >= 1, JSON.stringify({ c2, ...k }));
 await p.evaluate(() => __game.closeOverlay('phone'));
 for (let i = 0; i < 6; i++) await nextDay();
 const efw = await p.evaluate(() => __game.justice.wanted('efcc'));
 check('informants feed the EFCC until a warrant is out', efw === true);
 await p.evaluate(() => { const g = __game; g.player.teleport(g.spawn.x, g.spawn.z); g.justice.checkAt = 0; g.justice.raidAt = 0; g.justice.watch(1); }); await p.waitForTimeout(300);
 const raid = await choiceText(); await tap(/Go quietly/); await p.waitForTimeout(400);
 const r2 = await p.evaluate(() => ({ kingdom: __game.justice.j.kingdom, agency: __game.story.s.arrest?.justice?.agency }));
 check('the EFCC raid: arrested, and the kingdom is shut down', /EFCC/.test(raid) && r2.kingdom === null && r2.agency === 'efcc', JSON.stringify(r2));
 await p.evaluate(() => { const J = __game.justice, a = __game.story.s.arrest.justice; J.cases.close(a.caseIds, 'qa', __game.clock.day); J.release(null); J.j.convictions = 0; __game.life.record.r.entries = []; __game.closeChoice(); });
 // the police academy, joining, a duty
 const o = await p.evaluate(() => { const x = __game.story.offices.find((x) => x.id === 'police'); return { id: x.id, x: x.x, z: x.z, name: x.name }; });
 for (let i = 0; i < 3; i++) { await p.evaluate((o) => { const g = __game; g.needs.state.energy = 100; g.clock.minutes = 10 * 60; g.skills.state.fitness = Math.max(g.skills.state.fitness, 200); g.player.teleport(o.x, o.z); g.openChoice(() => ({ title: 'desk', options: g.justice.officeOptions(o) })); }, o); await tap(/academy · session/); await nextDay(); }
 await p.evaluate((o) => { const g = __game; g.clock.day = 16; g.clock.minutes = 9 * 60; g.needs.state.energy = 100; g.needs.state.hunger = 100; g.life.work.w.current = null; let n = 0; while (!/Sunday|weekend|Closed/.test('') && n++ < 7) { g.life.work.w.current = { id: 'police', rank: 0, since: 1, shifts: 0, clean: 0, warnings: 0, lastDay: 0, today: 0, dilemmas: 0 }; const ok = g.life.shiftCheck().ok; g.life.work.w.current = null; if (ok) break; g.clock.day++; } g.openChoice(() => ({ title: 'desk', options: g.justice.officeOptions(o) })); }, o);
 await tap(/Apply: Police officer/); await p.waitForTimeout(300);
 const joined = await p.evaluate(() => __game.life.work.current?.id);
 check('three academy sessions, then you can join the Nigeria Police Force', joined === 'police', joined);
 await p.evaluate((o) => { __game.needs.state.energy = 100; __game.needs.state.hunger = 100; __game.openChoice(() => ({ title: 'desk', options: __game.justice.officeOptions(o) })); }, o);
 await tap(/Go on duty/); await lucky(0.9);
 const duty = await p.evaluate(() => { const d = __game.justice.j.duty; return d && { kind: d.kind, steps: d.steps.map((s) => s.do) }; });
 const pay0 = await p.evaluate(() => __game.economy.balance);
 for (let i = 0; i < duty.steps.length; i++) {
  await p.evaluate(() => { const g = __game, s = g.justice.stepAt(); g.player.teleport(s.x, s.z); g.openChoice(() => g.justice.stepView()); });
  if (i === 0) await p.screenshot({ path: `${OUT}/duty.png` });
  const opts = await choiceText(); await tap(/Arrest them|Settle the dispute|Take statements|Check in|File an honest|Trace every|Pay the informant|Lead the raid/); if (/File an honest/.test(opts)) break;
 }
 const done = await p.evaluate(() => ({ duty: __game.justice.j.duty, shifts: __game.life.work.current?.shifts, cash: __game.economy.balance, integrity: __game.life.standing.value('integrity') }));
 check('a duty in the city, done by the book: steps, an honest report, paid like a shift', duty && !done.duty && done.shifts === 1 && done.cash > pay0, JSON.stringify({ duty, ...done, pay0 }));
 // the dealer won't deal with an officer; break-ins and heists are not for officers
 await p.evaluate(() => { const g = __game; g.openChoice(() => g.justice.dealerView()); }); const dv = await choiceText();
 check('the dealer won\'t deal with an officer', /uniform/.test(dv)); await p.evaluate(() => { __game.life.work.resign(__game.clock.day); __game.closeChoice(); });
 // break-ins (with tools) and the bank job (crew, casing it by day, at night)
 const gate = await p.evaluate(() => { const g = __game, J = g.justice, q = J.gates[0]; if (!q) return null; g.player.teleport(q.x, q.z); J.gateCache = { t: -1 }; return { has: !!J.nearGate(), n: J.gates.length }; });
 check('with tools, any walled compound can be broken into', gate?.has && gate.n > 100, JSON.stringify(gate));
 const heist = await p.evaluate(() => { const g = __game, J = g.justice, br = g.business.branches[0]; g.clock.minutes = 23 * 60; const before = J.bankOptions(br).find((o) => /Rob the bank/.test(o.label)); g.clock.minutes = 12 * 60; J.j.plan.crew = 2; J.bankOptions(br).find((o) => /Case the place/.test(o.label)).act(); g.closeChoice(); g.clock.minutes = 23 * 60; const after = J.bankOptions(br).find((o) => /Rob the bank/.test(o.label)); return { before: before?.disabled, why: before?.why, after: after?.disabled }; });
 check('the bank job needs tools, a crew, casing the bank by day, and the night', heist.before === true && heist.after === false, JSON.stringify(heist));
 // children never see any of it
 const kid = await p.evaluate(() => { const g = __game, ch = g.saveData.character, was = ch.ageGroup; ch.ageGroup = 'child'; const n = g.npcs.active.find((x) => x.role !== 'police'); const r = { talk: g.justice.dialogueOptions(n).length, bank: g.justice.bankOptions(g.business.branches[0]).length, office: g.justice.officeOptions(g.story.offices[0]).filter((o) => /academy|Apply/.test(o.label)).length, kingdom: g.justice.found('Kid house') }; ch.ageGroup = was; return r; });
 check('children get no crime options, no academy, no kingdom', kid.talk === 0 && kid.bank === 0 && kid.office === 0 && kid.kingdom === false, JSON.stringify(kid));
 // reload: everything persists; a v19 save migrates
 const before = await p.evaluate(() => { const g = __game; g.closeChoice(); g.saveGameNow(); return { cases: g.justice.j.cases.length, kit: g.justice.j.kit, academy: g.justice.j.academy.police, log: g.justice.j.log.length }; });
 const load = async () => { p.once('dialog', (d) => d.accept()); await p.goto(URL + '/'); await p.waitForTimeout(1500);
  const ob = p.getByRole('button', { name: /Open previous offline save/ }); if (await ob.count()) await ob.first().click();
  await p.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 400000 }).catch(() => {});
  await p.click('#screen-menu [data-action=continue]'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 }); };
 await load();
 const after = await p.evaluate(() => { const g = __game; return { v: g.saveData.version, cases: g.justice.j.cases.length, kit: g.justice.j.kit, academy: g.justice.j.academy.police, log: g.justice.j.log.length }; });
 check('cases, tools, academy and history survive a reload (save version 23)', after.v === 23 && JSON.stringify({ ...after, v: undefined }) === JSON.stringify({ ...before, v: undefined }), JSON.stringify({ before, after }));
 await p.goto(URL + '/manifest.webmanifest');
 await p.evaluate(() => { for (const k of ['onitshaway:save', 'onitshaway:save:backup']) { const raw = localStorage.getItem(k); if (!raw) continue; const d = JSON.parse(raw); d.version = 19; delete d.justice; d.wallet.balance = 55555; localStorage.setItem(k, JSON.stringify(d)); } });
 await load();
 const mig = await p.evaluate(() => ({ v: __game.saveData.version, cases: __game.saveData.justice?.cases.length, cash: __game.economy.balance }));
 check('a v19 save migrates: a clean slate, cash kept', mig.v === 23 && mig.cases === 0 && mig.cash === 55555, JSON.stringify(mig));
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`justice42: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
