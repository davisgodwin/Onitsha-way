/**
 * v0.40 reputation: seven separate ways the city judges you (stage 1 of the open-life redesign).
 *
 *  public       how ordinary people see you            -100..100  everyone sees the word (Trusted … Feared)
 *  professional how good you are at each of your jobs     0..100  you and your employers
 *  notoriety    how known you are among criminals         0..100  you and the authorities
 *  integrity    honest or corrupt                       -100..100  you only (and investigators, later)
 *  business     reliability of the work you sell          0..100  everyone, once you trade
 *  social       relationships, friends, community         0..100  everyone
 *  wealth       money and assets (computed, not earned)   tiers   everyone sees the tier; wealth is not respect
 *
 * Rules: scores only move through recorded events (each with a unique key, so nothing counts twice); an unproven
 * claim (a rumour) moves public opinion half as much and changes nothing else; negative public opinion, integrity and
 * notoriety recover slowly once you stop giving people reasons; every change is kept in a history you can read.
 */
export const DIMENSIONS = Object.freeze([
 { id: 'public', label: 'Public reputation', min: -100, max: 100, who: 'Everyone', desc: 'How ordinary people in Onitsha see you.' },
 { id: 'professional', label: 'Professional reputation', min: 0, max: 100, who: 'You and employers', desc: 'How well you do the work you have chosen. Each job has its own.' },
 { id: 'notoriety', label: 'Criminal notoriety', min: 0, max: 100, who: 'You and the authorities', desc: 'How known you are on the streets and to the police. Not the same as a criminal record.' },
 { id: 'integrity', label: 'Integrity', min: -100, max: 100, who: 'Only you', desc: 'Whether your choices have been honest or corrupt.' },
 { id: 'business', label: 'Business reputation', min: 0, max: 100, who: 'Everyone', desc: 'Whether customers and clients can rely on what you sell.' },
 { id: 'social', label: 'Social influence', min: 0, max: 100, who: 'Everyone', desc: 'Your relationships, friends and standing in the community.' },
 { id: 'wealth', label: 'Wealth and status', min: 0, max: 100, who: 'Everyone (tier only)', desc: 'Your money, homes and vehicles. Being rich is not the same as being respected.' },
]);
export const DIMENSION = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d]));
export const WEALTH_TIERS = [[0, 'Struggling'], [50000, 'Getting by'], [300000, 'Comfortable'], [1500000, 'Well off'], [6000000, 'Wealthy'], [25000000, 'Rich']];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
export const LOG_MAX = 80, KEYS_MAX = 600;

export function newStanding() { return { v: 1, public: 0, notoriety: 0, integrity: 0, business: 0, social: 0, prof: {}, praise: 0, blame: 0, lastBad: {}, keys: [], log: [] }; }
export function ensureStanding(raw) {
 const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : newStanding();
 for (const d of ['public', 'integrity']) s[d] = clamp(num(s[d]), -100, 100);
 for (const d of ['notoriety', 'business', 'social']) s[d] = clamp(num(s[d]), 0, 100);
 s.prof = s.prof && typeof s.prof === 'object' && !Array.isArray(s.prof) ? Object.fromEntries(Object.entries(s.prof).filter(([, v]) => Number.isFinite(v)).map(([k, v]) => [k, clamp(v, 0, 100)])) : {};
 s.praise = Math.max(0, num(s.praise)); s.blame = Math.max(0, num(s.blame));
 s.lastBad = s.lastBad && typeof s.lastBad === 'object' ? s.lastBad : {};
 s.keys = Array.isArray(s.keys) ? s.keys.filter((k) => typeof k === 'string').slice(-KEYS_MAX) : [];
 s.log = Array.isArray(s.log) ? s.log.filter((e) => e && typeof e.text === 'string').slice(-LOG_MAX) : [];
 s.v = 1; return s;
}

