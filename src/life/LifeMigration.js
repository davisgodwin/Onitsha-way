import { newWork, ensureWork } from './Occupations.js';
import { newStanding, ensureStanding } from './Standing.js';
import { newRecord, ensureRecord } from './LegalRecord.js';
import { OCCUPATION } from '../data/occupations.js';
/**
 * v17 → v18 (v0.40 open life). Nothing is taken away from an existing life:
 *  - the career you chose becomes your current job at its starting rank (you can resign);
 *  - the work you already did counts: trader jobs, keke trips and wholesale deliveries make you known for them;
 *  - your story trust, heat and choices seed your reputation; fines, wanted and custody seed your record;
 *  - the retired story contract and the "Find Your Friend" tracker are cleared (any reward already paid stays paid).
 */
export function newLife() { return { work: newWork(), standing: newStanding(), record: newRecord() }; }
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function migrateLife(data) {
 if (data.life && typeof data.life === 'object' && !Array.isArray(data.life)) return { work: ensureWork(data.life.work), standing: ensureStanding(data.life.standing), record: ensureRecord(data.life.record) };
 const life = newLife(), day = Number.isInteger(data.clock?.day) ? data.clock.day : 1, st = data.story && typeof data.story === 'object' ? data.story : {};
 const w = life.work, s = life.standing, r = life.record;
 // the old career → today's job
 const career = [st.career, data.character?.career].find((id) => OCCUPATION[id]?.kind === 'employed');
 if (career && (data.character?.ageGroup !== 'child' || OCCUPATION[career].child)) {
  w.current = { id: career, rank: 0, since: day, shifts: 0, clean: 0, warnings: 0, lastDay: 0, today: 0, dilemmas: 0 };
  w.history.push({ day, text: `Carried over from your old career: ${OCCUPATION[career].ranks[0]} (${OCCUPATION[career].label})` });
 }
 // work already done → self-employment
 const counts = { errands: Array.isArray(data.jobs?.completed) ? data.jobs.completed.length : 0, keke: Number.isFinite(data.business?.trips) ? data.business.trips : 0, trader: Array.isArray(data.wholesale?.done) ? data.wholesale.done.length : 0 };
 for (const [id, acts] of Object.entries(counts)) {
  if (!(acts > 0)) continue; const o = OCCUPATION[id]; let rank = 0; while (rank + 1 < o.ranks.length && acts >= o.acts[rank + 1]) rank++;
  w.self[id] = { since: day, acts: Math.floor(acts), rank }; s.prof[id] = clamp(Math.round(acts * (id === 'keke' ? 0.5 : 2)), 0, 60);
 }
 // story trust / heat / choices → reputation
 const trust = Number.isFinite(st.trust) ? st.trust : 0, heat = Number.isFinite(st.heat) ? st.heat : 0;
 s.public = clamp(Math.round(trust / 2 + Math.min(10, counts.errands)), -100, 100);
 s.integrity = clamp(Math.round({ honest: 15, risky: -20, reformed: 5 }[st.alignment] ?? 0) - (st.riskyChoices ?? 0) * 3 + (st.settled ? 10 : 0), -100, 100);
 s.notoriety = clamp(Math.round(heat * 0.6 + (st.riskyChoices ?? 0) * 2), 0, 100);
 s.business = clamp(Math.round(counts.errands + counts.keke * 0.2 + counts.trader * 1.5), 0, 40);
 s.social = clamp(Object.values(data.relationships ?? {}).filter((x) => (x?.talks ?? 0) > 0).length * 2, 0, 60);
 s.log.push({ day, text: 'Your reputation now has seven sides, worked out from your life so far', d: {} });
 // police and custody → record
 const p = data.police ?? {};
 for (const o of Array.isArray(p.owed) ? p.owed : []) if (o && Number.isFinite(o.amount)) r.entries.push({ id: `rec:${++r.seq}`, day, kind: 'fine', agency: 'police', text: `Unpaid fine: ${o.offence ?? 'traffic offence'}`, amount: Math.round(o.amount), status: 'open', ref: `owed:${o.id}` });
 if ((p.wanted ?? 0) > 0) r.entries.push({ id: `rec:${++r.seq}`, day, kind: 'evasion', agency: 'police', text: 'Wanted for driving off from a checkpoint', status: 'open', ref: 'legacy-wanted' });
 if (st.arrest) r.entries.push({ id: `rec:${++r.seq}`, day, kind: 'custody', agency: st.arrest.agency === 'efcc' ? 'efcc' : 'police', text: `In custody: ${st.arrest.reason ?? 'open case'}`, status: 'open', ref: 'legacy-custody' });
 if (st.fraudActive) r.entries.push({ id: `rec:${++r.seq}`, day, kind: 'case', agency: 'efcc', text: 'EFCC interest in illegal proceeds', status: 'open', ref: 'legacy-fraud' });
 return life;
}
/** The retired story pieces, cleared in place (the rest of the story state stays for custody, chases and bail). */
export function retireStory(out) {
 if (out.story && typeof out.story === 'object') { out.story.contract = null; }
 if (out.jobs?.missions) out.jobs.missions.tracked = null;
}
