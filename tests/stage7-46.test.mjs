// v0.46: university degrees, the professions (stage 7, first part), cases, hotel rooms, car doors, save v22.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAMMES, PROGRAMME, newEducation, ensureEducation, attendLecture, hasDegree } from '../src/data/education.js';
import { OCCUPATION } from '../src/data/occupations.js';
import { Occupations } from '../src/life/Occupations.js';
import { CASES } from '../src/life/OccupationsCity.js';
import { carSideOf } from '../src/vehicles/InteractiveCar.js';
const { defaultSave, migrate, SAVE_VERSION } = await import('../src/save/SaveSystem.js');

test('a degree: enrol, one lecture a day, graduate after the programme\'s lectures', () => {
 const e = newEducation(); assert.match(attendLecture(e, 1).error, /Enrol/);
 e.enrolled = 'education'; let r;
 for (let d = 1; d <= PROGRAMME.education.lectures; d++) { r = attendLecture(e, d); assert.equal(r.ok, true); if (!r.graduated) assert.match(attendLecture(e, d).error ?? '', /One lecture a day/); }
 assert.equal(r.graduated.id, 'education'); assert.deepEqual(e.degrees, ['education']); assert.equal(e.enrolled, null);
 assert.equal(hasDegree(e.degrees, 'education'), true); assert.equal(hasDegree(e.degrees, 'medicine'), false); assert.equal(hasDegree(e.degrees, 'any'), true); assert.equal(hasDegree([], 'any'), false);
 assert.deepEqual(ensureEducation({ degrees: ['law', 'wizardry', 'law'], enrolled: 'astrology' }).degrees, ['law']);
});

test('the professions need their degree, their skill and a clean record; children cannot apply', () => {
 for (const id of ['doctor', 'nurse', 'teacher', 'lecturer', 'lawyer']) { const o = OCCUPATION[id]; assert.equal(o.kind, 'employed'); assert.ok(o.degree && o.site && o.cases && o.dilemma.prompt && o.ranks.length === 5); assert.ok(CASES[o.cases]?.length >= 2); }
 for (const id of ['journalist', 'dj', 'hypeman']) assert.equal(OCCUPATION[id].kind, 'self');
 const W = new Occupations({}), skills = { level: () => 5 }, inv = { has: () => true }, base = { skills, inventory: inv, character: { ageGroup: 'adult' }, legal: { clean: true }, day: 3 };
 assert.match(W.eligibility('doctor', { ...base, degrees: [] }).missing.join(), /Medicine/);
 assert.equal(W.eligibility('doctor', { ...base, degrees: ['medicine'] }).ok, true);
 assert.equal(W.eligibility('lecturer', { ...base, degrees: ['law'] }).ok, true, 'any degree');
 assert.match(W.eligibility('teacher', { ...base, degrees: ['education'], character: { ageGroup: 'child' } }).missing.join(), /Adults only/);
 assert.match(W.eligibility('lawyer', { ...base, degrees: ['law'], legal: { clean: false, word: 'Wanted' } }).missing.join(), /Police record/);
});

test('every case has steps with exactly one right answer', () => {
 for (const [k, list] of Object.entries(CASES)) for (const c of list) { assert.ok(c.title && c.text && c.steps.length >= 1, k); for (const s of c.steps) { assert.ok(s.q); assert.equal(s.a.filter(([, ok]) => ok).length, 1, `${k}: ${c.title}`); } }
});

test('a car door: which side of the car you are on', () => {
 assert.equal(carSideOf(0, 0, 0, 2, 0), 1); assert.equal(carSideOf(0, 0, 0, -2, 0), -1); assert.equal(carSideOf(Math.PI / 2, 0, 0, 0, -2), 1);
});

test('saves: version 22 adds education; older lives keep everything', () => {
 assert.equal(SAVE_VERSION, 23); const d = defaultSave({ name: 'A', gender: 'female', ageGroup: 'adult' }); assert.deepEqual(d.education.degrees, []);
 const old = defaultSave({ name: 'B', gender: 'male', ageGroup: 'adult' }); old.version = 21; delete old.education; old.wallet.balance = 777; old.gigs = { feed: [{ key: 'x' }] };
 const m = migrate(old); assert.equal(m.version, 23); assert.equal(m.education.enrolled, null); assert.equal(m.wallet.balance, 777); assert.equal(m.gigs.feed.length, 1);
});
