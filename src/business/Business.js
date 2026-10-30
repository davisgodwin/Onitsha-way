/**
 * v0.41 businesses and fleets you own (pure rules; BusinessController runs them in the city).
 *
 * An organisation is a named business with its own bank-style account (a ledger with unique keys), staff hired on
 * escrowed wage contracts, and a log. Two kinds:
 *  - 'shop': premises you rent or buy (provisions shop, buka, beer parlour, phone shop, boutique). You buy stock, set
 *    prices and opening hours, hire attendants (or serve yourself when you're there). Customers come every hour it is
 *    open: how many depends on the area, the hour, your prices, how happy customers have been and your reputation. Run
 *    out of stock or staff and customers leave unhappy. Wages and rent are due whether you sell or not, food spoils,
 *    and an attendant you can't trust may pocket some takings when you're away. You can lose money.
 *  - 'transport': vehicles you own, each driven by a hired driver who brings back the day's takings ("delivery").
 *    Takings depend on the vehicle and the driver; fuel comes off the top; vehicles wear out and break down; a driver
 *    you can't trust brings back less.
 */
export const SHOP_TYPES = {
 provisions: { label: 'Provisions shop', unit: 'packs', cost: 400, price: 550, demand: 6, cap: 9, hours: [7, 21], spoil: 0, curve: [[7, .7], [9, 1], [12, 1.1], [17, 1.3], [20, .8]] },
 buka: { label: 'Buka (food)', unit: 'plates', cost: 450, price: 900, demand: 7, cap: 8, hours: [8, 20], spoil: 0.35, curve: [[8, .6], [11, 1.2], [13, 1.6], [15, .9], [18, 1.2]] },
 bar: { label: 'Beer parlour', unit: 'bottles', cost: 350, price: 600, demand: 5, cap: 10, hours: [12, 24], spoil: 0, curve: [[12, .4], [16, .8], [18, 1.4], [21, 1.6], [23, 1.0]] },
 phones: { label: 'Phone & accessories shop', unit: 'items', cost: 2500, price: 3500, demand: 1.3, cap: 4, hours: [8, 19], spoil: 0, curve: [[8, .6], [11, 1.1], [14, 1.2], [17, 1.0]] },
 boutique: { label: 'Fashion boutique', unit: 'pieces', cost: 5000, price: 8000, demand: 0.75, cap: 3, hours: [9, 19], spoil: 0, curve: [[9, .6], [12, 1.1], [16, 1.3], [18, .9]] },
};
export const PRICE_LEVELS = { cheap: { label: 'Cheap', mult: 0.85, demand: 1.25, happy: 0.012 }, normal: { label: 'Normal', mult: 1, demand: 1, happy: 0.008 }, premium: { label: 'Premium', mult: 1.25, demand: 0.72, happy: -0.004 } };
export const TRANSPORT_DAY = { keke: { gross: 9000, wage: 2500 }, minibus: { gross: 22000, wage: 4500 }, cbus: { gross: 28000, wage: 5000 }, bus: { gross: 40000, wage: 7000 } };
export const BUSINESS = { maxOrgs: 3, maxStaff: 4, maxStock: 600, rentDays: 7, evictAfter: 2, fuelShare: 0.15, catchUpHours: 48, breakdownAt: 80 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r50 = (n) => Math.round(n / 50) * 50;
export function newOrgs() { return { v: 1, seq: 0, list: [] }; }
export function ensureOrgs(raw) {
 const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : newOrgs();
 o.seq = Number.isInteger(o.seq) ? o.seq : 0;
 o.list = (Array.isArray(o.list) ? o.list : []).filter((x) => x && typeof x.id === 'string' && (x.kind === 'transport' || SHOP_TYPES[x.type]));
 for (const x of o.list) { x.account ??= { balance: 0, ledger: [], processed: [] }; x.staff ??= []; x.log ??= []; x.days ??= []; x.vehicles ??= []; x.satisfaction = clamp(Number.isFinite(x.satisfaction) ? x.satisfaction : 0.6, 0.1, 1); x.rep = clamp(Number.isFinite(x.rep) ? x.rep : 20, 0, 100); x.stock = Math.max(0, Math.floor(x.stock ?? 0)); }
 o.v = 1; return o;
}
/** How busy the hour is for a shop type (linear between the curve's points; 0 outside opening hours). */
export function hourFactor(type, hour) {
 const c = SHOP_TYPES[type].curve; if (hour <= c[0][0]) return c[0][1]; for (let i = 1; i < c.length; i++) if (hour <= c[i][0]) { const [h0, v0] = c[i - 1], [h1, v1] = c[i]; return v0 + (v1 - v0) * (hour - h0) / (h1 - h0); } return c.at(-1)[1];
}
export function isOpenAt(org, hour) { const [a, b] = [org.open ?? SHOP_TYPES[org.type].hours[0], org.close ?? SHOP_TYPES[org.type].hours[1]]; return hour >= a && hour < b; }
/**
 * One hour of trading. ctx = { hour, footfall (0.4–2, how busy the area is), ownerPresent, staff: [{ reliability }], rng }.
 * Mutates stock and satisfaction; returns { open, customers, served, revenue, missed, skimmed }.
 */
export function tradeHour(org, ctx) {
 const T = SHOP_TYPES[org.type], P = PRICE_LEVELS[org.price ?? 'normal'], rng = ctx.rng ?? Math.random;
 const capacity = (ctx.staff?.length ?? 0) * T.cap + (ctx.ownerPresent ? T.cap : 0);
 if (!isOpenAt(org, ctx.hour) || capacity <= 0) return { open: false, customers: 0, served: 0, revenue: 0, missed: 0, skimmed: 0 };
 const lambda = T.demand * clamp(ctx.footfall ?? 1, 0.3, 2.5) * hourFactor(org.type, ctx.hour) * P.demand * (0.5 + org.satisfaction) * (0.6 + org.rep / 125);
 const customers = Math.max(0, Math.round(lambda * (0.7 + 0.6 * rng())));
 const served = Math.min(customers, capacity, org.stock), missed = customers - served;
 org.stock -= served;
 const revenue = served * Math.round(T.price * P.mult);
 if (served) org.satisfaction += P.happy * Math.min(1, served / Math.max(1, customers));
 if (missed) org.satisfaction -= 0.035 * missed / Math.max(1, customers);
 org.satisfaction = clamp(org.satisfaction, 0.1, 1);
 // an attendant you can't trust may pocket some of the takings while you're away
 let skimmed = 0; if (!ctx.ownerPresent) for (const s of ctx.staff ?? []) skimmed += revenue / (ctx.staff.length) * Math.max(0, 0.9 - (s.reliability ?? 1)) * 0.6;
 skimmed = Math.min(revenue, r50(skimmed));
 return { open: true, customers, served, revenue, missed, skimmed };
}
/** Spoilage and the day's effect on reputation (moves 10% of the way towards how happy customers were). */
export function closeDay(org) {
 const T = SHOP_TYPES[org.type]; const spoiled = T.spoil ? Math.floor(org.stock * T.spoil) : 0; org.stock -= spoiled;
 org.rep = clamp(org.rep + (org.satisfaction * 100 - org.rep) * 0.1, 0, 100); return { spoiled };
}
/** Restock cost at the wholesaler. */
export const stockCost = (type, qty) => SHOP_TYPES[type].cost * Math.max(0, Math.floor(qty));
/**
 * One day's work for a vehicle with a hired driver. ctx = { mode, driver: { skill, reliability }, rain, rng, damage }.
 * Returns { worked, gross, fuel, remit, kept, damage } — the driver's wage is paid separately from their contract.
 */
export function vehicleDay(ctx) {
 const T = TRANSPORT_DAY[ctx.mode], rng = ctx.rng ?? Math.random; if (!T) return { worked: false, reason: 'not a commercial vehicle' };
 if ((ctx.damage ?? 0) >= BUSINESS.breakdownAt) return { worked: false, reason: 'broken down: needs a mechanic' };
 const gross = r50(T.gross * clamp(ctx.driver?.skill ?? 0.8, 0.5, 1.2) * (ctx.rain ? 0.88 : 1) * (0.8 + 0.4 * rng()));
 const fuel = r50(gross * BUSINESS.fuelShare), kept = r50((gross - fuel) * Math.max(0, 0.9 - (ctx.driver?.reliability ?? 1)) * 0.7);
 return { worked: true, gross, fuel, kept, remit: Math.max(0, gross - fuel - kept), damage: Math.round((1 + rng() * 3) * 10) / 10 };
}
/** A person you can hire: deterministic from a seed, so the same candidate always asks the same. */
export function candidate(seed, role, mode = 'keke') {
 let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } const r = (k) => (((h ^ (k * 2654435761)) >>> 0) % 1000) / 1000;
 const names = ['Chidi', 'Ngozi', 'Emeka', 'Ada', 'Obinna', 'Uche', 'Chiamaka', 'Ifeanyi', 'Nkechi', 'Ikenna', 'Amaka', 'Tobenna', 'Ebuka', 'Ifeoma', 'Kelechi', 'Somto', 'Chinedu', 'Oge'];
 const reliability = Math.round((0.6 + r(1) * 0.4) * 100) / 100, skill = Math.round((0.7 + r(2) * 0.45) * 100) / 100;
 const base = role === 'driver' ? TRANSPORT_DAY[mode]?.wage ?? 2500 : 1500;
 const wage = r50(base * (0.85 + skill * 0.25 + reliability * 0.1));
 return { name: names[Math.floor(r(3) * names.length)], role, reliability, skill, wage, honestyHint: reliability >= 0.85 ? 'Good references' : reliability >= 0.72 ? 'Some references' : 'No references' };
}
