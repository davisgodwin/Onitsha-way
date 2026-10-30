/**
 * v0.47 stage 7 (second part): pure rules for the remaining roles. Fictional clients, firms, clubs and crews; game
 * prices, not real ones. Adults only for all of it.
 */
export const rng = (seed) => { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
export const hash = (str) => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r50 = (n) => Math.round(n / 50) * 50;
const FIRST = ['Chinedu', 'Ngozi', 'Emeka', 'Adaeze', 'Obinna', 'Ifeoma', 'Uche', 'Chiamaka', 'Kelechi', 'Nkechi', 'Ikenna', 'Amaka', 'Tobenna', 'Ebele', 'Somto', 'Ugochi'];
const LAST = ['Okafor', 'Nwosu', 'Eze', 'Obi', 'Okeke', 'Nnaji', 'Onwuka', 'Igwe', 'Anyanwu', 'Chukwu', 'Ezeh', 'Nwankwo'];
export const personName = (seed) => { const r = rng(seed); return `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`; };

export function newVentures() { return { v: 1, seq: 0, events: [], decor: [], agency: null, lets: {}, builds: [], security: null, crew: null, club: null, coach: null, callout: null, done: {} }; }
export function ensureVentures(raw) {
 const o = raw && typeof raw === 'object' ? raw : newVentures();
 o.v = 1; o.seq = Number.isInteger(o.seq) ? o.seq : 0;
 for (const k of ['events', 'decor', 'builds']) o[k] = Array.isArray(o[k]) ? o[k].filter((x) => x && typeof x === 'object').slice(-40) : [];
 o.lets = o.lets && typeof o.lets === 'object' ? o.lets : {}; o.done = o.done && typeof o.done === 'object' ? o.done : {};
 for (const k of ['agency', 'security', 'crew', 'club', 'coach', 'callout']) if (o[k] != null && typeof o[k] !== 'object') o[k] = null; else o[k] ??= null;
 return o;
}

// ── event planner ──────────────────────────────────────────────────────────────────────────────────
export const EVENT_KINDS = [
 { id: 'igbankwu', label: 'Traditional wedding (igba nkwu)', guests: [150, 400], budget: [600_000, 1_400_000] },
 { id: 'birthday', label: 'Birthday party', guests: [40, 120], budget: [150_000, 400_000] },
 { id: 'dedication', label: 'Child dedication', guests: [50, 120], budget: [120_000, 300_000] },
 { id: 'graduation', label: 'Graduation party', guests: [60, 150], budget: [200_000, 450_000] },
 { id: 'burial', label: 'Burial reception', guests: [200, 500], budget: [700_000, 1_600_000] },
];
/** The suppliers you choose: each tier costs a share of the guest count and gives quality. */
export const SUPPLY = {
 venue: [{ id: 'compound', label: 'Family compound + canopies', perGuest: 900, q: 1 }, { id: 'hall', label: 'Event hall', perGuest: 1800, q: 2 }, { id: 'garden', label: 'Garden venue, decorated', perGuest: 3200, q: 3 }],
 food: [{ id: 'basic', label: 'Rice and drinks', perGuest: 1600, q: 1 }, { id: 'full', label: 'Full buffet: jollof, soups, small chops', perGuest: 2600, q: 2 }, { id: 'grand', label: 'Grand buffet + cocktails + cake', perGuest: 4000, q: 3 }],
 music: [{ id: 'speaker', label: 'A speaker and a playlist', flat: 30_000, q: 1 }, { id: 'dj', label: 'A DJ and an MC', flat: 90_000, q: 2 }, { id: 'band', label: 'A highlife band, a DJ and an MC', flat: 240_000, q: 3 }],
};
export function eventOffers(day, n = 3) {
 const out = [];
 for (let i = 0; i < n; i++) { const r = rng(hash(`ev:${day}:${i}`)), K = EVENT_KINDS[Math.floor(r() * EVENT_KINDS.length)], guests = Math.round(K.guests[0] + r() * (K.guests[1] - K.guests[0])), budget = r50(K.budget[0] + r() * (K.budget[1] - K.budget[0]));
  out.push({ id: `ev${day}-${i}`, kind: K.id, label: K.label, client: personName(hash(`evc:${day}:${i}`)), guests, budget, day: day + 2 + (i % 3), hours: [12, 18] }); }
 return out;
}
export function eventCost(guests, pick) { let c = 0; for (const k of ['venue', 'food', 'music']) { const t = SUPPLY[k][pick[k]]; c += t.perGuest ? t.perGuest * guests : t.flat; } return r50(c); }
/** How the day went: quality of what you bought, against what a budget like that expects, and your handling. */
export function eventResult(ev, pick, handled) {
 const q = SUPPLY.venue[pick.venue].q + SUPPLY.food[pick.food].q + SUPPLY.music[pick.music].q, expect = ev.budget / ev.guests > 5200 ? 7 : ev.budget / ev.guests > 3400 ? 5 : 4;
 const score = q - expect + (handled ? 1 : -2), cost = eventCost(ev.guests, pick);
 const fee = ev.budget * 0.08 * (score >= 1 ? 1.3 : score >= 0 ? 1 : score >= -2 ? 0.6 : 0.3), paid = r50(Math.min(cost, ev.budget) + fee); // the client covers the suppliers (up to the budget) plus your fee
 return { score, cost, paid, profit: paid - cost, grade: score >= 1 ? 'a great day' : score >= 0 ? 'a good day' : score >= -2 ? 'some complaints' : 'a disappointed client' };
}

// ── interior decorator ─────────────────────────────────────────────────────────────────────────────
export const DECOR_STYLES = ['modern', 'classic', 'afro-chic'];
export const DECOR_ITEMS = [
 { id: 'sectional', label: 'Grey sectional sofa', price: 380_000, tags: ['modern'] },
 { id: 'chesterfield', label: 'Leather Chesterfield sofa', price: 520_000, tags: ['classic'] },
 { id: 'ankara-sofa', label: 'Sofa in ankara fabric', price: 300_000, tags: ['afro-chic'] },
 { id: 'glass-table', label: 'Glass coffee table', price: 90_000, tags: ['modern'] },
 { id: 'carved-table', label: 'Carved wooden table', price: 140_000, tags: ['afro-chic', 'classic'] },
 { id: 'chandelier', label: 'Crystal chandelier', price: 260_000, tags: ['classic'] },
 { id: 'pendants', label: 'Black pendant lights', price: 70_000, tags: ['modern'] },
 { id: 'uli-art', label: 'Uli wall paintings', price: 110_000, tags: ['afro-chic'] },
 { id: 'raffia', label: 'Raffia and wood blinds', price: 60_000, tags: ['afro-chic', 'modern'] },
 { id: 'drapes', label: 'Heavy gold drapes', price: 120_000, tags: ['classic'] },
];
export function decorBriefs(day, n = 3) {
 const out = [];
 for (let i = 0; i < n; i++) { const r = rng(hash(`dc:${day}:${i}`)), style = DECOR_STYLES[Math.floor(r() * 3)], room = ['living room', 'bedroom', 'shop front'][Math.floor(r() * 3)], budget = r50(500_000 + r() * 700_000);
  out.push({ id: `dc${day}-${i}`, client: personName(hash(`dcc:${day}:${i}`)), style, room, budget, fee: r50(budget * 0.02) }); }
 return out;
}
/** Three items chosen for a brief: how well they match the style and stay in budget. */
export function decorScore(brief, ids) {
 const items = ids.map((id) => DECOR_ITEMS.find((x) => x.id === id)).filter(Boolean), cost = items.reduce((a, x) => a + x.price, 0), match = items.filter((x) => x.tags.includes(brief.style)).length;
 const over = cost > brief.budget; const fee = over ? r50(brief.fee * 0.5) : r50(brief.fee * (0.6 + 0.2 * match));
 return { cost, match, over, fee, grade: over ? 'over budget' : match === 3 ? 'exactly what they wanted' : match === 2 ? 'nearly right' : 'not their style' };
}

// ── tech agency ────────────────────────────────────────────────────────────────────────────────────
export const AGENCY = { found: 50_000, wage: 6000, maxStaff: 4, maxBriefs: 3, devEffort: 2 };
export const BRIEF_KINDS = [{ id: 'website', label: 'Business website', effort: 12, fee: 72_000 }, { id: 'shop', label: 'Online shop', effort: 20, fee: 120_000 }, { id: 'app', label: 'Mobile app', effort: 32, fee: 190_000 }, { id: 'brand', label: 'Logo and branding', effort: 8, fee: 48_000 }];
export function agencyBriefs(day, n = 3) {
 const out = []; for (let i = 0; i < n; i++) { const r = rng(hash(`ag:${day}:${i}`)), K = BRIEF_KINDS[Math.floor(r() * BRIEF_KINDS.length)], biz = ['Okafor Textiles', 'Nne Chika Foods', 'Iweka Motors', 'Ochanja Fresh Farm', 'Niger Spare Parts', 'Bright Future School', 'Amaka Beauty Place'][Math.floor(r() * 7)];
  out.push({ id: `ag${day}-${i}`, kind: K.id, label: K.label, client: biz, effort: K.effort, fee: K.fee, days: Math.ceil(K.effort / 3) + 2 }); }
 return out;
}
/** A day of agency work: your own effort (if you worked) plus each developer. Returns the effort spent. */
export const agencyCapacity = (coding, staff, workedYourself) => (workedYourself ? 2 + coding * 0.6 : 0) + staff * AGENCY.devEffort;

// ── landlord and developer ─────────────────────────────────────────────────────────────────────────
export function tenantsFor(homeId, rentBase, day) {
 return [0, 1, 2].map((i) => { const r = rng(hash(`tn:${homeId}:${day}:${i}`)); const rel = 0.55 + r() * 0.43; return { id: `t${i}`, name: personName(hash(`tnn:${homeId}:${day}:${i}`)), rent: r50(rentBase * (0.85 + (1 - rel) * 0.4 + r() * 0.1)), reliability: Math.round(rel * 100) / 100, job: ['trader', 'teacher', 'nurse', 'mechanic', 'civil servant', 'tailor'][Math.floor(r() * 6)] }; });
}
/** A week of rent: paid or not (deterministic per week), and maybe a repair the landlord has to pay for. */
export function rentWeek(let_, week) { const r = rng(hash(`rw:${let_.homeId}:${let_.tenant.name}:${week}`)); const paid = r() < let_.tenant.reliability; const repair = r() < 0.12 ? r50(15_000 + r() * 40_000) : 0; return { paid, repair }; }
export const BUILD = { stages: [{ id: 'blocks', label: 'Finish the blockwork', share: 0.3, days: 2 }, { id: 'roof', label: 'Roof it', share: 0.3, days: 2 }, { id: 'finish', label: 'Plaster, wire, plumb and paint', share: 0.4, days: 3 }], perM2: 90_000, landPerM2: 35_000, saleMargin: 1.12, rentPerM2Week: 900 };
export const buildCosts = (area) => ({ land: r50(area * BUILD.landPerM2), works: r50(area * BUILD.perM2), sale: r50(area * (BUILD.landPerM2 + BUILD.perM2) * BUILD.saleMargin), rentWeek: r50(area * BUILD.rentPerM2Week) });

// ── roadside mechanic ──────────────────────────────────────────────────────────────────────────────
export const FAULTS = [
 { id: 'battery', symptom: 'The engine won\'t crank; the dashboard lights are dim.', fix: 'Jump-start it and replace the battery terminal', wrong: ['Change the fuel pump', 'Top up the radiator'] },
 { id: 'overheat', symptom: 'Steam from the bonnet; the temperature needle is in the red.', fix: 'Let it cool, find the leaking hose, replace it and refill the coolant', wrong: ['Pour cold water on the hot engine at once', 'Replace the battery'] },
 { id: 'fuelpump', symptom: 'The engine cranks but won\'t start; there\'s fuel in the tank.', fix: 'Test the fuel pump and replace it', wrong: ['Charge the battery', 'Change the tyres'] },
 { id: 'tyre', symptom: 'A flat front tyre, the rim on the ground.', fix: 'Jack it up safely, fit the spare, check the pressure', wrong: ['Drive on it to the next vulcaniser', 'Replace the battery'] },
];
export function calloutFor(day, n) { const r = rng(hash(`co:${day}:${n}`)); return { id: `co${day}-${n}`, fault: FAULTS[Math.floor(r() * FAULTS.length)].id, owner: personName(hash(`coo:${day}:${n}`)), pay: r50(6_000 + r() * 9_000) }; }

// ── security company ───────────────────────────────────────────────────────────────────────────────
export const SECURITY = { licence: 100_000, wage: 2500, maxGuards: 8, trainCost: 15_000 };
export const SECURITY_CLIENTS = [
 { id: 'estate', label: 'Riverside Estate (gate)', guards: 2, feeWeek: 56_000 },
 { id: 'warehouse', label: 'Niger Spare Parts warehouse', guards: 2, feeWeek: 60_000 },
 { id: 'school', label: 'Bright Future School', guards: 1, feeWeek: 28_000 },
 { id: 'plaza', label: 'Iweka Road plaza', guards: 3, feeWeek: 86_000 },
];
/** A night at one client: an attempted break-in (sometimes) and whether your guards stopped it. */
export function securityNight(seed, guards, training) { const r = rng(seed); const attempt = r() < 0.12; const stopped = !attempt || r() < clamp(0.45 + training * 0.12 + guards * 0.05, 0, 0.97); return { attempt, stopped }; }

// ── street crew (abstract; adults) ─────────────────────────────────────────────────────────────────
export const TURF = [{ id: 'upper-iweka-park', label: 'Upper Iweka Motor Park' }, { id: 'main-market', label: 'Main Market gates' }, { id: 'bridgehead', label: 'Bridgehead' }, { id: 'ochanja', label: 'Ochanja Market' }];
export const RIVALS = [{ id: 'bornfree', name: 'Born Free Boys' }, { id: 'ogbaru', name: 'Ogbaru Lions' }, { id: 'riverside', name: 'Riverside Boys' }];
/** Crew activities: what each does to your influence, the money (if any), and whether it's a crime the police record. */
export const CREW_JOBS = {
 watch: { label: 'Community watch at night', influence: 3, pay: 0, public: 2, crime: false },
 loading: { label: 'Load buses at the park (loading fee)', influence: 2, pay: 6000, public: 0, crime: false },
 levy: { label: 'Collect a "levy" from traders', influence: 5, pay: 18_000, public: -4, crime: true, evidence: 0.45 },
};

// ── football: the Onitsha league ──────────────────────────────────────────────────────────────────
export const CLUB = { name: 'Onitsha City FC', youth: 'Onitsha City Academy U-17', trialFitness: 3, coachNeeds: { fitness: 3, charisma: 3 }, appearance: 6000, winBonus: 8000, trainPay: 1500, coachWeek: 25_000 };
export const LEAGUE = ['Onitsha City FC', 'Fegge Rangers', 'Odoakpu Stars', 'Woliwo United', 'Okpoko Warriors', 'GRA Strikers'];
/** The round-robin fixture for week w (6 teams): pairs of team indices. */
export function fixtures(w) { const n = LEAGUE.length, t = [...Array(n).keys()], rot = w % (n - 1), rest = t.slice(1); const r = [...rest.slice(rot), ...rest.slice(0, rot)], all = [t[0], ...r], out = []; for (let i = 0; i < n / 2; i++) out.push([all[i], all[n - 1 - i]]); return out; }
/** A simulated match from two ratings (and a tactic for the coached side): deterministic for the seed. */
export function simMatch(ra, rb, seed, tactic = 'balanced') { const r = rng(seed); const att = tactic === 'attack' ? 1.25 : tactic === 'defend' ? 0.8 : 1, def = tactic === 'defend' ? 0.75 : tactic === 'attack' ? 1.2 : 1; const goals = (rate) => { let g = 0; for (let i = 0; i < 6; i++) if (r() < rate) g++; return g; }; const a = goals(clamp(0.18 * (ra / rb) * att, 0.03, 0.6)), b = goals(clamp(0.18 * (rb / ra) * def, 0.03, 0.6)); return [a, b]; }
export function table(results) { const T = LEAGUE.map((name, i) => ({ i, name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 })); for (const { a, b, s } of results) { const A = T[a], B = T[b]; A.p++; B.p++; A.gf += s[0]; A.ga += s[1]; B.gf += s[1]; B.ga += s[0]; if (s[0] > s[1]) { A.w++; B.l++; A.pts += 3; } else if (s[0] < s[1]) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; } } return T.sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.i - y.i); }
