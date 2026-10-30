// v0.40 open life: occupations, seven-sided reputation, legal record, save migration.
import test from 'node:test'; import assert from 'node:assert/strict';
import { Occupations, shiftPay, rankName } from '../src/life/Occupations.js';
import { Standing, labelFor, wealthOf, newStanding } from '../src/life/Standing.js';
import { LegalRecord } from '../src/life/LegalRecord.js';
import { migrateLife } from '../src/life/LifeMigration.js';
import { OCCUPATION, OCCUPATIONS, occupationsFor, PROMOTION, DISMISSAL } from '../src/data/occupations.js';
import { defaultSave, migrate, SAVE_VERSION } from '../src/save/SaveSystem.js';
import { Economy } from '../src/economy/Economy.js';

const skills = (lvl = 10) => ({ level: () => lvl });
const inv = (has = true) => ({ has: () => has });
const adult = { ageGroup: 'adult' }, clean = { clean: true, word: 'Clean record' };
const ctx = (o = {}) => ({ skills: skills(), inventory: inv(), character: adult, legal: clean, day: 1, ...o });

test('a new life starts with no job and an empty record; the story has no career', () => {
 const d = defaultSave({ name: 'Ada', gender: 'female', ageGroup: 'adult' });
 assert.equal(d.version, SAVE_VERSION); assert.equal(SAVE_VERSION, 23);
 assert.equal(d.life.work.current, null); assert.deepEqual(d.life.work.self, {}); assert.equal(d.life.record.entries.length, 0);
 assert.equal(d.life.standing.public, 0); assert.equal(d.character.career, undefined);
});

test('every employed occupation has a rank ladder, pay, a skill and a real dilemma; children only get child roles', () => {
 for (const o of OCCUPATIONS) {
  assert.ok(o.ranks.length >= 4, o.id);
  if (o.kind === 'employed' && o.force) assert.ok(o.shiftPay > 0 && o.skill && o.academy && !o.child, o.id); // v0.42: duties replace the shift dilemma
  else if (o.kind === 'employed') { assert.ok(o.shiftPay > 0 && o.skill && o.dilemma.prompt && o.dilemma.honest && o.dilemma.shortcut.length, o.id); }
  else assert.equal(o.acts.length, o.ranks.length, o.id);
 }
 assert.ok(occupationsFor('child').every((o) => o.child)); assert.ok(occupationsFor('child').some((o) => o.id === 'student'));
 assert.ok(!OCCUPATION.thief && !OCCUPATION.fraud, 'crime is no longer a career menu item');
});

test('applying needs the skill, the tools and a clean police record; one employer at a time', () => {
 const w = new Occupations(undefined);
 assert.equal(w.eligibility('tech', ctx({ skills: skills(2) })).ok, false);
 assert.equal(w.eligibility('tech', ctx({ inventory: inv(false) })).ok, false);
 assert.equal(w.eligibility('tech', ctx({ legal: { clean: false, word: 'Wanted by the police' } })).ok, false);
 assert.equal(w.eligibility('tech', ctx({ character: { ageGroup: 'child' } })).ok, false);
 assert.ok(w.join('tech', ctx()).ok); assert.equal(w.current.id, 'tech'); assert.equal(rankName('tech', 0), 'Intern');
 assert.ok(w.join('mechanic', ctx()).ok, 'taking a new job resigns the old one');
 assert.equal(w.current.id, 'mechanic'); assert.match(w.w.history.at(-2).text, /Resigned/);
 assert.ok(w.resign(2).ok); assert.equal(w.current, null); assert.equal(w.resign(2).ok, false);
});

test('shifts: only in opening hours, at most two a day, not when exhausted', () => {
 const w = new Occupations(undefined); w.join('caterer', ctx());
 const at = (o) => w.canWork({ day: 5, hour: 10, weekday: 3, needs: { energy: 80, hunger: 80 }, ...o });
 assert.ok(at().ok); assert.equal(at({ weekday: 6 }).ok, false); assert.equal(at({ weekday: 0 }).ok, true, 'Mondays are working days'); assert.equal(at({ hour: 22 }).ok, false); assert.equal(at({ needs: { energy: 5, hunger: 80 } }).ok, false);
 w.work({ day: 5, skills: skills(5), needs: { energy: 80 }, professional: 0 }); w.work({ day: 5, skills: skills(5), needs: { energy: 80 }, professional: 0 });
 assert.equal(at().ok, false, 'third shift in a day refused'); assert.ok(at({ day: 6 }).ok);
});

