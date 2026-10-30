import * as THREE from 'three';
import { weekdayOf } from '../sim/Calendar.js';
import { ensureActivities } from './ActivityRecords.js';
import { naira } from '../economy/Economy.js';

/**
 * Weekly city events on the real Onitsha calendar (weekday 0 = Monday … 6 = Sunday). Lightweight: one check a few
 * times a second, no background timers. Each event changes something you can actually do, and friends invite you
 * by phone message once per event day.
 */
export const EVENTS = [
  { id: 'cup', name: 'Community 5-a-side Cup', days: [5], hours: [10, 18], where: 'Chuba Ikpeazu Memorial Stadium', from: 'Coach Uzo',
    invite: (d) => `Community Cup today at the stadium, ${d}. ₦500 entry, win your match and collect ₦1,500. Up to 3 prize matches each. Bring your boots!`, entry: 500, prize: 1500, perDay: 3 },
  { id: 'street-party', name: 'Market Corner street party', days: [4, 5], hours: [19, 23], where: 'Market Corner Pool & Draughts', from: 'Chinwe',
    invite: (d) => `Street party at Market Corner tonight, ${d}! Music, dancing, suya. Come and show us your legs.` },
  { id: 'draughts-sunday', name: 'Sunday draughts challenge', days: [6], hours: [14, 18], where: 'Market Corner Pool & Draughts', from: 'Papa Ifeanyi',
    invite: (d) => `My pikin, Sunday draughts challenge, ${d}. Beat me when I play seriously (Hard) and I will dash you ₦1,000. Once a day.`, prize: 1000 },
  { id: 'big-match', name: 'Big match night', days: [2, 5], hours: [20, 23], where: 'Iweka Viewing Centre', from: 'Kene',
    invite: (d) => `Big match night at the viewing centre, ${d}. The room will be full. Only ₦100 at the door.` },
];
const fmt = ([a, b]) => `${a > 12 ? a - 12 + 'pm' : a + 'am'}–${b > 12 ? b - 12 + 'pm' : b + 'am'}`;

export class CityEvents {
  constructor(g) { this.g = g; this.t = 0; this.party = null; this.toasted = new Set(); }
  setup() { this.buildParty(); }
  /** Is the event on now (weekday and hour)? */
  active(id, minutes = this.g.clock.minutes) {
    const e = EVENTS.find((x) => x.id === id); if (!e || !this.g.saveData) return false;
    const wd = weekdayOf(this.g.clock.day), h = minutes / 60; return e.days.includes(wd) && h >= e.hours[0] && h < e.hours[1];
  }
  /** Events today (for invitations and the map). */
  today() { const wd = weekdayOf(this.g.clock.day); return EVENTS.filter((e) => e.days.includes(wd)); }
  record() { return (ensureActivities(this.g.saveData).games.events ??= { played: 0, sent: [], prizes: {}, finished: [] }); }

  /** Prize matches/claims left today for an event (e.g. the cup: 3 a day). */
  claimsLeft(id) { const e = EVENTS.find((x) => x.id === id), r = this.record(), k = `${id}:${this.g.clock.day}`; return Math.max(0, (e.perDay ?? 1) - (r.prizes?.[k] ?? 0)); }
  /** Pay an event prize exactly once per key; counts against the daily allowance. */
  payPrize(id, key, amount, reason) {
    const r = this.record(), k = `${id}:${this.g.clock.day}`; r.prizes ??= {};
    if (this.claimsLeft(id) <= 0) return { ok: false, error: 'No prizes left today' };
    const tx = this.g.economy.transact({ key, amount, reason }); if (!tx.ok) return tx;
    r.prizes[k] = (r.prizes[k] ?? 0) + 1;
    for (const old of Object.keys(r.prizes)) if (!old.endsWith(`:${this.g.clock.day}`)) delete r.prizes[old];
    return { ok: true };
  }

