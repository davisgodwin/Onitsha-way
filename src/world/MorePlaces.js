import * as THREE from 'three';
import { venuePlot } from './StreetLayout.js';
import { venueSize } from './VenueArchitecture.js';
import { VenueSite } from '../activities/VenueKit.js';
import { EATERIES } from '../data/eateries.js';
import { VEHICLE_CATALOGUE } from '../data/VehicleCatalogue.js';
import { Showroom } from '../vehicles/Showroom.js';
import { mulberry32 } from '../core/utils.js';
import { naira } from '../economy/Economy.js';

/**
 * v0.49: more places all over Onitsha, including the new parts of the map: filling stations, hotels, bars, clubs,
 * eateries, recreation centres, mini football pitches, small street markets, schools, churches, police divisions and
 * two more car showrooms. Every one is a working place built by the same systems as the first ones (the fuel desk,
 * hotel rooms, bar and club, restaurant menu, pool and draughts, the school and church visitor rooms with their
 * staff rooms, the police visitor desk, the car dealer). All names are invented (no real business is portrayed);
 * the police divisions use the real agency name only.
 *
 * Spots are chosen in a fixed order from points along the streets, each kind kept apart from the places of the same
 * kind that already exist, so the whole map gets them. Built after everything else in the city, so nothing that
 * already existed (or that a save refers to) moves.
 */
