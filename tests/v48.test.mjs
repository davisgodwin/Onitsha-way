// v0.48: Onitsha only (COMING SOON), homes moved out of Delta State, neighbourhoods, bus stops, premium cars,
// online decorating costs and 11-a-side football.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PlayArea, COMING_SOON, placeBeyond, project } from '../src/world/PlayArea.js';
import { replaceId, relocateHomes, mentions } from '../src/housing/Relocate.js';
import { Districts, premiumAreas, parsePreview } from '../src/world/Districts.js';
import { classifyBuilding } from '../src/world/buildings/ResidentialKit.js';
import { stopTier } from '../src/transport/StopShelters.js';
import { VEHICLE_CATALOGUE, ROADSIDE, SHOWROOM, SHOWROOM_ONLY, VEHICLE_LOTS } from '../src/data/VehicleCatalogue.js';
import { LINES } from '../src/transport/transportConfig.js';
import { FootballMatch, PITCH, PITCH5, PITCH11, setPitchFormat } from '../src/activities/football/FootballMatch.js';

const map = JSON.parse(fs.readFileSync(new URL('../public/data/onitsha_core.json', import.meta.url)));
const pa = new PlayArea({ water: map.water, bounds: map.meta.playBounds });
const at = (lat, lon) => project(map.meta, lat, lon);

test('Onitsha only: the Asaba bank is COMING SOON, the Onitsha side is open', () => {
  const asaba = at(6.13721, 6.75129), bridgehead = at(6.13152, 6.77048), market = at(6.1522, 6.775), basilica = at(6.16124, 6.77692);
  assert.equal(pa.lockedAt(asaba.x, asaba.z)?.id, 'asaba');
  for (const p of [bridgehead, market, basilica]) assert.equal(pa.locked(p.x, p.z), false);
  const c = pa.clamp(asaba.x, asaba.z, 6); assert.equal(pa.locked(c.x, c.z), false, 'a player moved out of Asaba lands in Onitsha');
  assert.ok(!LINES.some((l) => l.stops.includes('asaba')), 'no bus goes to Asaba');
  assert.ok(COMING_SOON.every((p) => p.name && p.lat && p.lon));
});

test('edge signs name the place the road heads to', () => {
  const e = at(6.150, 6.7985), n = at(6.163, 6.7820);
  assert.equal(placeBeyond(map.meta, e.x, e.z, 0.97, -0.25)?.id, 'nkpor');
  // GRA is in the map since the v0.48 extension, so a road heading north no longer gets a GRA COMING SOON sign
  assert.equal(placeBeyond(map.meta, n.x, n.z, 0, -1)?.id, map.meta.extensions?.length ? undefined : 'gra');
});

test('a save that used a home in Delta State moves to an Onitsha home of the same kind, with everything in it', () => {
  const save = { housing: { rentals: { 'home:1': { until: 99 } }, storage: { 'home:1': ['rice'] } }, homeUpgrades: { homes: { 'home:1': { pieces: [{ pid: 'p1', item: 'sofa' }] } } }, note: 'Rent: home:1 paid', other: 'home:10' };
  const locked = [{ id: 'home:1', type: 'selfcon', interior: 'selfcon', door: { stand: { x: 0, z: 0 } } }];
  const open = [{ id: 'home:2', type: 'duplex', interior: 'duplex', door: { stand: { x: 1, z: 0 } } }, { id: 'home:3', type: 'selfcon', interior: 'selfcon', door: { stand: { x: 50, z: 0 } }, label: 'Self-contain' }];
  const moved = relocateHomes(save, locked, open);
  assert.deepEqual(moved.map((m) => m.to), ['home:3']);
  assert.ok(save.housing.rentals['home:3'] && !save.housing.rentals['home:1']);
  assert.deepEqual(save.homeUpgrades.homes['home:3'].pieces[0].item, 'sofa');
  assert.equal(save.note, 'Rent: home:3 paid'); assert.equal(save.other, 'home:10', 'a different id that starts the same is left alone');
  assert.equal(mentions(save, 'home:1'), false);
  assert.deepEqual(relocateHomes({ x: 1 }, locked, open), [], 'a save that never used it is untouched');
  assert.equal(replaceId({ a: ['k:7', 'k:70'] }, 'k:7', 'k:9').a.join(), 'k:9,k:70');
});

