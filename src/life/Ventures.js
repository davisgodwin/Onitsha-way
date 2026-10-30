import * as THREE from 'three';
import { GeoBuilder } from '../world/GeoBuilder.js';
import { naira } from '../economy/Economy.js';
import { weekdayOf } from '../sim/Calendar.js';
import { buildHuman, defaultAppearance } from '../characters/HumanRig.js';
import { CharacterAnimator } from '../characters/CharacterAnimator.js';
import { interactiveCar } from '../vehicles/InteractiveCar.js';
import { VEHICLE_MODELS, vehicleBody } from '../data/housing.js';
import { pickHostHome } from '../housing/HousingSystem.js';
import { streetReference } from '../world/StreetLayout.js';
import {
 ensureVentures, eventOffers, eventCost, eventResult, SUPPLY, decorBriefs, decorScore, DECOR_ITEMS, AGENCY, agencyBriefs, agencyCapacity,
 tenantsFor, rentWeek, BUILD, buildCosts, FAULTS, calloutFor, SECURITY, SECURITY_CLIENTS, securityNight, TURF, RIVALS, CREW_JOBS,
 CLUB, LEAGUE, fixtures, simMatch, table, hash, personName,
} from '../data/ventures.js';
/**
 * v0.47 stage 7 (second part): event planner, interior decorator, tech agency, landlord and developer, roadside
 * mechanic, security company, street crew, footballer and coach. Managed from the phone (Ventures), done in the city:
 * events happen at a place on a day (a canopy goes up), decorating is at the client's house, call-outs are a car at
 * the roadside, the developer's building is finished in front of you, guards stand at your shops, crews work their
 * turf, footballers play the league match at the stadium. Adults only.
 */
const C = (c) => new THREE.Color(c);
const DISTRICTS = ['fegge', 'odoakpu', 'main-market', 'ochanja', 'upper-iweka', 'bridgehead'];
export class Ventures {
 constructor(g) { this.g = g; this.group = new THREE.Group(); this.group.name = 'Ventures'; this.meshes = new Map(); this.day = null; this.offs = []; }
 get V() { const s = this.g.saveData; if (!s) return null; return (s.ventures = ensureVentures(s.ventures)); }
 adult() { return this.g.saveData?.character?.ageGroup !== 'child'; }
 get today() { return this.g.clock.day; }
 week(d = this.today) { return Math.floor((d - 1) / 7); }
 setup() { this.g.renderer.scene.add(this.group); }
 near(x, z, r = 40) { const p = this.g.player.position; return !this.g.civic?.inside && !this.g.homes?.inside && Math.hypot(p.x - x, p.z - z) < r; }
 spotNear(id, seed, off = 30) { const g = this.g, L = g.world.landmarks.get(id) ?? g.world.landmarks.list[0], a = (seed % 360) * Math.PI / 180; let x = L.x + Math.cos(a) * off, z = L.z + Math.sin(a) * off; try { [x, z] = g.world.findFreeSpot(x, z, 3); } catch { /* keep */ } return { x, z, area: L.name }; }
 pay(key, amount, reason) { if (!amount) return { ok: true }; return this.g.economy.transact({ key, amount, reason }); }
 places() { const V = this.V, out = []; if (!V) return out; for (const e of V.events) if (!e.done && e.day >= this.today) out.push({ x: e.x, z: e.z, kind: 'office', id: 'event-' + e.id, label: `Your event: ${e.label} (day ${e.day})` }); if (V.callout) out.push({ x: V.callout.x, z: V.callout.z, kind: 'office', id: 'callout', label: `Call-out: ${V.callout.owner}'s car` }); for (const d of V.decor) if (!d.done) out.push({ x: d.x, z: d.z, kind: 'office', id: 'decor-' + d.id, label: `Decorating job: ${d.client}` }); return out; }

 // ── daily ───────────────────────────────────────────────────────────────────────────────────────
 update() {
  const g = this.g; if (!g.saveData || !this.V) return;
  if (this.saveRef !== g.saveData) { this.saveRef = g.saveData; this.day = g.clock.day; this.refresh(); return; }
  if (g.clock.day !== this.day) { const from = this.day; this.day = g.clock.day; for (let d = from + 1; d <= this.day && d - from < 30; d++) this.newDay(d); this.refresh(); g.saveGame?.(); }
 }
 newDay(d) {
  const V = this.V, g = this.g;
  // the agency: staff work, wages are paid (or they leave)
  const A = V.agency; if (A) { const cap = agencyCapacity(g.skills.level('coding'), A.staff, A.workedDay === d - 1); for (const b of A.briefs) if (!b.done) { const use = Math.min(cap / Math.max(1, A.briefs.filter((x) => !x.done).length), b.effort - b.progress); b.progress += use; }
   for (const b of A.briefs) if (!b.done && b.progress >= b.effort - 0.01) this.deliver(b, d); for (const b of A.briefs) if (!b.done && d > b.due + 2) { b.done = 'cancelled'; g.life?.note(`agency-cancel:${b.id}`, `${b.client} cancelled a late ${b.label.toLowerCase()}`, { business: -3, prof: { agency: -3 } }); }
   A.briefs = A.briefs.filter((b) => !b.done || d - (b.doneDay ?? d) < 7);
   if (A.staff) { const w = A.staff * AGENCY.wage, tx = g.economy.canAfford(w) ? this.pay(`agency-wages:${d}`, -w, `Agency: wages for ${A.staff} developer${A.staff > 1 ? 's' : ''}`) : null; if (!tx?.ok) { A.staff = Math.max(0, A.staff - 1); g.ui?.toast?.('You couldn\'t pay your developers. One of them left.', 5000); } } }
  // rent from tenants, once a week
  for (const L of Object.values(V.lets)) { if (d - L.paidTo < 7) continue; L.paidTo += 7; const w = rentWeek(L, Math.floor(L.paidTo / 7));
   if (w.paid) { this.pay(`rent-in:${L.homeId}:${L.paidTo}`, L.tenant.rent, `Rent from ${L.tenant.name}`); L.paid = (L.paid ?? 0) + 1; g.life?.selfWork('landlord', `rent:${L.homeId}:${L.paidTo}`, `${L.tenant.name} paid ${naira(L.tenant.rent)} rent`, { prof: 1, business: 1 }); } else { L.arrears = (L.arrears ?? 0) + L.tenant.rent; g.life?.note(`arrears:${L.homeId}:${L.paidTo}`, `${L.tenant.name} didn't pay this week's rent`, { business: -0.5 }); }
   if (w.repair && g.economy.canAfford(w.repair)) this.pay(`repair:${L.homeId}:${L.paidTo}`, -w.repair, `Repairs at your let home (${L.label})`); }
  for (const b of V.builds) if (b.stage < BUILD.stages.length && b.working && d >= b.readyDay) { b.stage++; b.working = false; if (b.stage === BUILD.stages.length) { b.done = d; g.life?.selfWork('developer', `built:${b.id}`, `Finished a building (${Math.round(b.area)} m²)`, { prof: 3, business: 2, public: 1 }); g.ui?.toast?.('Your building is finished. Sell it or let it (phone: Ventures).', 6000); } }
  for (const b of V.builds) if (b.let && d - b.let.paidTo >= 7) { b.let.paidTo += 7; this.pay(`build-rent:${b.id}:${b.let.paidTo}`, b.rentWeek, `Rent: your building (${b.let.name})`); g.life?.selfWork('landlord', `brent:${b.id}:${b.let.paidTo}`, `Rent from your building: ${naira(b.rentWeek)}`, { prof: 1, business: 1 }); }
  // the security company: nights at each client, the weekly fees and the daily wages
  const S = V.security; if (S) { const posted = S.clients.reduce((a, c) => a + c.guards, 0);
   for (const c of S.clients) { const n = securityNight(hash(`sec:${c.id}:${d}`), c.guards, S.training); if (n.attempt) { if (n.stopped) g.life?.selfWork('security', `sec-stop:${c.id}:${d}`, `Your guards stopped a break-in at ${c.label}`, { prof: 3, public: 1, business: 1 }); else { c.lost = (c.lost ?? 0) + 1; g.life?.note(`sec-lost:${c.id}:${d}`, `A break-in at ${c.label} got past your guards`, { business: -2, prof: { security: -3 } }); if (c.lost >= 2) { S.clients = S.clients.filter((x) => x !== c); g.ui?.toast?.(`${c.label} ended its contract after two break-ins.`, 5000); } } } }
   if (weekdayOf(d) === 0) for (const c of S.clients) { this.pay(`sec-fee:${c.id}:${d}`, c.feeWeek, `Security fee: ${c.label}`); g.life?.selfWork('security', `sec-week:${c.id}:${d}`, `${c.label} paid ${naira(c.feeWeek)} for the week`, { prof: 1, business: 1 }); }
   if (S.guards) { const w = S.guards * SECURITY.wage; if (g.economy.canAfford(w)) this.pay(`sec-wages:${d}`, -w, `Security: wages for ${S.guards} guards`); else { S.guards = Math.max(posted ? posted - 1 : 0, S.guards - 1); g.ui?.toast?.('A guard left: wages unpaid.', 4000); } } }
  // the crew's rivals push back a little every day
  const K = V.crew; if (K) for (const t of TURF) { K.turf[t.id] = Math.max(0, (K.turf[t.id] ?? 0) - 1); }
  // football: the league round each Saturday (your match, if you played it, is already in)
  if (weekdayOf(d - 1) === 5) this.leagueRound(d - 1);
  if (weekdayOf(d - 1) === 5) this.youthRound(d - 1);
 }

