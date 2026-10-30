/**
 * v0.46 Shanahan University programmes (game rules, not the university's real requirements or fees). Enrol at the
 * admissions office, pay the session fee, attend lectures (one a day, weekdays 8:00–17:00) and graduate when you've
 * attended enough. A degree is what the professions ask for. Adults only.
 */
export const PROGRAMMES = [
 { id: 'medicine', label: 'Medicine and Surgery (MBBS)', faculty: 'College of Medicine', lectures: 14, fee: 450_000, skill: 'charisma', job: 'doctor' },
 { id: 'nursing', label: 'Nursing Science (B.NSc)', faculty: 'Basic Medical and Allied Sciences', lectures: 9, fee: 220_000, skill: 'charisma', job: 'nurse' },
 { id: 'law', label: 'Law (LL.B)', faculty: 'Faculty of Law', lectures: 12, fee: 350_000, skill: 'charisma', job: 'lawyer' },
 { id: 'education', label: 'Education (B.Ed)', faculty: 'Social and Management Sciences', lectures: 7, fee: 150_000, skill: 'charisma', job: 'teacher' },
 { id: 'computing', label: 'Computer Science (B.Sc)', faculty: 'Natural and Applied Sciences', lectures: 9, fee: 250_000, skill: 'coding', job: 'lecturer' },
 { id: 'masscomm', label: 'Mass Communication (B.Sc)', faculty: 'Social and Management Sciences', lectures: 7, fee: 180_000, skill: 'photography', job: 'journalist' },
];
export const PROGRAMME = Object.fromEntries(PROGRAMMES.map((p) => [p.id, p]));
export function newEducation() { return { v: 1, enrolled: null, lectures: 0, lastLecture: 0, studied: 0, degrees: [] }; }
export function ensureEducation(e) {
 const o = e && typeof e === 'object' ? e : newEducation();
 o.v = 1; o.enrolled = PROGRAMME[o.enrolled] ? o.enrolled : null; o.lectures = Number.isInteger(o.lectures) ? Math.max(0, o.lectures) : 0;
 o.lastLecture = Number.isInteger(o.lastLecture) ? o.lastLecture : 0; o.studied = Number.isInteger(o.studied) ? o.studied : 0;
 o.degrees = Array.isArray(o.degrees) ? [...new Set(o.degrees.filter((d) => PROGRAMME[d]))] : [];
 return o;
}
/** Does this set of degrees meet a job's requirement ('any' = any degree)? */
export const hasDegree = (degrees, need) => !need || (need === 'any' ? degrees.length > 0 : degrees.includes(need));
/** One lecture attended: returns { graduated } when the programme is complete. Pure (mutates e). */
export function attendLecture(e, day) {
 if (!e.enrolled) return { ok: false, error: 'Enrol in a programme first (admissions).' };
 if (e.lastLecture === day) return { ok: false, error: 'One lecture a day. Come back tomorrow.' };
 e.lastLecture = day; e.lectures++; const P = PROGRAMME[e.enrolled];
 if (e.lectures >= P.lectures) { if (!e.degrees.includes(P.id)) e.degrees.push(P.id); e.enrolled = null; e.lectures = 0; return { ok: true, graduated: P }; }
 return { ok: true, left: P.lectures - e.lectures };
}
