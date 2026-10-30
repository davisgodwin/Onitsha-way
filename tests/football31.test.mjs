import test from 'node:test';
import assert from 'node:assert/strict';
import { FootballMatch, PITCH, passSpeed, rollDistance } from '../src/activities/football/FootballMatch.js';
import { newActivities, ensureActivities, beginActivity, recordFootball, settleAbandoned, abandonActivity, footballStanding } from '../src/activities/ActivityRecords.js';
import { defaultSave, migrate, SAVE_VERSION } from '../src/save/SaveSystem.js';
import { validateSave } from '../src/save/validateSave.js';

const play = (m, input = null, max = 1200) => { let t = 0; const ev = []; while (m.phase !== 'fulltime' && t < max) { if (input) input(m); m.update(1 / 30); t += 1 / 30; if (m.phase === 'halftime') m.startSecondHalf(); ev.push(...m.drainEvents()); } return ev; };

test('pass speed model lands the ball where it was aimed', () => {
  for (const d of [4, 10, 18, 25]) { const s = passSpeed(d, 3.5); assert.ok(Math.abs(rollDistance(s, 3.5) - d) < 0.05, `distance ${d}`); }
  // integrating the same friction step by step agrees with the closed form
  let s = passSpeed(12, 3), x = 0; while (s > 3) { const ns = Math.max(0, s - (1 + 0.35 * s) / 600); x += (s + ns) / 2 / 600; s = ns; }
  assert.ok(Math.abs(x - 12) < 0.1);
});

test('a full AI match finishes with a valid result, both halves and plausible stats', () => {
  const m = new FootballMatch({ seed: 7, halfSeconds: 120, userSlot: -1 });
  const ev = play(m);
  assert.equal(m.phase, 'fulltime');
  const r = m.result;
  assert.equal(r.score.length, 2); assert.ok(r.score.every((n) => Number.isInteger(n) && n >= 0));
  assert.equal(r.outcome, r.score[0] > r.score[1] ? 'win' : r.score[0] < r.score[1] ? 'loss' : 'draw');
  assert.equal(r.goals.length, r.score[0] + r.score[1]);
  assert.ok(ev.some((e) => e.type === 'halftime') && ev.some((e) => e.type === 'fulltime'));
  assert.ok(r.stats.every((s) => s.passes > 10 && s.passesDone <= s.passes && s.onTarget <= s.shots + 2));
  assert.ok(r.possession[0] + r.possession[1] >= 99 && r.possession[0] + r.possession[1] <= 101);
});

test('matches are deterministic for a seed', () => {
  const a = new FootballMatch({ seed: 11, halfSeconds: 60, userSlot: -1 }), b = new FootballMatch({ seed: 11, halfSeconds: 60, userSlot: -1 });
  play(a); play(b); assert.deepEqual(a.result.score, b.result.score); assert.deepEqual(a.result.stats, b.result.stats);
});

test('scoring rate across many AI matches stays in a sensible range for 5-a-side', () => {
  let goals = 0, n = 0;
  for (let seed = 1; seed <= 10; seed++) { const m = new FootballMatch({ seed, halfSeconds: 150, userSlot: -1 }); play(m); goals += m.result.score[0] + m.result.score[1]; n++; }
  const avg = goals / n; assert.ok(avg >= 1.5 && avg <= 10, `average goals ${avg}`);
});

test('a ball fully over the line between the posts and under the bar is a goal; the scorer is credited', () => {
  const m = new FootballMatch({ seed: 3, halfSeconds: 120 });
  m.phase = 'play'; m.restart = null; const shooter = m.players[4]; const end = m.dir(0);
  Object.assign(m.ball, { owner: null, x: end * (PITCH.L / 2 - 0.5), y: 0.5, z: 0.4, vx: end * 15, vy: 0, vz: 0, lastTouch: shooter.id, lastTeam: 0 });
  for (const k of [m.players[0], m.players[5]]) { k.x = -end * 15; k.z = 10; } // keepers nowhere near
  for (let i = 0; i < 20 && m.phase === 'play'; i++) m.step(1 / 60);
  assert.equal(m.phase, 'goal'); assert.deepEqual(m.teams.map((t) => t.score), [1, 0]); assert.equal(shooter.stats.goals, 1);
  const ev = m.drainEvents(); assert.ok(ev.some((e) => e.type === 'goal' && e.team === 0));
});