 // ── event planner ───────────────────────────────────────────────────────────────────────────────
 eventView() {
  const g = this.g, V = this.V, opts = [];
  for (const e of V.events.filter((x) => !x.done)) opts.push({ label: `${e.label} for ${e.client} · day ${e.day}`, sub: e.day === this.today ? `Today 12:00–18:00 at ${e.area}: go there and run it` : `Booked: ${e.guests} guests at ${e.area}`, act: () => this.g.closeOverlay?.('phone') ?? null });
  if (V.events.filter((x) => !x.done).length < 2) for (const o of eventOffers(this.today).filter((o) => !V.events.some((e) => e.id === o.id))) opts.push({ label: `${o.label} · budget ${naira(o.budget)}`, sub: `${o.client} · ${o.guests} guests · day ${o.day}`, act: () => g.openChoice(() => this.supplyView(o, { venue: 1, food: 1, music: 1 })) });
  opts.push({ label: 'Back', ghost: true, act: () => g.closeChoice() });
  return { title: 'Event planning', kicker: 'BOOKINGS', text: 'Choose a booking, hire the venue, food and music (you pay them now; the client pays you the budget on the day), then run the day.', options: opts };
 }
 supplyView(o, pick) {
  const g = this.g, cost = eventCost(o.guests, pick), cycle = (k) => () => { const p = { ...pick, [k]: (pick[k] + 1) % 3 }; g.openChoice(() => this.supplyView(o, p)); };
  return { title: `${o.label} for ${o.client}`, kicker: `${o.guests} GUESTS · BUDGET ${naira(o.budget)}`, text: `Suppliers cost ${naira(cost)}: you keep what's left of the budget (more if they're delighted, less if not).`, options: [
   ...['venue', 'food', 'music'].map((k) => ({ label: `${k[0].toUpperCase() + k.slice(1)}: ${SUPPLY[k][pick[k]].label}`, sub: 'Tap to change', act: cycle(k) })),
   { label: `Book it · pay suppliers ${naira(cost)}`, primary: true, disabled: !g.economy.canAfford(cost) || cost > o.budget * 1.2, why: cost > o.budget * 1.2 ? 'Far over budget' : 'Not enough money', act: () => this.bookEvent(o, pick) },
   { label: 'Back', ghost: true, act: () => g.openChoice(() => this.eventView()) }] };
 }
 bookEvent(o, pick) {
  const g = this.g, V = this.V, cost = eventCost(o.guests, pick), tx = this.pay(`event-suppliers:${o.id}`, -cost, `Event suppliers: ${o.label} (${o.client})`); if (tx?.ok === false) return false;
  const sp = this.spotNear(DISTRICTS[hash(o.id) % DISTRICTS.length], hash(o.id), 40); V.events.push({ ...o, pick, cost, x: sp.x, z: sp.z, area: sp.area, done: false });
  g.closeChoice(); g.ui.toast(`Booked. On day ${o.day}, 12:00–18:00, run it at ${sp.area} (on your map).`, 6000); g.saveGame(); this.refresh(); return true;
 }
 runEventView(e) {
  const g = this.g, h = g.clock.minutes / 60; if (e.day !== this.today || h < 12 || h >= 18) return { title: e.label, text: `This is on day ${e.day}, 12:00–18:00.`, options: [{ label: 'OK', act: () => g.closeChoice() }] };
  const r = hash(e.id) % 3, problem = [['The generator cuts out during the toasts.', 'Switch to the backup generator you arranged and keep the MC talking', 'Wait for NEPA to bring light'], ['Rain starts an hour in.', 'Move the guests under the extra canopies and turn up the music', 'Tell everyone to go home'], ['The caterer is an hour late.', 'Serve the small chops early and call the caterer\'s backup', 'Do nothing and hope']][r];
  return { title: `${e.label} for ${e.client}`, kicker: 'THE DAY ITSELF', text: problem[0], options: [{ label: problem[1], act: () => this.finishEvent(e, true) }, { label: problem[2], act: () => this.finishEvent(e, false) }] };
 }
 finishEvent(e, handled) {
  const g = this.g, res = eventResult(e, e.pick, handled); e.done = true; g.closeChoice(); g.skipTime(240); g.needs.adjust({ energy: -20, social: 15 });
  this.pay(`event-paid:${e.id}`, res.paid, `Event fee: ${e.label} (${e.client})`); g.life.selfWork('planner', `event:${e.id}`, `Ran ${e.client}'s ${e.label.toLowerCase()}: ${res.grade} · ${naira(res.profit)} profit`, { prof: res.score >= 0 ? 3 : -1, business: res.profit > 0 ? 2 : -1, public: 1 });
  g.news?.add('events', `${e.label} at ${e.area}`, `${e.client}'s ${e.label.toLowerCase()} drew ${e.guests} guests: ${res.grade}.`);
  g.ui.toast(`${res.grade[0].toUpperCase() + res.grade.slice(1)}. Paid ${naira(res.paid)} (suppliers cost ${naira(res.cost)}).`, 6000); g.saveGame(); this.refresh(); return res;
 }

