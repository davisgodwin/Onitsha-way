// v0.42: crime, investigations, the courts, Hustle Kingdoms, and the police / EFCC as careers (pure rules).
import test from 'node:test';
import assert from 'node:assert/strict';
const ls = new Map(); globalThis.window = { localStorage: { getItem: (k) => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) } };
const { CRIMES, chance, attempt, fencePrice, fenceRate, heistReady, incidentsFor, FENCE } = await import('../src/justice/Crime.js');
const { Cases, newJustice, ensureJustice, CASE, LAWYERS } = await import('../src/justice/Cases.js');
const { SCHEMES, newKingdom, recruit, canRun, runScheme, kingdomDay, payMore, suspect } = await import('../src/justice/Kingdom.js');
const { dutyFor, stepChoices, arrestOutcome, complaint } = await import('../src/justice/Forces.js');
const { Occupations } = await import('../src/life/Occupations.js');
const { OCCUPATION } = await import('../src/data/occupations.js');
const { defaultSave, migrate, SAVE_VERSION } = await import('../src/save/SaveSystem.js');
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test('save v20: a new life has a clean slate; an old save gains one without other changes', () => {
 const d = defaultSave({ name: 'A', gender: 'male', ageGroup: 'adult' }); assert.equal(SAVE_VERSION, 23);
 assert.deepEqual(d.justice.cases, []); assert.equal(d.justice.kingdom, null); assert.equal(d.justice.kit, false);
 const old = structuredClone(d); old.version = 19; delete old.justice; old.wallet.balance = 999;
 const m = migrate(old); assert.equal(m.version, 23); assert.deepEqual(m.justice.cases, []); assert.equal(m.wallet.balance, 999);
 const bad = ensureJustice({ cases: [{ id: 'x', agency: 'army', status: 'open' }, { id: 'case:1', agency: 'police', status: 'open', severity: 9, evidence: 50 }] });
 assert.equal(bad.cases.length, 1); assert.equal(bad.cases[0].severity, 4); assert.equal(bad.cases[0].evidence, 3);
});

test('the odds of a crime: people watching and police nearby make it harder; skill and planning help', () => {
 const base = chance('pickpocket', { skill: 1 });
 assert.ok(chance('pickpocket', { skill: 1, witnesses: 5 }) < base);
 assert.ok(chance('pickpocket', { skill: 1, police: 1 }) < base - 0.2);
 assert.ok(chance('pickpocket', { skill: 8 }) > base);
 assert.ok(chance('breakin', { night: true }) > chance('breakin', { night: false }));
 const h0 = chance('heist', {}), h1 = chance('heist', { crew: 3, scouted: true, getaway: true });
 assert.ok(h1 > h0 + 0.25);
 for (const k of Object.keys(CRIMES)) { assert.ok(chance(k, { witnesses: 99, police: 99 }) >= 0.05); assert.ok(chance(k, { skill: 10, night: true, crew: 9, scouted: true, getaway: true }) <= 0.9); }
});

test('an attempt: success pays (cash or goods to fence); failure leaves more evidence; police nearby means a chase', () => {
 const ok = attempt('pickpocket', { rng: seq(0.01, 0.5, 0.5, 0.5) }); assert.ok(ok.ok && ok.loot >= 300 && ok.goods.length === 0);
 const goods = attempt('stall', { rng: seq(0.01, 0.5, 0.2, 0.4, 0.6) }); assert.ok(goods.ok && goods.loot === 0 && goods.goods.length >= 1);
 const fail = attempt('stall', { witnesses: 4, rng: seq(0.99, 0.99) }); assert.ok(!fail.ok && !fail.caught && fail.evidence > ok.evidence);
 const chased = attempt('stall', { police: 2, rng: seq(0.99, 0.1) }); assert.ok(chased.caught);
 const heist = attempt('heist', { cctv: true, rng: seq(0.01, 0.5) }); assert.ok(heist.evidence >= 0.6, 'cameras and a bank job always leave evidence');
});

test('a fence pays 40% of value, more with hustle, never more than 60%', () => {
 assert.equal(fenceRate(1), 0.4); assert.ok(fenceRate(5) > 0.4); assert.equal(fenceRate(10), 0.58); assert.ok(fenceRate(30) <= 0.6);
 assert.equal(fencePrice(10000, 1), 4000);
 const r = heistReady({}); assert.equal(r.ok, false); assert.equal(r.missing.length, 4);
 assert.ok(heistReady({ kit: true, crew: FENCE.heistCrew, scouted: true, night: true }).ok);
});

