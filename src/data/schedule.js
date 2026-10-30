/*
  Opening hours by weekday (game rules). Market stalls close on Sunday — Main Market and the other
  markets don't open; shops open after church; keke touts start later; neighbours are at church on
  Sunday morning. A resident's base `schedule` [open, close] (hours) is their weekday pattern.
  Weekday: 0 Monday … 6 Sunday.
*/
/** Sunday at the Basilica: people gather outside before Mass, are inside during it, and chat outside after. */
export const SERVICE = { gather: 7.5, start: 9, end: 11, disperse: 12.5 };

export function hoursFor(resident, weekday) {
  const [o, c] = resident.schedule ?? [0, 24];
  if (['nightlife','mall-visitor','street','activity'].includes(resident.kind)) return [o,c]; // 'activity': people at the v0.32 activity places
  if (resident.kind === 'host') return [0, 24];
  if (resident.kind === 'church') return weekday === 6 ? [SERVICE.gather, SERVICE.disperse] : null;
  if (weekday === 6) {
    if (resident.kind === 'stall') return null;
    if (resident.kind === 'shop') return [13, Math.min(c, 18.5)];
    if (resident.kind === 'rank') return [9, Math.min(c, 20)];
    if (resident.kind === 'gate') return [11.5, c];
    return [Math.max(o, 12), c];
  }
  if (weekday === 5 && (resident.kind === 'stall' || resident.kind === 'shop')) return [o, c + 0.5]; // Saturday runs late
  return [o, c];
}

/** Is this resident at their spot now? */
export function isOpen(resident, weekday, hour) {
  const h = hoursFor(resident, weekday);
  if (resident.kind === 'church' && hour >= SERVICE.start && hour < SERVICE.end) return false; // inside, at Mass
  return !!h && (h[0] > h[1] ? hour >= h[0] || hour < h[1] : hour >= h[0] && hour < h[1]);
}

/** Is Mass going on at the Basilica now? */
export function inService(weekday, hour) { return weekday === 6 && hour >= SERVICE.start && hour < SERVICE.end; }

export const DAY_NOTES = {
  6: 'Sunday: the markets are closed. Shops open after church (from 13:00).',
  5: 'Saturday: market day — busy until late.',
};