 // ── interior decorator ─────────────────────────────────────────────────────────────────────────
 decorView() {
  const g = this.g, V = this.V, opts = [];
  for (const d of V.decor.filter((x) => !x.done)) opts.push({ label: `${d.client}: a ${d.style} ${d.room}`, sub: 'Go to their house (marked) and decorate', disabled: true, why: 'Go there' });
  if (!V.decor.some((x) => !x.done)) for (const b of decorBriefs(this.today).filter((b) => !V.decor.some((x) => x.id === b.id))) opts.push({ label: `${b.client}: a ${b.style} ${b.room}`, sub: `Budget ${naira(b.budget)} (their money) · your fee up to ${naira(Math.round(b.fee * 1.2))}`, act: () => this.takeDecor(b) });
  opts.push({ label: 'Back', ghost: true, act: () => g.closeChoice() });
  return { title: 'Interior decorating', kicker: 'BRIEFS', text: 'Pick a brief. At the client\'s house you choose three pieces: match their style and stay in budget.', options: opts };
 }
 takeDecor(b) {
  const g = this.g, V = this.V, L = g.world.landmarks.get(DISTRICTS[hash(b.id) % DISTRICTS.length]) ?? g.world.landmarks.list[0];
  const h = pickHostHome(g.world.map, L.x, L.z, { seed: b.id, doorOk: (d) => g.world.collision.isFree(d.stand.x, d.stand.z, 0.4) });
  const x = h?.door.stand.x ?? L.x, z = h?.door.stand.z ?? L.z; V.decor.push({ ...b, x, z, done: false, picks: [] }); g.closeChoice(); g.ui.toast(`${b.client}'s house is marked on your map.`, 5000); g.saveGame(); this.refresh(); return true;
 }
 decorPickView(d) {
  const g = this.g, chosen = d.picks.map((id) => DECOR_ITEMS.find((x) => x.id === id).label);
  if (d.picks.length >= 3) { const s = decorScore(d, d.picks); return { title: `${d.client}'s ${d.room}`, kicker: 'DONE', text: `${chosen.join(', ')}: ${naira(s.cost)} of their ${naira(d.budget)}. ${s.grade[0].toUpperCase() + s.grade.slice(1)}.`, options: [{ label: `Hand over · fee ${naira(s.fee)}`, primary: true, act: () => this.finishDecor(d, s) }] }; }
  return { title: `${d.client}'s ${d.room}`, kicker: `THEY WANT IT ${d.style.toUpperCase()} · PIECE ${d.picks.length + 1} OF 3`, text: chosen.length ? `So far: ${chosen.join(', ')}.` : 'Choose the pieces.', options: DECOR_ITEMS.filter((x) => !d.picks.includes(x.id)).map((x) => ({ label: `${x.label} · ${naira(x.price)}`, sub: x.tags.join(', '), act: () => { d.picks.push(x.id); g.openChoice(() => this.decorPickView(d)); } })) };
 }
 finishDecor(d, s) { const g = this.g; d.done = true; g.closeChoice(); g.skipTime(180); g.needs.adjust({ energy: -15 }); this.pay(`decor-fee:${d.id}`, s.fee, `Decorating fee: ${d.client}`); g.life.selfWork('decorator', `decor:${d.id}`, `Decorated ${d.client}'s ${d.room}: ${s.grade}`, { prof: s.match >= 2 && !s.over ? 3 : -1, business: 1 }); g.ui.toast(`${d.client}: "${s.match === 3 ? 'It\'s beautiful!' : s.over ? 'This cost too much.' : 'It\'s nice, thank you.'}" Fee ${naira(s.fee)}.`, 5000); g.saveGame(); this.refresh(); }

 // ── tech agency ─────────────────────────────────────────────────────────────────────────────────
 agencyView() {
  const g = this.g, V = this.V, A = V.agency, opts = [];
  if (!A) { opts.push({ label: `Register a tech agency · ${naira(AGENCY.found)}`, sub: 'Coding helps; a laptop is needed', disabled: !g.economy.canAfford(AGENCY.found) || !g.inventory.has('laptop'), why: !g.inventory.has('laptop') ? 'You need a laptop' : 'Not enough money', act: () => { this.pay('agency-found', -AGENCY.found, 'Registered a tech agency'); V.agency = { name: `${g.saveData.character.name.split(' ')[0]} Digital`, staff: 0, briefs: [], delivered: 0, workedDay: 0 }; g.life.selfWork('agency', 'agency-found', 'Registered a tech agency', { business: 2 }); g.saveGame(); g.openChoice(() => this.agencyView()); } }); }
  else {
   for (const b of A.briefs) opts.push({ label: `${b.label} for ${b.client}${b.done ? (b.done === 'cancelled' ? ' · cancelled' : ' · delivered') : ''}`, sub: b.done ? '' : `${Math.round((100 * b.progress) / b.effort)}% · due day ${b.due} · ${naira(b.fee)}`, disabled: true, why: '' });
   opts.push({ label: 'Work on the briefs today (3 hours)', sub: `With your laptop · coding ${g.skills.level('coding')}`, disabled: A.workedDay === this.today || !A.briefs.some((b) => !b.done) || !g.inventory.has('laptop'), why: A.workedDay === this.today ? 'Done for today' : 'No briefs', act: () => { A.workedDay = this.today; g.closeChoice(); g.skipTime(180); g.skills.add('coding', 30); g.needs.adjust({ energy: -12 }); g.saveGame(); g.ui.toast('Good progress. It counts at the end of the day.'); } });
   if (A.staff < AGENCY.maxStaff) opts.push({ label: `Hire a developer · ${naira(AGENCY.wage)} a day`, sub: `${A.staff} on staff · each adds effort every day`, act: () => { A.staff++; g.saveGame(); g.openChoice(() => this.agencyView()); } });
   if (A.staff) opts.push({ label: 'Let a developer go', ghost: true, act: () => { A.staff--; g.saveGame(); g.openChoice(() => this.agencyView()); } });
   if (A.briefs.filter((b) => !b.done).length < AGENCY.maxBriefs) for (const b of agencyBriefs(this.today).filter((b) => !A.briefs.some((x) => x.id === b.id))) opts.push({ label: `Take: ${b.label} for ${b.client} · ${naira(b.fee)}`, sub: `About ${b.effort} days of one developer · due in ${b.days} days`, act: () => { A.briefs.push({ ...b, progress: 0, due: this.today + b.days, done: false }); g.saveGame(); g.openChoice(() => this.agencyView()); } });
  }
  opts.push({ label: 'Back', ghost: true, act: () => g.closeChoice() });
  return { title: A?.name ?? 'Tech agency', kicker: 'TECH AGENCY', text: A ? `${A.delivered} projects delivered. Wages are paid daily.` : 'Start your own agency.', options: opts };
 }
 deliver(b, d) { const g = this.g, A = this.V.agency, late = d > b.due, fee = Math.round((b.fee * (late ? 0.7 : 1)) / 50) * 50; b.done = 'delivered'; b.doneDay = d; A.delivered++; this.pay(`agency-paid:${b.id}`, fee, `Agency: ${b.client} paid for the ${b.label.toLowerCase()}`); g.life?.selfWork('agency', `deliver:${b.id}`, `Delivered ${b.client}'s ${b.label.toLowerCase()}${late ? ' (late)' : ''} · ${naira(fee)}`, { prof: late ? 0 : 3, business: 2 }); g.news?.add('business', `${b.client} goes digital`, `${A.name} delivered a new ${b.label.toLowerCase()} for ${b.client}.`); }