test('cases: caught in the act is a warrant; otherwise investigators may identify you day by day, or the case goes cold', () => {
 const j = newJustice(), C = new Cases(j, { rng: () => 0.99 });
 const seen = C.open({ offence: 'Theft', severity: 1, evidence: 1.2, day: 1, ref: 'a' }); assert.equal(seen.status, 'warrant'); assert.ok(C.wanted());
 assert.equal(C.open({ offence: 'Theft', evidence: 1.2, day: 1, ref: 'a' }), seen, 'the same crime is one case');
 const weak = C.open({ offence: 'Burglary', severity: 3, evidence: 0.2, day: 1 });
 for (let d = 2; d <= 21; d++) C.newDay(d); assert.equal(weak.status, 'open');
 C.newDay(22); assert.equal(weak.status, 'closed'); assert.equal(weak.outcome, 'cold');
 const C2 = new Cases(newJustice(), { rng: () => 0.01 }), strong = C2.open({ offence: 'Robbery', severity: 2, evidence: 0.7, day: 1 });
 const ev = C2.newDay(2); assert.equal(strong.status, 'warrant'); assert.equal(ev[0].type, 'warrant');
 const C3 = new Cases(newJustice(), { rng: () => 0.01 }), quiet = C3.open({ offence: 'x', evidence: 0.3, day: 1 });
 C3.newDay(2); assert.equal(quiet.status, 'open', 'below the threshold nobody is identified');
 C3.newDay(3, { [quiet.id]: 0.4 }); assert.equal(quiet.status, 'warrant', 'new evidence (an informant) can tip it');
});

test('court: a guilty plea is lighter, past convictions make it heavier, proceeds are handed back; a lawyer helps at trial', () => {
 const j = newJustice(), C = new Cases(j, { rng: () => 0.5 });
 const a = C.open({ offence: 'Robbery', severity: 2, evidence: 1.1, day: 1, amount: 12000 }), b = C.open({ offence: 'Theft', severity: 1, evidence: 1.1, day: 1 });
 const charged = C.charge(2).map((c) => c.id); assert.equal(charged.length, 2); assert.ok(!C.wanted());
 const plea = C.sentence(charged, { guilty: true }), trial = C.sentence(charged);
 assert.ok(plea.fine < trial.fine && plea.service <= trial.service); assert.equal(plea.forfeit, 12000);
 j.convictions = 2; assert.ok(C.sentence(charged, { guilty: true }).fine > plea.fine);
 const weakIds = [C.open({ offence: 'w', evidence: 0.3, day: 1 }).id];
 assert.ok(new Cases(j, { rng: () => 0.3 }).trial(weakIds, 'private').convicted === false, 'weak evidence and a good lawyer: acquitted');
 const Cs = new Cases(j); assert.ok(Cs.trial(charged, 'none').chance > Cs.trial(charged, 'private').chance);
 assert.equal(C.bail(charged), 3 * 20000); assert.ok(LAWYERS.private.cost > 0 && LAWYERS.aid.cost === 0);
});

test('bribing your way out: sometimes the case disappears, otherwise it is another charge', () => {
 const j = newJustice(); const ok = new Cases(j, { rng: () => 0.1 }), c = ok.open({ offence: 'x', severity: 2, evidence: 1.2, day: 1 }); ok.charge(1);
 const r = ok.bribe([c.id], 2); assert.ok(r.ok && r.amount === 30000); assert.equal(c.status, 'closed');
 const j2 = newJustice(), no = new Cases(j2, { rng: () => 0.9 }), d = no.open({ offence: 'y', evidence: 1.2, day: 1 }); no.charge(1);
 assert.equal(no.bribe([d.id], 2).ok, false); assert.equal(no.charged().length, 2); assert.ok(no.charged().some((x) => /bribery/.test(x.offence)));
});

test('Hustle Kingdoms: one scheme a day, bigger schemes need members and skill; members take a cut; a boss takes half from a member', () => {
 const k = newKingdom('House', 1);
 assert.equal(canRun(k, 'medium', { day: 1, hustle: 5 }).ok, false, 'needs members');
 assert.equal(canRun(k, 'big', { day: 1, hustle: 1 }).ok, false);
 const r = runScheme(k, 'small', { day: 1, hustle: 3, rng: () => 0.1 }); assert.ok(r.ok && r.gross >= SCHEMES.small.gross[0] && r.mine === r.gross);
 assert.equal(canRun(k, 'small', { day: 1, hustle: 3 }).ok, false, 'one a day');
 k.members.push(recruit('a'), recruit('b')); const r2 = runScheme(k, 'medium', { day: 2, hustle: 3, rng: () => 0.1 }); assert.ok(r2.cut > 0 && r2.mine === r2.gross - r2.cut);
 const m = newKingdom('Boss', 1, { role: 'member', boss: 'Fegge Connect' }); const r3 = runScheme(m, 'small', { day: 1, hustle: 2, rng: () => 0.1 }); assert.equal(r3.mine, r3.gross - r3.cut); assert.equal(r3.cut, Math.round(r3.gross * 0.5 / 50) * 50);
 assert.equal(recruit('x').name, recruit('x').name, 'the same person every time');
});