test('pay grows with rank and quality, within bounds; promotion takes shifts, days, skill and standing', () => {
 assert.ok(shiftPay('tech', 4, 1) > shiftPay('tech', 0, 1)); assert.ok(shiftPay('tech', 0, 1) > shiftPay('tech', 0, 0));
 const w = new Occupations(undefined, { rng: () => 0.99 }); w.join('courier', ctx({ day: 1 }));
 for (let i = 0; i < PROMOTION.shifts[1] - 1; i++) w.work({ day: 1 + Math.floor(i / 2), skills: skills(10), needs: { energy: 90 }, professional: 99, choice: w.dilemmaDue() ? 'honest' : null });
 assert.equal(w.current.rank, 0, 'not enough shifts yet');
 const r = w.work({ day: 1, skills: skills(10), needs: { energy: 90 }, professional: 99 });
 assert.equal(w.current.rank, 0, 'still too few days in the job'); assert.equal(r.promoted, null);
 const r2 = w.work({ day: 1 + PROMOTION.days[1], skills: skills(10), needs: { energy: 90 }, professional: 99 });
 assert.equal(r2.promoted?.rank, 1); assert.equal(w.current.rank, 1);
 const w2 = new Occupations(undefined); w2.join('courier', ctx({ day: 1 }));
 for (let i = 0; i < 20; i++) w2.work({ day: 30 + i, skills: skills(10), needs: { energy: 90 }, professional: 0 });
 assert.equal(w2.current.rank, 0, 'no promotion without professional standing');
});

test('the dilemma: honesty builds integrity; shortcuts pay more but risk warnings, and three warnings mean dismissal', () => {
 const lucky = new Occupations(undefined, { rng: () => 0.99 }); lucky.join('mechanic', ctx());
 const honest = lucky.work({ day: 2, skills: skills(5), needs: { energy: 80 }, choice: 'honest' });
 const shortcut = lucky.work({ day: 3, skills: skills(5), needs: { energy: 80 }, choice: 'shortcut' });
 assert.ok(honest.integrity > 0 && shortcut.integrity < 0); assert.ok(shortcut.pay > honest.pay, 'the shortcut pays more when nobody notices'); assert.equal(shortcut.warned, false);
 const caught = new Occupations(undefined, { rng: () => 0 }); caught.join('mechanic', ctx());
 const a = caught.work({ day: 2, skills: skills(5), needs: { energy: 80 }, choice: 'shortcut' }); assert.equal(a.warned, true); assert.equal(caught.current.warnings, 1);
 caught.work({ day: 3, skills: skills(5), needs: { energy: 80 }, choice: 'shortcut' });
 const out = caught.work({ day: 4, skills: skills(5), needs: { energy: 80 }, choice: 'shortcut' });
 assert.ok(out.dismissed); assert.equal(caught.current, null);
 assert.equal(caught.eligibility('mechanic', ctx({ day: 5 })).ok, false, 'dismissed: not rehired straight away');
 assert.ok(caught.eligibility('mechanic', ctx({ day: 4 + DISMISSAL.banDays })).ok, 'a path back after the ban');
 assert.ok(caught.eligibility('caterer', ctx({ day: 5 })).ok, 'other employers still hire');
});

test('self-employment: you become known for work you do, and rise by doing it', () => {
 const w = new Occupations(undefined);
 assert.equal(w.did('keke', 1).first, true); assert.equal(w.did('keke', 1).first, false);
 for (let i = 0; i < 20; i++) w.did('keke', 2);
 assert.equal(w.w.self.keke.rank, 1); assert.equal(w.did('tech', 1), null, 'employed jobs are not self-employment');
 assert.deepEqual(w.summary().map((j) => j.id), ['keke']);
});

test('reputation: each event counts once, rumours count half and only for public opinion, and bad feeling fades', () => {
 const s = new Standing(newStanding());
 assert.ok(s.record({ key: 'a', day: 1, text: 'Helped', public: 10, integrity: 5, prof: { keke: 3 } }));
 assert.equal(s.record({ key: 'a', day: 1, text: 'Helped again', public: 10 }), false); assert.equal(s.value('public'), 10);
 s.record({ key: 'r', day: 1, text: 'Accused', public: -10, integrity: -20, rumour: true });
 assert.equal(s.value('public'), 5); assert.equal(s.value('integrity'), 5, 'an unproven claim does not touch integrity');
 s.record({ key: 'b', day: 2, text: 'Ran from police', public: -20, notoriety: 10 });
 const before = s.value('public'); s.newDay(3); assert.equal(s.value('public'), before, 'too soon to fade'); s.newDay(6); assert.equal(s.value('public'), before + 1);
 for (let d = 7; d < 30; d++) s.newDay(d); assert.ok(s.value('notoriety') < 10);
 assert.equal(s.value('professional', 'keke'), 3); assert.equal(s.s.log.length, 3);
 assert.ok(s.record({ key: 'cap', day: 9, text: 'x', public: 999 })); assert.equal(s.value('public'), 100);
});

