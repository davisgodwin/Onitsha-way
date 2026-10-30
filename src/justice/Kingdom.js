/**
 * v0.42 Hustle Kingdoms (pure rules). Kept abstract on purpose: a scheme is one choice of size with a risk, a payout
 * and heat. No technique is described. A kingdom is a crew in a house; the EFCC watches crews, and a member who
 * doesn't trust you may become an informant. Enough evidence and the EFCC raids: arrests and seizure.
 *
 * kingdom = { name, day, role: 'boss' | 'member', boss?, members: [{ id, name, loyalty, skill, informant, day }],
 *   pot, schemes, heat, lastScheme, caseId }
 */
export const SCHEMES = {
 small: { label: 'Small scheme', gross: [15000, 45000], heat: 6, minutes: 120, members: 0, skill: 1, base: 0.7 },
 medium: { label: 'Bigger scheme', gross: [60000, 160000], heat: 14, minutes: 240, members: 2, skill: 3, base: 0.6 },
 big: { label: 'The big one', gross: [300000, 750000], heat: 30, minutes: 360, members: 4, skill: 5, base: 0.5 },
};
export const KINGDOM = { maxMembers: 6, memberCut: 0.08, bossCut: 0.5, heatDecay: 4, perDay: 1, informantHeat: 40 };
export const NPC_KINGDOMS = ['The Okpoko Boys', 'Fegge Connect', 'Odoakpu Syndicate'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r50 = (n) => Math.round(n / 50) * 50;
export function newKingdom(name, day, { role = 'boss', boss = null } = {}) { return { name: String(name).slice(0, 40), day: Math.floor(day ?? 1), role, boss, members: [], pot: 0, schemes: 0, heat: 0, lastScheme: 0, caseId: null }; }
/** A recruit: deterministic from a seed. Loyalty is hidden; references only hint at it. */
export function recruit(seed) {
 let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } const r = (k) => (((h ^ (k * 2654435761)) >>> 0) % 1000) / 1000;
 const names = ['Kene', 'Dubem', 'Ifechi', 'Nnamdi', 'Zubby', 'Ekene', 'Onyeka', 'Jide', 'Bobo', 'Tochi', 'Kosi', 'Ugo'];
 const loyalty = Math.round((0.45 + r(1) * 0.55) * 100) / 100, skill = Math.round((0.5 + r(2) * 0.6) * 100) / 100;
 return { id: `m:${seed}`, name: names[Math.floor(r(3) * names.length)], loyalty, skill, informant: false, hint: loyalty >= 0.85 ? 'Known to keep quiet' : loyalty >= 0.65 ? 'Unknown' : 'Talks too much' };
}
/** Can this scheme be run today? ctx = { day, hustle } */
export function canRun(k, size, ctx) {
 const S = SCHEMES[size]; if (!S) return { ok: false, error: 'Unknown scheme' };
 if (k.lastScheme === ctx.day) return { ok: false, error: 'One scheme a day' };
 if (k.role === 'boss' && k.members.length < S.members) return { ok: false, error: `Needs ${S.members} members` };
 if ((ctx.hustle ?? 1) < S.skill) return { ok: false, error: `Needs Hustle level ${S.skill}` };
 return { ok: true };
}
/**
 * Run a scheme. Returns { ok, gross, cut (to members or the boss), mine, heat, informants: [names who turned] }.
 * As a member you take half after the boss; as boss you pay each member a cut.
 */
export function runScheme(k, size, ctx = {}) {
 const S = SCHEMES[size], rng = ctx.rng ?? Math.random, can = canRun(k, size, ctx); if (!can.ok) return can;
 const crew = k.members.reduce((s, m) => s + m.skill, 0) / Math.max(1, k.members.length);
 const p = clamp(S.base + ((ctx.hustle ?? 1) - S.skill) * 0.04 + (k.members.length ? (crew - 0.75) * 0.2 : 0), 0.1, 0.92), ok = rng() < p;
 k.lastScheme = ctx.day; k.schemes++; k.heat = clamp(k.heat + S.heat * (ok ? 1 : 0.6), 0, 200);
 const out = { ok, chance: p, gross: 0, cut: 0, mine: 0, heat: S.heat, informants: [], minutes: S.minutes };
 if (ok) {
  out.gross = r50(S.gross[0] + (S.gross[1] - S.gross[0]) * rng());
  out.cut = k.role === 'member' ? r50(out.gross * KINGDOM.bossCut) : r50(out.gross * KINGDOM.memberCut * k.members.length);
  out.mine = out.gross - out.cut;
 }
 // heat makes people nervous: a member who doesn't trust you may start talking to the EFCC
 for (const m of k.members) if (!m.informant && k.heat > 10 && rng() < (k.heat / 250) * (1 - m.loyalty) * 1.5) { m.informant = true; out.informants.push(m.name); }
 return out;
}
/** A day passes: heat cools; each informant feeds the EFCC. Returns evidence added to the kingdom's case. */
export function kingdomDay(k) { k.heat = clamp(k.heat - KINGDOM.heatDecay, 0, 200); return k.members.filter((m) => m.informant).length * 0.12 + (k.heat > KINGDOM.informantHeat ? 0.05 : 0); }
/** Charisma helps you read your people: true informants are spotted with this chance. */
export function suspect(k, charisma = 1, rng = Math.random) { return k.members.map((m) => ({ ...m, flagged: m.informant ? rng() < 0.3 + charisma * 0.06 : rng() < 0.08 })); }
/** Paying more buys loyalty (not back from informing). */
export function payMore(k, amount) { const each = amount / Math.max(1, k.members.length); for (const m of k.members) if (!m.informant) m.loyalty = clamp(m.loyalty + each / 50000, 0, 1); }