test('heat makes disloyal members talk; informants feed the EFCC; paying more buys loyalty; charisma helps spot them', () => {
 const k = newKingdom('H', 1); k.members.push({ ...recruit('a'), loyalty: 0.2 }, { ...recruit('b'), loyalty: 1 }); k.heat = 150;
 const r = runScheme(k, 'small', { day: 1, hustle: 1, rng: () => 0.05 }); assert.deepEqual(r.informants, [k.members[0].name]); assert.ok(!k.members[1].informant);
 assert.ok(kingdomDay(k) >= 0.12); const h = k.heat; kingdomDay(k); assert.ok(k.heat < h);
 const before = k.members[1].loyalty; k.members[1].loyalty = 0.5; payMore(k, 50000); assert.ok(k.members[1].loyalty > 0.5); assert.equal(k.members[0].loyalty, 0.2, 'not from someone already talking');
 assert.equal(suspect(k, 10, () => 0.5)[0].flagged, true);
});

test('police and EFCC: academy and a clean record to join, never children or kingdom members; duties end at the desk', () => {
 const w = new Occupations(undefined), ctx = { skills: { level: () => 3 }, character: { ageGroup: 'adult' }, legal: { clean: true }, day: 5 };
 assert.equal(w.eligibility('police', { ...ctx, academy: { police: 2 } }).ok, false);
 assert.equal(w.eligibility('police', { ...ctx, academy: { police: 3 } }).ok, true);
 assert.equal(w.eligibility('police', { ...ctx, academy: { police: 3 }, kingdom: true }).ok, false);
 assert.equal(w.eligibility('efcc', { ...ctx, academy: { efcc: 3 }, legal: { clean: false, word: 'Wanted' } }).ok, false);
 assert.equal(w.eligibility('police', { ...ctx, academy: { police: 3 }, character: { ageGroup: 'child' } }).ok, false);
 const spots = [{ x: 1, z: 1, name: 'A' }, { x: 2, z: 2, name: 'B' }, { x: 3, z: 3, name: 'C' }], office = { x: 0, z: 0, name: 'Station' };
 const rep = dutyFor('police', { seq: 1, day: 1, spots, incident: { text: 'A stall was robbed', at: spots[0] }, office });
 const efcc = dutyFor('efcc', { seq: 2, day: 1, spots, office });
 for (const d of [rep, efcc]) { assert.equal(d.steps.at(-1).do, 'file'); assert.ok(d.steps.length >= 3); }
 assert.deepEqual(efcc.steps.map((s) => s.do), ['records', 'informant', 'raid', 'file']);
 const sus = rep.steps.findIndex((s) => s.do === 'suspect'); if (sus >= 0) { const ch = stepChoices(rep, sus); assert.ok(ch.some((c) => c.corrupt && c.bribe > 0) && ch.some((c) => c.arrest)); }
 assert.equal(complaint(0, () => 0), false); assert.equal(complaint(3, () => 0.5), true);
 assert.equal(arrestOutcome(1, seq(0.9)).caught, true, 'they came quietly');
});

test('a complaint that sticks is a written warning; three and you are dismissed', () => {
 const w = new Occupations(undefined, { rng: () => 0 }); const ctx = { skills: { level: () => 3 }, character: { ageGroup: 'adult' }, legal: { clean: true }, day: 1, academy: { police: 3 } };
 assert.ok(w.join('police', ctx).ok);
 const r = w.work({ day: 1, skills: ctx.skills, choice: 'shortcut' }); assert.ok(r.warned && /complaint/.test(r.events[0].text));
 w.work({ day: 2, skills: ctx.skills, choice: 'shortcut' }); const r3 = w.work({ day: 3, skills: ctx.skills, choice: 'shortcut' }); assert.ok(r3.dismissed);
 const honest = new Occupations(undefined, { rng: () => 0 }); honest.join('efcc', { ...ctx, academy: { efcc: 3 } }); assert.equal(honest.work({ day: 1, skills: ctx.skills, choice: 'honest' }).warned, false);
 assert.ok(OCCUPATION.police.force && OCCUPATION.efcc.force && !OCCUPATION.police.child);
});

test('reported crime for officers on duty is the same for everyone on a given day', () => {
 const places = [{ x: 0, z: 0, name: 'Park' }, { x: 5, z: 5, name: 'Market' }];
 assert.deepEqual(incidentsFor(7, places), incidentsFor(7, places)); assert.equal(incidentsFor(7, places).length, 3);
 assert.equal(CASE.coldAfter, 21);
});
