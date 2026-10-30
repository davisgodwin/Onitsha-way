/**
 * Public transport configuration: vehicle classes, fares and the line plan.
 * Fares are GAME prices in naira, chosen to feel plausible for Onitsha in the mid-2020s; they are
 * configuration, not surveyed fares. All money moves through Economy.transact().
 */

/** traffic type = the TrafficSystem model used for the vehicle. */
export const MODES = {
  keke: {
    label: 'Keke NAPEP', short: 'Keke', traffic: 'keke', seats: 3, spacing: 380, stopSpacing: 330,
    fare: { base: 200, perKm: 150, min: 200, max: 1000 }, dwell: [5, 9], color: '#f2c200',
  },
  minibus: {
    label: 'Mini bus', short: 'Mini bus', traffic: 'minibus', seats: 14, spacing: 650, stopSpacing: 520,
    fare: { base: 200, perKm: 100, min: 200, max: 800 }, dwell: [7, 12], color: '#1d4e89',
  },
  cbus: {
    label: 'Commercial bus', short: 'Bus', traffic: 'cbus', seats: 18, spacing: 760, stopSpacing: 600,
    fare: { base: 150, perKm: 80, min: 150, max: 700 }, dwell: [8, 13], color: '#e2b007',
  },
  coaster: {
    label: 'Coaster bus', short: 'Coaster', traffic: 'bus', seats: 30, spacing: 1100, stopSpacing: 900,
    fare: { base: 300, perKm: 100, min: 300, max: 1200 }, dwell: [10, 15], color: '#c1121f',
  },
};

const r50 = (n) => Math.max(50, Math.round(n / 50) * 50);

/** Fare for riding `metres` on a mode. Whole naira, rounded to ₦50. */
export function fareFor(mode, metres) {
  const f = MODES[mode].fare;
  return Math.min(f.max, Math.max(f.min, r50(f.base + (f.perKm * metres) / 1000)));
}

/**
 * The line plan. Terminals and vias are landmark ids or {x, z} points; the actual streets come from
 * a shortest-path search on the OSM road graph, so routes always follow real roads.
 * Keke never use the Niger Bridge deck; `bridge: true` lets a line cross it (the coaster to Asaba).
 */
export const LINES = [
  { id: 'K1', mode: 'keke', name: 'Main Market – Upper Iweka', stops: ['main-market', 'ike-dunkofia', 'ochanja', 'upper-iweka'] },
  { id: 'K2', mode: 'keke', name: 'Fegge – Main Market – Basilica', stops: ['fegge', 'main-market', 'basilica'] },
  { id: 'K3', mode: 'keke', name: 'Ochanja – Bridgehead', stops: ['ochanja', 'fegge', 'bridgehead'] },
  { id: 'K4', mode: 'keke', name: 'Upper Iweka – Onitsha Mall', stops: ['upper-iweka-park', 'shoprite'] },
  { id: 'M1', mode: 'minibus', name: 'Upper Iweka – Main Market', stops: ['upper-iweka', 'ochanja', 'main-market'] },
  { id: 'M2', mode: 'minibus', name: 'Bridgehead – Upper Iweka', stops: ['bridgehead', 'upper-iweka'] },
  { id: 'B1', mode: 'cbus', name: 'Bridgehead – Main Market – Onitsha Mall', stops: ['bridgehead', 'main-market', 'shoprite'] },
  // v0.48: Asaba is COMING SOON, so the coaster turns at Bridgehead
  { id: 'C1', mode: 'coaster', name: 'Upper Iweka Park – Bridgehead', stops: ['upper-iweka-park', 'bridgehead'] },
];

export const TRANSPORT = {
  boardRadius: 9,        // m from the vehicle's door for the Board prompt
  platformRadius: 7,     // m from a stop sign for the destination picker
  maxPlayerHold: 30,     // s a driver waits for a player who chose this line and is nearby
  restPerSecond: 0.06,   // energy recovered per second while seated
};
