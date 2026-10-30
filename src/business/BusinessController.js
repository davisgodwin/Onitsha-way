import * as THREE from 'three';
import { pickStoreBuilding } from '../buy/HomeStores.js';
import { buildVenue, venueNear, venueDoor } from '../world/VenueArchitecture.js';
import { Economy, naira } from '../economy/Economy.js';
import { Bank, BANKS, BANK, ensureBank } from '../money/Bank.js';
import { Contracts, ensureContracts, CONTRACT } from './Contracts.js';
import { SHOP_TYPES, PRICE_LEVELS, TRANSPORT_DAY, BUSINESS, ensureOrgs, tradeHour, closeDay, stockCost, vehicleDay, candidate, isOpenAt } from './Business.js';
import { CATALOGUE_BY_ID } from '../data/VehicleCatalogue.js';
import { VEHICLE_MODELS, vehicleBody } from '../data/housing.js';
/**
 * v0.41: banks, premises, businesses and transport fleets in the city (stage 2 of the open-life redesign).
 * Money moves only through ledgers with unique keys (wallet, bank account, each business account, each contract's
 * escrow), so nothing is paid twice and nothing appears from nowhere. Trading is simulated hour by hour while the game
 * runs, and caught up (up to 48 hours) when you come back; wages, rent, takings and loan instalments once a day.
 */
const PREMISES = [
 { id: 'p-market-a', near: 'main-market', min: 150 }, { id: 'p-market-b', near: 'main-market', min: 240 },
 { id: 'p-ochanja', near: 'ochanja', min: 110 }, { id: 'p-iweka', near: 'upper-iweka', min: 230 },
 { id: 'p-bridgehead', near: 'bridgehead', min: 120 }, { id: 'p-fegge', near: 'fegge', min: 80 },
 { id: 'p-mall', near: 'shoprite', min: 160 }, { id: 'p-dunkofia', near: 'ike-dunkofia', min: 90 },
];
const BUSY = { market: 1.2, mall: 0.8, park: 0.7, interchange: 0.9, plaza: 0.6, bridgehead: 0.8 };
const REGISTER_FEE = 5000;
const r50 = (n) => Math.max(0, Math.round(n / 50) * 50);
const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length]; a += x1 * z2 - x2 * z1; } return Math.abs(a) / 2; };
export const COMMERCIAL_MODES = { keke: 'keke', minibus: 'minibus', cbus: 'cbus', bus: 'bus' };
export const modeOf = (model) => COMMERCIAL_MODES[vehicleBody(model)] ?? (model === 'keke' ? 'keke' : null);

