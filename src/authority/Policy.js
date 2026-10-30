/**
 * v0.43 server authority (stage 4 of the open-life plan): the rules the account server applies. Pure, and shared:
 * the server enforces them, the tests check them, and the browser never has to trust itself.
 *
 * For a signed-in account the server keeps its own copy of every money account (wallet, bank account, each
 * business account, each wage escrow), the property you have really paid for, your legal record (append-only) and your
 * reputation. The browser sends each transaction as it happens; the server accepts it only if the game's own rules
 * allow it (no money from nowhere, no balance below zero, nothing counted twice, earnings within what the work can
 * pay), then answers with the true balances. Offline play is unchanged.
 *
 * auth = { v, lifeId, opened: { at, from }, ledgers: { id: { balance } }, keys: { 'ledger|key': amount }, keyOrder,
 *   date, income: { rule: naira }, total, property: { vehicles: { id: price }, homes: { id: price } },
 *   record: { id: entry }, convictions, standing: { date, base, values }, rejected: [..], stats }
 */
import { OCCUPATIONS, RANK_PAY } from '../data/occupations.js';
import { CRIMES, FENCE } from '../justice/Crime.js';
import { SCHEMES } from '../justice/Kingdom.js';
import { BANK } from '../money/Bank.js';
import { TRANSPORT_DAY, SHOP_TYPES, PRICE_LEVELS, BUSINESS } from '../business/Business.js';
import { CATALOGUE_BY_ID } from '../data/VehicleCatalogue.js';

export const AUTH = { keysMax: 3000, rejectedMax: 60, recordMax: 300, standingDay: 30, dayTotal: 6_000_000, entriesPerSync: 400 };
const r50 = (n) => Math.ceil(n / 50) * 50;
const maxShift = r50(Math.max(...OCCUPATIONS.filter((o) => o.shiftPay).map((o) => o.shiftPay)) * RANK_PAY.at(-1) * 1.15 + 4000);
const maxVehicle = Math.max(...Object.values(CATALOGUE_BY_ID).map((v) => v.price ?? 0));
const maxSale = Math.max(...Object.values(SHOP_TYPES).map((t) => t.price * t.cap)) * PRICE_LEVELS.premium.mult * (BUSINESS.maxStaff + 1);
const maxCrime = Math.max(...Object.values(CRIMES).map((c) => c.loot[1]));
/**
 * Earnings the server accepts, by what they're for. max = one transaction; day = all of that kind in a WAT day.
 * Transfers between your own accounts, and the refund of your own payment, are not earnings and aren't capped.
 */