 // ── landlord and developer ─────────────────────────────────────────────────────────────────────
 ownedHomes() { const g = this.g, H = g.homes?.housing; if (!H) return []; return Object.keys(H.state.owned ?? {}).map((id) => H.get(id)).filter(Boolean); }
 isLet(homeId) { return !!this.V?.lets?.[homeId]; }
 landlordView() {
  const g = this.g, V = this.V, opts = [];
  for (const h of this.ownedHomes()) { const L = V.lets[h.id];
   if (L) { opts.push({ label: `${h.label}: let to ${L.tenant.name}`, sub: `${naira(L.tenant.rent)} a week · ${L.paid ?? 0} paid${L.arrears ? ` · arrears ${naira(L.arrears)}` : ''}`, disabled: true, why: '' }); opts.push({ label: `Give ${L.tenant.name} notice (end the let)`, ghost: true, act: () => { delete V.lets[h.id]; g.saveGame(); g.openChoice(() => this.landlordView()); } }); }
   else { const base = Math.round(((h.rent ?? 100_000) / Math.max(1, h.days ?? 30)) * 7 * 1.1 / 50) * 50; for (const t of tenantsFor(h.id, base, this.today)) opts.push({ label: `Let ${h.label} to ${t.name} (${t.job})`, sub: `${naira(t.rent)} a week · ${Math.round(t.reliability * 100)}% likely to pay each week`, act: () => { V.lets[h.id] = { homeId: h.id, label: h.label, tenant: t, since: this.today, paidTo: this.today }; g.life.selfWork('landlord', `let:${h.id}:${this.today}`, `Let ${h.label} to ${t.name}`, { business: 1 }); g.saveGame(); g.openChoice(() => this.landlordView()); } }); }
  }
  for (const b of this.V.builds.filter((b) => b.done && !b.sold)) { if (!b.let) { opts.push({ label: `Sell your finished building · ${naira(b.sale)}`, sub: `${Math.round(b.area)} m²`, act: () => this.sellBuild(b) }); opts.push({ label: `Let your finished building · ${naira(b.rentWeek)} a week`, sub: 'To a business tenant', act: () => { b.let = { name: personName(hash(b.id)), paidTo: this.today }; g.saveGame(); g.openChoice(() => this.landlordView()); } }); } else opts.push({ label: `Your building: let to ${b.let.name}`, sub: `${naira(b.rentWeek)} a week`, disabled: true, why: '' }); }
  if (!opts.length) opts.push({ label: 'You don\'t own a home yet', sub: 'Buy one (phone: Cars & homes), or develop an unfinished building', disabled: true, why: '' });
  opts.push({ label: 'Back', ghost: true, act: () => g.closeChoice() });
  return { title: 'Your property', kicker: 'LANDLORD', text: 'A home you let is your tenant\'s: you can\'t live in it while it\'s let. Rent comes in weekly (when they pay).', options: opts };
 }
 unfinishedNear(max = 400) { const g = this.g, p = g.player.position, out = []; for (const ch of g.world.city.chunks.values()) for (const it of ch.items ?? []) { if (it.plan?.type !== 'unfinished') continue; const b = it.b, cx = b.pts.reduce((a, q) => a + q[0], 0) / b.pts.length, cz = b.pts.reduce((a, q) => a + q[1], 0) / b.pts.length, d = Math.hypot(cx - p.x, cz - p.z); if (d > max) continue; let area = 0; for (let i = 0; i < b.pts.length; i++) { const a = b.pts[i], q = b.pts[(i + 1) % b.pts.length]; area += a[0] * q[1] - q[0] * a[1]; } out.push({ id: String(b.id), x: cx, z: cz, d, area: Math.abs(area) / 2, pts: b.pts }); } return out.sort((a, b) => a.d - b.d).slice(0, 4); }
 developView() {
  const g = this.g, V = this.V, opts = [];
  for (const b of V.builds.filter((x) => !x.sold)) { if (b.done) { opts.push({ label: `Building finished (${Math.round(b.area)} m²)`, sub: 'Sell or let it under Landlord', disabled: true, why: '' }); continue; } const s = BUILD.stages[b.stage], cost = Math.round((b.works * s.share) / 50) * 50; opts.push({ label: b.working ? `${s.label}: in progress` : `${s.label} · ${naira(cost)}`, sub: b.working ? `Ready on day ${b.readyDay}` : `${s.days} days of work`, disabled: b.working || !g.economy.canAfford(cost), why: b.working ? 'The builders are on it' : 'Not enough money', act: () => { this.pay(`build-stage:${b.id}:${b.stage}`, -cost, `Building works: ${s.label.toLowerCase()}`); b.working = true; b.readyDay = this.today + s.days; g.saveGame(); g.openChoice(() => this.developView()); } }); opts.push({ label: 'Show me the site', act: () => { g.closeChoice(); g.setWaypoint?.({ x: b.x, z: b.z, name: 'Your building site', radius: 10, custom: true }); } }); }
  if (V.builds.filter((x) => !x.done).length < 2) for (const u of this.unfinishedNear().filter((u) => !V.builds.some((b) => b.id === u.id))) { const c = buildCosts(u.area); opts.push({ label: `Buy the unfinished building ${Math.round(u.d)} m away · ${naira(c.land)}`, sub: `${Math.round(u.area)} m² · works about ${naira(c.works)} · sells for about ${naira(c.sale)}`, disabled: !g.economy.canAfford(c.land), why: 'Not enough money', act: () => { this.pay(`build-land:${u.id}`, -c.land, `Bought an unfinished building (${Math.round(u.area)} m²)`); V.builds.push({ id: u.id, x: u.x, z: u.z, area: u.area, pts: u.pts, stage: 0, works: c.works, sale: c.sale, rentWeek: c.rentWeek, working: false, bought: this.today }); g.saveGame(); this.refresh(); g.openChoice(() => this.developView()); } }); }
  opts.push({ label: 'Back', ghost: true, act: () => g.closeChoice() });
  return { title: 'Property development', kicker: 'DEVELOPER', text: 'Buy one of the city\'s unfinished buildings, pay for each stage, and it\'s finished in front of you.', options: opts };
 }
 sellBuild(b) { const g = this.g; b.sold = this.today; this.pay(`build-sale:${b.id}`, b.sale, `Sold the premises you built (${Math.round(b.area)} m²)`); g.life.selfWork('developer', `sold:${b.id}`, `Sold a finished building for ${naira(b.sale)}`, { prof: 2, business: 3 }); g.news?.add('business', 'New building sold', `A newly finished ${Math.round(b.area)} m² building changed hands for ${naira(b.sale)}.`); g.saveGame(); g.openChoice(() => this.landlordView()); }

