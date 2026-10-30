/*
  Reputation (Milestone 7, game rules): how the area knows you, worked out from what you've done — the
  people who know you (and how well), jobs finished, jobs let down, people shoved. Nothing extra is
  stored; it's recomputed from the relationships and the job log, so it can't drift from them.

  Effects: traders start lower and come down further for a known face (a small discount on asking and
  floor prices — hawkers' prices stay fixed), traders pay a bit more for jobs, and strangers greet you.
*/
export const REP_LEVELS = [
  { min: -Infinity, label: 'Bad name', discount: -0.03, jobBonus: 0, note: 'People remember the trouble. Prices are a little higher for you.' },
  { min: 0, label: 'New face', discount: 0, jobBonus: 0, note: 'Nobody knows you yet.' },
  { min: 12, label: 'Known in the area', discount: 0.02, jobBonus: 0.05, note: 'Traders recognise you: small discounts, slightly better job pay.' },
  { min: 35, label: 'Respected', discount: 0.04, jobBonus: 0.1, note: 'People greet you on the street; better prices and pay.' },
  { min: 80, label: 'Big name in Onitsha', discount: 0.06, jobBonus: 0.15, note: 'Everybody knows you. The best prices and pay.' },
];

/** relationships: {id: {talks, positive, negative, bumps}}; jobLog: [{missed?}] */
export function reputation(relationships = {}, jobLog = [], police = null) {
  let social = 0, trouble = 0, friends = 0;
  for (const r of Object.values(relationships)) {
    const fam = Math.max(0, Math.round((r.talks ?? 0) + (r.positive ?? 0) * 0.5 - (r.negative ?? 0) * 0.7));
    social += Math.min(6, fam);
    if (fam >= 6) friends++;
    trouble += (r.negative ?? 0) * 0.8 + Math.max(0, (r.bumps ?? 0) - 1) * 0.5;
  }
  // running from the police and unpaid fines count against you
  trouble += (police?.wanted ?? 0) * 3 + (police?.owed?.length ?? 0) * 2;
  const done = jobLog.filter((l) => !l.missed).length, missed = jobLog.filter((l) => l.missed).length;
  const score = Math.round(social + done * 3 - missed * 4 - trouble);
  let level = 0;
  for (let i = 0; i < REP_LEVELS.length; i++) if (score >= REP_LEVELS[i].min) level = i;
  return { score, level, ...REP_LEVELS[level], friends, jobsDone: done, jobsMissed: missed };
}