export const INCOME_RULES = [
 { id: 'start', re: /^Starting funds/, max: 1_000_000, day: 1_000_000, label: 'starting funds' },
 { id: 'wages', re: /^(Shift pay|Bursary|Career:)/, max: maxShift, day: maxShift * 3, label: 'shift pay' },
 { id: 'apprentice', re: /^Apprenticeship settlement/, max: 100_000, day: 100_000, label: 'apprenticeship settlement' },
 { id: 'sales', re: /^Sales:/, max: r50(maxSale), day: r50(maxSale * 14), label: 'shop takings' },
 { id: 'remit', re: /^Delivery from/, max: TRANSPORT_DAY.bus.gross * 1.3, day: TRANSPORT_DAY.bus.gross * 1.3 * 6, label: 'drivers\' takings' },
 { id: 'loan', re: /paid into your account$/, max: Math.max(BANK.personal.cap, r50(maxVehicle * 4 * BANK.secured.ltv)), day: Math.max(BANK.personal.cap, r50(maxVehicle * 4 * BANK.secured.ltv)), label: 'a loan' },
 { id: 'interest', re: /^Savings interest/, max: r50(BANK.interestCap * BANK.interestRate) + 50, day: r50(BANK.interestCap * BANK.interestRate) + 50, label: 'interest' },
 { id: 'crime', re: /^(Stolen cash|Robbery proceeds|Stolen parcel proceeds)/, max: maxCrime, day: Math.round(maxCrime * 1.3), label: 'stolen money' },
 { id: 'fence', re: /to a dealer$/, max: r50(CRIMES.breakin.loot[1] * FENCE.max), day: r50(CRIMES.breakin.loot[1] * FENCE.max * 6), label: 'stolen goods sold' },
 { id: 'scheme', re: /^Hustle proceeds/, max: SCHEMES.big.gross[1], day: SCHEMES.big.gross[1], label: 'scheme proceeds' },
 { id: 'bribe', re: /^Bribe taken on duty/, max: 60_000, day: 150_000, label: 'bribes' },
 { id: 'vehicle-sale', key: /^sell-vehicle:/, max: maxVehicle, day: maxVehicle * 3, label: 'a vehicle sale', property: 'vehicle' },
 { id: 'premises-sale', re: /^Sold the premises/, max: 20_000_000, day: 20_000_000, label: 'premises sold' },
 { id: 'refund', re: /(Refund|Refunded|returned|reversed|Bail bond returned)/, max: 2_000_000, day: 5_000_000, label: 'a refund' },
 { id: 'winnings', re: /(winnings|prize)/i, max: 100_000, day: 300_000, label: 'winnings' },
 { id: 'gigs', re: /^(Job:|Paid:|Mission:|Supply order|Fare|Keke|Bus fare|Hustle:|Sold |Wholesale)/, max: 150_000, day: 1_000_000, label: 'paid work and sales' },
 { id: 'property', re: /^(Rent from|Rent: your building)/, max: 1_000_000, day: 2_000_000, label: 'rent from tenants' }, // v0.47
 { id: 'ventures', re: /^(Event fee|Decorating fee|Agency: .* paid|Security fee|Story fee|DJ set|MC fee)/, max: 2_500_000, day: 5_000_000, label: 'business and freelance fees' }, // v0.47
 { id: 'office', re: /^(Office salary|Campaign donations)/, max: 1_500_000, day: 3_000_000, label: 'office salary' }, // v0.45
 { id: 'diverted', re: /^Diverted public funds/, max: 800_000_000, day: 800_000_000, label: 'diverted public funds' }, // v0.45: a crime the EFCC investigates, bounded by the office's budget
 { id: 'other', re: /.*/, max: 50_000, day: 250_000, label: 'other earnings' },
];
const UNCAPPED = new Set(['vehicle-sale', 'premises-sale', 'refund', 'loan', 'start']);
/** The WAT (Africa/Lagos, UTC+1) calendar date of a moment: daily limits follow the real day in Onitsha. */
export const watDate = (ms) => new Date(ms + 3_600_000).toISOString().slice(0, 10);
export const LEDGER_RE = /^(wallet|bank|org:[\w:-]{1,60}|escrow:[\w:-]{1,60})$/;
export function ruleFor(e) { return INCOME_RULES.find((r) => (r.key ? r.key.test(e.key) : r.re.test(e.reason ?? ''))); }

