import test from 'node:test';
import assert from 'node:assert/strict';
import { SPOTS, sweetSpot, simulateShot, ShootoutRound, HOOP } from '../src/activities/basketball/Basketball.js';
import { trackPoint, TRACK_LENGTH, LapCounter } from '../src/activities/Jogging.js';
import { buyFood, eatNow, FOOD_STALLS } from '../src/activities/StreetServices.js';
import { washVehicle } from '../src/activities/CarWash.js';
import { recordPool, recordGame, newActivities, ensureActivities, beginActivity, abandonActivity, settleAbandoned } from '../src/activities/ActivityRecords.js';
import { Economy } from '../src/economy/Economy.js';
import { Inventory } from '../src/economy/Inventory.js';
import { Needs } from '../src/player/Needs.js';
import { ITEMS, CATALOGUE } from '../src/data/catalogue.js';
import { defaultSave, migrate } from '../src/save/SaveSystem.js';

const fakeGame = (balance = 10000) => {
  const save = defaultSave({ name: 'Ada', gender: 'female' }); save.wallet.balance = balance;
  return { saveData: save, economy: new Economy(save.wallet), inventory: new Inventory(save.inventory), needs: new Needs(save.needs), clock: { day: 3 } };
};

test('basketball: every marked spot has a release power that scores; far off it misses', () => {
  for (const s of SPOTS) {
    const sw = sweetSpot(s); assert.ok(simulateShot(s.x, s.z, sw.power).made, `${s.id} sweet spot scores`);
    assert.ok(!simulateShot(s.x, s.z, Math.max(0, sw.power - 0.15)).made, `${s.id} short misses`);
    assert.ok(!simulateShot(s.x, s.z, Math.min(1, sw.power + 0.15)).made, `${s.id} long misses`);
  }
});

test('basketball: rim and backboard collisions keep the ball outside the ring and board', () => {
  const s = SPOTS[0], sw = sweetSpot(s);
  for (const off of [-0.03, -0.015, 0.015, 0.03]) {
    const r = simulateShot(s.x, s.z, sw.power + off);
    for (const [x, , z] of r.path) assert.ok(z > -0.05, 'never passes through the backboard');
  }
  const round = new ShootoutRound({ seconds: 60, seed: 3 }); const perfect = SPOTS.reduce((n, sp) => n + (round.shoot(sp, sweetSpot(sp).power, sweetSpot(sp)).made ? sp.points : 0), 0);
  assert.equal(round.score, perfect); assert.ok(round.makes >= 5); round.tick(61); assert.ok(round.over);
  assert.ok(HOOP.rimY === 3.05);
});

test('jogging: the lap is continuous and checkpoints must be passed in order', () => {
  let prev = trackPoint(0), max = 0;
  for (let s = 0.5; s <= TRACK_LENGTH; s += 0.5) { const p = trackPoint(s); max = Math.max(max, Math.hypot(p.x - prev.x, p.z - prev.z)); prev = p; }
  assert.ok(max < 0.51, `no jumps along the lap (max step ${max})`);
  const end = trackPoint(TRACK_LENGTH - 0.01), start = trackPoint(0); assert.ok(Math.hypot(end.x - start.x, end.z - start.z) < 0.05);
  const c = new LapCounter(0); const s0 = trackPoint(TRACK_LENGTH * 0.5); // far side first: out of order
  assert.equal(c.step({ x: 0, z: -38.5 }, 10), null);
  assert.equal(c.step({ x: 60, z: 0 }, 20), 'checkpoint'); assert.equal(c.step({ x: 0, z: -38.5 }, 40), 'checkpoint'); assert.equal(c.step({ x: -60, z: 0 }, 60), 'checkpoint');
  assert.equal(c.step({ x: 0, z: 38.5 }, 80), 'lap'); assert.equal(c.laps, 1); assert.equal(c.best, 80); assert.ok(s0);
});

test('street food: pay once per item, eat here or take away; full or broke is refused without charging', () => {
  const g = fakeGame(3000), stall = FOOD_STALLS.find((s) => s.id === 'suya-iweka');
  g.needs.state.energy = 40; g.needs.state.hunger = 30;
  const r = buyFood(g, stall, 'suya-big'); assert.ok(r.ok); assert.equal(g.economy.balance, 500);
  assert.equal(g.needs.state.energy, 70); assert.equal(g.needs.state.hunger, 75);
  assert.equal(buyFood(g, stall, 'suya-big').ok, false); assert.equal(g.economy.balance, 500, 'not enough money: nothing taken');
  const t = buyFood(g, stall, 'zobo', { eatHere: false }); assert.ok(t.ok); assert.equal(g.inventory.count('zobo'), 1);
  assert.equal(buyFood(g, stall, 'puff-puff').ok, false, 'not sold at this stall');
  g.needs.state.energy = 100; g.needs.state.hunger = 100; assert.equal(buyFood(g, stall, 'zobo').ok, false); assert.equal(g.economy.balance, 200);
  for (const id of CATALOGUE.streetfood.map((i) => i.id)) assert.ok(ITEMS[id]?.use?.verb, id);
  assert.equal(eatNow(g.needs, 'bread').ok, false);
});

