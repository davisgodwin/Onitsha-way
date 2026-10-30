import * as THREE from 'three';
import { VenueSite, openAt } from './VenueKit.js';
import { ITEMS } from '../data/catalogue.js';
import { HAIR_STYLES } from '../characters/HumanRig.js';
import { ensureActivities } from './ActivityRecords.js';
import { naira } from '../economy/Economy.js';

const clamp = (v) => Math.max(0, Math.min(100, v));
const hoursText = ([a, b]) => `${a}:00–${b % 24}:00`;

export const FOOD_STALLS = [
  { id: 'suya-iweka', name: "Mallam Sani's Suya Spot", near: 'upper-iweka-park', dx: 30, dz: -28, hours: [16, 24], items: ['suya-small', 'suya-big', 'zobo'], vendor: 'Mallam Sani', kind: 'suya', blurb: 'Beef suya off the grill, yaji pepper, onions and cabbage.' },
  { id: 'corn-market', name: 'Roadside corn & ube', near: 'main-market', dx: -40, dz: 30, hours: [9, 20], items: ['roasted-corn', 'corn-ube', 'boli-groundnut'], vendor: 'Mama Ebele', vendorGender: 'female', kind: 'corn', blurb: 'Corn roasting on the coal pot, ube softened in the embers, boli and groundnut.' },
  { id: 'puff-ochanja', name: 'Mama Chioma puff-puff & akara', near: 'ochanja', dx: 25, dz: 20, hours: [6, 13], items: ['puff-puff', 'akara-pap', 'zobo'], vendor: 'Mama Chioma', vendorGender: 'female', kind: 'fryer', blurb: 'Morning puff-puff and akara fried fresh, pap in the pot.' },
  { id: 'mamaput-bridge', name: 'Mama Put · Bridgehead', near: 'bridgehead', dx: -30, dz: -35, hours: [10, 21], items: ['mama-put-rice', 'beans-dodo', 'abacha', 'zobo'], vendor: 'Mama Nkechi', vendorGender: 'female', kind: 'mamaput', blurb: 'Rice and stew, beans and dodo, abacha — eat on the bench.' },
];
export const BARBER_HOURS = [8, 20];
export const CUT_PRICES = { lowcut: 1000, waves: 1500, twists: 2500, fade: 1500, short_afro: 1200, cornrows: 3500, braids: 7000, bun: 2000, afro: 2500, gele: 1500, bob: 6000, ponytail: 2500 };

/** Eat or drink an item straight away (no bag slot needed). Mirrors Needs.use effects. */
export function eatNow(needs, itemId) {
  const it = ITEMS[itemId], u = it?.use; if (!u?.verb) return { ok: false, error: 'not-food' };
  if (needs.state.energy >= 99.5 && needs.state.hunger >= 99.5) return { ok: false, error: 'full' };
  needs.state.energy = clamp(needs.state.energy + (u.energy ?? 0));
  needs.adjust({ hunger: u.hunger ?? (u.verb === 'Eat' ? u.energy ?? 15 : 2), bladder: u.verb === 'Drink' ? -6 : 0 });
  return { ok: true, item: it };
}
/** Buy one item at a stall: pay once (unique key), then eat here or put it in the bag. */
export function buyFood(g, stall, itemId, { eatHere = true } = {}) {
  const item = ITEMS[itemId]; if (!item || !stall.items.includes(itemId)) return { ok: false, error: 'Not sold here' };
  if (eatHere && g.needs.state.energy >= 99.5 && g.needs.state.hunger >= 99.5) return { ok: false, error: 'You are full' };
  if (!eatHere && !g.inventory.canAdd(item)) return { ok: false, error: 'Bag full' };
  const rec = (ensureActivities(g.saveData).games.food ??= { played: 0, seq: 0, spent: 0, finished: [] });
  const tx = g.economy.transact({ key: `food:${stall.id}:${(rec.seq = (rec.seq ?? 0) + 1)}`, amount: -item.price, reason: `${stall.name}: ${item.name}` });
  if (!tx.ok) return { ok: false, error: tx.error === 'insufficient-funds' ? 'Not enough money' : 'Payment failed' };
  rec.spent = (rec.spent ?? 0) + item.price; rec.played = (rec.played ?? 0) + 1;
  if (eatHere) { eatNow(g.needs, itemId); g.needs.adjust({ fun: 2, social: stall.kind === 'suya' || stall.kind === 'mamaput' ? 3 : 1 }); }
  else g.inventory.add(item);
  return { ok: true, item, eatHere };
}