/** What a save holds, as the server sees it: balances per ledger, property, record, reputation. */
export function readSave(d) {
 const ledgers = { wallet: d?.wallet?.balance ?? 0 };
 if (d?.bank?.open && d.bank.account) ledgers.bank = d.bank.account.balance ?? 0;
 for (const o of d?.orgs?.list ?? []) if (o?.account && typeof o.id === 'string') ledgers[`org:${o.id}`] = o.account.balance ?? 0;
 for (const k of d?.contracts?.list ?? []) if (k?.escrow && typeof k.id === 'string') ledgers[`escrow:${k.id}`] = k.escrow.balance ?? 0;
 const vehicles = Object.fromEntries((d?.vehicles ?? []).filter((v) => typeof v?.id === 'string').map((v) => [v.id, CATALOGUE_BY_ID[v.model]?.price ?? 0]));
 const homes = Object.fromEntries(Object.keys(d?.housing?.owned ?? {}).map((id) => [id, 0]));
 return { ledgers, vehicles, homes, record: d?.life?.record?.entries ?? [], standing: standingOf(d?.life?.standing), convictions: d?.justice?.convictions ?? 0 };
}
export function standingOf(s) { return s ? { public: s.public ?? 0, integrity: s.integrity ?? 0, notoriety: s.notoriety ?? 0, business: s.business ?? 0, social: s.social ?? 0, prof: { ...(s.prof ?? {}) } } : { public: 0, integrity: 0, notoriety: 0, business: 0, social: 0, prof: {} }; }
const intOr0 = (v) => (Number.isInteger(v) ? v : Math.round(Number(v) || 0));
/** A new authority for a life, opened from a save (the copy already on the server when it exists). */
export function openAuthority(lifeId, data, now, from) {
 const s = readSave(data), date = watDate(now);
 return { v: 1, lifeId: String(lifeId), opened: { at: now, from }, ledgers: Object.fromEntries(Object.entries(s.ledgers).map(([k, b]) => [k, { balance: Math.max(0, intOr0(b)) }])), keys: {}, keyOrder: [], date, income: {}, total: 0,
  property: { vehicles: s.vehicles, homes: s.homes }, record: Object.fromEntries(s.record.filter((e) => e && typeof e.id === 'string').slice(-AUTH.recordMax).map((e) => [e.id, e])), convictions: intOr0(s.convictions),
  standing: { date, base: s.standing, values: s.standing }, rejected: [], stats: { accepted: 0, rejected: 0, syncs: 0 } };
}
function rememberKey(a, k, amount) { a.keys[k] = amount; a.keyOrder.push(k); while (a.keyOrder.length > AUTH.keysMax) delete a.keys[a.keyOrder.shift()]; }
function newDay(a, now) { const d = watDate(now); if (a.date !== d) { a.date = d; a.income = {}; a.total = 0; a.standing.base = { ...a.standing.values, prof: { ...a.standing.values.prof } }; a.standing.date = d; } }
/**
 * Apply one sync from the browser. body = { entries: [{ ledger, key, amount, reason }], record, standing, convictions,
 * property: { vehicles: [ids], homes: [ids] } }. Returns { accepted, rejected: [{ ledger, key, why }], balances,
 * record: entries to put back, standing (the values allowed), convictions, unverified: { vehicles, homes } }.
 */