 // ── roadside mechanic ───────────────────────────────────────────────────────────────────────────
 calloutView() {
  const g = this.g, V = this.V, c = V.callout, kit = g.inventory.has('inspection-kit'), n = V.done.callouts?.[this.today] ?? 0;
  const opts = c ? [{ label: `${c.owner}'s car`, sub: 'Marked on your map: go there and look at it', act: () => { g.closeChoice(); g.setWaypoint?.({ x: c.x, z: c.z, name: `${c.owner}'s car`, radius: 8, custom: true }); } }, { label: 'Cancel the call-out', ghost: true, act: () => { V.callout = null; g.saveGame(); this.refresh(); g.closeChoice(); } }]
   : [{ label: 'Take a call-out', sub: kit ? `${3 - n} left today` : 'You need an inspection kit (equipment desks)', disabled: !kit || n >= 3, why: !kit ? 'No inspection kit' : 'Enough for today', act: () => this.takeCallout() }];
  opts.push({ label: 'Back', ghost: true, act: () => g.closeChoice() });
  return { title: 'Roadside call-outs', kicker: 'MECHANIC', text: 'Drivers whose cars have broken down call you. Get there, find the fault, fix it.', options: opts };
 }
 takeCallout() {
  const g = this.g, V = this.V, n = (V.done.callouts ??= {})[this.today] ?? 0, co = calloutFor(this.today, n), p = g.player.position, a = (hash(co.id) % 360) * Math.PI / 180;
  let x = p.x + Math.cos(a) * 140, z = p.z + Math.sin(a) * 140; const nr = streetReference(g.world.map, x, z); if (nr && nr.dist > 0.5) { const k = (nr.road.width / 2 + 2.2) / nr.dist; x = nr.px + (x - nr.px) * k; z = nr.pz + (z - nr.pz) * k; } // at the side of a real road try { [x, z] = g.world.findFreeSpot(x, z, 2.6); } catch { /* keep */ }
  V.callout = { ...co, x, z }; g.closeChoice(); g.setWaypoint?.({ x, z, name: `${co.owner}'s car`, radius: 8, custom: true }); g.ui.toast(`${co.owner}: "My car don die for road!" It's marked on your map.`, 5000); g.saveGame(); this.refresh(); return V.callout;
 }
 repairView() { const g = this.g, c = this.V.callout; if (!c) return null; const F = FAULTS.find((f) => f.id === c.fault), opts = [[F.fix, true], ...F.wrong.map((w) => [w, false])].sort((x, y) => hash(x[0] + c.id) - hash(y[0] + c.id)); return { title: `${c.owner}'s car`, kicker: 'ROADSIDE REPAIR', text: F.symptom, options: opts.map(([t, ok]) => ({ label: t, act: () => this.repair(ok) })) }; }
 repair(ok) { const g = this.g, V = this.V, c = V.callout; if (!c) return; V.callout = null; if (g.waypoint?.name === `${c.owner}'s car`) g.setWaypoint(null); V.done.callouts[this.today] = (V.done.callouts[this.today] ?? 0) + 1; g.closeChoice(); g.skipTime(ok ? 45 : 70); g.skills.add('hustle', ok ? 25 : 8);
  if (ok) { this.pay(`callout:${c.id}`, c.pay, `Job: roadside repair for ${c.owner}`); g.life.selfWork('roadside', `callout:${c.id}`, `Fixed ${c.owner}'s car at the roadside · ${naira(c.pay)}`, { prof: 2, public: 0.5 }); g.ui.toast(`Fixed. ${c.owner} paid ${naira(c.pay)}.`); } else { g.life.note(`callout-miss:${c.id}`, `Couldn't fix ${c.owner}'s car`, { prof: { roadside: -2 } }); g.ui.toast(`That wasn't it. ${c.owner} called someone else.`); }
  g.saveGame(); this.refresh(); }

 // ── security company ────────────────────────────────────────────────────────────────────────────
 securityView() {
  const g = this.g, V = this.V, S = V.security, opts = [];
  if (!S) opts.push({ label: `Register a security company · ${naira(SECURITY.licence)}`, sub: 'Licence and uniforms', disabled: !g.economy.canAfford(SECURITY.licence), why: 'Not enough money', act: () => { this.pay('security-licence', -SECURITY.licence, 'Registered a security company'); V.security = { name: `${g.saveData.character.name.split(' ')[0]} Guards`, guards: 0, training: 0, clients: [], own: [] }; g.life.selfWork('security', 'sec-found', 'Registered a security company', { business: 2 }); g.saveGame(); g.openChoice(() => this.securityView()); } });
  else {
   const posted = S.clients.reduce((a, c) => a + c.guards, 0) + S.own.length, free = S.guards - posted;
   opts.push({ label: `${S.guards} guards · ${free} free · training level ${S.training}`, sub: `Wages ${naira(S.guards * SECURITY.wage)} a day`, disabled: true, why: '' });
   if (S.guards < SECURITY.maxGuards) opts.push({ label: `Hire a guard · ${naira(SECURITY.wage)} a day`, act: () => { S.guards++; g.saveGame(); g.openChoice(() => this.securityView()); } });
   if (free > 0) opts.push({ label: 'Let a guard go', ghost: true, act: () => { S.guards--; g.saveGame(); g.openChoice(() => this.securityView()); } });
   if (S.training < 5) opts.push({ label: `Train your guards · ${naira(SECURITY.trainCost * Math.max(1, S.guards))}`, sub: 'Better at stopping break-ins', disabled: !S.guards || !g.economy.canAfford(SECURITY.trainCost * S.guards), why: 'Hire guards first, or not enough money', act: () => { this.pay(`sec-train:${this.today}:${S.training}`, -SECURITY.trainCost * S.guards, 'Security: guard training'); S.training++; g.saveGame(); g.openChoice(() => this.securityView()); } });
   for (const c of S.clients) opts.push({ label: `Client: ${c.label}`, sub: `${c.guards} guard${c.guards > 1 ? 's' : ''} · ${naira(c.feeWeek)} a week (paid Mondays)`, act: () => { S.clients = S.clients.filter((x) => x !== c); g.saveGame(); g.openChoice(() => this.securityView()); } });
   for (const c of SECURITY_CLIENTS.filter((c) => !S.clients.some((x) => x.id === c.id))) opts.push({ label: `Take on: ${c.label}`, sub: `Needs ${c.guards} free guard${c.guards > 1 ? 's' : ''} · ${naira(c.feeWeek)} a week`, disabled: free < c.guards, why: 'Not enough free guards', act: () => { S.clients.push({ ...c, since: this.today }); g.saveGame(); g.openChoice(() => this.securityView()); } });
   for (const org of g.business?.orgs?.list ?? []) { const pr = g.business.premisesOf(org); if (!pr) continue; const on = S.own.includes(org.id); opts.push({ label: `${on ? 'Guarding' : 'Guard'} your own ${org.name}`, sub: on ? 'Tap to stand the guard down' : 'A guard at the door (no fee)', disabled: !on && free < 1, why: 'No free guard', act: () => { S.own = on ? S.own.filter((x) => x !== org.id) : [...S.own, org.id]; g.saveGame(); this.refresh(); g.openChoice(() => this.securityView()); } }); }
  }
  opts.push({ label: 'Back', ghost: true, act: () => g.closeChoice() });
  return { title: S?.name ?? 'Security company', kicker: 'SECURITY', text: 'Clients pay weekly; guards are paid daily. Well-trained guards stop more break-ins; two break-ins and a client leaves.', options: opts };
 }