export class BusinessController {
 constructor(g) { this.g = g; this.group = new THREE.Group(); this.group.name = 'Business'; this.branches = []; this.premises = []; this.signs = new Map(); }
 setup() {
  const g = this.g, w = g.world, taken = new Set([...g.homes.listings.map((h) => h.buildingId), ...(g.homeStores?.stores ?? []).map((s) => s.buildingId), ...(g.hospitals?.list ?? []).map((h) => h.buildingId)]);
  const avoid = w.landmarks.list.filter((l) => ['market', 'mall', 'interchange'].includes(l.kind)).map((l) => ({ x: l.x, z: l.z, r: (l.radius ?? 60) + 10 }));
  const pick = (def) => { const p = pickStoreBuilding(w.map, w.landmarks, def, taken, (x, z, r) => w.collision.isFree(x, z, r), avoid); if (p) taken.add(p.b.id); return p; };
  // v0.43: each bank has its own banking hall on a clear plot (in its colours, with an ATM); a borrowed shop building is
  // only the fallback if no plot fits nearby.
  const COLORS = { nkwo: ['#0f3d63', '#f2c14e'], bridgehead: ['#1d5b3a', '#ffffff'] }, near = [...(g.homeStores?.stores ?? []), ...(g.hospitals?.list ?? [])].map((s) => ({ x: s.door?.stand?.x ?? s.place?.x, z: s.door?.stand?.z ?? s.place?.z, r: 45 })).filter((q) => Number.isFinite(q.x));
  for (const [i, def] of BANKS.entries()) {
   const plot = venueNear(w, def.near, 'bank', { from: 50, avoid: [...near, ...this.branches.map((b) => ({ x: b.x, z: b.z, r: 100 }))], seed: i + 3 });
   if (plot) { const v = { id: `bank-${def.id}`, kind: 'bank', name: def.name, colors: COLORS[def.id], ...plot }; buildVenue(w, v, this.group); const d = venueDoor(v, 0, -6.9, 3.4); const br = { ...def, venue: true, door: d, x: d.stand.x, z: d.stand.z }; this.branches.push(br); g.interactions.register({ x: br.x, z: br.z, radius: 2.8, priority: 2, enabled: () => this.outside(), label: () => this.hallOpen() ? `${def.name} — go in` : `${def.name} — ATM (the banking hall opens at 8:00)`, onInteract: () => this.hallOpen() ? this.enterBank(br) : g.openChoice(() => this.bankView(br)) }); continue; }
   { const p = pick(def); if (!p) continue; const br = { ...def, buildingId: p.b.id, door: p.door, x: p.door.stand.x, z: p.door.stand.z }; this.branches.push(br); this.sign(br, def.name.toUpperCase(), 'ACCOUNTS · SAVINGS · LOANS', '#0f3d63', '#ffffff'); g.interactions.register({ x: br.x, z: br.z, radius: 2.4, priority: 2, enabled: () => this.outside(), label: () => `${def.name} — banking hall`, onInteract: () => g.openChoice(() => this.bankView(br)) }); }
  }
  for (const def of PREMISES) { const p = pick(def); if (!p) continue; const ft = this.footfall(p.door.stand.x, p.door.stand.z), a = area(p.b.pts), rent = r50(6000 + ft * 6000 + Math.min(a, 400) * 15); const pr = { ...def, buildingId: p.b.id, door: p.door, x: p.door.stand.x, z: p.door.stand.z, footfall: Math.round(ft * 100) / 100, rentWeek: rent, price: rent * 52, size: Math.round(a) }; this.premises.push(pr); g.interactions.register({ x: pr.x, z: pr.z, radius: 2.4, priority: 2, enabled: () => this.outside(), label: () => { const o = this.orgAt(pr); return o ? `${o.name} — manage your business` : `Shop to let · ${naira(pr.rentWeek)} a week`; }, onInteract: () => g.openChoice(() => this.premisesView(pr)) }); }
  g.renderer.scene.add(this.group);
  const on = (t, fn) => g.bus.on(t, (p) => { if (this.ready) try { fn(p); } catch (e) { console.error('[business]', t, e); } });
  on('clock:hour', () => this.tick()); on('clock:day', () => this.tick());
  on('vehicle:sold', (v) => { for (const o of this.orgs.list) for (const f of o.vehicles.filter((x) => x.vehicle === v.id)) { if (f.driver) { this.contracts.end(f.driver, g.clock.day, this.acct(o)); o.staff = o.staff.filter((x) => x !== f.driver); } o.vehicles = o.vehicles.filter((x) => x !== f); } });
 }
 outside() { const g = this.g; return !!g.saveData && !g.homes.inside && !g.vehicles.driving && !g.civic?.inside && !g.club?.inside && !g.story?.inside; }
 footfall(x, z) { let f = 0.45; for (const l of this.g.world.landmarks.list) { const w = BUSY[l.kind]; if (w) f += w * Math.exp(-Math.hypot(l.x - x, l.z - z) / 350); } return Math.max(0.4, Math.min(2.2, f)); }
 /** A painted signboard over a door (also used for a business's own name). */
 sign(at, title, sub, bg, fg) {
  this.signs.get(at.id)?.removeFromParent();
  const c = document.createElement('canvas'); c.width = 1024; c.height = 180; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 1024, 180); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 62px Arial'; x.fillText(title, 512, 72, 960); x.font = '600 34px Arial'; x.globalAlpha = 0.85; x.fillText(sub, 512, 138, 960);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const d = at.door;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.88), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.3 }));
  m.position.set(d.x + d.nx * 0.12, 3.2, d.z + d.nz * 0.12); m.rotation.y = Math.atan2(d.nx, d.nz); m.name = 'business-sign'; this.group.add(m); this.signs.set(at.id, m);
 }
 // ── state ────────────────────────────────────────────────────────────────────────────────────
 start(save) {
  const g = this.g; save.bank = ensureBank(save.bank); save.orgs = ensureOrgs(save.orgs); save.contracts = ensureContracts(save.contracts);
  this.save = save; this.orgs = save.orgs; this.contracts = new Contracts(save.contracts, { clock: g.clock });
  this.bank = new Bank(save.bank, { wallet: g.economy, bus: g.bus, clock: g.clock, ctx: { day: () => g.clock.day, income14: () => this.income14(), legalClean: () => g.life?.legal().clean !== false } });
  for (const pr of this.premises) { const o = this.orgAt(pr); if (o) this.sign(pr, o.name.toUpperCase(), SHOP_TYPES[o.type].label.toUpperCase(), '#7a1f1f', '#fff4d6'); else this.sign(pr, 'SHOP TO LET', `${naira(pr.rentWeek)} A WEEK · OR BUY`, '#f3e3b0', '#3a2a10'); }
  this.ready = true; this.tick(true);
 }
 acct(org) { return new Economy(org.account, { clock: this.g.clock }); }
 orgAt(pr) { return this.orgs?.list.find((o) => o.premises === pr.id) ?? null; }
 premisesOf(org) { return this.premises.find((p) => p.id === org.premises) ?? null; }
 absHour() { return this.g.clock.day * 24 + Math.floor(this.g.clock.minutes / 60); }
 income14() { const d = this.g.clock.day; return (this.save?.wallet.ledger ?? []).filter((e) => e.amount > 0 && (e.day ?? 0) >= d - 14 && !/Withdrawal|reversed|Escrow|returned|qa/i.test(e.reason ?? '')).reduce((s, e) => s + e.amount, 0); }
 staffOf(org) { return org.staff.map((id) => this.contracts.get(id)).filter((k) => k && k.status === 'active'); }
 log(org, text) { org.log.push({ day: this.g.clock.day, text }); if (org.log.length > 40) org.log.shift(); }
 // ── time ─────────────────────────────────────────────────────────────────────────────────────
 /** Run every hour and day that has passed (catch-up after time away is capped). */
 tick(loading = false) {
  if (!this.ready) return; const g = this.g, now = this.absHour(), day = g.clock.day;
  for (const org of this.orgs.list) {
   if (org.kind !== 'shop' || !org.premises) { org.lastHour = now; continue; }
   const from = Math.max((org.lastHour ?? now) + 1, now - BUSINESS.catchUpHours + 1);
   for (let h = from; h <= now; h++) this.hour(org, h, loading || h < now);
   org.lastHour = now;
  }
  const bankOut = this.bank.newDay(day, { repossess: (key) => this.repossess(key) });
  for (const e of bankOut) this.bankEvent(e);
  for (const org of this.orgs.list) { const from = Math.max((org.lastDay ?? day - 1) + 1, day - 7); for (let d = from; d <= day; d++) this.endOfDay(org, d - 1); org.lastDay = day; }
  if (!loading) this.bank.review();
 }
 hour(org, abs, away) {
  const g = this.g, pr = this.premisesOf(org); if (!pr) return;
  const p = g.player.position, present = !away && !g.vehicles.driving && !g.homes.inside && Math.hypot(p.x - pr.x, p.z - pr.z) < 25;
  const staff = this.staffOf(org).map((k) => k.meta);
  let seed = (abs * 2654435761) ^ org.id.length; const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const r = tradeHour(org, { hour: abs % 24, footfall: pr.footfall * (g.weather?.w?.rain > 0.3 ? 0.75 : 1), ownerPresent: present, staff, rng });
  const t = org.today ??= { day: Math.floor(abs / 24), customers: 0, served: 0, revenue: 0, missed: 0, skimmed: 0 };
  if (t.day !== Math.floor(abs / 24)) { org.prevDay = { ...t }; Object.assign(t, { day: Math.floor(abs / 24), customers: 0, served: 0, revenue: 0, missed: 0, skimmed: 0 }); }
  t.customers += r.customers; t.served += r.served; t.missed += r.missed; t.skimmed += r.skimmed; t.revenue += r.revenue;
  const banked = r.revenue - r.skimmed; if (banked > 0) this.acct(org).transact({ key: `sale:${org.id}:${abs}`, amount: banked, reason: `Sales: ${r.served} ${SHOP_TYPES[org.type].unit}` });
 }
 endOfDay(org, d) {
  const g = this.g, a = this.acct(org), report = { day: d, wages: 0, rent: 0, revenue: 0, skimmed: 0, served: 0, missed: 0, remit: 0, fuel: 0, kept: 0, notes: [] };
  const td = [org.today, org.prevDay].find((x) => x?.day === d); // the new day's first hour may already have started a fresh tally
  if (td) Object.assign(report, { revenue: td.revenue, skimmed: td.skimmed, served: td.served, missed: td.missed });
  // wages from each contract's escrow, then top the escrow back up from the business account
  for (const k of this.staffOf(org)) {
   const paid = this.contracts.release(k.id, d); report.wages += paid;
   if (!paid) { k.meta.unpaid = (k.meta.unpaid ?? 0) + 1; report.notes.push(`${k.payeeName} was not paid`); if (k.meta.unpaid >= 2) { this.contracts.end(k.id, d, a); org.staff = org.staff.filter((x) => x !== k.id); for (const v of org.vehicles) if (v.driver === k.id) v.driver = null; report.notes.push(`${k.payeeName} quit: unpaid for two days`); g.life?.note(`unpaid:${k.id}`, `${k.payeeName} quit ${org.name}: wages unpaid`, { business: -3, public: -1 }); } }
   else k.meta.unpaid = 0;
   if (k.status === 'active') this.contracts.topUp(k.id, a, d);
  }
  if (org.kind === 'shop') {
   if (org.lease === 'rent' && org.premises && d >= (org.rentPaidTo ?? d)) {
    const pr = this.premisesOf(org), tx = pr && a.transact({ key: `rent:${org.id}:${d}`, amount: -pr.rentWeek, reason: `Rent: ${pr ? naira(pr.rentWeek) : ''} for a week` });
    if (tx?.ok) { org.rentPaidTo = d + BUSINESS.rentDays; org.arrears = 0; report.rent = pr.rentWeek; }
    else { org.arrears = (org.arrears ?? 0) + 1; org.rentPaidTo = d + 1; report.notes.push('Rent not paid: the landlord wants it'); if (org.arrears >= BUSINESS.evictAfter) { report.notes.push('Evicted for unpaid rent'); this.leave(org, true); } }
   }
   const c = closeDay(org); if (c.spoiled) report.notes.push(`${c.spoiled} ${SHOP_TYPES[org.type].unit} spoiled`);
   if (report.served) g.life?.selfWork('shopkeeper', `shopday:${org.id}:${d}`, `${org.name}: served ${report.served} customers (${naira(report.revenue)})`, { prof: 1, business: (org.rep - 50) / 50, public: 0 });
   if (report.skimmed > 1000) report.notes.push(`The takings are ${naira(report.skimmed)} short`);
  } else {
   for (const v of org.vehicles) {
    const veh = this.save.vehicles.find((x) => x.id === v.vehicle), k = v.driver && this.contracts.get(v.driver);
    if (!veh || !k || k.status !== 'active') continue;
    if (g.vehicles.driving?.id === veh.id) { report.notes.push(`${VEHICLE_MODELS[veh.model].label} stayed with you today`); continue; }
    let seed = (d * 7919 + veh.id.length) >>> 0; const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const r = vehicleDay({ mode: modeOf(veh.model), driver: k.meta, rain: (g.weather?.w?.rain ?? 0) > 0.3, rng, damage: veh.damage ?? 0 });
    if (!r.worked) { report.notes.push(`${VEHICLE_MODELS[veh.model].label}: ${r.reason}`); continue; }
    if (a.transact({ key: `remit:${veh.id}:${d}`, amount: r.remit, reason: `Delivery from ${k.payeeName} (${VEHICLE_MODELS[veh.model].label})` }).ok) { report.remit += r.remit; report.fuel += r.fuel; report.kept += r.kept; }
    veh.damage = Math.min(100, Math.round(((veh.damage ?? 0) + r.damage) * 10) / 10); veh.odo = (veh.odo ?? 0) + 60;
   }
   if (report.remit) g.life?.selfWork('transporter', `fleetday:${org.id}:${d}`, `${org.name}: ${naira(report.remit)} in deliveries`, { prof: 1, business: 0.5 });
   if (report.kept > 2000) report.notes.push(`Deliveries look ${naira(report.kept)} light`);
  }
  if (report.revenue || report.remit || report.wages || report.rent || report.notes.length) { org.days.push(report); if (org.days.length > 14) org.days.shift(); }
 }
 // ── bank ─────────────────────────────────────────────────────────────────────────────────────
 assets() {
  const out = [];
  for (const v of (this.save.vehicles ?? []).filter((v) => !this.g.authority?.isUnverified('vehicle', v.id))) out.push({ key: `vehicle:${v.id}`, label: `your ${VEHICLE_MODELS[v.model]?.label?.toLowerCase() ?? v.model}`, value: Math.round((CATALOGUE_BY_ID[v.model]?.price ?? 0) * (1 - (v.damage ?? 0) / 200)) });
  const h = this.g.homes?.housing; for (const id of Object.keys(h?.state.owned ?? {}).filter((id) => !this.g.authority?.isUnverified('home', id))) out.push({ key: `home:${id}`, label: `your home (${h.get(id)?.label ?? id})`, value: h.purchasePrice(id) });
  return out;
 }
 isPledged(key) { return !!this.save?.bank?.pledged?.[key]; }
 repossess(key) {
  const g = this.g, [kind, ...rest] = key.split(':'), id = rest.join(':');
  if (kind === 'vehicle') { const v = g.vehicles.sys?.get(id); if (!v) return 0; const val = Math.round((CATALOGUE_BY_ID[v.model]?.price ?? 0) * 0.45); if (g.vehicles.driving?.id === id) g.vehicles.stopDriving?.({ silent: true }); g.vehicles.sys.list.splice(g.vehicles.sys.list.indexOf(v), 1); g.vehicles.removeOwned?.(v); for (const o of this.orgs.list) o.vehicles = o.vehicles.filter((x) => x.vehicle !== id); return val; }
  if (kind === 'home') { const h = g.homes.housing; if (!h.state.owned[id]) return 0; const val = Math.round(h.purchasePrice(id) * 0.7); if (g.homes.inside?.home.id === id) g.homes.exit(); delete h.state.owned[id]; g.homes.refreshSigns?.(); return val; }
  return 0;
 }
 bankEvent(e) {
  const g = this.g, L = e.loan;
  if (e.kind === 'missed') { g.ui?.toast(`Missed a loan instalment (${L.label}). A late fee of ${naira(e.fee)} was added.`, 5000); g.life?.note(`bank-missed:${L.id}:${L.missedTotal}`, `Missed a loan instalment`, { business: -1 }); }
  if (e.kind === 'default') { g.ui?.toast(`Your ${L.label} is in default.`, 6000); g.life?.note(`bank-default:${L.id}`, `Defaulted on a bank loan`, { public: -3, business: -6 }); }
  if (e.kind === 'repossessed') { g.ui?.toast(`The bank repossessed ${L.assetLabel} and recovered ${naira(e.recovered)}.`, 6000); g.life?.note(`bank-repo:${L.id}`, `The bank repossessed ${L.assetLabel}`, { public: -2, business: -3 }); }
  if (e.kind === 'collected') g.ui?.toast(`Debt collectors took ${naira(e.amount)} from your cash.`, 4000);
  g.saveGame();
 }
 bankView(br) {
  const g = this.g, b = this.bank, s = this.save.bank, opts = [], amounts = [5000, 20000, 50000];
  if (!s.open) return { title: br.name, kicker: 'BANKING HALL', text: 'Open an account to save, earn a little interest and borrow. Your account is separate from the cash you carry.', note: 'Fictional bank. Game money only.', options: [{ label: `Open an account · ${naira(BANK.openFee)}`, primary: true, disabled: !g.economy.canAfford(BANK.openFee), why: 'Not enough cash', act: () => { const r = b.open(br.id); g.ui.toast(r.ok ? 'Account opened. Welcome!' : r.error); g.saveGame(); g.renderChoice(); } }, ...(g.justice?.bankOptions(br) ?? []), { label: 'Leave', ghost: true, act: () => g.closeChoice() }] };
  for (const a of amounts) opts.push({ label: `Deposit ${naira(a)}`, sub: 'From your cash', disabled: !g.economy.canAfford(a), why: 'Not enough cash', act: () => this.doMove('deposit', a) });
  opts.push({ label: 'Deposit all your cash', disabled: g.economy.balance <= 0, act: () => this.doMove('deposit', g.economy.balance) });
  for (const a of amounts) opts.push({ label: `Withdraw ${naira(a)}`, sub: 'To your cash', disabled: b.balance < a, why: 'Not enough in your account', act: () => this.doMove('withdraw', a) });
  opts.push({ label: 'Loans', sub: `${b.active().length ? b.active().map((l) => `${l.label}: ${naira(b.owed(l))} owed`).join(' · ') : 'Borrow against your income, a vehicle or a home'}`, primary: true, act: () => g.openChoice(() => this.loansView(br)) });
  opts.push(...(g.justice?.bankOptions(br) ?? []));
  opts.push({ label: 'Leave', ghost: true, act: () => g.closeChoice() });
  return { title: br.name, kicker: `YOUR ACCOUNT · ${naira(b.balance)} · CREDIT SCORE ${s.score}`, text: `Cash in hand: ${naira(g.economy.balance)}. Savings earn 0.1% a day on up to ${naira(BANK.interestCap)}.`, options: opts };
 }
 doMove(kind, amount) { const g = this.g, r = kind === 'deposit' ? this.bank.deposit(amount) : this.bank.withdraw(amount); g.ui.toast(r.ok ? `${kind === 'deposit' ? 'Deposited' : 'Withdrew'} ${naira(amount)}` : r.error); g.saveGame(); g.renderChoice(); }
 /** v0.44: the banking hall is open 8:00–17:00; outside those hours only the ATM at the door (and whatever else happens at night). */
 hallOpen() { const h = (this.g.clock?.minutes ?? 720) / 60; return h >= 8 && h < 17; }
 enterBank(br) {
  const g = this.g, hall = () => g.openChoice(() => this.bankView(br));
  br.civic ??= { id: `bank-${br.id}`, kind: 'bank', name: br.name, x: br.x, z: br.z, visitSpot: { x: br.x, z: br.z }, interior: { kind: 'bank', opts: { colors: { nkwo: ['#0f3d63', '#f2c14e'], bridgehead: ['#1d5b3a', '#ffffff'] }[br.id], name: br.name }, hours: [8, 17], welcome: `${br.name} · tellers ahead, loans on the left, ATMs on the right`, counters: [
   { at: 'teller', label: 'Teller — deposits, withdrawals, your account', act: hall }, { at: 'service', label: 'Customer service — loans', act: () => g.openChoice(() => (this.save.bank.open ? this.loansView(br) : this.bankView(br))) }, { at: 'atm', label: 'ATM', act: hall }] } };
  return g.civic.enter(br.civic);
 }
 loansView(br) {
  const g = this.g, b = this.bank, opts = [];
  for (const l of b.active()) { const owed = b.owed(l); opts.push({ label: `${l.label}: ${naira(owed)} owed${l.status === 'default' ? ' · IN DEFAULT' : ''}`, sub: `${naira(l.per)} a day · ${l.missedTotal ? `${l.missedTotal} missed` : 'on time'}${l.assetLabel ? ` · pledged: ${l.assetLabel}` : ''}`, disabled: true, why: '' }); opts.push({ label: `Pay off ${naira(Math.min(owed, b.balance))} now`, disabled: b.balance <= 0, why: 'Nothing in your account', act: () => { const r = b.repay(l.id, Math.min(owed, b.balance)); g.ui.toast(r.ok ? (r.owed ? `Paid. ${naira(r.owed)} still owed.` : 'Loan paid off!') : r.error); g.saveGame(); g.renderChoice(); } }); }
  for (const o of b.offers(this.assets())) { const amts = o.ok ? [...new Set([Math.min(o.max, 20000), Math.round(o.max / 2 / 50) * 50, o.max])].filter((x) => x >= 5000) : [o.max]; for (const amt of amts.slice(0, o.ok ? 3 : 1)) opts.push({ label: `${o.label}: borrow ${naira(amt)}`, sub: o.ok ? `Repay ${naira(Math.round(amt * (1 + o.rate)))} over ${o.days} days (${naira(Math.ceil(amt * (1 + o.rate) / o.days))} a day from your account)${o.asset ? ` · ${o.assetLabel} is pledged until repaid` : ''}` : o.why, disabled: !o.ok, why: o.why, act: () => g.openChoice(() => ({ title: 'Take this loan?', text: `${o.label}: ${naira(amt)} into your account now. ${naira(Math.round(amt * (1 + o.rate)))} to repay over ${o.days} days. Miss three instalments in a row and it's a default${o.asset ? `: ${o.assetLabel} would be repossessed` : ': collectors take what you owe from your cash, and you cannot borrow again until it is paid'}.`, options: [{ label: 'Take the loan', primary: true, act: () => { const r = b.borrow(o, amt); g.ui.toast(r.ok ? `${naira(amt)} paid into your account` : r.error); g.saveGame(); g.openChoice(() => this.loansView(br)); } }, { label: 'Not now', ghost: true, act: () => g.openChoice(() => this.loansView(br)) }] })) }); }
  opts.push({ label: 'Back', ghost: true, act: () => g.openChoice(() => this.bankView(br)) });
  return { title: 'Loans', kicker: `CREDIT SCORE ${this.save.bank.score} · INCOME, 14 DAYS: ${naira(this.income14())}`, text: 'A steady income, a clear police record and paying on time raise your score. Missed payments lower it.', options: opts };
 }
 // ── premises and shops ───────────────────────────────────────────────────────────────────────
 premisesView(pr) {
  const g = this.g, o = this.orgAt(pr); if (o) return this.orgView(o);
  const opts = Object.entries(SHOP_TYPES).map(([type, T]) => ({ label: `Open a ${T.label.toLowerCase()} here`, sub: `Sells ${T.unit} for about ${naira(T.price)} · stock costs ${naira(T.cost)} each · open ${T.hours[0]}:00–${T.hours[1] % 24}:00`, act: () => g.openChoice(() => this.leaseView(pr, type)) }));
  opts.push({ label: 'Leave', ghost: true, act: () => g.closeChoice() });
  return { title: 'Shop to let', kicker: `${naira(pr.rentWeek)} A WEEK · OR BUY FOR ${naira(pr.price)}`, text: `About ${pr.size} m². Foot traffic here: ${pr.footfall >= 1.4 ? 'very busy' : pr.footfall >= 1 ? 'busy' : pr.footfall >= 0.7 ? 'steady' : 'quiet'}. Registering a business costs ${naira(REGISTER_FEE)}.`, note: 'Rent is due every 7 days from the business account. Two missed payments and the landlord evicts you.', options: opts };
 }
 names(type) { const n = (this.save.character.name ?? 'Your').split(' ')[0], T = SHOP_TYPES[type].label; return [`${n}'s ${T}`, `Onitsha ${T}`, `${{ provisions: 'Nkwo', buka: 'Mama', bar: 'Oga', phones: 'Connect', boutique: 'Ada' }[type]} ${T}`]; }
 leaseView(pr, type) {
  const g = this.g, T = SHOP_TYPES[type], opts = [];
  if (this.orgs.list.length >= BUSINESS.maxOrgs) return { title: 'Too many businesses', text: `You can run up to ${BUSINESS.maxOrgs} businesses.`, options: [{ label: 'Back', ghost: true, act: () => g.openChoice(() => this.premisesView(pr)) }] };
  for (const name of this.names(type)) { const rent = REGISTER_FEE + pr.rentWeek, buy = REGISTER_FEE + pr.price; opts.push({ label: `Rent as “${name}” · ${naira(rent)}`, sub: `Registration + the first week's rent, from your cash`, disabled: !g.economy.canAfford(rent), why: 'Not enough cash', act: () => this.found(pr, type, name, 'rent') }); opts.push({ label: `Buy as “${name}” · ${naira(buy)}`, sub: 'Registration + the premises, from your cash. No rent, ever.', disabled: !g.economy.canAfford(buy), why: 'Not enough cash', act: () => this.found(pr, type, name, 'own') }); }
  opts.push({ label: 'Back', ghost: true, act: () => g.openChoice(() => this.premisesView(pr)) });
  return { title: `${T.label}: choose a name`, kicker: 'REGISTER YOUR BUSINESS', text: 'The name goes on the signboard. You can run the shop yourself when you are there, or hire attendants.', options: opts.slice(0, 7) };
 }
 found(pr, type, name, lease) {
  const g = this.g, cost = REGISTER_FEE + (lease === 'own' ? pr.price : pr.rentWeek), id = `org:${++this.orgs.seq}`;
  const tx = g.economy.transact({ key: `found:${id}`, amount: -cost, reason: `${name}: registration and ${lease === 'own' ? 'purchase' : 'first week\'s rent'}` }); if (!tx.ok) { g.ui.toast('Not enough cash'); return; }
  const org = { id, kind: 'shop', type, name, founded: g.clock.day, premises: pr.id, lease, rentPaidTo: lease === 'rent' ? g.clock.day + BUSINESS.rentDays : null, price: 'normal', open: SHOP_TYPES[type].hours[0], close: SHOP_TYPES[type].hours[1], stock: 0, satisfaction: 0.6, rep: 20, account: { balance: 0, ledger: [], processed: [] }, staff: [], vehicles: [], log: [], days: [], lastHour: this.absHour(), lastDay: g.clock.day };
  this.orgs.list.push(org); this.log(org, `Registered ${name} (${lease === 'own' ? 'bought the premises' : 'renting'})`);
  this.sign(pr, name.toUpperCase(), SHOP_TYPES[type].label.toUpperCase(), '#7a1f1f', '#fff4d6');
  g.life?.selfWork('shopkeeper', `found:${id}`, `Opened ${name}`, { prof: 1, business: 2, public: 1 }); g.saveGame();
  g.ui.toast(`${name} is yours. Put money in the business account, buy stock, and open up.`, 6000); g.openChoice(() => this.orgView(org));
 }
 leave(org, evicted = false) {
  const g = this.g, pr = this.premisesOf(org); for (const k of this.staffOf(org)) this.contracts.end(k.id, g.clock.day, this.acct(org)); org.staff = [];
  if (org.lease === 'own' && pr && !evicted) this.acct(org).transact({ key: `sold-premises:${org.id}`, amount: Math.round(pr.price * 0.7), reason: 'Sold the premises' });
  org.premises = null; org.stock = 0; this.log(org, evicted ? 'Evicted for unpaid rent' : 'Gave up the premises');
  if (pr) this.sign(pr, 'SHOP TO LET', `${naira(pr.rentWeek)} A WEEK · OR BUY`, '#f3e3b0', '#3a2a10');
  if (evicted) g.life?.note(`evicted:${org.id}`, `${org.name} was evicted for unpaid rent`, { business: -6, public: -1 });
 }
 orgView(org) {
  const g = this.g, a = this.acct(org), T = SHOP_TYPES[org.type], opts = [], staff = this.staffOf(org), last = org.days.at(-1), back = () => g.openChoice(() => this.orgView(org));
  if (org.kind === 'transport') return this.fleetView(org);
  if (!org.premises) return { title: org.name, text: 'This business has no premises any more. Its account and records remain.', options: [...this.moneyOptions(org, back), { label: 'Close the business', sub: 'Its money comes back to your cash', act: () => this.dissolve(org) }, { label: 'Back', ghost: true, act: () => g.closeChoice() }] };
  const open = isOpenAt(org, g.clock.hour) && (staff.length || this.ownerHere(org));
  opts.push({ label: `Buy stock · ${naira(T.cost)} each`, sub: `In stock: ${org.stock} ${T.unit}. Paid from the business account (${naira(a.balance)})`, act: () => g.openChoice(() => ({ title: 'Buy stock', text: `Wholesale: ${naira(T.cost)} per ${T.unit.replace(/s$/, '')}. Delivered now.${T.spoil ? ' Food spoils overnight: buy what you can sell.' : ''}`, options: [...[20, 50, 100, 200].map((q) => ({ label: `${q} ${T.unit} · ${naira(stockCost(org.type, q))}`, disabled: a.balance < stockCost(org.type, q) || org.stock + q > BUSINESS.maxStock, why: org.stock + q > BUSINESS.maxStock ? 'No space' : 'Not enough in the business account', act: () => { const tx = a.transact({ key: `stock:${org.id}:${++this.orgs.seq}`, amount: -stockCost(org.type, q), reason: `Stock: ${q} ${T.unit}` }); if (tx.ok) { org.stock += q; g.saveGame(); } g.renderChoice(); } })), { label: 'Back', ghost: true, act: back }] })) });
  opts.push({ label: `Prices: ${PRICE_LEVELS[org.price].label}`, sub: 'Cheap brings more customers; premium earns more per sale and fewer come', act: () => { const ks = Object.keys(PRICE_LEVELS); org.price = ks[(ks.indexOf(org.price) + 1) % ks.length]; g.saveGame(); g.renderChoice(); } });
  const hourSets = [[T.hours[0], T.hours[1]], [7, 19], [10, 23]].filter((x, i, arr) => arr.findIndex((y) => y[0] === x[0] && y[1] === x[1]) === i);
  opts.push({ label: `Opening hours: ${org.open}:00–${org.close % 24}:00`, sub: 'Tap to change', act: () => { const i = hourSets.findIndex((x) => x[0] === org.open && x[1] === org.close); [org.open, org.close] = hourSets[(i + 1) % hourSets.length]; g.saveGame(); g.renderChoice(); } });
  opts.push({ label: `Staff: ${staff.length ? staff.map((k) => `${k.payeeName} (${naira(k.amount)}/day)`).join(', ') : 'none'}`, sub: staff.length < BUSINESS.maxStaff ? 'Hire or let go of attendants' : 'Let go of attendants', act: () => g.openChoice(() => this.staffView(org, 'attendant')) });
  opts.push(...this.moneyOptions(org, back));
  opts.push({ label: 'Reports', sub: last ? `Day ${last.day}: ${naira(last.revenue)} sales · ${last.served} served · ${last.missed} turned away` : 'No full day yet', act: () => g.openChoice(() => this.reportView(org)) });
  opts.push({ label: org.lease === 'own' ? `Sell the premises (${naira(Math.round(this.premisesOf(org).price * 0.7))})` : 'Give up the premises', sub: 'Staff contracts end; stock is lost', act: () => g.openChoice(() => ({ title: 'Are you sure?', text: 'You lose these premises and the stock in them.', options: [{ label: 'Yes', primary: true, act: () => { this.leave(org); g.saveGame(); g.openChoice(() => this.orgView(org)); } }, { label: 'No', ghost: true, act: back }] })) });
  opts.push({ label: 'Close', ghost: true, act: () => g.closeChoice() });
  return { title: org.name, kicker: `${T.label.toUpperCase()} · ${open ? 'OPEN NOW' : 'CLOSED NOW'} · ACCOUNT ${naira(a.balance)}`, text: `Customers are ${org.satisfaction >= 0.75 ? 'very happy' : org.satisfaction >= 0.55 ? 'happy' : org.satisfaction >= 0.35 ? 'grumbling' : 'unhappy'}. Reputation ${Math.round(org.rep)}/100. ${org.lease === 'rent' ? `Rent ${naira(this.premisesOf(org)?.rentWeek ?? 0)} due on day ${org.rentPaidTo}.` : 'You own the premises.'}`, note: 'Open only when someone is serving: your staff, or you standing in the shop.', options: opts };
 }
 ownerHere(org) { const pr = this.premisesOf(org), p = this.g.player.position; return !!pr && !this.g.vehicles.driving && Math.hypot(p.x - pr.x, p.z - pr.z) < 25; }
 moneyOptions(org, back) {
  const g = this.g, a = this.acct(org), opts = [];
  for (const amt of [10000, 50000]) opts.push({ label: `Put ${naira(amt)} into the business`, sub: 'From your cash', disabled: !g.economy.canAfford(amt), why: 'Not enough cash', act: () => { this.transfer(g.economy, a, amt, `${org.name}: money in`); g.renderChoice(); } });
  if (this.save.bank.open) opts.push({ label: `Put ${naira(Math.min(50000, this.bank.balance))} in from your bank account`, disabled: this.bank.balance <= 0, why: 'Your bank account is empty', act: () => { this.transfer(this.bank.account, a, Math.min(50000, this.bank.balance), `${org.name}: from your bank`); g.renderChoice(); } });
  opts.push({ label: `Take ${naira(a.balance)} out to your cash`, disabled: a.balance <= 0, why: 'The account is empty', act: () => { this.transfer(a, g.economy, a.balance, `${org.name}: money out`); g.renderChoice(); } });
  return opts;
 }
 transfer(from, to, amount, label) { if (!(amount > 0)) return; const key = `xfer:${++this.orgs.seq}`; const out = from.transact({ key: `${key}:out`, amount: -amount, reason: label }); if (!out.ok) { this.g.ui.toast('Not enough money'); return; } to.transact({ key: `${key}:in`, amount, reason: label }); this.g.saveGame(); }
 staffView(org, role, mode = null, vehicleId = null) {
  const g = this.g, a = this.acct(org), opts = [], day = g.clock.day, staff = this.staffOf(org), back = () => g.openChoice(() => this.orgView(org));
  if (!vehicleId) for (const k of staff.filter((x) => x.meta.role === role)) opts.push({ label: `Let ${k.payeeName} go`, sub: `${naira(k.amount)} a day · ${k.paidDays} days paid · the rest of their escrow comes back`, act: () => { this.contracts.end(k.id, day, a); org.staff = org.staff.filter((x) => x !== k.id); for (const v of org.vehicles) if (v.driver === k.id) v.driver = null; this.log(org, `Let ${k.payeeName} go`); g.saveGame(); g.renderChoice(); } });
  if (vehicleId || staff.length < BUSINESS.maxStaff) for (let i = 0; i < 3; i++) {
   const c = candidate(`${org.id}:${role}:${day}:${i}`, role, mode ?? 'keke'), fund = c.wage * CONTRACT.escrowDays;
   opts.push({ label: `Hire ${c.name} · ${naira(c.wage)} a day`, sub: `${role === 'driver' ? `Driving: ${c.skill >= 1 ? 'very good' : c.skill >= 0.85 ? 'good' : 'fair'}` : `Serving: ${c.skill >= 1 ? 'quick' : 'steady'}`} · ${c.honestyHint} · sets aside ${naira(fund)} (3 days' wages) from the business account`, disabled: a.balance < fund, why: 'Not enough in the business account for 3 days\' wages', act: () => { const off = this.contracts.offer({ kind: 'wage', title: `${c.name}: ${role} at ${org.name}`, payer: org.id, payee: `npc:${org.id}:${role}:${day}:${i}`, payeeName: c.name, amount: c.wage, meta: { ...c } }); const r = off.ok && this.contracts.accept(off.contract.id, a, day); if (!r?.ok) { g.ui.toast(r?.error ?? off.error); return; } org.staff.push(off.contract.id); if (vehicleId) { const v = org.vehicles.find((x) => x.vehicle === vehicleId); if (v) v.driver = off.contract.id; } this.log(org, `Hired ${c.name} as ${role}`); g.saveGame(); g.ui.toast(`${c.name} starts today.`); vehicleId ? g.openChoice(() => this.fleetView(org)) : g.renderChoice(); } });
  }
  opts.push({ label: 'Back', ghost: true, act: vehicleId ? () => g.openChoice(() => this.fleetView(org)) : back });
  return { title: role === 'driver' ? 'Hire a driver' : 'Staff', kicker: `${org.name.toUpperCase()} · ACCOUNT ${naira(a.balance)}`, text: 'Wages are paid every day from money set aside in escrow, topped up from the business account. Two unpaid days and they quit. References are a hint, not a promise.', options: opts };
 }
 reportView(org) {
  const g = this.g, opts = [...org.days].reverse().slice(0, 7).map((d) => ({ label: `Day ${d.day}: ${org.kind === 'shop' ? `${naira(d.revenue)} sales` : `${naira(d.remit)} deliveries`}`, sub: [org.kind === 'shop' ? `${d.served} served, ${d.missed} turned away` : `fuel ${naira(d.fuel)}`, `wages ${naira(d.wages)}`, d.rent ? `rent ${naira(d.rent)}` : '', ...d.notes].filter(Boolean).join(' · '), disabled: true, why: '' }));
  opts.push(...[...org.log].reverse().slice(0, 6).map((l) => ({ label: `Day ${l.day}: ${l.text}`, disabled: true, why: '' })));
  opts.push({ label: 'Back', ghost: true, act: () => g.openChoice(() => this.orgView(org)) });
  return { title: `${org.name}: reports`, kicker: 'LAST 7 DAYS', options: opts };
 }
 dissolve(org) { const g = this.g, a = this.acct(org); for (const k of this.staffOf(org)) this.contracts.end(k.id, g.clock.day, a); if (a.balance > 0) this.transfer(a, g.economy, a.balance, `${org.name}: closing balance`); this.orgs.list = this.orgs.list.filter((o) => o !== org); g.life?.note(`closed:${org.id}`, `Closed ${org.name}`); g.saveGame(); g.closeChoice(); g.ui.toast(`${org.name} is closed.`); }
 // ── transport companies ──────────────────────────────────────────────────────────────────────
 commercialVehicles() { return (this.save.vehicles ?? []).filter((v) => modeOf(v.model)); }
 startTransport() {
  const g = this.g, n = (this.save.character.name ?? 'Your').split(' ')[0], id = `org:${++this.orgs.seq}`;
  if (this.orgs.list.length >= BUSINESS.maxOrgs) { g.ui.toast(`You can run up to ${BUSINESS.maxOrgs} businesses`); return; }
  const tx = g.economy.transact({ key: `found:${id}`, amount: -REGISTER_FEE, reason: `${n} Transport: registration` }); if (!tx.ok) { g.ui.toast('Not enough cash'); return; }
  const org = { id, kind: 'transport', type: null, name: `${n} Transport`, founded: g.clock.day, premises: null, account: { balance: 0, ledger: [], processed: [] }, staff: [], vehicles: [], log: [], days: [], satisfaction: 0.6, rep: 20, stock: 0, lastDay: g.clock.day };
  this.orgs.list.push(org); this.log(org, 'Registered the company'); g.life?.selfWork('transporter', `found:${id}`, `Started ${org.name}`, { prof: 1, business: 1 }); g.saveGame(); g.openChoice(() => this.fleetView(org));
 }
 fleetView(org) {
  const g = this.g, a = this.acct(org), opts = [], used = new Set(this.orgs.list.flatMap((o) => o.vehicles.map((v) => v.vehicle)));
  for (const v of org.vehicles) { const veh = this.save.vehicles.find((x) => x.id === v.vehicle), k = v.driver && this.contracts.get(v.driver), M = veh && VEHICLE_MODELS[veh.model]; if (!veh) continue;
   opts.push({ label: `${M.label}: ${k?.status === 'active' ? `driven by ${k.payeeName}` : 'no driver'}`, sub: `Damage ${veh.damage ?? 0}%${(veh.damage ?? 0) >= BUSINESS.breakdownAt ? ' · broken down: take it to a mechanic' : ''} · expected ${naira(TRANSPORT_DAY[modeOf(veh.model)].gross)} a day before fuel`, act: () => g.openChoice(() => k?.status === 'active' ? ({ title: M.label, options: [{ label: `Let ${k.payeeName} go`, act: () => { this.contracts.end(k.id, g.clock.day, a); org.staff = org.staff.filter((x) => x !== k.id); v.driver = null; g.saveGame(); g.openChoice(() => this.fleetView(org)); } }, { label: 'Take it off the road', act: () => { if (k) { this.contracts.end(k.id, g.clock.day, a); org.staff = org.staff.filter((x) => x !== k.id); } org.vehicles = org.vehicles.filter((x) => x !== v); g.saveGame(); g.openChoice(() => this.fleetView(org)); } }, { label: 'Back', ghost: true, act: () => g.openChoice(() => this.fleetView(org)) }] }) : this.staffView(org, 'driver', modeOf(veh.model), veh.id)) }); }
  for (const veh of this.commercialVehicles().filter((x) => !used.has(x.id))) opts.push({ label: `Put your ${VEHICLE_MODELS[veh.model].label.toLowerCase()} to work`, sub: 'Then hire a driver for it', act: () => { org.vehicles.push({ vehicle: veh.id, driver: null }); g.saveGame(); g.openChoice(() => this.staffView(org, 'driver', modeOf(veh.model), veh.id)); } });
  if (!this.commercialVehicles().length) opts.push({ label: 'Buy a keke or a bus first', sub: 'Car stands sell keke, minibuses and buses', disabled: true, why: '' });
  opts.push(...this.moneyOptions(org, () => g.openChoice(() => this.fleetView(org))));
  opts.push({ label: 'Reports', act: () => g.openChoice(() => this.reportView(org)) });
  if (!org.vehicles.length) opts.push({ label: 'Close the company', act: () => this.dissolve(org) });
  opts.push({ label: 'Close', ghost: true, act: () => g.closeChoice() });
  return { title: org.name, kicker: `TRANSPORT · ${org.vehicles.length} VEHICLE${org.vehicles.length === 1 ? '' : 'S'} · ACCOUNT ${naira(a.balance)}`, text: 'Each driver brings back the day\'s takings after fuel; their wage comes from escrow. Vehicles wear out; a broken-down vehicle earns nothing until repaired.', note: 'A vehicle you are driving yourself stays with you that day.', options: opts };
 }
 // ── phone ────────────────────────────────────────────────────────────────────────────────────
 summary() { return this.orgs.list.map((o) => ({ id: o.id, name: o.name, kind: o.kind, balance: o.account.balance, last: o.days.at(-1) ?? null, label: o.kind === 'shop' ? SHOP_TYPES[o.type].label : `${o.vehicles.length} vehicle(s)` })); }
 places() { return [...this.branches.map((b) => ({ x: b.x, z: b.z, kind: 'bank', id: 'bank-' + b.id, label: b.name })), ...this.premises.map((p) => { const o = this.orgAt(p); return { x: p.x, z: p.z, kind: o ? 'business' : 'tolet', id: 'premises-' + p.id, label: o ? o.name : `Shop to let (${naira(p.rentWeek)}/week)` }; })]; }
 update() {}
}