test('reputation words: feared vs disliked, controversial, and wealth is not respect', () => {
 assert.equal(labelFor('public', -40, { notoriety: 60 }), 'Feared'); assert.equal(labelFor('public', -40, { notoriety: 0 }), 'Disliked');
 assert.equal(labelFor('public', 70), 'Trusted'); assert.equal(labelFor('public', 0, { praise: 20, blame: 20 }), 'Controversial');
 assert.equal(labelFor('integrity', -70), 'Corrupt'); assert.equal(labelFor('notoriety', 80), 'Infamous');
 assert.equal(wealthOf(30000000).tier, 'Rich'); assert.equal(wealthOf(0).tier, 'Struggling');
 const s = new Standing(newStanding()); assert.deepEqual(Object.keys(s.publicView(1e7)).sort(), ['business', 'public', 'social', 'wealth'], 'integrity and notoriety are private');
});

test('legal record: facts recorded once, status separates wanted, custody, fines and a clean record', () => {
 const r = new LegalRecord(undefined);
 assert.equal(r.status({}).word, 'Clean record');
 assert.ok(r.add({ kind: 'fine', day: 1, text: 'Speeding', amount: 3000, ref: 'f1' })); assert.equal(r.add({ kind: 'fine', day: 1, text: 'dup', ref: 'f1' }), null);
 assert.equal(r.status({}).word, 'Clear (has a past record)'); assert.equal(r.status({ owed: 3000 }).clean, false);
 assert.equal(r.status({ wanted: true }).word, 'Wanted by the police'); assert.equal(r.status({ custody: true }).level, 3);
 r.add({ kind: 'case', day: 2, text: 'Open case', status: 'open' }); assert.equal(r.status({}).word, 'Open case');
 assert.equal(r.close((e) => e.kind === 'case', 3), 1); assert.equal(r.status({}).clean, true);
});

test('old saves: the career becomes a job, past work counts, story and police seed reputation and record, nothing lost', () => {
 const d = defaultSave({ name: 'Obi', gender: 'male', ageGroup: 'adult', career: 'tech' }); delete d.life; d.version = 17;
 d.wallet.balance = 54321; d.story = { career: 'tech', trust: 40, heat: 30, alignment: 'risky', riskyChoices: 2, contract: { id: 1, career: 'tech', target: { x: 1, z: 2 } } };
 d.jobs.completed = Array.from({ length: 6 }, (_, i) => ({ id: 'j' + i })); d.business.trips = 12; d.wholesale.done = ['o1'];
 d.police.owed = [{ id: 'case:1', offence: 'speeding', amount: 3000 }]; d.police.wanted = 1;
 d.jobs.missions.records['find-your-friend'] = { status: 'active', bindings: { giver: 'a', target: 'b' }, progress: 0, rewardClaimed: false, acceptedAt: 1, completedAt: null }; d.jobs.missions.tracked = 'find-your-friend';
 const out = migrate(structuredClone(d));
 assert.equal(out.version, 23); assert.equal(out.wallet.balance, 54321, 'no money changes');
 assert.equal(out.life.work.current.id, 'tech'); assert.equal(out.life.work.current.rank, 0);
 assert.equal(out.life.work.self.errands.rank, 1); assert.equal(out.life.work.self.keke.rank, 1); assert.equal(out.life.work.self.trader.acts, 1);
 assert.ok(out.life.standing.public > 0 && out.life.standing.integrity < 0 && out.life.standing.notoriety > 0);
 assert.ok(out.life.record.entries.some((e) => e.kind === 'fine' && e.status === 'open') && out.life.record.entries.some((e) => e.kind === 'evasion'));
 assert.equal(out.story.contract, null); assert.equal(out.jobs.missions.tracked, null); assert.ok(out.jobs.missions.records['find-your-friend'], 'old mission record kept');
 const again = migrate(structuredClone(out)); assert.deepEqual(again.life, out.life, 'migrating twice changes nothing');
 const thief = defaultSave({ name: 'X', gender: 'male', ageGroup: 'adult' }); delete thief.life; thief.story = { career: 'thief', heat: 50 };
 assert.equal(migrate(thief).life.work.current, null, 'an illegal "career" becomes no job, with notoriety instead');
});

test('shift pay goes through the idempotent wallet: a repeated shift key never pays twice', () => {
 const e = new Economy({ balance: 0, ledger: [], processed: [] });
 assert.ok(e.transact({ key: 'shift:tech:1', amount: 3600, reason: 'Shift pay' }).ok);
 e.transact({ key: 'shift:tech:1', amount: 3600, reason: 'Shift pay' }); assert.equal(e.balance, 3600);
});
