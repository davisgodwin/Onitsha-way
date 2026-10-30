// v0.50: where the WELCOME TO GRA gateways go, the TV channels, and the club's music files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MapData } from '../src/world/MapData.js';
import { premiumAreas } from '../src/world/Districts.js';
import { findGateways } from '../src/world/GRAWelcome.js';
import { TV_CHANNELS } from '../src/life/TVShows.js';
import { CLUB_MIXES, VENUE_TRACKS } from '../src/audio/VenueMusic.js';

const raw = JSON.parse(fs.readFileSync(new URL('../public/data/onitsha_core.json', import.meta.url)));
const map = new MapData(raw);

test('GRA gateways: both GRAs get gateways on roads that cross into them, just inside, spaced out, at most three each', () => {
  const areas = premiumAreas(map); assert.ok(areas.length >= 2);
  for (const a of areas) {
    const inside = (x, z) => Math.hypot(x - a.x, z - a.z) < a.r - 60;
    const gw = findGateways(map.roads, a, inside);
    assert.ok(gw.length >= 1 && gw.length <= 3, a.name + ' ' + gw.length);
    for (const s of gw) { assert.ok(inside(s.x, s.z), 'inside'); assert.ok(!inside(s.x - s.dx * 30, s.z - s.dz * 30), 'the road comes from outside'); }
    for (let i = 0; i < gw.length; i++) for (let j = i + 1; j < gw.length; j++) assert.ok(Math.hypot(gw[i].x - gw[j].x, gw[i].z - gw[j].z) >= 260);
    // the biggest roads come first
    for (let i = 1; i < gw.length; i++) assert.ok(gw[i - 1].rank >= gw[i].rank);
  }
});

test('TV: seven channels of invented programmes, each with captions and a fun reward', () => {
  assert.deepEqual(TV_CHANNELS.map((c) => c.id), ['nollywood', 'hollywood', 'comedy', 'news', 'football', 'music', 'cartoon']);
  for (const c of TV_CHANNELS) { assert.ok(c.shows.length >= 1 && c.minutes >= 15 && c.needs.fun > 0); for (const s of c.shows) assert.ok(s.title && s.lines.length >= 4); }
});

test('club music: the two DJ mixes stream, the files are real MP3s, the bar tracks are still there', () => {
  assert.equal(CLUB_MIXES.length, 2); assert.equal(VENUE_TRACKS.length, 3);
  for (const t of CLUB_MIXES) {
    assert.ok(t.stream);
    const f = new URL('../public/' + t.url, import.meta.url), size = fs.statSync(f).size, head = fs.readFileSync(f).subarray(0, 3);
    assert.ok(size > 3e6, t.url + ' ' + size); assert.ok(head.toString() === 'ID3' || head[0] === 0xff);
  }
  assert.ok(fs.existsSync(new URL('../public/audio/club/custom/README.txt', import.meta.url)));
});