/** Street-food stalls and the barbershop: real places, real prices, saved results. */
export class StreetServices {
  constructor(g) { this.g = g; this.stalls = []; this.eatHere = true; }
  setup() {
    const g = this.g;
    for (const def of FOOD_STALLS) {
      const l = g.world.landmarks.get(def.near); if (!l) continue;
      try { this.stalls.push(this.buildStall(def, { x: l.x + def.dx, z: l.z + def.dz })); } catch (err) { console.warn('[activities] no plot for', def.id, err.message); }
    }
    const l = g.world.landmarks.get('ochanja') ?? g.world.landmarks.get('upper-iweka');
    try { this.buildBarber({ x: l.x - 30, z: l.z - 25 }); } catch (err) { console.warn('[activities] no plot for barbershop', err.message); }
  }

  buildStall(def, near) {
    const g = this.g, s = new VenueSite(g, def.id, near, { w: 6, d: 5 }), stall = { ...def, site: s };
    s.box(6, 0.08, 5, 0, 0.04, -2.5, '#a39b8a');
    // umbrella
    s.cyl(0.04, 2.4, -1.4, 1.2, -1.6, '#555'); const top = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 8), s.mat(def.kind === 'suya' ? '#c8322b' : def.kind === 'mamaput' ? '#1d7a3e' : '#e8a020')); top.position.set(-1.4, 2.6, -1.6); s.group.add(top);
    // counter / grill
    if (def.kind === 'suya' || def.kind === 'corn') {
      s.box(1.4, 0.75, 0.6, -1.4, 0.38, -1.7, '#3d3d3d', true);
      const coals = s.box(1.25, 0.05, 0.45, -1.4, 0.78, -1.7, '#ff6a1a', false, { emissive: '#ff4a00', emissiveIntensity: 1.4 });
      for (let i = 0; i < 6; i++) s.box(def.kind === 'suya' ? 0.5 : 0.18, 0.04, 0.05, -1.9 + i * 0.2, 0.84, -1.7 + (i % 2) * 0.1, def.kind === 'suya' ? '#7a3b1e' : '#e4c24a');
    } else if (def.kind === 'fryer') {
      s.box(1.2, 0.7, 0.6, -1.4, 0.35, -1.7, '#6b4b2f', true); s.cyl(0.32, 0.22, -1.4, 0.82, -1.7, '#2b2b2b'); s.box(0.5, 0.02, 0.5, -1.4, 0.94, -1.7, '#d79a3a');
    } else { s.box(2, 0.85, 0.7, -1.4, 0.43, -1.8, '#7b5a3c', true); for (let i = 0; i < 4; i++) s.cyl(0.18, 0.3, -2.1 + i * 0.47, 1.0, -1.8, ['#c94', '#a33', '#d6b46a', '#6a8'][i]); }
    // bench and price board
    s.box(2, 0.08, 0.4, 1.4, 0.45, -2.6, '#6e4a2f', true); for (const k of [0.6, 2.2]) s.box(0.08, 0.42, 0.36, k, 0.21, -2.6, '#4b3220');
    s.sign(def.name.toUpperCase(), 3.2, 0.42, 1.0, 1.9, -0.25, '#fff4dc', '#7a1f2b'); for (const u of [-0.55, 2.55]) s.box(0.06, 2.1, 0.06, u, 1.05, -0.3, '#4b3220');
    stall.vendorNpc = s.person(0, -1.4, -2.3, 0, { name: def.vendor, gender: def.vendorGender ?? 'male', activity: 'serve', schedule: def.hours, role: 'trader' });
    s.person(1, 1.2, -2.6, 0, { name: ['Ikenna', 'Adaobi', 'Kelechi', 'Somto'][this.stalls.length % 4], gender: this.stalls.length % 2 ? 'female' : 'male', activity: 'drink', seatY: 0.48, schedule: def.hours });
    s.interact(-1.4, -0.7, () => `${def.name} — buy food`, () => g.openChoice(() => this.stallView(stall)), { radius: 2 });
    return stall;
  }

  stallView(stall) {
    const g = this.g, h = g.clock.minutes / 60, open = openAt(h, stall.hours);
    const result = (r) => { g.ui.toast(r.ok ? (r.eatHere ? `${r.item.use.verb === 'Drink' ? 'Drank' : 'Ate'} the ${r.item.name.toLowerCase()} — ${naira(r.item.price)}` : `${r.item.name} is in your bag`) : r.error); if (r.ok) g.saveGameNow(); g.renderChoice(); };
    return { title: stall.name, kicker: `OPEN ${hoursText(stall.hours)} · WALLET ${naira(g.economy.balance)}`, text: stall.blurb,
      note: open ? `Energy ${Math.round(g.needs.energy)} · Hunger ${Math.round(g.needs.state.hunger)}. ${this.eatHere ? 'Eating here: it counts straight away.' : 'Take-away: goes in your bag.'}` : `${stall.vendor} is not here now. Come back between ${hoursText(stall.hours)}.`,
      options: [
        ...stall.items.map((id) => { const it = ITEMS[id], afford = g.economy.canAfford(it.price); return { label: `${it.name} · ${naira(it.price)}`, sub: `+${it.use.energy} energy · +${it.use.hunger ?? 2} hunger`, disabled: !open || !afford, why: !open ? 'Closed' : 'Not enough money', act: () => result(buyFood(g, stall, id, { eatHere: this.eatHere })) }; }),
        { label: this.eatHere ? 'Mode: eat here (tap for take-away)' : 'Mode: take-away (tap to eat here)', act: () => { this.eatHere = !this.eatHere; g.renderChoice(); } },
        { label: 'Done', ghost: true, act: () => g.closeChoice() },
      ] };
  }

  // ------------------------------------------------------------------ barbershop
  buildBarber(near) {
    const g = this.g, s = this.barber = new VenueSite(g, 'kingsway-barber', near, { w: 6, d: 5.5 });
    s.shed({ w: 5.6, d: 5, h: 2.9, wall: '#dfe8e6', roof: '#6e7c80', trim: '#1d3b6e', sign: 'KINGSWAY BARBING & HAIR SALON', signBg: '#1d3b6e', signFg: '#fff' });
    for (const u of [-1.4, 1.2]) { s.box(0.65, 0.5, 0.65, u, 0.35, -3.7, '#7a1f2b', true); s.box(0.65, 0.6, 0.1, u, 0.85, -4.0, '#7a1f2b'); s.box(0.9, 1.1, 0.04, u, 1.6, -4.85, '#bfe2ef', false, { emissive: '#6a9fb5', emissiveIntensity: 0.25, metalness: 0.6, roughness: 0.15 }); }
    s.box(4.6, 0.06, 0.35, 0, 1.05, -4.75, '#f4f1e8'); for (let i = 0; i < 6; i++) s.box(0.08, 0.2, 0.08, -2 + i * 0.75, 1.18, -4.75, ['#1f4fbf', '#c8322b', '#1d7a3e', '#f2c12e'][i % 4]);
    s.box(2.2, 0.08, 0.45, -1.2, 0.45, -1.2, '#6e4a2f', true);
    // barber pole by the entrance
    s.cyl(0.08, 1.3, 2.5, 1.5, 0.15, '#f4f4f4'); for (let i = 0; i < 4; i++) { const r = s.box(0.17, 0.12, 0.17, 2.5, 1.0 + i * 0.3, 0.15, i % 2 ? '#1d3b6e' : '#c8322b'); r.rotation.y = i * 0.6; }
    this.barberNpc = s.person(0, -0.6, -3.5, 0, { name: 'Brother Kingsley', activity: 'serve', schedule: BARBER_HOURS, role: 'trader' });
    s.person(1, -1.6, -1.2, 0, { name: 'Ugo', activity: 'drink', seatY: 0.48, schedule: BARBER_HOURS });
    s.interact(0, -2.2, () => 'Barbing salon — change your hair', () => g.openChoice(() => this.barberView()), { radius: 2.2 });
  }
  barberView() {
    const g = this.g, open = openAt(g.clock.minutes / 60, BARBER_HOURS), app = g.player.appearance, gender = app.gender === 'female' ? 'female' : 'male';
    return { title: 'Kingsway Barbing & Hair Salon', kicker: `OPEN ${hoursText(BARBER_HOURS)} · WALLET ${naira(g.economy.balance)}`,
      text: gender === 'male' ? '"Oga, how you want am today?" Pick a cut. Your new look shows straight away and is saved.' : '"Sister, sit down. Which style?" Pick a style. Your new look shows straight away and is saved.',
      note: open ? 'You pay once, after choosing. Your current style is free to keep.' : `Closed now. Open ${hoursText(BARBER_HOURS)} (Onitsha time).`,
      options: [...HAIR_STYLES[gender].map((h) => { const cur = app.hair === h.id, price = CUT_PRICES[h.id] ?? 1500; return { label: `${h.label}${cur ? ' (current)' : ` · ${naira(price)}`}`, disabled: cur || !open || !g.economy.canAfford(price), why: cur ? 'Your current style' : !open ? 'Closed' : 'Not enough money', act: () => g.ui.toast(this.haircut(h.id).message) }; }), { label: 'Done', ghost: true, act: () => g.closeChoice() }] };
  }
  /** Pay once and change the saved hairstyle. */
  haircut(style) {
    const g = this.g, app = g.player.appearance, gender = app.gender === 'female' ? 'female' : 'male', h = HAIR_STYLES[gender].find((x) => x.id === style);
    if (!h) return { ok: false, message: 'Not offered here' };
    if (!openAt(g.clock.minutes / 60, BARBER_HOURS)) return { ok: false, message: 'The salon is closed' };
    if (app.hair === style) return { ok: false, message: 'That is already your style' };
    const price = CUT_PRICES[style] ?? 1500, rec = (ensureActivities(g.saveData).games.barber ??= { played: 0, seq: 0, finished: [] });
    const tx = g.economy.transact({ key: `barber:${(rec.seq = (rec.seq ?? 0) + 1)}`, amount: -price, reason: `Kingsway salon: ${h.label}` });
    if (!tx.ok) return { ok: false, message: 'Not enough money' };
    rec.played = (rec.played ?? 0) + 1;
    g.player.setAppearance({ ...app, hair: style }); g.player.syncModel();
    g.saveData.character = { ...g.saveData.character, hair: style };
    g.needs.adjust({ hygiene: 8, social: 4 }); g.saveGameNow(); g.renderChoice();
    return { ok: true, message: `Fresh ${h.label.toLowerCase()}! ${naira(price)} paid.` };
  }

  places() {
    const out = this.stalls.map((st) => ({ ...st.site.at(-1.4, -0.5), kind: 'venue', label: st.name }));
    if (this.barber) out.push({ ...this.barber.at(0, -0.5), kind: 'venue', label: 'Kingsway Barbing & Hair Salon' });
    return out;
  }
}