const NAMES = {
  fuel: ['Ugo Oil & Gas', 'Ebube Petroleum', 'Riverline Fuels', 'Amaka Energy', 'Obiora Petroleum', 'Crestfield Oil', 'Ike Fuels', 'Sunrise Petroleum', 'Ndidi Oil', 'Goldfield Energy'],
  hotel: ['Royal Palm Suites', 'Niger View Hotel', 'Ebony Lodge', 'Golden Gate Guest House', 'Chukwudi Suites', 'Amara Hotel & Suites', 'Kingsway Inn', 'Ivory Court Hotel'],
  bar: ["Agu's Joint", 'Okafor Beer Parlour', 'Cool Spot Bar', 'Palm Wine Corner', 'Evening Breeze Bar', 'Ebenezer Relaxation Spot', 'Chief Ike Beer Garden', 'Corner Pepper Soup Joint', 'Ogene Bar', 'Two Brothers Bar'],
  club: ['Neon Nights', 'Vibes Lounge', 'Afrobeat Arena', 'Skyline Club', 'Rhythm House'],
  eatery: ["Nkechi's Buka", 'Chop Life Grill', 'Ofe Onugbu Kitchen', 'Golden Fork Restaurant', 'Mama Uju Food Canteen', 'Suya Spot', 'Calabar Pot', 'Igwe Rice House'],
  recreation: ['Ifeoma Recreation Centre', 'Unity Games Centre', 'Champions Recreation Club', 'Youth Hub Games & Pool', 'Starlight Recreation Centre', 'Riverside Games Centre'],
  field: ['Community Mini Pitch', 'Youth Football Field', 'Street Pitch', 'Neighbourhood Field', 'Five-a-side Ground', 'Football Patch', 'Unity Pitch', 'Junior Pitch'],
  market: ['Afor Market', 'Eke Street Market', 'Nkwo Market', 'Orie Evening Market', 'Daily Market', 'Corner Market'],
  school: ['Unity Primary School', 'Community Secondary School', 'Bright Future Nursery & Primary', 'Model Comprehensive School', 'Divine Grace Academy', 'Excel College', 'Progress Primary School', 'Hilltop Secondary School'],
  church: ["St. Michael's Parish", 'Christ Assembly', 'Mount Zion Chapel', 'Holy Ghost Parish', 'Grace Chapel', "St. Paul's Anglican Church", 'Emmanuel Methodist Church', 'Good Shepherd Parish', 'Calvary Chapel', 'Redemption Gospel Hall'],
  police: ['Division A', 'Division B', 'Division C', 'Division D', 'Division E'],
};
// how many more of each, and how far apart (metres) from any other place of the same kind
const PLAN = [
  ['police', 5, 1500], ['fuel', 9, 850], ['hotel', 7, 1000], ['school', 8, 900], ['church', 10, 750], ['market', 5, 1300],
  ['recreation', 6, 1100], ['field', 8, 800], ['bar', 10, 650], ['club', 5, 1300], ['eatery', 8, 650], ['showroom', 2, 2500],
];
const SIZE = { recreation: { w: 18, d: 16 }, field: { w: 30, d: 22 }, school: { w: 32, d: 28 }, church: { w: 24, d: 32 } };
const hash = (t) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export class MorePlaces {
  constructor(g) { this.g = g; this.list = []; this.sites = []; this.showrooms = []; }
  existing() {
    const g = this.g, P = { fuel: [], hotel: [], bar: [], club: [], eatery: [], recreation: [], field: [], market: [], school: [], church: [], police: [], showroom: [] };
    for (const s of g.vehicles?.stations ?? []) P.fuel.push(s);
    for (const s of g.story?.city?.services ?? []) if (s.kind === 'hotel') P.hotel.push(s);
    for (const v of g.cityLife?.venues ?? []) (P[v.kind] ?? P.bar).push(v);
    for (const e of g.eateries?.list ?? []) P.eatery.push(e.place);
    for (const l of g.world.landmarks.list) { if (l.kind === 'school' || l.kind === 'church') P[l.kind].push(l); if (l.kind === 'market') P.market.push(l); }
    for (const o of g.story?.offices ?? []) if (o.kind === 'police') P.police.push(o);
    if (g.entertainment?.zone) P.recreation.push(g.entertainment.zone); if (g.parlour?.site) P.recreation.push(g.parlour.site);
    if (g.court?.site) P.field.push(g.court.site); if (g.world.stadium?.entrance) P.field.push(g.world.stadium.entrance);
    for (const l of g.vehicles?.dealerships ?? []) P.showroom.push(l); if (g.showroom?.plot) P.showroom.push(g.showroom.plot);
    return P;
  }
  /** points along the streets, in a fixed but well-mixed order */
  anchors() {
    const w = this.g.world, map = w.map, pa = w.playArea, B = map.fullBounds ?? map.bounds, out = [];
    const keep = w.landmarks.list.filter((l) => ['market', 'mall', 'interchange', 'stadium', 'park', 'plaza', 'monument'].includes(l.kind));
    for (const r of map.roads) {
      if (r.elevated || r.width < 5 || !['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'trunk', 'living_street'].includes(r.type)) continue;
      let acc = 75;
      for (let i = 0; i + 1 < r.points.length; i++) {
        const [ax, az] = r.points[i], [bx, bz] = r.points[i + 1], L = Math.hypot(bx - ax, bz - az);
        while (acc < L) { const t = acc / L, x = ax + (bx - ax) * t, z = az + (bz - az) * t; acc += 150;
          if (x < B.minX + 80 || x > B.maxX - 80 || z < B.minZ + 80 || z > B.maxZ - 80 || pa?.lockedFast(x, z)) continue;
          if (keep.some((l) => Math.hypot(l.x - x, l.z - z) < (l.radius ?? 60) + 40)) continue;
          out.push({ x, z, road: r, h: hash(`${Math.round(x)},${Math.round(z)}`) }); }
        acc -= L;
      }
    }
    return out.sort((a, b) => a.h - b.h);
  }
  setup() {
    const g = this.g, P = this.existing(), anchors = this.anchors(), picked = [], counters = {};
    const street = (x, z) => g.world.map.nearestRoad(x, z, { named: true, maxDist: 90 })?.road.displayName ?? null;
    for (const [kind, n, gap] of PLAN) {
      let made = 0;
      for (const a of anchors) {
        if (made >= n) break;
        if ((P[kind] ?? []).some((q) => Math.hypot(q.x - a.x, q.z - a.z) < gap) || picked.some((q) => Math.hypot(q.x - a.x, q.z - a.z) < 160)) continue;
        const i = counters[kind] = (counters[kind] ?? 0), id = `${kind}49:${i}`;
        let p = null;
        try { p = this.build(kind, i, id, a, street(a.x, a.z)); } catch (err) { p = null; }
        if (!p) continue;
        counters[kind]++; made++; picked.push(p); (P[kind] ??= []).push(p);
      }
    }
    this.stats = { ...counters };
    g.world.landmarks.byRadius = [...g.world.landmarks.list].sort((a, b) => a.radius - b.radius);
  }
  name(kind, i) { const l = NAMES[kind]; return l[i % l.length] + (i >= l.length ? ` ${Math.floor(i / l.length) + 1}` : ''); }
  build(kind, i, id, a, st) {
    const g = this.g, w = g.world;
    if (kind === 'fuel' || kind === 'hotel') {
      const p = venuePlot(w, a, venueSize(kind)), def = { id, name: kind === 'fuel' ? this.name('fuel', i) : this.name('hotel', i), kind, confidence: 'fictional', ...(kind === 'hotel' ? { rate: [3000, 4500, 6500, 9000][i % 4] } : {}) };
      const v = g.story.city.addService(def, p); return { x: v.x, z: v.z };
    }
    if (kind === 'bar' || kind === 'club') {
      const p = venuePlot(w, a, venueSize(kind)), v = g.cityLife.addVenue({ id, name: this.name(kind, i), kind, hours: kind === 'club' ? [19, 4] : [12, 24], dx: 0, dz: 0 }, p); return { x: v.x, z: v.z };
    }
    if (kind === 'eatery') {
      const p = venuePlot(w, a, venueSize('eatery')), base = EATERIES[i % EATERIES.length];
      const e = g.eateries.addEatery({ ...base, id: `eatery-${id.replace(':', '-')}`, name: this.name('eatery', i), near: null, colors: [['#5a2a1a', '#ffcf5c'], ['#173b4f', '#ff9a3c'], ['#2c5530', '#f5e6a8'], ['#4b1f3a', '#ffd7a8']][i % 4], blurb: base.blurb }, p);
      return e.place;
    }
    if (kind === 'police') {
      const p = venuePlot(w, a, venueSize('police')), o = g.story.addOffice({ id: `police-${i}`, kind: 'police', name: `Police Station · ${st ? st + ' ' : ''}${this.name('police', i)}` }, p);
      return { x: o.x, z: o.z };
    }
    if (kind === 'market') return this.market(i, id, a, st);
    if (kind === 'showroom') return this.showroomAt(i, a);
    return this[kind](i, id, a, st);
  }
  // ------------------------------------------------------------------ the places this module builds itself
  recreation(i, id, a) {
    const g = this.g, s = new VenueSite(g, id, a, SIZE.recreation), name = this.name('recreation', i);
    s.shed({ w: 17, d: 15, h: 3.6, wall: ['#e6d8bd', '#d9e2d2', '#e9d3c9'][i % 3], roof: '#5d6d72', trim: '#1d5b8a', sign: `${name.toUpperCase()} · POOL · DRAUGHTS · GAMES`, signBg: '#13324d', signFg: '#ffe9a8' });
    for (const [u, w] of [[-3.8, -4], [3.8, -4]]) { s.box(2.6, 0.8, 1.45, u, 0.4, w, '#5a3a22', true); s.box(2.3, 0.04, 1.2, u, 0.82, w, '#1f7a46'); }
    s.box(1.1, 0.75, 1.1, -5.5, 0.38, -9.5, '#6b4a2e', true); s.box(0.9, 0.03, 0.9, -5.5, 0.77, -9.5, '#efe3c6');
    s.box(1.8, 0.75, 0.5, 4.5, 0.38, -13.6, '#1b1b1f', true); const tv = s.box(1.6, 0.9, 0.06, 4.5, 1.5, -13.75, '#202a33'); tv.material.emissive?.set('#1f3550');
    s.person(0, -3.8, -2.6, Math.PI, { name: 'Chidi', activity: 'idle', schedule: [10, 22] }); s.person(1, -5.5, -8.4, Math.PI, { name: 'Papa Okeke', activity: 'drink', seatY: 0.45, schedule: [9, 20] }); s.person(2, 2.5, -1.2, 0, { name: 'Attendant', activity: 'serve', role: 'trader', schedule: [10, 22] });
    s.interact(-3.8, -2.6, () => `${name} — 8-ball pool`, () => g.openChoice(() => g.parlour.poolView()), { radius: 2.2 });
    s.interact(-5.5, -8.3, () => `${name} — draughts`, () => g.openChoice(() => g.parlour.draughtsView()), { radius: 1.8, priority: 2 });
    if (g.entertainment?.zoneView) s.interact(4.5, -12.4, () => `${name} — console football`, () => g.openChoice(() => g.entertainment.zoneView()), { radius: 1.8, priority: 2 });
    this.list.push({ x: s.x, z: s.z, kind: 'recreation', id, label: name }); this.sites.push(s); return s.place;
  }
  field(i, id, a, st) {
    const g = this.g, s = new VenueSite(g, id, a, SIZE.field), name = st ? `${st} ${this.name('field', i)}` : this.name('field', i), W = 26, D = 17, cz = -D / 2 - 1.5;
    s.box(W + 2, 0.06, D + 2, 0, 0.03, cz, '#5f8f3c'); for (let k = 0; k < 6; k++) s.box(W / 6, 0.005, D, -W / 2 + W / 12 + k * W / 6, 0.065, cz, k % 2 ? '#5a8a37' : '#64963f');
    const line = (w, d, u, z) => s.box(w, 0.012, d, u, 0.075, z, '#f2f2ea');
    line(W, 0.12, 0, cz - D / 2); line(W, 0.12, 0, cz + D / 2); line(0.12, D, -W / 2, cz); line(0.12, D, W / 2, cz); line(0.12, D, 0, cz);
    for (const e of [-1, 1]) { for (const q of [-1.6, 1.6]) s.box(0.12, 1.9, 0.12, e * (W / 2 - 0.1), 0.95, cz + q, '#ffffff', true); s.box(0.12, 0.12, 3.3, e * (W / 2 - 0.1), 1.9, cz, '#ffffff'); }
    for (const u of [-6, 0, 6]) s.box(3, 0.45, 0.5, u, 0.23, -1, '#7a5a3a', true);
    for (let k = 0; k < 4; k++) s.person(k, -8 + k * 5, cz + (k % 2 ? 3 : -3), k % 2 ? 0 : Math.PI, { name: ['Kelechi', 'Tobe', 'Ebuka', 'Somto'][k], activity: 'idle', schedule: [15, 19] });
    s.interact(0, -2, () => `${name} — join the kick-about`, () => g.openChoice(() => this.fieldView(name, id)), { radius: 3 });
    this.list.push({ x: s.x, z: s.z, kind: 'field', id, label: name }); this.sites.push(s); return s.place;
  }
  fieldView(name, id) {
    const g = this.g, h = g.clock.minutes / 60, key = `field49:${id}:${g.clock.day}`, done = g.saveData?.world?.[key];
    const on = h >= 15 && h < 19;
    return { title: name, kicker: 'MINI PITCH · KICK-ABOUT 15:00–19:00', text: on ? 'The local boys and girls are playing. Join in for half an hour: it is free, good for your fitness and your mood.' : 'Nobody is playing now. The kick-about is every afternoon from 15:00 to 19:00.',
      note: 'For a proper 5-a-side or 11-a-side match, go to the stadium.',
      options: [
        { label: 'Join the kick-about (30 min)', primary: true, disabled: !on || !!done, why: done ? 'You already played here today' : 'Come back between 15:00 and 19:00', act: () => { g.closeChoice(); g.skipTime?.(30); g.needs.adjust({ fun: 14, social: 8, energy: -10 }); g.skills?.add('fitness', 25); if (g.saveData?.world) g.saveData.world[key] = true; g.ui.toast('Good game! +fitness, +fun.'); g.saveGame(); } },
        { label: 'Show the stadium on the map', act: () => { g.closeChoice(); const l = g.world.landmarks.get('community-stadium') ?? g.world.landmarks.list.find((x) => x.kind === 'stadium'); if (l) g.setWaypoint({ x: l.x, z: l.z, name: l.name, radius: 20, custom: true }); } },
        { label: 'Leave', ghost: true, act: () => g.closeChoice() }] };
  }
  civic(kind, i, id, a, st) {
    const g = this.g, s = new VenueSite(g, id, a, SIZE[kind]), name = this.name(kind, i), rng = mulberry32(hash(id));
    if (kind === 'school') {
      const wall = ['#e9e0c8', '#dfe6d3', '#e8d8c0'][i % 3];
      // a two-storey classroom block across the back, a covered walkway, the yard with a flagpole
      s.box(26, 7, 7, 0, 3.5, -20.5, wall, true); s.box(26.6, 0.35, 7.6, 0, 7.15, -20.5, '#7b4a32');
      for (let f = 0; f < 2; f++) for (let k = 0; k < 8; k++) { const win = s.box(1.6, 1.2, 0.06, -10.5 + k * 3, 1.7 + f * 3.3, -16.96, '#3f6070'); win.material.emissive?.set('#22323a'); }
      s.box(26, 0.15, 3, 0, 3.4, -15.5, '#8a9496'); for (let k = 0; k < 6; k++) s.box(0.22, 3.3, 0.22, -12.5 + k * 5, 1.65, -14.2, '#c8c2b4');
      s.box(0.1, 7, 0.1, -9, 3.5, -6, '#bfbfbf', true); s.box(1.4, 0.9, 0.02, -8.3, 6.4, -6, '#1a8b3c'); s.box(0.47, 0.9, 0.025, -8.3, 6.4, -6, '#ffffff');
      s.sign(name.toUpperCase(), 12, 1.2, 0, 8.2, -16.9, '#123a6b', '#ffffff');
      for (let k = 0; k < 6; k++) s.person(k, -8 + (k % 3) * 6, -9 - Math.floor(k / 3) * 3, rng() * 6, { name: ['Chiamaka', 'Obinna', 'Ifunanya', 'Tochukwu', 'Adaeze', 'Kamsi'][k], activity: 'idle', schedule: [8, 14] });
    } else {
      const wall = ['#f1ece0', '#efe4d4', '#e6e2da'][i % 3];
      // a church hall with a pitched roof and a bell tower with a cross
      s.box(16, 7.5, 22, 0, 3.75, -17, wall, true);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 9.6, 4.5, 4, 1, false, Math.PI / 4), s.mat(['#7c2f2a', '#3b4f6b', '#5b4636'][i % 3])); roof.scale.set(1, 1, 22 / 13.6); roof.position.set(0, 9.75, -17); s.group.add(roof);
      s.box(4.6, 13, 4.6, 0, 6.5, -5.4, wall, true); s.box(5, 0.4, 5, 0, 13.2, -5.4, '#9a8f7c'); s.box(0.35, 3, 0.35, 0, 15, -5.4, '#e8d36a'); s.box(1.8, 0.35, 0.35, 0, 15.6, -5.4, '#e8d36a');
      s.box(2.2, 3.4, 0.1, 0, 1.7, -3.08, '#6b4a2e'); s.sign(name.toUpperCase(), 9, 0.9, 0, 4.2, -3.05, '#3a2a1a', '#ffe9b0');
      for (let k = 0; k < 6; k++) s.person(k, -6 + (k % 3) * 6, -1.5 - Math.floor(k / 3) * 2, rng() * 6, { name: ['Bro. Emeka', 'Sis. Ngozi', 'Bro. Obi', 'Sis. Chioma', 'Deacon Uche', 'Sis. Amaka'][k], activity: 'idle', gender: k % 2 ? 'female' : 'male', schedule: [7, 12] });
    }
    const d = s.at(0, kind === 'school' ? -1.5 : -1.8), l = { id, name, kind, x: s.x, z: s.z, radius: 40, confidence: 'fictional', blurb: kind === 'school' ? 'A neighbourhood school: visitors\' desk for evening classes, and the staff room for teaching jobs.' : 'A neighbourhood church: services on Sunday morning; open for quiet reflection in the day.', site: { door: { stand: d }, style: 'plain' }, visitSpot: d };
    g.world.landmarks.list.push(l); g.cityLife.addCivicLandmark(l); this.sites.push(s); return s.place;
  }
  school(i, id, a, st) { return this.civic('school', i, id, a, st); }
  church(i, id, a, st) { return this.civic('church', i, id, a, st); }
  market(i, id, a, st) {
    const g = this.g, w = g.world, M = w.markets; if (!M) return null;
    const name = st ? `${st} ${this.name('market', i)}` : this.name('market', i), lm = { id, name, kind: 'market', x: a.x, z: a.z, radius: 55, confidence: 'fictional', small: true };
    const before = M.stalls.length; M.build(lm); const made = M.stalls.length - before; if (made < 6) return null;
    w.landmarks.list.push(lm); M.registerFrom?.(g.npcs, before); return { x: a.x, z: a.z };
  }
  showroomAt(i, a) {
    const g = this.g, everyday = ['toyota_corolla', 'toyota_camry', 'toyota_avalon', 'toyota_highlander', 'toyota_rav4', 'toyota_sienna', 'honda_accord', 'honda_civic', 'honda_crv', 'honda_pilot', 'lexus_rx350', 'lexus_es350', 'toyota_prado', 'hyundai_elantra', 'kia_rio', 'nissan_altima'];
    const exec = ['mercedes_cclass', 'mercedes_eclass', 'lexus_gs350', 'bmw_5series', 'lexus_gx460', 'range_rover_sport', 'lexus_lx570', 'ford_mustang_gt', 'audi_a6', 'bmw_x5', 'toyota_land_cruiser'];
    const pick = i === 0 ? everyday : exec, stock = VEHICLE_CATALOGUE.filter((v) => pick.includes(v.id));
    const opts = i === 0 ? { lot: { id: 'lot-unity', name: 'Unity Motors Onitsha' }, title: 'UNITY MOTORS', sub: 'TOYOTA · HONDA · LEXUS · NEW & TOKUNBO', premium: false, show: ['toyota_camry', 'toyota_highlander', 'honda_accord', 'lexus_rx350', 'toyota_corolla', 'toyota_sienna'] }
      : { lot: { id: 'lot-executive', name: 'Executive Motors' }, title: 'EXECUTIVE MOTORS', sub: 'EXECUTIVE SALOONS & SUVs', premium: true, show: ['mercedes_eclass', 'range_rover_sport', 'lexus_lx570', 'bmw_5series', 'mercedes_cclass', 'audi_a6'] };
    const sr = new Showroom(g, { ...opts, stock, anchor: a, tag: 'showroom49', reach: 260 }); sr.setup(); if (!sr.plot) return null;
    this.showrooms.push(sr); g.activityPlaces?.push(sr); return { x: sr.plot.x, z: sr.plot.z };
  }
  places() { return this.list; }
  update(dt) { for (const s of this.showrooms) s.update?.(dt); }
}
void naira;