test('over the bar or wide is not a goal: goal kick or corner by who touched it last', () => {
  const m = new FootballMatch({ seed: 4, halfSeconds: 120 }); const end = m.dir(0);
  m.phase = 'play'; m.restart = null;
  Object.assign(m.ball, { owner: null, x: end * (PITCH.L / 2 - 0.3), y: 2.6, z: 0, vx: end * 12, vy: 0.5, vz: 0, lastTouch: 4, lastTeam: 0 });
  for (let i = 0; i < 10; i++) m.step(1 / 60);
  assert.equal(m.teams[0].score, 0); assert.equal(m.phase, 'restart'); assert.equal(m.restart.kind, 'goalkick'); assert.equal(m.restart.team, 1);
  const c = new FootballMatch({ seed: 4, halfSeconds: 120 }); c.phase = 'play'; c.restart = null;
  Object.assign(c.ball, { owner: null, x: end * (PITCH.L / 2 - 0.3), y: 0.3, z: 5, vx: end * 12, vy: 0, vz: 0, lastTouch: 6, lastTeam: 1 });
  for (let i = 0; i < 10; i++) c.step(1 / 60);
  assert.equal(c.restart.kind, 'corner'); assert.equal(c.restart.team, 0);
});

test('ball over a touchline is a kick-in to the other side', () => {
  const m = new FootballMatch({ seed: 5, halfSeconds: 120 }); m.phase = 'play'; m.restart = null;
  Object.assign(m.ball, { owner: null, x: 2, y: 0.11, z: PITCH.W / 2 - 0.2, vx: 0, vy: 0, vz: 8, lastTouch: 7, lastTeam: 1 });
  for (let i = 0; i < 10; i++) m.step(1 / 60);
  assert.equal(m.restart.kind, 'kickin'); assert.equal(m.restart.team, 0); assert.equal(m.ball.owner, m.restart.taker);
});

test('keeper standing in the path saves a central shot far more often than not', () => {
  let saved = 0, goals = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const m = new FootballMatch({ seed, halfSeconds: 120, difficulty: 'normal' }); m.phase = 'play'; m.restart = null;
    const end = m.dir(0), k = m.players[5]; k.x = end * (PITCH.L / 2 - 1); k.z = 0;
    for (const p of m.players) if (p !== k) { p.x = -end * 15; p.z = -10; }
    Object.assign(m.ball, { owner: null, x: end * 8, y: 0.4, z: 0, vx: end * 20, vy: 1, vz: 0, lastTouch: 4, lastTeam: 0, shot: { by: 4, team: 0, t: 0 } });
    for (let i = 0; i < 90 && m.phase === 'play'; i++) m.step(1 / 60);
    if (m.teams[0].score) goals++; else if (m.teams[1].stats.saves) saved++;
  }
  assert.ok(saved >= 28 && goals <= 10, `saved ${saved}, goals ${goals}`);
});

test('the human player dribbles, passes and shoots with the input contract', () => {
  const m = new FootballMatch({ seed: 9, halfSeconds: 120 }); const u = m.user;
  assert.equal(m.ball.owner, u.id, 'user takes the first kick-off');
  m.press('pass'); m.update(1 / 30); assert.equal(m.phase, 'play'); assert.equal(m.ball.owner, null); assert.equal(u.stats.passes, 1);
  // put the ball at the user's feet in front of goal and charge a shot
  m.ball.owner = u.id; const end = m.dir(0); u.x = end * 12; u.z = 0; u.heading = end > 0 ? 0 : Math.PI;
  m.setUserInput({ mx: end, mz: 0, shootHeld: true }); for (let i = 0; i < 20; i++) m.update(1 / 30);
  assert.ok(m.shootCharge > 0.4);
  m.setUserInput({ shootHeld: false }); m.update(1 / 30);
  assert.equal(u.stats.shots, 1); assert.notEqual(m.ball.owner, u.id);
});

