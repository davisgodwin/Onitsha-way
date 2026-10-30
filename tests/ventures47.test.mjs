// v0.47: stage 7 (second part) rules and stage 8 (the news, fame) — pure parts, the save, and the balance bands.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../src/data/ventures.js';
import { fameOf, fameOpener, ensureNews, newNews } from '../src/life/NewsFeed.js';
import { OCCUPATIONS } from '../src/data/occupations.js';
import { shiftPay, Occupations } from '../src/life/Occupations.js';
const { defaultSave, migrate, SAVE_VERSION } = await import('../src/save/SaveSystem.js');

test('event planner: offers are fixed per day; within budget you earn your fee, and good suppliers earn more', () => {
 assert.deepEqual(V.eventOffers(9), V.eventOffers(9)); const o = V.eventOffers(9)[0];
 const cheap = V.eventResult(o, { venue: 0, food: 0, music: 0 }, true), handledBadly = V.eventResult(o, { venue: 0, food: 0, music: 0 }, false);
 assert.ok(handledBadly.paid <= cheap.paid, 'handling the problem well pays');
 const within = V.eventResult({ ...o, budget: 10_000_000 }, { venue: 2, food: 2, music: 2 }, true); assert.ok(within.profit > 0 && within.paid >= within.cost);
 const over = V.eventResult({ ...o, guests: 500, budget: 100_000 }, { venue: 2, food: 2, music: 2 }, true); assert.ok(over.profit < 0, 'going far over budget loses money');
});

test('decorator: style and budget decide the fee', () => {
 const b = { style: 'modern', budget: 1_000_000, fee: 20_000 };
 const right = V.decorScore(b, ['sectional', 'glass-table', 'pendants']), wrong = V.decorScore(b, ['chesterfield', 'chandelier', 'drapes']), over = V.decorScore({ ...b, budget: 300_000 }, ['sectional', 'glass-table', 'pendants']);
 assert.equal(right.match, 3); assert.ok(right.fee > wrong.fee); assert.ok(over.over && over.fee < right.fee);
});

test('agency, rent, building, security: deterministic and sensible', () => {
 assert.equal(V.agencyCapacity(5, 2, true), 2 + 3 + 2 * V.AGENCY.devEffort); assert.equal(V.agencyCapacity(5, 0, false), 0);
 const t = V.tenantsFor('home:1', 20_000, 4); assert.equal(t.length, 3); assert.deepEqual(t, V.tenantsFor('home:1', 20_000, 4));
 const L = { homeId: 'home:1', tenant: t[0] }; assert.deepEqual(V.rentWeek(L, 3), V.rentWeek(L, 3));
 const c = V.buildCosts(100); assert.ok(c.sale > c.land + c.works && c.sale < (c.land + c.works) * 1.2, 'a modest margin, not free money');
 let stopped = 0, attempts = 0; for (let i = 0; i < 400; i++) { const n = V.securityNight(i, 2, 5); if (n.attempt) { attempts++; if (n.stopped) stopped++; } } assert.ok(attempts > 20 && stopped / attempts > 0.8, 'trained guards stop most break-ins');
});

test('the league: every side plays once a week and meets everyone once in five weeks', () => {
 const seen = new Set(); for (let w = 0; w < 5; w++) { const f = V.fixtures(w); assert.equal(f.length, 3); assert.equal(new Set(f.flat()).size, 6); for (const [a, b] of f) seen.add([a, b].sort().join('-')); } assert.equal(seen.size, 15);
 assert.deepEqual(V.simMatch(60, 60, 7), V.simMatch(60, 60, 7));
 const T = V.table([{ a: 0, b: 1, s: [2, 0] }, { a: 2, b: 3, s: [1, 1] }]); assert.equal(T[0].i, 0); assert.equal(T[0].pts, 3);
});

test('fame: how strangers see you', () => {
 assert.equal(fameOf({ standing: { public: 50 } }).level, 'famous'); assert.equal(fameOf({ standing: { notoriety: 60, public: 10 } }).level, 'feared');
 assert.equal(fameOf({ wanted: true, standing: { public: 80 } }).level, 'wanted'); assert.equal(fameOf({ office: { prefix: 'Hon.' } }).level, 'office'); assert.equal(fameOf({}).level, 'ordinary');
 assert.equal(fameOpener(fameOf({})), null); assert.match(fameOpener(fameOf({ wanted: true, name: 'Ada Eze' })).gen, /poster|police/);
 assert.equal(ensureNews({ items: [{ title: 'x', day: 1 }, { bad: 1 }] }).items.length, 1);
});

test('saves: version 23 adds ventures and the news; older lives keep everything', () => {
 assert.equal(SAVE_VERSION, 23); const d = defaultSave({ name: 'A', gender: 'female', ageGroup: 'adult' }); assert.deepEqual(d.ventures.builds, []); assert.deepEqual(d.news.items, []);
 const old = defaultSave({ name: 'B', gender: 'male', ageGroup: 'adult' }); old.version = 22; delete old.ventures; delete old.news; old.wallet.balance = 999;
 const m = migrate(old); assert.equal(m.version, 23); assert.equal(m.ventures.agency, null); assert.equal(m.wallet.balance, 999); assert.deepEqual(newNews().items, []);
});

test('balance: no honest role pays absurdly more than the others per hour', () => {
 for (const o of OCCUPATIONS.filter((o) => o.kind === 'employed')) { const top = shiftPay(o.id, 4, 1) / 4; assert.ok(top <= 8000, `${o.id} tops out at ${top}/h`); }
 const best = []; for (let d = 1; d < 40; d++) for (const o of V.eventOffers(d)) { let m = -Infinity; for (const v of [0, 1, 2]) for (const f of [0, 1, 2]) for (const mu of [0, 1, 2]) m = Math.max(m, V.eventResult(o, { venue: v, food: f, music: mu }, true).profit); best.push(m); }
 const avg = best.reduce((a, b) => a + b, 0) / best.length / 6; assert.ok(avg > 0 && avg < 12_000, `event planner ${Math.round(avg)}/h`);
 const fees = V.decorBriefs(5).map((b) => b.fee * 1.2 / 3); assert.ok(fees.every((f) => f < 12_000));
 const perDev = 30 * V.BRIEF_KINDS.reduce((a, k) => a + k.fee / k.effort, 0) / V.BRIEF_KINDS.length / 30 * V.AGENCY.devEffort - V.AGENCY.wage; assert.ok(perDev > 0 && perDev < 10_000, `a developer nets ${Math.round(perDev)} a day`);
 for (const c of V.SECURITY_CLIENTS) assert.ok(c.feeWeek / 7 / c.guards > V.SECURITY.wage, `${c.id} covers its guards' wages`);
 assert.ok(V.CREW_JOBS.levy.pay > V.CREW_JOBS.loading.pay && V.CREW_JOBS.levy.crime, 'crime pays more, and it is a crime');
});

test('shifts: Mondays are working days, Sundays are not (weekday 0 = Monday)', () => {
 const w = new Occupations({}); w.w.current = { id: 'tech', rank: 0, since: 1, shifts: 0, clean: 0, warnings: 0, lastDay: 0, today: 0, dilemmas: 0 };
 const at = (weekday) => w.canWork({ day: 5, hour: 10, weekday, needs: { energy: 80, hunger: 80 } }).ok; assert.equal(at(0), true); assert.equal(at(6), false);
});
