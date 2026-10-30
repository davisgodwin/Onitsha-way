import { CAREERS } from './careers.js';
import { CAREER_RULES } from './careerProgression.js';
/**
 * v0.40 occupation registry (stage 1 of the open-life redesign). Fictional game rules, not real job requirements.
 *
 * Two kinds of occupation:
 *  - 'employed': a job with an employer at a workplace. Apply (skills, tools, a clean police record), work shifts in
 *    opening hours, get promoted through a ladder of ranks, resign whenever you like, or be dismissed. One at a time.
 *  - 'self': work you do for yourself in the city (trader errands, a keke, wholesale trading). There is nothing to
 *    apply for: the first time you do the work you become known for it, and you rise by doing it well. Any number.
 *
 * Every rank has requirements that take time (shifts or jobs done, days in the role, skill, professional standing);
 * nobody jumps straight to the top. Later stages add police, EFCC, doctors, politicians and the rest to this list.
 */
const LADDERS = {
 tech: ['Intern', 'Junior developer', 'Developer', 'Senior developer', 'Lead developer'],
 realtor: ['Property assistant', 'Junior agent', 'Agent', 'Senior agent', 'Principal agent'],
 apprentice: ['Trade apprentice', 'Shop hand', 'Sales attendant', 'Shop manager', 'Trading partner'],
 car_dealer: ['Sales trainee', 'Salesperson', 'Senior salesperson', 'Sales manager', 'Branch manager'],
 oso_afia: ['Broker trainee', 'Broker', 'Senior broker', 'Head broker', 'Market agent'],
 courier: ['Courier trainee', 'Courier', 'Senior courier', 'Dispatch lead', 'Dispatch supervisor'],
 caterer: ['Kitchen assistant', 'Cook', 'Senior cook', 'Head cook', 'Catering manager'],
 mechanic: ['Workshop trainee', 'Mechanic', 'Senior mechanic', 'Chief mechanic', 'Workshop manager'],
 tailor: ['Fashion trainee', 'Tailor', 'Senior tailor', 'Head designer', 'Fashion house manager'],
 creator: ['Photography learner', 'Photographer', 'Senior photographer', 'Studio lead', 'Creative director'],
 logistics: ['Dispatch assistant', 'Logistics agent', 'Senior agent', 'Operations lead', 'Logistics manager'],
 student: ['Student', 'Good student', 'Class prefect', 'Head student'],
};
/** What the shortcut in each job's dilemma is: extra money now (share of the shift's pay), what it costs your
 *  integrity, and how likely the employer finds out. Careless shortcuts gain nothing and only risk the work. */
const SHORTCUTS = {
 tech: { kind: 'careless', gain: 0.15, integrity: -2, risk: 0.45 },
 realtor: { kind: 'dishonest', gain: 0.4, integrity: -6, risk: 0.35 },
 apprentice: { kind: 'dishonest', gain: 0.35, integrity: -7, risk: 0.4 },
 car_dealer: { kind: 'dishonest', gain: 0.4, integrity: -6, risk: 0.35 },
 oso_afia: { kind: 'mistake' },
 courier: { kind: 'dishonest', gain: 0, integrity: -5, risk: 0.4 },
 caterer: { kind: 'careless', gain: 0.1, integrity: -3, risk: 0.5 },
 mechanic: { kind: 'dishonest', gain: 0.4, integrity: -6, risk: 0.3 },
 tailor: { kind: 'careless', gain: 0.1, integrity: -1, risk: 0.45 },
 creator: { kind: 'dishonest', gain: 0.3, integrity: -5, risk: 0.35 },
 logistics: { kind: 'careless', gain: 0.15, integrity: -3, risk: 0.4 },
 student: { kind: 'dishonest', gain: 0, integrity: -4, risk: 0.45 },
};
/** Shift pay multiplier by rank, and what each rank asks for (index = the rank you are promoted TO). */
export const RANK_PAY = [1, 1.25, 1.6, 2.0, 2.6];
export const PROMOTION = {
 shifts: [0, 6, 15, 30, 50],
 days: [0, 2, 5, 9, 15],
 skill: [0, 1, 2, 3, 4],          // levels above the job's entry level (capped at 10)
 professional: [0, 15, 30, 50, 70],
};
export const SHIFT = { minutes: 240, studentMinutes: 180, perDay: 2, open: [7, 20], studentOpen: [7, 15], energy: 20, hunger: 15 };
export const DISMISSAL = { warnings: 3, banDays: 7, cleanShiftsToForgive: 10 };