test('stamina limits sprinting and recovers', () => {
  const m = new FootballMatch({ seed: 2, halfSeconds: 300 }); m.press('pass'); m.update(1 / 30);
  for (let i = 0; i < 60 * 9; i++) { m.setUserInput({ mx: 0, mz: (i / 180 | 0) % 2 ? 1 : -1, sprint: true }); m.update(1 / 60); }
  const low = m.stamina; assert.ok(low < 0.4, `stamina ${low}`);
  for (let i = 0; i < 60 * 5; i++) { m.setUserInput({ mx: 0, mz: 0, sprint: false }); m.update(1 / 60); }
  assert.ok(m.stamina > low + 0.2);
});

test('pausing stops the clock and the ball', () => {
  const m = new FootballMatch({ seed: 2, halfSeconds: 120, userSlot: -1 }); m.update(2); const c = m.clock, x = m.ball.x;
  m.paused = true; m.update(1); assert.equal(m.clock, c); assert.equal(m.ball.x, x);
});

test('records: a finished match is recorded and rewarded exactly once; abandoning gives nothing', () => {
  const save = { activities: newActivities() };
  const id = beginActivity(save, 'football'); assert.equal(save.activities.active.id, id);
  const result = { score: [3, 0], user: { goals: 3, assists: 0 } };
  const r = recordFootball(save, id, result, { opponent: 'Fegge Rangers', difficulty: 'hard' });
  assert.equal(r.ok, true); assert.equal(r.duplicate, false); assert.equal(r.outcome, 'win');
  assert.deepEqual(r.newAchievements.sort(), ['clean-sheet', 'first-goal', 'first-match', 'first-win', 'hard-win', 'hat-trick'].sort());
  assert.ok(r.xp > 0); assert.equal(save.activities.active, null);
  const again = recordFootball(save, id, result); assert.equal(again.duplicate, true);
  assert.equal(save.activities.football.played, 1); assert.equal(save.activities.football.goals, 3);
  const id2 = beginActivity(save, 'football'); assert.ok(abandonActivity(save, id2));
  assert.equal(save.activities.football.abandoned, 1); assert.equal(save.activities.football.played, 1);
  const id3 = beginActivity(save, 'football'); assert.notEqual(id3, id2);
  assert.equal(settleAbandoned(save).id, id3); assert.equal(save.activities.football.abandoned, 2);
  assert.equal(footballStanding(save.activities.football).label, 'Weekend baller');
});

test('save v16: old saves gain an empty activity record; damaged records are repaired or rejected', () => {
  const old = defaultSave({ name: 'Ada', gender: 'female' }); delete old.activities; old.version = 15;
  const out = migrate(structuredClone(old)); assert.equal(out.version, SAVE_VERSION); assert.equal(SAVE_VERSION, 23);
  assert.equal(out.activities.football.played, 0); assert.deepEqual(out.wallet, old.wallet);
  const bad = defaultSave({ name: 'Ada', gender: 'female' }); bad.activities = { football: { played: -3, history: 'x' } };
  assert.throws(() => validateSave(bad), /activities\.football\.history/);
  const repair = { activities: { seq: 'nope', football: { played: 2.5, achievements: ['first-win', 'made-up'] } } };
  ensureActivities(repair); assert.equal(repair.activities.seq, 0); assert.equal(repair.activities.football.played, 0); assert.deepEqual(repair.activities.football.achievements, ['first-win']);
});
