/**
 * v0.42 crime against the city (pure rules; JusticeController runs them in the world).
 *
 * Crime is something you can choose to do, never something the game pushes you into, and it has consequences:
 * witnesses and cameras leave evidence, the police (or the EFCC) open a case, investigate it day by day, and may put
 * out a warrant. Nothing here describes how to commit a real crime: each act is one choice with a chance of success
 * worked out from your skill, the time, who is watching and how well you prepared. Children can't commit crimes.
 */
export const CRIMES = {
 pickpocket: { label: 'Pick their pocket', offence: 'Theft (pickpocketing)', agency: 'police', severity: 1, base: 0.55, loot: [300, 4500], cash: true, minutes: 2, notoriety: 2, integrity: -5 },
 stall: { label: 'Rob the stall', offence: 'Robbery of a market stall', agency: 'police', severity: 2, base: 0.45, loot: [3000, 22000], goods: true, minutes: 5, notoriety: 4, integrity: -8 },
 breakin: { label: 'Break into the house', offence: 'Burglary', agency: 'police', severity: 3, base: 0.5, loot: [8000, 60000], goods: true, needs: 'kit', minutes: 25, notoriety: 6, integrity: -10 },
 heist: { label: 'Rob the bank (planned heist)', offence: 'Robbery (planned heist on a bank)', agency: 'police', severity: 4, base: 0.3, loot: [350000, 1200000], cash: true, needs: 'plan', minutes: 40, notoriety: 25, integrity: -20 },
};
/** What stolen goods look like in your bag (value = what the owner paid; a fence pays a fraction). */
export const LOOT_GOODS = ['phone', 'wristwatch', 'jewellery', 'laptop', 'wrapper of fabric', 'cash box', 'speaker', 'gold chain', 'tablet', 'radio'];
export const FENCE = { rate: 0.4, perHustle: 0.02, max: 0.6, kitPrice: 15000, crewPrice: 25000, heistCrew: 2 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r50 = (n) => Math.round(n / 50) * 50;
/**
 * The chance a crime comes off, 5%–90%.
 * ctx = { skill (hustle level 1–10), fitness, witnesses (people nearby), police (officers nearby), night, crew, scouted,
 *  getaway (own vehicle), rep (notoriety 0–100: known faces are watched) }
 */
export function chance(kind, ctx = {}) {
 const C = CRIMES[kind]; if (!C) return 0;
 let p = C.base + ((ctx.skill ?? 1) - 1) * 0.035 + ((ctx.fitness ?? 1) - 1) * 0.01;
 p -= Math.min(6, ctx.witnesses ?? 0) * 0.05 + Math.min(2, ctx.police ?? 0) * 0.25;
 if (ctx.night) p += kind === 'pickpocket' ? -0.05 : 0.1;
 if (kind === 'heist') p += Math.min(4, ctx.crew ?? 0) * 0.06 + (ctx.scouted ? 0.12 : 0) + (ctx.getaway ? 0.08 : 0);
 p -= (ctx.rep ?? 0) / 600;
 return clamp(Math.round(p * 100) / 100, 0.05, 0.9);
}
/**
 * One attempt. Returns { kind, ok, caught, loot (cash), goods [{ name, value }], evidence (0–1+), witnesses, text }.
 * Failing is worse with police around: they give chase. Witnesses and cameras turn into evidence either way.
 */
export function attempt(kind, ctx = {}) {
 const C = CRIMES[kind], rng = ctx.rng ?? Math.random; if (!C) return { ok: false, error: 'Unknown crime' };
 const p = chance(kind, ctx), ok = rng() < p, w = Math.min(8, ctx.witnesses ?? 0);
 let evidence = w * (ok ? 0.06 : 0.12) + (ctx.cctv ? (ok ? 0.25 : 0.4) : 0) + (kind === 'heist' ? 0.35 : 0);
 if (!ok) evidence += 0.25;
 const caught = !ok && rng() < 0.35 + Math.min(2, ctx.police ?? 0) * 0.3;
 const out = { kind, ok, caught, chance: p, witnesses: w, loot: 0, goods: [], evidence: Math.round(evidence * 100) / 100 };
 if (ok) {
  const [a, b] = C.loot, value = r50(a + (b - a) * rng() * (kind === 'heist' ? 0.6 + 0.4 * Math.min(1, (ctx.crew ?? 0) / 4) : 1));
  if (C.cash) out.loot = value;
  else { const n = 1 + Math.floor(rng() * 3); for (let i = 0; i < n; i++) out.goods.push({ name: LOOT_GOODS[Math.floor(rng() * LOOT_GOODS.length)], value: Math.max(500, r50(value / n)) }); }
 }
 out.text = ok ? (C.cash ? `Got away with ${out.loot}` : `Got away with ${out.goods.map((x) => x.name).join(', ')}`) : caught ? 'Seen and chased' : 'It went wrong: people noticed and you backed off';
 return out;
}
/** What a fence pays for stolen goods: 40% of their value, more if you can bargain (hustle). */
export const fenceRate = (hustle = 1) => Math.round(clamp(FENCE.rate + (hustle - 1) * FENCE.perHustle, FENCE.rate, FENCE.max) * 100) / 100;
export const fencePrice = (value, hustle) => r50(value * fenceRate(hustle));
/** Can you try a heist now? plan = { kit, crew, scouted, night } */
export function heistReady(plan = {}) {
 const missing = [];
 if (!plan.kit) missing.push('Tools (buy from the back-street dealer)');
 if ((plan.crew ?? 0) < FENCE.heistCrew) missing.push(`A crew of ${FENCE.heistCrew} (hire at the dealer, or your Hustle Kingdom)`);
 if (!plan.scouted) missing.push('Case the bank in daylight first');
 if (!plan.night) missing.push('Only at night (22:00–4:00)');
 return { ok: !missing.length, missing };
}
/** Crime reported in the city each day, for police on duty to deal with (deterministic for a day). */
export function incidentsFor(day, places, n = 3) {
 const list = []; let h = (day * 2654435761) >>> 0; const r = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
 const kinds = [['stall', 'A trader reports her stall was robbed'], ['pickpocket', 'A passenger lost his phone at the park'], ['breakin', 'A family came home to a break-in'], ['assault', 'A fight outside a beer parlour'], ['fraud', 'A shop owner was paid with a fake transfer']];
 for (let i = 0; i < n && places.length; i++) { const [kind, text] = kinds[Math.floor(r() * kinds.length)], at = places[Math.floor(r() * places.length)]; list.push({ id: `inc:${day}:${i}`, kind, text, at: { x: at.x, z: at.z, name: at.name ?? at.label ?? 'the city' } }); }
 return list;
}