  /** Party set: speakers, a DJ table, coloured lights and extra dancers at the parlour on party nights. */
  buildParty() {
    const pc = this.g.parlour?.site; if (!pc) return;
    const grp = new THREE.Group(); grp.name = 'street-party'; grp.visible = false; pc.group.add(grp);
    const box = (w, h, d, x, y, z, c, glow = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, emissive: glow ? c : '#000', emissiveIntensity: glow })); m.position.set(x, y, z); grp.add(m); return m; };
    for (const x of [-4.3, 4.3]) { box(0.7, 1.2, 0.6, x, 0.6, 0.5, '#151515'); box(0.5, 0.5, 0.05, x, 0.85, 0.82, '#333'); }
    box(1.6, 0.85, 0.7, -3.0, 0.43, -0.9, '#2a2440'); box(1.2, 0.05, 0.5, -3.0, 0.88, -0.9, '#555');
    this.partyLights = []; for (let i = 0; i < 8; i++) this.partyLights.push(box(0.18, 0.18, 0.18, -4 + i * 1.15, 2.95, 0.5, ['#ff3b6b', '#3bff8a', '#3bb5ff', '#ffd23b'][i % 4], 2));
    this.party = grp;
    // dancers only appear on party nights (their hours are switched on and off by the event)
    this.dancers = [];
    for (let i = 0; i < 6; i++) {
      const p = pc.at(-2.6 + i * 1.05, 0.7 + (i % 2) * 0.8);
      this.dancers.push(this.g.npcs.addAnchored({ id: `event:street-party:${i}`, kind: 'activity', role: 'neighbour', name: ['Nneka', 'Obi', 'Ada', 'Chuks', 'Ifunanya', 'Dubem'][i], x: p.x, z: p.z, nx: Math.sin(pc.yaw + Math.PI), nz: Math.cos(pc.yaw + Math.PI), schedule: [0, 0], gender: i % 2 ? 'male' : 'female', activity: 'dance' }));
    }
    this.djNpc = this.g.npcs.addAnchored({ id: 'event:street-party:dj', kind: 'activity', role: 'neighbour', name: 'DJ Spinall-Onitsha', ...pc.at(-3.0, -1.5), nx: Math.sin(pc.yaw), nz: Math.cos(pc.yaw), schedule: [0, 0], gender: 'male', activity: 'serve' });
  }

  update(dt) {
    const g = this.g; if (!g.saveData) return;
    this.t += dt;
    if (this.party?.visible) { const t = performance.now() / 1000; this.partyLights.forEach((m, i) => { m.material.emissiveIntensity = 1 + Math.max(0, Math.sin(t * 6 + i * 1.3)) * 3; }); }
    if (this.t < 0.5) return; this.t = 0;
    // party on/off
    const party = this.active('street-party');
    if (this.party && this.party.visible !== party) { this.party.visible = party; for (const d of [...(this.dancers ?? []), this.djNpc]) if (d) d.schedule = party ? [19, 23] : [0, 0]; }
    // invitations: one phone message per event day, from the morning
    const h = g.clock.minutes / 60, r = this.record(), day = g.clock.day;
    if (h >= 7 && g.phoneServices) for (const e of this.today()) {
      const key = `${e.id}:${day}`; if (r.sent.includes(key) || h >= e.hours[1]) continue;
      r.sent.push(key); if (r.sent.length > 30) r.sent.splice(0, r.sent.length - 30);
      g.phoneServices.message(e.from, e.invite(`${fmt(e.hours)}`)); g.phone?.messenger?.badge?.();
    }
    // a heads-up when you are near an event that is on
    for (const e of EVENTS) {
      if (!this.active(e.id)) continue; const place = this.placeOf(e.id); if (!place) continue;
      const k = `${e.id}:${day}`; if (this.toasted.has(k)) continue;
      if (Math.hypot(g.player.position.x - place.x, g.player.position.z - place.z) < 60) { this.toasted.add(k); g.ui.toast(`${e.name} is on now (${fmt(e.hours)})`); }
    }
  }
  placeOf(id) {
    const g = this.g;
    if (id === 'cup') return g.stadiumFootball?.spot;
    if (id === 'street-party' || id === 'draughts-sunday') return g.parlour?.site?.at(0, 0);
    if (id === 'big-match') return g.entertainment?.view?.at(0, 0);
    return null;
  }
  places() {
    return EVENTS.filter((e) => this.active(e.id)).map((e) => { const p = this.placeOf(e.id); return p ? { x: p.x + 0.5, z: p.z + 0.5, kind: 'venue', label: `On now: ${e.name}` } : null; }).filter(Boolean);
  }
  /** Calendar text for the phone/places: this week's events. */
  weekText() { const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; return EVENTS.map((e) => `${e.name}: ${e.days.map((d) => names[d]).join(' & ')} ${fmt(e.hours)} at ${e.where}`); }
}
export { naira };