 // ── street crew (abstract) ──────────────────────────────────────────────────────────────────────
 crewView() {
  const g = this.g, V = this.V, K = V.crew, opts = [];
  if (!K) opts.push({ label: 'Start a crew · ₦20,000', sub: 'Five boys from the area, a name, a corner', disabled: !g.economy.canAfford(20_000), why: 'Not enough money', act: () => { this.pay('crew-found', -20_000, 'Started a street crew'); V.crew = { name: `${g.saveData.character.name.split(' ')[0]}'s Boys`, members: 5, turf: {}, rival: {}, done: {} }; g.life.selfWork('crew', 'crew-found', 'Started a street crew', { notoriety: 2 }); g.saveGame(); g.openChoice(() => this.crewView()); } });
  else {
   for (const t of TURF) { const here = this.near(g.world.landmarks.get(t.id)?.x ?? 0, g.world.landmarks.get(t.id)?.z ?? 0, 90), rv = RIVALS[hash(t.id) % RIVALS.length], inf = K.turf[t.id] ?? 0, theirs = Math.max(0, 50 - inf);
    opts.push({ label: `${t.label}: you ${inf} · ${rv.name} ${theirs}`, sub: here ? 'You are here' : 'Go there to work it', disabled: true, why: '' });
    if (here) for (const [k, J] of Object.entries(CREW_JOBS)) opts.push({ label: `${J.label}${J.crime ? ' (a crime)' : ''}`, sub: `${J.pay ? naira(J.pay) + ' · ' : ''}+${J.influence} influence${J.crime ? ' · the police can open a case' : ''}`, disabled: K.done[`${t.id}:${k}`] === this.today, why: 'Done here today', act: () => this.crewJob(t, k) });
    if (here && theirs > 10) opts.push({ label: `Talk peace with the ${rv.name}`, sub: `Charisma ${g.skills.level('charisma')}: share the turf instead of fighting over it`, disabled: K.rival[rv.id] === this.today, why: 'Already talked today', act: () => this.crewPeace(t, rv) }); }
   opts.push({ label: 'Disband the crew', ghost: true, act: () => { V.crew = null; g.saveGame(); g.closeChoice(); } });
  }
  opts.push({ label: 'Back', ghost: true, act: () => g.closeChoice() });
  return { title: K?.name ?? 'Street crew', kicker: 'STREET CREW · ADULTS', text: 'Influence fades every day you don\'t work a place. Rivals hold what you don\'t. No fighting here: talk, or lose ground.', options: opts };
 }
 crewJob(t, k) {
  const g = this.g, K = this.V.crew, J = CREW_JOBS[k]; K.done[`${t.id}:${k}`] = this.today; K.turf[t.id] = Math.min(100, (K.turf[t.id] ?? 0) + J.influence * (1 + K.members / 10)); g.skipTime(120); g.needs.adjust({ energy: -10, social: 6 });
  if (J.pay) this.pay(`crew:${t.id}:${k}:${this.today}`, J.pay, k === 'levy' ? `Robbery proceeds: "levy" at ${t.label}` : `Hustle: loading fees at ${t.label}`);
  if (J.crime && g.justice?.ready) g.justice.cases.open({ agency: 'police', offence: `Extortion of traders (${t.label})`, severity: 2, evidence: J.evidence, day: this.today, ref: `crew:levy:${t.id}:${this.today}`, amount: J.pay });
  g.life.selfWork('crew', `crew:${t.id}:${k}:${this.today}`, `${J.label} at ${t.label}`, { prof: 2, public: J.public, ...(J.crime ? { integrity: -6 } : {}) });
  if (J.crime) g.life.note(`crew-crime:${t.id}:${this.today}`, `Your crew collected a "levy" at ${t.label}`, { integrity: -6, notoriety: 4 });
  g.saveGame(); g.openChoice(() => this.crewView());
 }
 crewPeace(t, rv) { const g = this.g, K = this.V.crew, ok = Math.random() < 0.35 + g.skills.level('charisma') * 0.07; K.rival[rv.id] = this.today; if (ok) { K.turf[t.id] = Math.min(100, (K.turf[t.id] ?? 0) + 10); g.life.selfWork('crew', `peace:${rv.id}:${this.today}`, `Made peace with the ${rv.name} at ${t.label}`, { prof: 2, public: 2 }); g.ui.toast(`The ${rv.name} agree to share ${t.label}.`); } else g.ui.toast(`The ${rv.name} won't talk today.`); g.saveGame(); g.openChoice(() => this.crewView()); }