export function applySync(a, body, now) {
 newDay(a, now); a.stats.syncs++;
 const entries = (Array.isArray(body?.entries) ? body.entries : []).slice(0, AUTH.entriesPerSync), out = { accepted: 0, rejected: [] };
 const reject = (e, why) => { out.rejected.push({ ledger: e.ledger, key: e.key, amount: e.amount, why }); a.rejected.push({ at: now, ledger: e.ledger, key: e.key, amount: e.amount, reason: String(e.reason ?? '').slice(0, 80), why }); if (a.rejected.length > AUTH.rejectedMax) a.rejected.shift(); a.stats.rejected++; };
 const seen = new Map(); // this batch's debits, for matching transfers
 for (const e of entries) {
  if (!e || !LEDGER_RE.test(String(e.ledger)) || typeof e.key !== 'string' || !e.key || e.key.length > 160 || !Number.isInteger(e.amount) || e.amount === 0 || Math.abs(e.amount) > 100_000_000) { reject(e ?? {}, 'not a valid transaction'); continue; }
  const id = `${e.ledger}|${e.key}`; if (id in a.keys) continue; // already counted (idempotent)
  const L = (a.ledgers[e.ledger] ??= { balance: 0 });
  if (e.amount < 0) {
   if (L.balance + e.amount < 0) { reject(e, 'not enough money on the server\'s books'); continue; }
   L.balance += e.amount; rememberKey(a, id, e.amount); seen.set(id, e.amount); a.stats.accepted++; out.accepted++;
   const vb = /^buy-vehicle:(.+)$/.exec(e.key); if (vb) a.property.vehicles[`veh:${vb[1]}`] = -e.amount;
   const hb = /^buy-home:(.+)$/.exec(e.key); if (hb) a.property.homes[hb[1]] = -e.amount;
   continue;
  }
  // a credit: a transfer from another of your accounts (same key, or :out → :in), the undo of your own payment, or earnings
  const pairKeys = [e.key, e.key.replace(/:in$/, ':out')], undo = /:undo$/.test(e.key) ? `${e.ledger}|${e.key.replace(/:undo$/, ':out')}` : null;
  const paired = Object.keys(a.ledgers).some((lg) => lg !== e.ledger && pairKeys.some((k) => { const v = seen.get(`${lg}|${k}`) ?? a.keys[`${lg}|${k}`]; return v === -e.amount; }));
  if (paired || (undo && (seen.get(undo) ?? a.keys[undo]) === -e.amount)) { L.balance += e.amount; rememberKey(a, id, e.amount); a.stats.accepted++; out.accepted++; continue; }
  const rule = ruleFor(e);
  if (rule.id === 'start' && Object.keys(a.keys).some((k) => k.startsWith('wallet|'))) { reject(e, 'starting funds only come once'); continue; }
  if (rule.property === 'vehicle') { const vid = e.key.slice('sell-vehicle:'.length), price = a.property.vehicles[vid]; if (price == null) { reject(e, 'that vehicle was never paid for on this account'); continue; } if (e.amount > Math.max(price, 1)) { reject(e, 'more than the vehicle cost'); continue; } delete a.property.vehicles[vid]; }
  if (e.amount > rule.max) { reject(e, `more than ${rule.label} can pay at once`); continue; }
  if ((a.income[rule.id] ?? 0) + e.amount > rule.day) { reject(e, `more ${rule.label} than possible in a day`); continue; }
  if (!UNCAPPED.has(rule.id) && a.total + e.amount > AUTH.dayTotal) { reject(e, 'more earnings than possible in a day'); continue; }
  a.income[rule.id] = (a.income[rule.id] ?? 0) + e.amount; if (!UNCAPPED.has(rule.id)) a.total += e.amount;
  L.balance += e.amount; rememberKey(a, id, e.amount); a.stats.accepted++; out.accepted++;
 }
 // the legal record is append-only: entries the server has seen come back if they go missing
 const sent = (Array.isArray(body?.record) ? body.record : []).filter((e) => e && typeof e.id === 'string' && typeof e.text === 'string');
 for (const e of sent) { const old = a.record[e.id]; a.record[e.id] = old ? { ...old, status: old.status === 'open' ? e.status : old.status, closedDay: e.closedDay ?? old.closedDay } : { id: e.id, day: e.day, kind: e.kind, agency: e.agency, text: String(e.text).slice(0, 160), status: e.status, ...(e.amount != null ? { amount: e.amount } : {}), ...(e.ref ? { ref: e.ref } : {}) }; }
 const ids = Object.keys(a.record).sort((x, y) => seqOf(x) - seqOf(y)); for (const id of ids.slice(0, Math.max(0, ids.length - AUTH.recordMax))) delete a.record[id];
 const minSent = sent.length ? Math.min(...sent.map((e) => seqOf(e.id))) : Infinity, have = new Set(sent.map((e) => e.id));
 const restore = Object.values(a.record).filter((e) => !have.has(e.id) && (sent.length === 0 || seqOf(e.id) >= minSent));
 // convictions never go down; reputation moves at most so far in a day
 a.convictions = Math.max(a.convictions, intOr0(body?.convictions));
 const st = body?.standing ? standingOf(body.standing) : null; let standing = null;
 if (st) { const b = a.standing.base, lim = AUTH.standingDay, cl = (v, base, lo, hi) => Math.max(lo, Math.min(hi, Math.max(base - lim, Math.min(base + lim, v))));
  const v = { public: cl(st.public, b.public, -100, 100), integrity: cl(st.integrity, b.integrity, -100, 100), notoriety: cl(st.notoriety, b.notoriety, 0, 100), business: cl(st.business, b.business, 0, 100), social: cl(st.social, b.social, 0, 100), prof: Object.fromEntries(Object.entries(st.prof).map(([k, x]) => [k, cl(x, b.prof[k] ?? 0, 0, 100)])) };
  a.standing.values = v; standing = v; }
 // property you have but never paid for on this account: kept, but it can't be sold or pledged
 const unverified = { vehicles: (body?.property?.vehicles ?? []).filter((id) => typeof id === 'string' && !(id in a.property.vehicles)), homes: (body?.property?.homes ?? []).filter((id) => typeof id === 'string' && !(id in a.property.homes)) };
 const incoming = (a.inbox ?? []).splice(0); // moves the server made itself (payments, robberies between players), for the browser to record
 return { ...out, incoming, balances: Object.fromEntries(Object.entries(a.ledgers).map(([k, L]) => [k, L.balance])), record: restore, standing, convictions: a.convictions, unverified };
}
const seqOf = (id) => Number(/(\d+)$/.exec(id)?.[1] ?? 0);
/**
 * Make a save agree with the authority before it's stored: balances, convictions, the record and reputation limits.
 * Returns { data, corrected: [what changed] }. Property is never removed.
 */