/** Words for a score. `ctx` lets public opinion read notoriety and fame (feared, controversial, known). */
export function labelFor(id, value, ctx = {}) {
 if (id === 'public') {
  if (value <= -30 && (ctx.notoriety ?? 0) >= 50) return 'Feared';
  if (value <= -30) return 'Disliked';
  if (value >= 60) return 'Trusted';
  if (value >= 30) return 'Respected';
  if ((ctx.praise ?? 0) >= 15 && (ctx.blame ?? 0) >= 15) return 'Controversial';
  if ((ctx.social ?? 0) >= 20 || Math.abs(value) >= 10) return 'Known';
  return 'Unknown';
 }
 if (id === 'integrity') return value <= -60 ? 'Corrupt' : value <= -20 ? 'Questionable' : value < 20 ? 'Untested' : value < 60 ? 'Honest' : 'Incorruptible';
 if (id === 'notoriety') return value < 5 ? 'Unknown to criminals' : value < 25 ? 'Noticed' : value < 50 ? 'Known on the streets' : value < 75 ? 'Notorious' : 'Infamous';
 if (id === 'professional') return value < 10 ? 'New' : value < 30 ? 'Learning' : value < 50 ? 'Reliable' : value < 75 ? 'Skilled' : 'Expert';
 if (id === 'business') return value < 10 ? 'No track record' : value < 35 ? 'New in business' : value < 60 ? 'Reliable' : value < 85 ? 'Respected' : 'Leading';
 if (id === 'social') return value < 10 ? 'Newcomer' : value < 30 ? 'Has friends' : value < 55 ? 'Well connected' : value < 80 ? 'Influential' : 'Community pillar';
 return '';
}
/** Net worth in naira → a tier word and a 0..100 bar (log scale up to "Rich"). */
export function wealthOf(netWorth) {
 const n = Math.max(0, num(netWorth)); let tier = WEALTH_TIERS[0][1]; for (const [at, w] of WEALTH_TIERS) if (n >= at) tier = w;
 return { netWorth: Math.round(n), tier, bar: Math.round(clamp(Math.log10(1 + n) / Math.log10(1 + 25000000), 0, 1) * 100) };
}

export class Standing {
 constructor(state) { this.s = ensureStanding(state); }
 has(key) { return this.s.keys.includes(key); }
 /**
  * Record something that happened. Returns false if this event (key) was already counted.
  * evt = { key, day, text, public?, integrity?, notoriety?, business?, social?, prof?: { [occupationId]: n }, rumour? }
  */
 record(evt) {
  const s = this.s; if (!evt?.key || this.has(evt.key)) return false;
  const rumour = evt.rumour === true, d = {};
  const move = (id, by, lo, hi) => { if (!Number.isFinite(by) || !by) return; const before = s[id]; s[id] = clamp(before + by, lo, hi); if (s[id] !== before) d[id] = Math.round((s[id] - before) * 10) / 10; };
  move('public', rumour ? (evt.public ?? 0) * 0.5 : evt.public, -100, 100);
  if (!rumour) {
   move('integrity', evt.integrity, -100, 100); move('notoriety', evt.notoriety, 0, 100);
   move('business', evt.business, 0, 100); move('social', evt.social, 0, 100);
   for (const [k, by] of Object.entries(evt.prof ?? {})) { if (!Number.isFinite(by) || !by) continue; const b = s.prof[k] ?? 0; s.prof[k] = clamp(b + by, 0, 100); if (s.prof[k] !== b) (d.prof ??= {})[k] = Math.round((s.prof[k] - b) * 10) / 10; }
  }
  if ((evt.public ?? 0) > 0) s.praise += evt.public; if ((evt.public ?? 0) < 0) s.blame -= evt.public;
  const day = Math.floor(num(evt.day, 1));
  for (const id of ['public', 'integrity']) if ((d[id] ?? 0) < 0) s.lastBad[id] = day;
  if ((d.notoriety ?? 0) > 0) s.lastBad.notoriety = day;
  s.keys.push(evt.key); if (s.keys.length > KEYS_MAX) s.keys.splice(0, s.keys.length - KEYS_MAX);
  s.log.push({ day, text: String(evt.text ?? '').slice(0, 160), d, ...(rumour ? { rumour: true } : {}) }); if (s.log.length > LOG_MAX) s.log.shift();
  return true;
 }
 /** Once a game day: bad feeling fades if you've given no new reason for a while. */
 newDay(day) {
  const s = this.s, quiet = (id, n) => day - (s.lastBad[id] ?? -999) >= n;
  if (s.public < 0 && quiet('public', 3)) s.public = Math.min(0, s.public + 1);
  if (s.integrity < 0 && quiet('integrity', 5)) s.integrity = Math.min(0, s.integrity + 1);
  if (s.notoriety > 0 && quiet('notoriety', 5)) s.notoriety = Math.max(0, s.notoriety - 1);
 }
 value(id, occ = null) { return id === 'professional' ? (occ ? this.s.prof[occ] ?? 0 : Math.max(0, ...Object.values(this.s.prof))) : this.s[id] ?? 0; }
 label(id, occ = null) { return labelFor(id, this.value(id, occ), this.s); }
 /** What another person would see about you: labels only for the public dimensions, nothing private. */
 publicView(netWorth = 0) { return { public: this.label('public'), social: this.label('social'), business: this.s.business > 0 ? this.label('business') : null, wealth: wealthOf(netWorth).tier }; }
}