 // ── football ────────────────────────────────────────────────────────────────────────────────────
 club() { return this.V.club; }
 footballView() {
  const g = this.g, V = this.V, F = V.club, Co = V.coach, opts = [], wd = weekdayOf(this.today), h = g.clock.minutes / 60, atPitch = this.atStadium(), w = this.week();
  if (!F) opts.push({ label: `Trial at ${CLUB.name}`, sub: `Fitness ${CLUB.trialFitness} or better (you: ${g.skills.level('fitness')})`, disabled: g.skills.level('fitness') < CLUB.trialFitness, why: 'Get fitter first (jogging, football)', act: () => { V.club = { signed: this.today, apps: 0, goals: 0, wins: 0, results: [], trained: {} }; g.life.selfWork('footballer', 'signed', `Signed for ${CLUB.name}`, { public: 2 }); g.news?.add('sport', `${CLUB.name} sign a new player`, `${g.saveData.character.name} joins the squad.`); g.saveGame(); g.openChoice(() => this.footballView()); } });
  else {
   const fx = fixtures(w).find((p) => p.includes(0)), opp = LEAGUE[fx[0] === 0 ? fx[1] : fx[0]], played = F.results.some((r) => r.week === w && (r.a === 0 || r.b === 0));
   opts.push({ label: `Train with the squad · ${naira(CLUB.trainPay)}`, sub: atPitch ? 'Two hours at the stadium, weekdays' : 'At the stadium, weekdays', disabled: !atPitch || wd > 4 || F.trained[this.today], why: !atPitch ? 'Go to the stadium' : F.trained[this.today] ? 'Trained today' : 'No training at weekends', act: () => { F.trained[this.today] = true; g.closeChoice(); g.skipTime(120); g.skills.add('fitness', 30); g.needs.adjust({ energy: -18 }); this.pay(`train:${this.today}`, CLUB.trainPay, `Job: training with ${CLUB.name}`); g.saveGame(); g.ui.toast('Good session.'); } });
   opts.push({ label: `League match vs ${opp}`, sub: played ? 'Played this week' : `Saturdays 10:00–18:00 at the stadium · ${naira(CLUB.appearance)} to play, ${naira(CLUB.winBonus)} for a win`, disabled: played || !atPitch || wd !== 5 || h < 10 || h >= 18, why: played ? 'Played' : 'Saturdays at the stadium', act: () => this.playLeague(opp) });
   opts.push({ label: 'League table', act: () => g.openChoice(() => this.tableView(F.results, CLUB.name)) });
  }
  if (!Co) opts.push({ label: `Coach ${CLUB.youth}`, sub: `Fitness ${CLUB.coachNeeds.fitness} and charisma ${CLUB.coachNeeds.charisma} · ${naira(CLUB.coachWeek)} a week`, disabled: g.skills.level('fitness') < CLUB.coachNeeds.fitness || g.skills.level('charisma') < CLUB.coachNeeds.charisma, why: 'Not experienced enough yet', act: () => { V.coach = { since: this.today, results: [], plan: {}, trained: {} }; g.life.selfWork('coach', 'coach-start', `Became coach of ${CLUB.youth}`, { public: 1 }); g.saveGame(); g.openChoice(() => this.footballView()); } });
  else { const plan = Co.plan[w]; opts.push({ label: `U-17s this Saturday: ${plan ? plan : 'pick the tactics'}`, sub: 'Attack, balanced or defend', act: () => g.openChoice(() => ({ title: 'Tactics for Saturday', options: ['attack', 'balanced', 'defend'].map((t) => ({ label: t[0].toUpperCase() + t.slice(1), act: () => { Co.plan[w] = t; g.saveGame(); g.openChoice(() => this.footballView()); } })) })) }); opts.push({ label: 'Run a youth training session', sub: 'Weekdays · makes the side stronger this week', disabled: Co.trained[this.today] || wd > 4, why: 'Once a day, weekdays', act: () => { Co.trained[this.today] = true; g.closeChoice(); g.skipTime(90); g.skills.add('charisma', 15); g.saveGame(); g.ui.toast('The boys worked hard.'); } }); opts.push({ label: 'U-17 league table', act: () => g.openChoice(() => this.tableView(Co.results, CLUB.youth)) }); }
  opts.push({ label: 'Back', ghost: true, act: () => g.closeChoice() });
  return { title: 'Football', kicker: CLUB.name.toUpperCase(), text: 'The Onitsha league: six sides, a round every Saturday.', options: opts };
 }
 atStadium() { const s = this.g.stadiumFootball?.spot; return !!s && this.near(s.x, s.z, 80); }
 playLeague(opp) { const g = this.g, F = this.V.club, i = g.stadiumFootball ? ['Fegge Rangers', 'Odoakpu Stars', 'Woliwo United', 'Okpoko Warriors', 'GRA Strikers'].indexOf(opp) : -1; F.pending = { week: this.week(), opp: LEAGUE.indexOf(opp) }; g.saveGame(); g.closeChoice(); return g.stadiumFootball?.startMatch({ ...g.stadiumFootball.opts, opp: Math.max(0, i) }, { format: '11', league: opp }); }
 /** Your league match finished in the football mini-game. */
 footballResult({ matchId, outcome, score }) { const F = this.V?.club, p = F?.pending; if (!p || p.week !== this.week()) return; F.pending = null; const fx = fixtures(p.week).find((x) => x.includes(0)), home = fx[0] === 0, s = home ? score : [score[1], score[0]];
  F.results.push({ week: p.week, a: fx[0], b: fx[1], s }); F.apps++; if (outcome === 'win') F.wins++; this.pay(`app:${p.week}`, CLUB.appearance, `Job: appearance fee, ${CLUB.name}`); if (outcome === 'win') this.pay(`win:${p.week}`, CLUB.winBonus, `Job: win bonus, ${CLUB.name}`);
  this.g.life.selfWork('footballer', `match:${p.week}`, `${CLUB.name} ${score[0]}–${score[1]} ${LEAGUE[p.opp]}`, { prof: outcome === 'win' ? 3 : 1, public: outcome === 'win' ? 1 : 0 }); this.g.news?.add('sport', `${CLUB.name} ${score[0]}–${score[1]} ${LEAGUE[p.opp]}`, outcome === 'win' ? `A win for ${CLUB.name}.` : outcome === 'draw' ? 'Honours even.' : `A defeat for ${CLUB.name}.`); this.g.saveGame(); }
 leagueRound(day) { const F = this.V.club; if (!F) return; const w = this.week(day); for (const [a, b] of fixtures(w)) { if (F.results.some((r) => r.week === w && r.a === a && r.b === b)) continue; if (a === 0 || b === 0) { F.results.push({ week: w, a, b, s: a === 0 ? [0, 3] : [3, 0], walkover: true }); continue; } F.results.push({ week: w, a, b, s: simMatch(60, 60, hash(`lg:${w}:${a}:${b}`)) }); } F.results = F.results.slice(-60); }
 youthRound(day) { const Co = this.V.coach, g = this.g; if (!Co) return; const w = this.week(day), tactic = Co.plan[w] ?? 'balanced', trained = Object.keys(Co.trained).filter((d) => this.week(+d) === w).length, rating = 50 + g.skills.level('charisma') * 2 + g.skills.level('fitness') + trained * 3;
  for (const [a, b] of fixtures(w)) { if (Co.results.some((r) => r.week === w && r.a === a && r.b === b)) continue; const mine = a === 0 || b === 0, s = mine ? (a === 0 ? simMatch(rating, 58, hash(`yt:${w}:${a}:${b}`), tactic) : simMatch(58, rating, hash(`yt:${w}:${a}:${b}`)).map((x) => x)) : simMatch(58, 58, hash(`yt:${w}:${a}:${b}`)); Co.results.push({ week: w, a, b, s }); if (mine) { const us = a === 0 ? s[0] : s[1], them = a === 0 ? s[1] : s[0]; this.pay(`coach-week:${w}`, CLUB.coachWeek, `Job: coaching, ${CLUB.youth}`); g.life?.selfWork('coach', `youth:${w}`, `U-17s ${us}–${them} ${LEAGUE[a === 0 ? b : a]}`, { prof: us > them ? 3 : us === them ? 1 : 0 }); } } Co.results = Co.results.slice(-60); }
 tableView(results, name) { const T = table(results); return { title: `${name}: league table`, kicker: 'P W D L GD PTS', text: T.map((t, i) => `${i + 1}. ${t.i === 0 ? name.replace(' Academy U-17', ' U-17') : t.name} · ${t.p} ${t.w} ${t.d} ${t.l} ${t.gf - t.ga >= 0 ? '+' : ''}${t.gf - t.ga} · ${t.pts}`).join('\n'), options: [{ label: 'Back', act: () => this.g.openChoice(() => this.footballView()) }] }; }

