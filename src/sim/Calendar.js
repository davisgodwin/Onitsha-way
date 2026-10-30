/*
  Milestone 7: the calendar, the weather and the power supply. All pure and deterministic — the same
  game day and time always give the same weather and the same outages, so a reload never changes them.

  Calendar (a game rule, not real time): every game day has a weekday name, and each game day also moves
  the season on by one week, starting in mid-October (the end of the rains). So within a couple of weeks
  of play you see the rains stop, the dry season, then harmattan, and on into the next rains.

  Onitsha's climate as configured here (game values from the general pattern, not a forecast):
  - rainy season roughly April–October, wettest June–September (with a short "August break");
  - dry season November–March; harmattan (dry, dusty north-east wind, hazy sky) strongest Dec–Feb;
  - rain usually comes as a storm in the afternoon or at night, an hour or a few.
  Power ("NEPA" — what everyone still calls the electricity supply) goes off a few times a day, for
  an hour to several; generators fill the gap for those who have them.
*/

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Game day 1 = Monday, in the week of 15 October. */
export const CALENDAR_START = { year: 2026, month: 9, date: 15 };

/** Chance of a rain storm on a day, by month (Jan … Dec). */
export const RAIN_CHANCE = [0.03, 0.08, 0.25, 0.45, 0.6, 0.7, 0.75, 0.55, 0.75, 0.55, 0.15, 0.03];
/** Harmattan strength by month (0 none … 1 thick). */
export const HARMATTAN = [1, 0.65, 0.15, 0, 0, 0, 0, 0, 0, 0, 0.25, 0.8];

function hash(n) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0; }
function rngFor(...k) { let s = 2166136261; for (const v of k) s = hash(s ^ (v | 0)); return () => { s = hash(s + 0x9e3779b9); return s / 4294967296; }; }
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Weekday index 0 (Monday) … 6 (Sunday) for a game day (day 1 is a Monday). */
let realCalendar=null;
export function setRealCalendar(day,date){realCalendar=day==null?null:{day,date};}
export function weekdayOf(day) { if(realCalendar){const d=new Date((realCalendar.date+day-realCalendar.day)*86400000);return (d.getUTCDay()+6)%7;}return (((day - 1) % 7) + 7) % 7; }

/** {weekday, weekdayName, month, monthName, date, season, label} for a game day. */
export function calendar(day) {
  const t = realCalendar ? (realCalendar.date+day-realCalendar.day)*86400000 : Date.UTC(CALENDAR_START.year, CALENDAR_START.month, CALENDAR_START.date) + (day - 1) * 7 * 86400000;
  const d = new Date(t);
  const month = d.getUTCMonth(), wd = weekdayOf(day);
  const part = d.getUTCDate() <= 10 ? 'early' : d.getUTCDate() <= 20 ? 'mid' : 'late';
  return {
    weekday: wd, weekdayName: WEEKDAYS[wd], month, monthName: MONTHS[month], date: d.getUTCDate(),
    season: seasonOf(month), label: realCalendar ? `${WEEKDAYS[wd]} · ${d.getUTCDate()} ${MONTHS[month]} ${d.getUTCFullYear()}` : `${WEEKDAYS[wd]} · ${part} ${MONTHS[month]}`,
  };
}

export function seasonOf(month) {
  if (HARMATTAN[month] >= 0.5) return 'harmattan';
  if (month >= 3 && month <= 9) return 'rainy';
  return 'dry';
}

/** Today's storm, if any: {start, end, peak} in minutes of the day (may run past midnight), or null. */
export function stormOn(day, seed = 0) {
  const { month } = calendar(day);
  const r = rngFor(seed, day, 7);
  if (r() >= RAIN_CHANCE[month]) return null;
  const afternoon = r() < 0.65;
  const start = Math.round((afternoon ? 13 + r() * 6 : 20 + r() * 8) * 60);
  const dur = Math.round((1 + r() * 2.5) * 60);
  return { start, end: start + dur, peak: 0.45 + r() * 0.55 };
}

/**
 * Weather at a moment: {rain 0..1, harmattan 0..1, cloud 0..1, label}. Rain ramps in and out over
 * about 20 minutes; harmattan haze is thickest in the morning and thinned by rain.
 */
export function weatherAt(day, minutes, seed = 0) {
  let rain = 0, cloud = 0;
  for (const dd of [day - 1, day]) { // yesterday's late storm can run past midnight
    const s = stormOn(dd, seed); if (!s) continue;
    const m = minutes + (day - dd) * 1440;
    const k = smooth(s.start - 20, s.start + 10, m) * (1 - smooth(s.end - 15, s.end + 15, m));
    rain = Math.max(rain, k * s.peak);
    cloud = Math.max(cloud, smooth(s.start - 120, s.start, m) * (1 - smooth(s.end, s.end + 90, m)));
  }
  const { month } = calendar(day);
  const r = rngFor(seed, day, 11);
  const base = HARMATTAN[month] * (0.7 + r() * 0.45);
  const h = minutes / 60;
  const morning = 1 - 0.35 * smooth(10, 14, h) * (1 - smooth(17, 20, h)); // the haze lifts a little by afternoon
  const harmattan = Math.min(1, base * morning * (1 - rain));
  cloud = Math.max(cloud, rain);
  const label = rain > 0.6 ? 'Heavy rain' : rain > 0.15 ? 'Raining' : cloud > 0.5 ? 'Clouding up' : harmattan > 0.55 ? 'Harmattan haze' : harmattan > 0.2 ? 'Dusty' : 'Clear';
  return { rain, harmattan, cloud, label };
}

/** Today's power cuts: [{start, end}] in minutes of the day. */
export function outagesOn(day, seed = 0) {
  const r = rngFor(seed, day, 23);
  const n = 1 + Math.floor(r() * 3);
  const out = [];
  for (let i = 0; i < n; i++) {
    const start = Math.round(r() * 22 * 60);
    const end = Math.min(1440, start + Math.round((1 + r() * 4.5) * 60));
    out.push({ start, end });
  }
  // overlapping cuts are one long cut
  const merged = [];
  for (const o of out.sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && o.start <= last.end) last.end = Math.max(last.end, o.end); else merged.push({ ...o });
  }
  return merged;
}

/** {on, until}: whether there is power ("light") now and, if not, when it should be back (minutes). */
export function powerAt(day, minutes, seed = 0) {
  for (const o of outagesOn(day, seed)) if (minutes >= o.start && minutes < o.end) return { on: false, until: o.end };
  return { on: true, until: null };
}

/**
 * Busy-ness of the roads by weekday and hour: morning and evening rush on weekdays, a busy Saturday,
 * a quiet Sunday morning (church), and fewer people out in the rain.
 */
export function trafficFactor(weekday, hour, rain = 0) {
  let k = 1;
  if (weekday <= 4) {
    if (hour >= 7 && hour < 9.5) k = 1.4;
    else if (hour >= 16.5 && hour < 19) k = 1.35;
  } else if (weekday === 5) { if (hour >= 10 && hour < 17) k = 1.2; } else if (hour >= 6 && hour < 12) k = 0.55;
  return k * (1 - 0.25 * rain);
}
export function crowdFactor(weekday, hour, rain = 0) {
  let k = 1;
  if (weekday === 6 && hour >= 7 && hour < 11.5) k = 0.6;     // most people are in church
  if (weekday === 5 && hour >= 9 && hour < 17) k = 1.2;       // Saturday market
  return k * (1 - 0.7 * rain);                                 // the rain clears the streets
}