export function normaliseSave(a, d) {
 const corrected = [], set = (obj, key, v, what) => { if (obj && obj[key] !== v) { obj[key] = v; corrected.push(what); } };
 set(d.wallet, 'balance', a.ledgers.wallet?.balance ?? d.wallet?.balance, 'wallet');
 if (d.bank?.open && a.ledgers.bank) set(d.bank.account, 'balance', a.ledgers.bank.balance, 'bank account');
 for (const o of d.orgs?.list ?? []) { const L = a.ledgers[`org:${o.id}`]; if (L) set(o.account, 'balance', L.balance, o.name ?? 'a business'); }
 for (const k of d.contracts?.list ?? []) { const L = a.ledgers[`escrow:${k.id}`]; if (L) set(k.escrow, 'balance', L.balance, 'a wage escrow'); }
 if (d.justice && (d.justice.convictions ?? 0) < a.convictions) set(d.justice, 'convictions', a.convictions, 'convictions');
 const rec = d.life?.record; if (rec) { const have = new Set((rec.entries ?? []).map((e) => e.id)), min = rec.entries?.length ? Math.min(...rec.entries.map((e) => seqOf(e.id))) : 0, back = Object.values(a.record).filter((e) => !have.has(e.id) && seqOf(e.id) >= min); if (back.length) { rec.entries = [...rec.entries, ...back].sort((x, y) => seqOf(x.id) - seqOf(y.id)); corrected.push('legal record'); } }
 return { data: d, corrected };
}
/**
 * v0.44 players together: the server itself moves money between two players' books (a payment, or money stolen in a
 * robbery between players). The key is recorded in both books, so when each browser applies the same transaction
 * it is recognised and not counted again. Returns false if the payer's books don't have the money.
 */
export function serverMove(from, to, key, amount, now, { out = 'Paid out', into = 'Received' } = {}) {
 if (!Number.isInteger(amount) || amount <= 0) return false;
 newDay(from, now); newDay(to, now);
 const A = (from.ledgers.wallet ??= { balance: 0 }), B = (to.ledgers.wallet ??= { balance: 0 });
 if (A.balance < amount) return false;
 A.balance -= amount; B.balance += amount; rememberKey(from, `wallet|${key}:out`, -amount); rememberKey(to, `wallet|${key}:in`, amount);
 (from.inbox ??= []).push({ ledger: 'wallet', key: `${key}:out`, amount: -amount, reason: out }); (to.inbox ??= []).push({ ledger: 'wallet', key: `${key}:in`, amount, reason: into });
 return true;
}
/** The rules for players acting on each other (shared by the server and the game). */
export const PVP = {
 kinds: { pickpocket: { label: 'Pick their pocket', chance: 0.55, share: 0.2, max: 5000, severity: 1, offence: 'Theft from a person (pickpocketing)' }, rob: { label: 'Rob them', chance: 0.45, share: 0.35, max: 20000, severity: 2, offence: 'Robbery of a person' } },
 reach: 3, attackerCooldown: 10 * 60_000, victimShield: 30 * 60_000, perDay: 3, peaceLock: 30 * 60_000,
 pay: { max: 500_000, perDay: 2_000_000, reach: 12 },
};