test('car wash: one payment per wash, dirt cleared, polish lasts three days', () => {
  const g = fakeGame(5000), v = { id: 'veh:1', dirt: 0.7 };
  const r = washVehicle(g, v, 'polish'); assert.ok(r.ok); assert.equal(v.dirt, 0); assert.equal(v.polished, 6); assert.equal(g.economy.balance, 1500);
  assert.equal(washVehicle(g, v, 'polish').ok, false); assert.equal(g.economy.balance, 1500);
  assert.ok(washVehicle(g, v, 'wash').ok); assert.equal(v.polished, undefined); assert.equal(g.economy.balance, 0);
});

test('pool and small-game records: once only, abandoned counted, v16 save repairs', () => {
  const save = { activities: newActivities() };
  const id = beginActivity(save, 'pool');
  const r = recordPool(save, id, { won: true, bestRun: 5, stake: 200, payout: 350, difficulty: 'hard' });
  assert.ok(r.ok && !r.duplicate); assert.deepEqual(r.newAchievements.sort(), ['pool-first-game', 'pool-first-win', 'pool-hard-win', 'pool-run-five', 'pool-stake-win'].sort());
  assert.equal(recordPool(save, id, { won: true }).duplicate, true); assert.equal(save.activities.pool.winnings, 350);
  const d = beginActivity(save, 'draughts'); assert.ok(abandonActivity(save, d)); assert.equal(save.activities.games.draughts, undefined, 'no record created just by abandoning');
  const g1 = beginActivity(save, 'basketball'); assert.ok(recordGame(save, 'basketball', g1, { score: 14 }).newBest); assert.equal(recordGame(save, 'basketball', g1, { score: 30 }).duplicate, true);
  const g2 = beginActivity(save, 'basketball'); settleAbandoned(save); assert.equal(save.activities.games.basketball.abandoned, 1);
  const j = recordGame(save, 'jogging', 'jogging-a', { score: 70, best: 'min' }); recordGame(save, 'jogging', 'jogging-b', { score: 65, best: 'min' }); recordGame(save, 'jogging', 'jogging-c', { score: 90, best: 'min' });
  assert.equal(save.activities.games.jogging.best, 65); assert.ok(j.ok && g2);
  const old = defaultSave({ name: 'Ada', gender: 'female' }); old.vehicles = [{ id: 'v', model: 'sedan', x: 0, z: 0, dirt: 7 }]; old.activities = { football: {}, games: { pool: 'x', jogging: { best: -4 } } };
  const out = migrate(structuredClone(old)); assert.equal(out.vehicles[0].dirt, 1); assert.equal(out.activities.games.jogging.best, 0); assert.equal(out.activities.games.pool, undefined); assert.equal(out.activities.pool.played, 0);
  ensureActivities(out);
});

import { CityEvents, EVENTS } from '../src/activities/CityEvents.js';
test('city events: weekday schedule, once-a-day invitations, prizes capped per day and paid once per key', () => {
  const g = fakeGame(1000); g.clock = { day: 6, minutes: 11 * 60 }; // day 6 → Saturday on the game calendar
  const msgs = []; g.phoneServices = { message: (from, text) => msgs.push({ from, text }) }; g.ui = { toast() {} }; g.player = { position: { x: 1e6, z: 1e6 } };
  const ev = new CityEvents(g);
  assert.ok(ev.active('cup')); assert.ok(!ev.active('draughts-sunday')); assert.ok(!ev.active('street-party'));
  ev.update(1); ev.update(1);
  assert.deepEqual(msgs.map((m) => m.from).sort(), ['Chinwe', 'Coach Uzo', 'Kene'].sort(), 'invites for today\'s events, once each');
  ev.update(1); assert.equal(msgs.length, 3);
  const cup = EVENTS.find((e) => e.id === 'cup');
  for (let i = 0; i < cup.perDay; i++) assert.ok(ev.payPrize('cup', `k${i}`, cup.prize, 'prize').ok);
  assert.equal(ev.payPrize('cup', 'k9', cup.prize, 'prize').ok, false, 'daily cap'); assert.equal(g.economy.balance, 1000 + cup.perDay * cup.prize);
  g.clock.day = 13; assert.equal(ev.claimsLeft('cup'), cup.perDay, 'resets next Saturday');
  assert.equal(ev.payPrize('cup', 'k0', cup.prize, 'prize').ok, false, 'same key never pays twice');
  g.clock = { day: 7, minutes: 15 * 60 }; assert.ok(ev.active('draughts-sunday'));
});
