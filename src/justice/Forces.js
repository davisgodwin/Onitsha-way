/**
 * v0.42 working for the Nigeria Police Force or the EFCC (pure rules). The agencies are the real names; every officer,
 * suspect and case is fictional. Adults only, with a clean record and no Hustle Kingdom.
 *
 * Join: three academy sessions (one a day) at the station / field office, then apply. Each shift is a duty in the
 * city with steps you walk to: a scene, a suspect, an informant, a raid. At each step you choose to do it by the book
 * or take the corrupt way (a bribe, a shortcut with the evidence). Corruption pays and costs integrity; complaints
 * that stick are warnings, three warnings and you're dismissed, like any job.
 */
export const ACADEMY = { sessions: 3, minutes: 180, energy: 25 };
export const FORCES = {
 police: { label: 'Nigeria Police Force', office: 'police', skill: 'fitness' },
 efcc: { label: 'EFCC', office: 'efcc', skill: 'coding' },
};
const pick = (r, a) => a[Math.floor(r() * a.length)];
function rngFor(seed) { let h = (seed * 2654435761) >>> 0; return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; }; }
/**
 * The day's duty. spots = places in the city ({ x, z, name }), incident = a reported crime from Crime.incidentsFor.
 * steps = [{ do, at, text }]; do: 'scene' | 'suspect' | 'patrol' | 'records' | 'informant' | 'raid'. The last step is
 * always back at the office to file the report.
 */
export function dutyFor(force, { seq, day, spots, incident = null, office, kingdom = null }) {
 const r = rngFor(seq * 31 + day), far = (n) => { const out = []; for (let i = 0; i < n; i++) out.push(pick(r, spots)); return out; };
 const file = { do: 'file', at: { x: office.x, z: office.z, name: office.name }, text: 'File your report at the desk' };
 if (force === 'police') {
  if (incident && r() < 0.7) {
   const [hide] = far(1);
   return { id: `duty:${seq}`, force, kind: 'report', title: incident.text, steps: [
    { do: 'scene', at: incident.at, text: `Go to the scene: ${incident.at.name}` },
    { do: 'suspect', at: { x: hide.x, z: hide.z, name: hide.name }, text: `A witness saw the suspect near ${hide.name}. Find and arrest them` },
    file], step: 0, bribe: 5000 + Math.floor(r() * 4) * 2500 };
  }
  const pts = far(3);
  return { id: `duty:${seq}`, force, kind: 'patrol', title: 'Foot patrol', steps: [...pts.map((p, i) => ({ do: 'patrol', at: { x: p.x, z: p.z, name: p.name }, text: `Patrol point ${i + 1}: ${p.name}`, incident: i === 1 })), file], step: 0, bribe: 3000 + Math.floor(r() * 3) * 1000 };
 }
 const [inf, house] = far(2);
 return { id: `duty:${seq}`, force, kind: 'trace', title: kingdom ? `Following up on ${kingdom}` : 'Tracing a fraud ring', steps: [
  { do: 'records', at: { x: office.x, z: office.z, name: office.name }, text: 'Go through the bank records at the office' },
  { do: 'informant', at: { x: inf.x, z: inf.z, name: inf.name }, text: `Meet an informant near ${inf.name}` },
  { do: 'raid', at: { x: house.x, z: house.z, name: house.name }, text: `Raid the house near ${house.name}` },
  file], step: 0, bribe: 20000 + Math.floor(r() * 4) * 10000 };
}
/**
 * The choices at a step, and what each does. The by-the-book way builds the case (quality) and integrity; the
 * corrupt way pays (bribe) and costs integrity, with a risk of a complaint that sticks.
 */
export function stepChoices(duty, step) {
 const s = duty.steps[step]; if (!s) return [];
 const book = (label, sub, extra = {}) => ({ id: 'book', label, sub, quality: 0.2, integrity: 2, ...extra });
 const corrupt = (label, sub, extra = {}) => ({ id: 'corrupt', label, sub, quality: -0.1, integrity: -8, bribe: duty.bribe, corrupt: true, ...extra });
 switch (s.do) {
  case 'scene': return [book('Take statements and collect the evidence properly', 'Slower, builds a strong case', { minutes: 40 }), { id: 'rush', label: 'Look around quickly and move on', sub: 'Faster, weaker case', quality: -0.1, integrity: 0, minutes: 10 }];
  case 'suspect': return [book('Arrest them and read them their rights', 'They may run: fitness helps', { minutes: 20, arrest: true }), corrupt(`Take ₦${duty.bribe.toLocaleString('en-NG')} and let them go`, 'Nobody has to know…')];
  case 'patrol': return s.incident ? [book('Settle the dispute fairly', 'A trader and a bus driver are arguing', { minutes: 15 }), corrupt(`Collect ₦${duty.bribe.toLocaleString('en-NG')} "for the boys" from the bus driver`, 'It happens on every road…')] : [book('Check in and keep moving', '', { minutes: 15, quality: 0.1, integrity: 0 })];
  case 'records': return [book('Trace every transfer carefully', 'Coding helps', { minutes: 60, skill: 'coding' }), { id: 'rush', label: 'Skim the summary', sub: 'Faster, weaker case', quality: -0.1, integrity: 0, minutes: 15 }];
  case 'informant': return [book('Pay the informant ₦2,000 from your pocket for the address', 'A good lead', { minutes: 20, cost: 2000 }), { id: 'press', label: 'Press them for it without paying', sub: 'They may give you a bad address', quality: -0.05, integrity: -1, minutes: 10 }];
  case 'raid': return [book('Lead the raid by the book', 'Arrests and evidence for the case', { minutes: 45, arrest: true }), corrupt(`Accept ₦${duty.bribe.toLocaleString('en-NG')} to "lose" the evidence`, 'The ring keeps running…')];
  case 'file': return [book('File an honest report', 'Finish the duty', { minutes: 20, quality: 0.1, integrity: 1 })];
  default: return [];
 }
}
/** Does the suspect come quietly? A fitter officer catches a runner. */
export function arrestOutcome(fitness = 1, rng = Math.random) { const runs = rng() < 0.35; return { runs, caught: !runs || rng() < 0.35 + fitness * 0.06 }; }
/** At the end of the duty: did any corrupt act get reported? (risk grows with how many) */
export function complaint(corruptActs, rng = Math.random) { return corruptActs > 0 && rng() < 1 - Math.pow(0.7, corruptActs); }