 // ── what you see in the city ───────────────────────────────────────────────────────────────────
 refresh() {
  const V = this.V, g = this.g; if (!V) return; for (const off of this.offs) off(); this.offs = [];
  const want = new Map();
  for (const e of V.events) if (!e.done && e.day === this.today) want.set('event:' + e.id, () => this.canopy(e));
  if (V.callout) want.set('callout:' + V.callout.id, () => this.brokenCar(V.callout));
  for (const b of V.builds) if (b.done && !b.sold) want.set('build:' + b.id, () => this.finished(b)); else if (!b.done && !b.sold) want.set('site:' + b.id + ':' + b.stage, () => this.siteBoard(b));
  for (const id of V.security?.own ?? []) { const org = g.business?.orgs?.list.find((o) => o.id === id), pr = org && g.business.premisesOf(org); if (pr) want.set('guard:' + id, () => this.guard(pr)); }
  for (const [k, m] of this.meshes) if (!want.has(k)) { m.parent?.remove(m); m.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); this.meshes.delete(k); }
  for (const [k, make] of want) if (!this.meshes.has(k)) { try { const m = make(); if (m) { this.group.add(m); this.meshes.set(k, m); } } catch (e) { console.warn('[ventures] could not show', k, e.message); } }
  // interactions at the places
  const reg = (x, z, label, fn, r = 3.5) => this.offs.push(g.interactions.register({ x, z, radius: r, priority: 2, enabled: () => !!g.saveData && !g.civic?.inside && !g.homes?.inside && !g.vehicles?.driving, label: () => label, onInteract: fn }));
  for (const e of V.events) if (!e.done && e.day === this.today) reg(e.x, e.z, `${e.client}'s ${e.label.toLowerCase()} — run the event`, () => g.openChoice(() => this.runEventView(e)), 8);
  for (const d of V.decor) if (!d.done) reg(d.x, d.z, `${d.client}'s house — decorate the ${d.room}`, () => g.openChoice(() => this.decorPickView(d)));
  if (V.callout) reg(V.callout.x, V.callout.z, `${V.callout.owner}'s car — take a look`, () => g.openChoice(() => this.repairView()), 4);
 }
 canopy(e) { const grp = new THREE.Group(), gb = new GeoBuilder(); grp.position.set(e.x, 0, e.z); for (const [x, z] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) gb.box(x, z, 0, 3.2, 0.12, 0.12, 0, C('#cfcfcf')); gb.box(0, 0, 3.2, 3.5, 10.6, 8.6, 0, C('#f6f2e8')); for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) { gb.box(-3.9 + c * 1.1, -2.4 + r * 1.4, 0.42, 0.48, 0.45, 0.45, 0, C(['#c0392b', '#f2c14e'][r % 2])); gb.box(-3.9 + c * 1.1, -2.2 + r * 1.4, 0.48, 1.0, 0.45, 0.06, 0, C(['#c0392b', '#f2c14e'][r % 2])); } gb.box(4.8, -3.6, 0, 1.4, 0.6, 0.6, 0, C('#1b1b1b')); gb.box(0, -3.8, 0, 0.8, 4, 0.9, 0, C('#f2ead8')); const m = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); m.castShadow = true; grp.add(m); grp.name = 'event-canopy'; return grp; }
 brokenCar(c) { let m; try { m = interactiveCar(vehicleBody('toyota_corolla'), '#8a8f93', VEHICLE_MODELS.toyota_corolla); } catch { const gb = new GeoBuilder(); gb.box(0, 0, 0.3, 1.4, 1.8, 4.2, 0, C('#8a8f93')); m = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true })); } m.position.set(c.x, 0, c.z); m.rotation.y = (hash(c.id) % 628) / 100; m.name = 'callout-car'; const tri = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.5, 3), new THREE.MeshStandardMaterial({ color: '#e74c3c', emissive: '#e74c3c', emissiveIntensity: 0.5 })); tri.position.set(0, 0.25, -3.4); m.add(tri); return m; }
 finished(b) { const xs = b.pts.map((p) => p[0]), zs = b.pts.map((p) => p[1]), minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs), w = maxX - minX + 0.4, d = maxZ - minZ + 0.4, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, gb = new GeoBuilder(), H = 6.6; gb.box(cx, cz, 0, H, w, d, 0, C('#efe4cf')); gb.box(cx, cz, H, H + 0.35, w + 0.6, d + 0.6, 0, C('#7a2a22')); for (let i = 0; i < Math.floor(w / 2.6); i++) for (const y of [1.4, 4.4]) for (const s of [-1, 1]) gb.box(minX + 1.4 + i * 2.6, cz + s * (d / 2 + 0.03), y, y + 1.3, 1.3, 0.06, 0, C('#41657c')); const m = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); m.castShadow = true; m.name = 'developed-building'; return m; }
 siteBoard(b) { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const c = cv.getContext('2d'); c.fillStyle = '#1d4f7a'; c.fillRect(0, 0, 512, 256); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '800 44px Arial'; c.fillText('PROPOSED BUILDING', 256, 80); c.font = '600 28px Arial'; c.fillText(`Developer: ${this.g.saveData.character.name}`, 256, 140); c.fillText(`Stage ${b.stage + 1} of ${BUILD.stages.length}${b.working ? ' · work in progress' : ''}`, 256, 190); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const grp = new THREE.Group(), m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, emissive: '#fff', emissiveMap: t, emissiveIntensity: 0.25 })); m.position.set(0, 2.2, 0); const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), new THREE.MeshStandardMaterial({ color: '#777' })); post.position.y = 1.1; grp.add(m, post); const xs = b.pts.map((p) => p[0]), zs = b.pts.map((p) => p[1]); grp.position.set((Math.min(...xs) + Math.max(...xs)) / 2, 0, Math.max(...zs) + 1.5); grp.name = 'site-board'; return grp; }
 guard(pr) { const app = { ...defaultAppearance('male'), outfit: 'shirt_trousers', color: 11, bottomColor: 11 }; const r = buildHuman(app); new CharacterAnimator(r).update(0, { speed: 0, grounded: true, turnRate: 0 }); const x = pr.x + 1.4, z = pr.z; r.group.position.set(x, 0, z); r.group.name = 'guard'; return r.group; }
}