test('neighbourhoods come from map evidence; GRA only where the map names it (or a preview)', () => {
  const landmarks = { list: [{ id: 'main-market', kind: 'market', x: 0, z: 0, radius: 200 }, { id: 'fegge', kind: 'district', x: 600, z: 0 }], get(id) { return this.list.find((l) => l.id === id); } };
  const D = new Districts({ map: { pois: [{ name: 'GRA Phase I', kind: 'neighbourhood', x: 5000, z: 0 }], areas: [] }, landmarks });
  assert.equal(D.at(0, 0), 'market'); assert.equal(D.at(700, 0), 'dense'); assert.equal(D.at(5000, 0), 'gra');
  assert.equal(D.at(2600, 0, { type: 'primary' }), 'mixed'); assert.equal(D.at(2600, 0, { type: 'residential' }), 'middle');
  assert.equal(premiumAreas({ pois: [], areas: [] }).length, 0);
  assert.deepEqual(parsePreview('?quickstart&preview-gra=1200,-500,320'), { x: 1200, z: -500, r: 320 });
  const r = () => 0.3;
  assert.ok(['villa', 'mansion'].includes(classifyBuilding({ kind: 'residential', levels: 1, area: 350, box: { w: 20, d: 17 }, rect: 0.9 }, r, { premium: 1 })));
  assert.notEqual(classifyBuilding({ kind: 'residential', levels: 1, area: 200, box: { w: 25, d: 8 }, rect: 0.9 }, r, { premium: 1 }), 'tenement');
});

test('bus stop size follows the street', () => {
  assert.equal(stopTier({ named: true }, { type: 'residential' }), 'large');
  assert.equal(stopTier({ named: false }, { type: 'primary', width: 12 }), 'medium');
  assert.equal(stopTier({ named: false }, { type: 'residential', width: 6 }), 'small');
});

test('premium vehicles: 18 new models, dear, sold at the showroom, never on the roadside stands', () => {
  assert.equal(VEHICLE_CATALOGUE.length, 54); assert.equal(new Set(VEHICLE_CATALOGUE.map((v) => v.id)).size, 54);
  for (const id of ['mercedes_g550', 'mercedes_g63', 'range_rover', 'toyota_land_cruiser', 'cadillac_escalade', 'bmw_x7', 'mercedes_sclass', 'bmw_7series', 'lexus_ls500', 'audi_a8', 'porsche_cayenne', 'bmw_m5', 'audi_rs7']) {
    const v = VEHICLE_CATALOGUE.find((x) => x.id === id); assert.ok(v.premium && v.price >= 1000000, id); assert.ok(SHOWROOM.includes(v) && !ROADSIDE.includes(v), id);
  }
  assert.ok(ROADSIDE.some((v) => v.id === 'toyota_avalon') && ROADSIDE.some((v) => v.id === 'honda_civic'));
  assert.equal(new Set(VEHICLE_LOTS.flatMap((l) => l.models)).size, 36, 'the six roadside stands keep their featured cars');
  const cheapPremium = Math.min(...SHOWROOM.map((v) => v.price)), dearEveryday = Math.max(...ROADSIDE.filter((v) => !v.premium && !['bus', 'lorry', 'cbus', 'minibus', 'pickup'].includes(v.body)).map((v) => v.price));
  assert.ok(cheapPremium > dearEveryday, `premium from ₦${cheapPremium}, everyday up to ₦${dearEveryday}`);
  assert.ok(SHOWROOM_ONLY.size === 16);
});

test('11-a-side: 22 players in a 4-4-2 on a 100 × 64 m pitch; 5-a-side unchanged', () => {
  const m = new FootballMatch({ seed: 7, format: '11', halfSeconds: 20 });
  assert.equal(m.N, 11); assert.equal(m.players.length, 22); assert.equal(PITCH.L, 100); assert.equal(PITCH.goalW, PITCH11.goalW);
  assert.equal(m.players.filter((p) => p.team === 0 && p.role === 'def').length, 4);
  assert.ok(m.players.find((p) => p.user).slot === 10);
  let n = 0; while (m.phase !== 'fulltime' && n++ < 5000) { m.update(0.25); if (m.phase === 'halftime') m.startSecondHalf(); }
  assert.equal(m.phase, 'fulltime'); assert.ok(m.result.stats[0].passes + m.result.stats[1].passes > 10);
  const f = new FootballMatch({ seed: 7 }); assert.equal(f.N, 5); assert.equal(PITCH.L, PITCH5.L);
  setPitchFormat('5');
});
