import * as THREE from 'three';
import { EATERIES, DATE_TOPICS, dateOutcome, eateryOpen } from '../data/eateries.js';
import { buildVenue, venueNear, venueDoor } from '../world/VenueArchitecture.js';
import { naira } from '../economy/Economy.js';
import { seatedY } from '../interiors/CivicLayouts.js';
/**
 * v0.45 eateries and dates. Three fictional restaurants, each its own building with a walk-in dining room: order at
 * the counter (food fills you up), sit at any table, and take someone on a date:
 * - someone you know in the city (you've talked and know their name): invite them, they join you at a table for two,
 *   you order for both and talk; how it goes depends on what you say. Dates build the relationship; after a few good
 *   ones you're "seeing each other". Conversation only — the game shows nothing more than that.
 * - another player: from the meet menu (friends only, adults only, the server checks both). You both go in and sit
 *   together; the server counts the date once you've both been there a while.
 * Children can eat here but can't go on dates.
 */
const TAU = Math.PI * 2;
export class Eateries {
 constructor(g) { this.g = g; this.list = []; this.group = new THREE.Group(); this.group.name = 'Eateries'; this.date = null; this.seq = 0; this.readyAt = 0; }
 adult() { return this.g.saveData?.character?.ageGroup !== 'child'; }
 setup() {
  const g = this.g, w = g.world;
  const avoid = () => [...(g.homeStores?.stores ?? []).map((s) => ({ x: s.door?.stand?.x ?? s.x, z: s.door?.stand?.z ?? s.z, r: 40 })), ...(g.hospitals?.list ?? []).map((h) => ({ x: h.place.x, z: h.place.z, r: 45 })), ...(g.business?.branches ?? []).map((b) => ({ x: b.x, z: b.z, r: 40 })), ...this.list.map((e) => ({ x: e.place.x, z: e.place.z, r: 80 }))].filter((q) => Number.isFinite(q.x));
  for (const [i, def] of EATERIES.entries()) {
   const plot = venueNear(w, def.near, 'eatery', { from: 70, avoid: avoid(), seed: i + 3 }); if (!plot) { console.warn('[eateries] no plot for', def.id); continue; }
   this.addEatery(def, plot);
  }
  g.renderer.scene.add(this.group);
 }
 /** v0.49: one eatery on a plot (also used to open more of them later). */
 addEatery(def, plot) {
   const g = this.g, w = g.world;
   const v = { ...plot, id: def.id, kind: 'eatery', name: def.name, colors: def.colors, style: def.style }; buildVenue(w, v, this.group);
   const d = venueDoor(v, 0, -4.9, 2.4), e = { ...def, door: d, place: { x: d.stand.x, z: d.stand.z } }; this.list.push(e);
   g.interactions.register({ x: d.stand.x, z: d.stand.z, radius: 3, priority: 2, enabled: () => !!g.saveData && !g.homes.inside && !g.vehicles.driving && !g.civic?.inside, label: () => this.open(e) ? `${e.name} — go in` : `${e.name} — opens ${e.hours[0]}:00`, onInteract: () => this.enter(e) });
   if (g.online) g.online.locations[def.id] = { x: d.stand.x, z: d.stand.z };
   return e;
 }
 open(e) { return eateryOpen(e, this.g.clock.minutes / 60); }
 places() { return this.list.map((e) => ({ x: e.place.x, z: e.place.z, kind: 'eatery', id: e.id, label: e.name })); }
 /** The eatery you're in, if any. */
 here() { const c = this.g.civic?.inside; return c?.eatery ?? null; }
 enter(e) {
  const g = this.g; if (!this.open(e)) { g.ui.toast(`${e.name} opens at ${e.hours[0]}:00.`); return false; }
  e.civic ??= { id: e.id, kind: 'eatery', name: e.name, x: e.place.x, z: e.place.z, visitSpot: e.place, eatery: e, interior: { kind: 'eatery', hours: e.hours, opts: { name: e.name, style: e.style, colors: e.colors, menu: e.menu },
   counters: [{ at: 'counter', label: 'Counter — order food', act: () => g.openChoice(() => this.menuView(e)) },
    ...[0, 1, 2, 3].map((k) => ({ at: 'table' + k, radius: 1.1, label: () => this.date?.eatery === e && this.date.table === k ? `Sit with ${this.date.name}` : 'Table for two — sit down', act: () => this.sitAt(e, k) }))] } };
  return g.civic.enter(e.civic);
 }
 /** The tables of the room you're in (world coordinates). */
 tables() { const c = this.g.civic, A = c?.anchors; if (!A?.tables) return []; return A.tables.map((t) => ({ me: { x: c.ox + t.me.x, z: t.me.z }, them: { x: c.ox + t.them.x, z: t.them.z } })); }
 sitAt(e, k) {
  const g = this.g, t = this.tables()[k]; if (!t) return;
  if (g.player.posture) g.player.stand();
  g.posture?.use({ x: t.me.x, z: t.me.z, y: 0.49, heading: Math.PI, kind: 'seat' });
  if (this.date?.eatery === e && this.date.table === k) { this.date.seated = true; g.openChoice(() => this.dateView()); }
 }
 // ── ordering ────────────────────────────────────────────────────────────────────────────────────
 menuView(e) {
  const g = this.g, opts = e.menu.map((m) => ({ label: `${m.name} · ${naira(m.price)}`, sub: m.drink ? 'Drink' : `Fills you up (+${m.hunger})`, disabled: !g.economy.canAfford(m.price), why: 'Not enough cash', act: () => this.order(e, m) }));
  if (this.adult() && !this.date) opts.push({ label: 'Invite someone here on a date', sub: 'Someone you know in Onitsha joins you at a table for two', act: () => g.openChoice(() => this.inviteView(e)) });
  if (this.date?.eatery === e && !this.date.seated) opts.push({ label: `${this.date.name} is waiting at the table by the window`, sub: 'Walk over and sit down', disabled: true, why: 'Go to the table' });
  const o = g.online?.date; if (o && o.area === e.id) opts.push({ label: 'Your date with another player is here', sub: 'Sit at a table together and stay a while; the server counts it', disabled: true, why: 'Sit down together' });
  opts.push({ label: 'Back', ghost: true, act: () => g.closeChoice() });
  return { title: e.name, kicker: 'EATERY · ORDER', text: e.blurb, note: `Open ${e.hours[0]}:00–${e.hours[1] % 24}:00. Pay at the counter; sit wherever you like.`, options: opts };
 }
 order(e, m, { quiet = false } = {}) {
  const g = this.g; if (!g.economy.canAfford(m.price)) { g.ui.toast('Not enough cash.'); return false; }
  const tx = g.economy.transact({ key: `eatery:${e.id}:${Date.now()}:${++this.seq}`, amount: -m.price, reason: `${e.name}: ${m.name}` }); if (tx && tx.ok === false) { g.ui.toast(tx.error ?? 'Payment failed.'); return false; }
  g.needs?.adjust({ hunger: m.hunger, fun: m.fun ?? 0 }); g.saveGame?.();
  if (!quiet) { g.closeChoice(); g.ui.toast(`${m.name}. ${m.drink ? 'Refreshing.' : 'Delicious.'}`); }
  return true;
 }
 // ── dates with people you know ─────────────────────────────────────────────────────────────────
 /** People you could ask: you know their name, you've talked a few times, it isn't going badly. */
 candidates() {
  const rels = this.g.npcs?.rels ?? {}, day = this.g.clock.day;
  return Object.entries(rels).filter(([, r]) => r.knowsName && (r.talks ?? 0) >= 2 && (r.positive ?? 0) >= (r.negative ?? 0) && r.name).map(([id, r]) => ({ id, name: r.name, role: r.role, rel: r, today: r.lastDate === day }))
   .sort((a, b) => (b.rel.dates ?? 0) - (a.rel.dates ?? 0) || (b.rel.talks ?? 0) - (a.rel.talks ?? 0)).slice(0, 8);
 }
 inviteView(e) {
  const g = this.g, list = this.candidates();
  const opts = list.map((c) => ({ label: `${c.name}${c.rel.status === 'dating' ? ' ♥' : ''}`, sub: `${c.role ?? 'Someone you know'} · ${c.rel.dates ? `${c.rel.dates} date${c.rel.dates > 1 ? 's' : ''} so far` : 'no dates yet'}`, disabled: c.today, why: 'You saw them today already', act: () => this.invite(e, c) }));
  opts.push({ label: 'Back', ghost: true, act: () => g.openChoice(() => this.menuView(e)) });
  return { title: 'Who would you like to invite?', kicker: `${e.name.toUpperCase()} · A DATE`, text: list.length ? 'You call them. They come if they like you enough.' : 'Nobody yet. Talk to people around the city (and learn their names) first.', note: 'Dates are conversation over a meal. Adults only.', options: opts };
 }
 invite(e, c) {
  const g = this.g, r = c.rel, fam = Math.round((r.talks ?? 0) + (r.positive ?? 0) * 0.5 - (r.negative ?? 0) * 0.7);
  if (!this.adult()) return;
  if (fam < 3 && !(r.dates > 0)) { r.lastDate = g.clock.day; g.closeChoice(); g.ui.toast(`${c.name} is busy today. Get to know them a bit better first.`, 5000); g.saveGame?.(); return; }
  const res = (g.npcs?.residents ?? []).find((x) => x.id === c.id), gender = res?.gender ?? (c.id.length % 2 ? 'female' : 'male');
  const tables = this.g.civic.anchors?.tables ?? [], k = 0, t = tables[k]; if (!t) return;
  this.endDate(true);
  const rig = this.g.civic.room.person(t.them.x, t.them.z, 0, { gender, outfit: gender === 'female' ? 'ankara_gown' : 'senator', color: (c.id.length * 3) % 10, pose: 'sit', y: seatedY(0.49) });
  this.date = { eatery: e, table: k, id: c.id, name: c.name, rel: r, rig, seated: false, stage: 'order', score: 0, round: 0, meal: null, lines: [], topics: null };
  g.closeChoice(); g.ui.toast(`${c.name} is on the way… and here already. They're at the table for two by the window.`, 5000);
 }
 dateView() {
  const g = this.g, d = this.date; if (!d) return null; const e = d.eatery, n = d.name;
  if (d.stage === 'order') {
   const opts = e.menu.filter((m) => !m.drink).map((m) => ({ label: `Order ${m.name} for two · ${naira(m.price * 2)}`, disabled: !g.economy.canAfford(m.price * 2), why: 'Not enough cash', act: () => { if (this.order(e, { ...m, price: m.price * 2, name: `${m.name} for two` }, { quiet: true })) { d.meal = m; this.plates(); d.stage = 'talk'; g.openChoice(() => this.dateView()); } } }));
   const drink = e.menu.find((m) => m.drink); if (drink) opts.push({ label: `Just drinks: ${drink.name} for two · ${naira(drink.price * 2)}`, disabled: !g.economy.canAfford(drink.price * 2), why: 'Not enough cash', act: () => { if (this.order(e, { ...drink, price: drink.price * 2, name: `${drink.name} for two` }, { quiet: true })) { d.stage = 'talk'; g.openChoice(() => this.dateView()); } } });
   opts.push({ label: 'Leave without ordering', ghost: true, act: () => this.finish(true) });
   return { title: `A date with ${n}`, kicker: e.name.toUpperCase(), text: `${n} smiles as you sit down. What will you have?`, options: opts };
  }
  if (d.stage === 'talk') {
   d.topics ??= this.pick(3);
   const opts = d.topics.map((t) => ({ label: t.label, act: () => { d.score += t.score; d.lines.push(t.reply(n)); d.round++; d.topics = null; if (d.round >= 3) d.stage = 'end'; g.skipTime(15); g.openChoice(() => this.dateView()); } }));
   return { title: `A date with ${n}`, kicker: `${e.name.toUpperCase()} · ${d.round + 1} OF 3`, text: d.lines.at(-1) ?? `${d.meal ? `The ${d.meal.name.toLowerCase()} arrives.` : 'The drinks arrive.'} What do you talk about?`, options: opts };
  }
  const out = dateOutcome(d.score, !!d.meal);
  return { title: `A date with ${n}`, kicker: `${e.name.toUpperCase()} · THE END OF THE EVENING`, text: `${d.lines.at(-1) ?? ''} It was ${out.line}.`, options: [{ label: 'Say goodnight', primary: true, act: () => this.finish(false) }] };
 }
 pick(n) { const pool = [...DATE_TOPICS], out = [], r = () => { this.seq = (this.seq * 9301 + 49297) % 233280; return this.seq / 233280; }; this.seq = (this.seq || 7) + this.g.clock.day; while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); if (!out.some((t) => t.score > 0)) out[0] = DATE_TOPICS[0]; return out; }
 plates() { const d = this.date, t = this.tables()[d?.table]; if (!t) return; const m = new THREE.MeshStandardMaterial({ color: '#f6f2e8' }), f = new THREE.MeshStandardMaterial({ color: '#d4542a' });
  for (const z of [t.me.z - 0.38, t.them.z + 0.38]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.03, 16), m); p.position.set(t.me.x, 0.79, z); const food = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 12), f); food.position.set(t.me.x, 0.82, z); this.g.civic.group.add(p, food); } }
 /** The date ends: score it (unless it was cut short), remember it, and they leave. */
 finish(early) {
  const g = this.g, d = this.date; if (!d) return; g.closeChoice();
  if (!early) {
   const out = dateOutcome(d.score, !!d.meal), r = d.rel;
   r.positive = (r.positive ?? 0) + out.positive; r.negative = (r.negative ?? 0) + (out.negative ?? 0); r.lastDate = g.clock.day;
   if (out.grade !== 'poor') r.dates = (r.dates ?? 0) + 1; r.goodDates = (r.goodDates ?? 0) + (out.grade === 'good' || out.grade === 'great' ? 1 : 0);
   const was = r.status; if ((r.goodDates ?? 0) >= 3 && r.status !== 'dating') r.status = 'dating';
   g.needs?.adjust({ social: out.social, fun: out.fun }); g.life?.note?.(`date:${d.id}:${g.clock.day}`, `A date with ${d.name} at ${d.eatery.name}: ${out.line}`, { social: out.grade === 'poor' ? 0 : 2 });
   g.ui.toast(r.status === 'dating' && was !== 'dating' ? `You and ${d.name} are seeing each other now.` : `${d.name}: "${out.grade === 'poor' ? 'Maybe another time.' : 'Thank you, I enjoyed this.'}"`, 6000);
  } else { d.rel.lastDate = g.clock.day; g.ui.toast(`${d.name} heads home.`); }
  this.endDate(); g.saveGame?.();
 }
 endDate(silent = false) { const d = this.date; if (!d) return; d.rig?.group?.parent?.remove(d.rig.group); this.date = null; }
 update() {
  const g = this.g, d = this.date;
  if (d && g.civic?.inside?.eatery !== d.eatery) { d.rel.lastDate = g.clock.day; this.endDate(); g.ui.toast(`You left. ${d.name} heads home.`); }
  // a date with another player: check in automatically once you're both at the eatery
  const o = g.online?.date, now = performance.now();
  if (o && o.area?.startsWith('eatery-') && now - this.readyAt > 4000) { const here = g.civic?.inside?.id === o.area || Math.hypot(g.player.position.x - o.x, g.player.position.z - o.z) < 25; if (here) { this.readyAt = now; g.online.request('dateReady', { id: o.id }).catch(() => {}); } }
 }
}