const employed = CAREERS.filter((c) => !c.illegal && LADDERS[c.id]).map((c) => {
 const r = CAREER_RULES[c.id] ?? {};
 return {
  id: c.id, kind: 'employed', label: c.label, ranks: LADDERS[c.id], skill: r.skill ?? c.skill, level: r.level ?? 1, tools: r.tools ?? [],
  site: r.site, shiftPay: c.id === 'student' ? 300 : Math.round((c.pay * 0.45) / 50) * 50, child: !!c.child,
  dilemma: { prompt: c.prompt, honest: c.choices[c.right], shortcut: c.choices.filter((_, i) => i !== c.right), ...SHORTCUTS[c.id] },
 };
});
const self = [
 { id: 'errands', kind: 'self', label: 'Errand runner for traders', ranks: ['New runner', 'Reliable runner', 'Trusted runner', 'Top runner'], acts: [0, 5, 15, 40], child: false, how: 'Take delivery, collection and errand jobs from traders in the markets.' },
 { id: 'keke', kind: 'self', label: 'Keke driver', ranks: ['New driver', 'Regular driver', 'Experienced driver', 'Veteran driver'], acts: [0, 10, 40, 120], child: false, how: 'Drive your own keke and pick up passengers queueing at stops.' },
 { id: 'busdriver', kind: 'self', label: 'Bus driver', ranks: ['New driver', 'Regular driver', 'Experienced driver', 'Veteran driver'], acts: [0, 25, 100, 300], child: false, how: 'Drive your own minibus or bus and carry passengers, on a route of your choice.' },
 { id: 'shopkeeper', kind: 'self', label: 'Business owner', ranks: ['New in business', 'Established', 'Well known', 'Big business'], acts: [0, 7, 30, 90], child: false, how: 'Run a shop, buka, beer parlour, phone shop or boutique.' },
 { id: 'transporter', kind: 'self', label: 'Transport operator', ranks: ['Small operator', 'Operator', 'Fleet owner', 'Transport boss'], acts: [0, 7, 30, 90], child: false, how: 'Own keke or buses and hire drivers to work them.' },
 { id: 'trader', kind: 'self', label: 'Market trader', ranks: ['Small trader', 'Trader', 'Big trader', 'Merchant'], acts: [0, 5, 20, 60], child: false, how: 'Buy stock from wholesalers and supply market traders.' },
];
// v0.42: the Nigeria Police Force and the EFCC (real agency names; every officer and case in the game is fictional).
// Joined through three academy sessions, then a shift is a duty in the city (see justice/Forces.js). Adults only, with
// a clean record and no Hustle Kingdom. A corrupt act that gets reported is a complaint: a written warning.
const forces = [
 { id: 'police', kind: 'employed', force: true, office: 'police', label: 'Police officer (Nigeria Police Force)', ranks: ['Recruit constable', 'Constable', 'Corporal', 'Sergeant', 'Inspector'], skill: 'fitness', level: 2, tools: [], shiftPay: 3500, child: false, academy: 3,
  dilemma: { prompt: null, honest: 'Did the duty by the book', kind: 'complaint', gain: 0, integrity: 0, risk: 1 } },
 { id: 'efcc', kind: 'employed', force: true, office: 'efcc', label: 'EFCC officer', ranks: ['Cadet', 'Detective assistant', 'Detective', 'Senior detective', 'Team lead'], skill: 'coding', level: 2, tools: [], shiftPay: 4000, child: false, academy: 3,
  dilemma: { prompt: null, honest: 'Did the duty by the book', kind: 'complaint', gain: 0, integrity: 0, risk: 1 } },
];
// v0.46 stage 7 (first part): the professions. Each needs a degree from Shanahan University (see data/education.js),
// is worked at its own building, and a shift is a real case (a patient, a class, a brief) with choices that are graded.
const professions = [
 { id: 'doctor', kind: 'employed', cases: 'doctor', label: 'Doctor (hospital)', ranks: ['House officer', 'Medical officer', 'Senior medical officer', 'Senior registrar', 'Consultant'], skill: 'charisma', level: 2, tools: [], degree: 'medicine', site: 'hospital', shiftPay: 9000, child: false,
  dilemma: { prompt: 'A patient\'s relative offers you cash to see them before the people already waiting.', honest: 'Refuse: the queue is by need', shortcut: ['Take the money and see them first'], kind: 'dishonest', gain: 0.35, integrity: -6, risk: 0.35 } },
 { id: 'nurse', kind: 'employed', cases: 'nurse', label: 'Nurse (hospital)', ranks: ['Nursing officer II', 'Nursing officer I', 'Senior nursing officer', 'Principal nursing officer', 'Chief nursing officer'], skill: 'charisma', level: 1, tools: [], degree: 'nursing', site: 'hospital', shiftPay: 5500, child: false,
  dilemma: { prompt: 'The pharmacy is short of a drug. A man outside will buy the ward\'s spare stock for cash.', honest: 'Keep the drugs for the patients', shortcut: ['Sell him the spare packs'], kind: 'dishonest', gain: 0.4, integrity: -7, risk: 0.35 } },
 { id: 'teacher', kind: 'employed', cases: 'teacher', label: 'Teacher (Christ the King College)', ranks: ['Graduate assistant teacher', 'Teacher II', 'Teacher I', 'Head of department', 'Vice principal'], skill: 'charisma', level: 2, tools: [], degree: 'education', site: 'ckc', shiftPay: 4000, child: false,
  dilemma: { prompt: 'A parent offers you money to raise their son\'s exam score.', honest: 'Refuse, and offer extra lessons instead', shortcut: ['Take the money and change the mark'], kind: 'dishonest', gain: 0.4, integrity: -7, risk: 0.35 } },
 { id: 'lecturer', kind: 'employed', cases: 'lecturer', label: 'Lecturer (Shanahan University)', ranks: ['Graduate assistant', 'Assistant lecturer', 'Lecturer II', 'Senior lecturer', 'Professor'], skill: 'coding', level: 3, tools: ['laptop'], degree: 'any', site: 'shanahan', shiftPay: 7000, child: false,
  dilemma: { prompt: 'A student offers you money to pass them in your course.', honest: 'Refuse and report it to the department', shortcut: ['Take the money and pass them'], kind: 'dishonest', gain: 0.45, integrity: -8, risk: 0.35 } },
 { id: 'lawyer', kind: 'employed', cases: 'lawyer', label: 'Lawyer (chambers at the Magistrate Court)', ranks: ['Pupil lawyer', 'Junior counsel', 'Counsel', 'Senior counsel', 'Head of chambers'], skill: 'charisma', level: 3, tools: ['notebook'], degree: 'law', site: 'court', shiftPay: 8000, child: false,
  dilemma: { prompt: 'Your client wants you to tell a witness what to say in court.', honest: 'Refuse: the evidence is the evidence', shortcut: ['Coach the witness'], kind: 'dishonest', gain: 0.45, integrity: -8, risk: 0.4 } },
];
self.push(
 { id: 'journalist', kind: 'self', label: 'Journalist (freelance, The Onitsha Courier)', ranks: ['Stringer', 'Reporter', 'Senior reporter', 'Editor'], acts: [0, 6, 20, 50], child: false, how: 'Write up what happens in the city and sell the stories to the paper (phone: The Courier).' },
 { id: 'dj', kind: 'self', label: 'DJ', ranks: ['Bedroom DJ', 'Club DJ', 'Resident DJ', 'Celebrity DJ'], acts: [0, 5, 20, 60], child: false, how: 'Play sets at the nightclubs (the DJ booth inside).' },
 // v0.47 stage 7 (second part)
 { id: 'planner', kind: 'self', label: 'Event planner', ranks: ['New planner', 'Planner', 'Top planner', 'Society planner'], acts: [0, 3, 10, 30], child: false, how: 'Take bookings for weddings, birthdays and burials; hire the venue, food and music; run the day (phone: Ventures).' },
 { id: 'decorator', kind: 'self', label: 'Interior decorator', ranks: ['New decorator', 'Decorator', 'Sought-after decorator', 'Design house'], acts: [0, 3, 10, 30], child: false, how: 'Decorate clients\' rooms to their brief and budget (phone: Ventures).' },
 { id: 'agency', kind: 'self', label: 'Tech agency owner', ranks: ['Freelancer', 'Small agency', 'Agency', 'Big agency'], acts: [0, 3, 10, 30], child: false, how: 'Run a tech agency: take client briefs, hire developers, deliver on time (phone: Ventures).' },
 { id: 'landlord', kind: 'self', label: 'Landlord', ranks: ['New landlord', 'Landlord', 'Property owner', 'Property magnate'], acts: [0, 4, 15, 50], child: false, how: 'Let the homes you own to tenants and collect the rent (phone: Ventures).' },
 { id: 'developer', kind: 'self', label: 'Property developer', ranks: ['First project', 'Developer', 'Big developer', 'Estate developer'], acts: [0, 2, 6, 15], child: false, how: 'Buy unfinished buildings, finish them, then sell or let them (phone: Ventures).' },
 { id: 'roadside', kind: 'self', label: 'Roadside mechanic', ranks: ['Apprentice', 'Roadside mechanic', 'Trusted mechanic', 'Master mechanic'], acts: [0, 5, 20, 60], child: false, how: 'Answer call-outs for broken-down cars (phone: Ventures; you need an inspection kit).' },
 { id: 'security', kind: 'self', label: 'Security company owner', ranks: ['Small outfit', 'Security company', 'Big security firm', 'Security group'], acts: [0, 7, 30, 90], child: false, how: 'Hire and train guards and guard clients\' premises (phone: Ventures).' },
 { id: 'crew', kind: 'self', label: 'Street crew leader', ranks: ['Corner boy', 'Crew leader', 'Area boss', 'Big boss'], acts: [0, 5, 20, 60], child: false, how: 'Lead a street crew: watch, loading at the parks, and rivals (phone: Ventures).' },
 { id: 'footballer', kind: 'self', label: 'Footballer (Onitsha City FC)', ranks: ['Trialist', 'Squad player', 'First-team regular', 'Club star'], acts: [0, 3, 12, 30], child: false, how: 'Train with Onitsha City FC on weekdays and play the league match on Saturdays (the stadium).' },
 { id: 'coach', kind: 'self', label: 'Football coach (Onitsha City Academy)', ranks: ['Assistant coach', 'Youth coach', 'Head coach', 'Champion coach'], acts: [0, 3, 10, 25], child: false, how: 'Coach the U-17 side: pick the tactics each week (the stadium).' },
 { id: 'hypeman', kind: 'self', label: 'Hypeman / MC', ranks: ['Open mic', 'Hypeman', 'Top MC', 'Celebrity MC'], acts: [0, 5, 20, 60], child: false, how: 'Grab the mic at the nightclubs and get the crowd going.' },
);
export const OCCUPATIONS = Object.freeze([...employed, ...forces, ...professions, ...self]);
export const OCCUPATION = Object.freeze(Object.fromEntries(OCCUPATIONS.map((o) => [o.id, o])));
export const occupationsFor = (ageGroup) => OCCUPATIONS.filter((o) => ageGroup !== 'child' || o.child);
