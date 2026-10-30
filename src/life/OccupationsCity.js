import { weekdayOf } from '../sim/Calendar.js';
import { naira } from '../economy/Economy.js';
import { OCCUPATION } from '../data/occupations.js';
import { PROGRAMMES, PROGRAMME, attendLecture, hasDegree } from '../data/education.js';
import { RANK_PAY } from '../data/occupations.js';
/**
 * v0.46 stage 7 (first part): the professions in their buildings, university study, and three kinds of freelance work.
 * - Shanahan University: enrol in a programme (admissions), attend a lecture a day (the lecture theatre), study in the
 *   library; graduate with a degree. Lecturers are hired in the staff room.
 * - Doctors and nurses at the hospitals, teachers at CKC, lawyers at the Magistrate Court: apply inside; a shift is a
 *   real case (a patient, a class, a client) with choices that are graded and paid by how well you did.
 * - Freelance: journalist (assignments from The Onitsha Courier: go to the place, report, file), DJ and hypeman (the
 *   booth at the nightclubs).
 * Adults only for all of it.
 */
const pick = (arr, n) => arr[Math.abs(n) % arr.length];
export const CASES = {
 doctor: [
  { title: 'A child with a high fever', text: 'A mother brings in her son, 7: fever for three days, chills, a headache.', steps: [
   { q: 'What do you do first?', a: [['Examine him and order a malaria test', 1], ['Give antibiotics straight away', 0], ['Send them home with paracetamol', 0]] },
   { q: 'The malaria test is positive.', a: [['Prescribe the right antimalarial for his weight, with follow-up', 1], ['Admit him for a week to be safe', 0], ['Tell the mother to buy whatever the chemist has', 0]] }] },
  { title: 'A keke accident', text: 'A keke rider is brought in after a crash at Upper Iweka: a deep cut on his arm, conscious, in pain.', steps: [
   { q: 'First?', a: [['Stop the bleeding, check his airway and other injuries', 1], ['Stitch the cut at once', 0], ['Ask for his hospital card first', 0]] },
   { q: 'He is stable.', a: [['Clean and suture the wound, tetanus shot, X-ray the arm', 1], ['Bandage it and discharge him', 0], ['Refer him to Enugu', 0]] }] },
  { title: 'Chest pain', text: 'A trader, 58, has chest pain spreading to his left arm and is sweating.', steps: [
   { q: 'What do you suspect?', a: [['A heart attack: act now', 1], ['Indigestion', 0], ['Stress from the market', 0]] },
   { q: 'Next?', a: [['ECG, aspirin, oxygen, and arrange the cardiac referral', 1], ['Give antacids and watch him', 0], ['Tell him to rest at home', 0]] }] },
 ],
 nurse: [
  { title: 'The morning ward round', text: 'Ward A has four patients. Bed 2 looks pale and her drip has stopped.', steps: [
   { q: 'First?', a: [['Check bed 2: vital signs, the drip line', 1], ['Finish the paperwork first', 0], ['Wait for the doctor\'s round', 0]] },
   { q: 'Her blood pressure is low.', a: [['Call the doctor now, raise her legs, restart the fluids as charted', 1], ['Give her tea and sugar', 0], ['Note it for later', 0]] }] },
  { title: 'Triage at reception', text: 'Five people are waiting. One is a man struggling to breathe.', steps: [
   { q: 'Who goes first?', a: [['The man who can\'t breathe', 1], ['Whoever came first', 0], ['The woman with a hospital card', 0]] },
   { q: 'Then?', a: [['Oxygen, observations, and get the doctor', 1], ['Ask him to fill the form', 0], ['Send him to the pharmacy', 0]] }] },
 ],
 teacher: [
  { title: 'SS2 mathematics', text: 'Thirty-eight students, quadratic equations, and a lot of noise at the back.', steps: [
   { q: 'Start the lesson how?', a: [['A market-prices word problem they care about, then the method', 1], ['Copy the textbook onto the board', 0], ['Let them talk for ten minutes', 0]] },
   { q: 'Two boys keep disturbing.', a: [['Move them to the front and give them a problem to solve on the board', 1], ['Send them out for the whole lesson', 0], ['Ignore them', 0]] }] },
  { title: 'Marking the test scripts', text: 'Forty scripts. Many students made the same mistake.', steps: [
   { q: 'What do you do?', a: [['Mark fairly, then re-teach that topic tomorrow', 1], ['Mark everyone down and move on', 0], ['Give everyone the marks anyway', 0]] }] },
 ],
 lecturer: [
  { title: 'Introduction to Computer Science, lecture 4', text: 'Two hundred first-year students. Today: algorithms.', steps: [
   { q: 'How do you teach it?', a: [['Live demo: sort a list of real market prices, then the theory', 1], ['Read the slides aloud', 0], ['Tell them to read the textbook', 0]] },
   { q: 'A student asks a question you can\'t answer.', a: [['Say you\'ll check and answer next lecture', 1], ['Make something up', 0], ['Tell her to stop asking', 0]] }] },
  { title: 'Final-year projects', text: 'Five students show you their projects. One looks copied.', steps: [
   { q: 'The copied one?', a: [['Ask him to explain his code; follow the department\'s rules', 1], ['Fail him on the spot without asking', 0], ['Pass it, it\'s easier', 0]] }] },
 ],
 lawyer: [
  { title: 'A trader accused of stealing goods', text: 'Your client says the goods were his, bought from a wholesaler at Ochanja.', steps: [
   { q: 'Prepare how?', a: [['Get the receipts and the wholesaler as a witness', 1], ['Tell the client to plead guilty', 0], ['Hope the prosecution doesn\'t turn up', 0]] },
   { q: 'In court, the prosecution\'s witness is unsure.', a: [['Cross-examine calmly on the dates and the receipts', 1], ['Shout at the witness', 0], ['Say nothing', 0]] }] },
  { title: 'A tenancy dispute', text: 'A landlord wants a family out of a flat in Fegge without notice.', steps: [
   { q: 'You act for the family. First?', a: [['Check the tenancy agreement and the notice the law requires', 1], ['Tell them to move out', 0], ['Threaten the landlord', 0]] }] },
 ],
};
const STORY_BEATS = [
 { id: 'traffic', place: 'upper-iweka', title: 'Traffic at Upper Iweka', angle: 'how long the go-slow is today and what drivers say' },
 { id: 'prices', place: 'ochanja', title: 'Food prices at Ochanja Market', angle: 'what a bag of rice and a basket of tomatoes cost this week' },
 { id: 'market', place: 'main-market', title: 'Business at the Main Market', angle: 'how traders are doing, and what customers are buying' },
 { id: 'bridge', place: 'bridgehead', title: 'Crossing the Niger Bridge', angle: 'traffic, trade and travellers at the bridgehead' },
 { id: 'mall', place: 'shoprite', title: 'Weekend at Onitsha Mall', angle: 'shoppers, prices and the cinema queue' },
 { id: 'church', place: 'basilica', title: 'Sunday at Holy Trinity', angle: 'the congregation, the choir and the visitors' },
];
export class OccupationsCity {
 constructor(g) { this.g = g; }
 adult() { return this.g.saveData?.character?.ageGroup !== 'child'; }
 get E() { return this.g.saveData?.education; }
 get W() { const s = this.g.saveData; if (!s) return null; s.gigs ??= { story: null, filed: 0, feed: [], last: {} }; return s.gigs; }
 get day() { return this.g.clock.day; }
 weekday() { return weekdayOf(this.day); } // 0 = Monday … 6 = Sunday
 // ── the university ──────────────────────────────────────────────────────────────────────────────
 universityView(l) {
  const g = this.g, E = this.E, opts = [];
  if (!this.adult()) return { title: 'Shanahan University', kicker: 'ADMISSIONS', text: 'Come back when you finish secondary school.', options: [{ label: 'OK', act: () => g.closeChoice() }] };
  if (E.enrolled) { const P = PROGRAMME[E.enrolled]; opts.push({ label: `Studying ${P.label}`, sub: `${E.lectures} of ${P.lectures} lectures · one a day in the lecture theatre (weekdays 8:00–17:00)`, disabled: true, why: 'Enrolled' }); opts.push({ label: 'Withdraw from the programme', sub: 'Your fees are not refunded', ghost: true, act: () => { E.enrolled = null; E.lectures = 0; g.saveGame(); g.openChoice(() => this.universityView(l)); } }); }
  else for (const P of PROGRAMMES) { const done = E.degrees.includes(P.id); opts.push({ label: `${done ? '✓ ' : ''}${P.label} · ${naira(P.fee)}`, sub: done ? 'You hold this degree' : `${P.faculty} · ${P.lectures} lectures · leads to: ${OCCUPATION[P.job]?.label ?? P.job}`, disabled: done || !g.economy.canAfford(P.fee), why: done ? 'Graduated' : 'Not enough money for the fees', act: () => this.enrol(P.id) }); }
  opts.push({ label: 'Close', ghost: true, act: () => g.closeChoice() });
  return { title: 'Admissions & registry', kicker: 'SHANAHAN UNIVERSITY', text: E.degrees.length ? `Your degrees: ${E.degrees.map((d) => PROGRAMME[d].label).join(', ')}.` : 'Choose a programme. The fee covers the whole programme.', note: 'Game programmes and fees, not the university\'s real ones.', options: opts };
 }
 enrol(id) { const g = this.g, P = PROGRAMME[id], E = this.E; if (E.enrolled || !g.economy.canAfford(P.fee)) return false; const tx = g.economy.transact({ key: `fees:${id}:${this.day}:${E.degrees.length}`, amount: -P.fee, reason: `Shanahan University: fees, ${P.label}` }); if (tx?.ok === false) return false; E.enrolled = id; E.lectures = 0; g.life?.note(`enrol:${id}:${this.day}`, `Enrolled at Shanahan University: ${P.label}`, { social: 1, public: 1 }); g.saveGame(); g.closeChoice(); g.ui.toast(`Welcome to Shanahan University. Your first lecture is in the lecture theatre (weekdays 8:00–17:00).`, 6000); return true; }
 lectureView(l) {
  const g = this.g, E = this.E, h = g.clock.minutes / 60, wd = this.weekday(), open = wd <= 4 && h >= 8 && h < 17;
  if (!E.enrolled) return { title: 'Lecture theatre 1', text: 'Enrol at admissions to attend lectures.', options: [{ label: 'OK', act: () => g.closeChoice() }] };
  const P = PROGRAMME[E.enrolled];
  return { title: 'Lecture theatre 1', kicker: P.label.toUpperCase(), text: `Lecture ${E.lectures + 1} of ${P.lectures}.`, options: [{ label: 'Attend today\'s lecture (2 hours)', sub: open ? `${P.skill} practice` : 'Lectures run weekdays 8:00–17:00', disabled: !open || E.lastLecture === this.day, why: !open ? 'No lecture now' : 'One lecture a day', act: () => this.attend() }, { label: 'Close', ghost: true, act: () => g.closeChoice() }] };
 }
 attend() {
  const g = this.g, E = this.E, r = attendLecture(E, this.day); if (!r.ok) { g.ui.toast(r.error); return r; }
  const seat = (g.civic.room?.seats ?? []).filter((s) => s.kind === 'seat' && s.y < 0.6)[3]; if (seat) g.posture?.use(seat);
  g.closeChoice(); g.skipTime(120); g.needs.adjust({ energy: -10, fun: -2 }); const skill = (PROGRAMME[r.graduated?.id ?? E.enrolled] ?? r.graduated)?.skill ?? 'charisma'; g.skills.add(skill, 35);
  if (r.graduated) { g.life?.note(`graduated:${r.graduated.id}`, `Graduated from Shanahan University: ${r.graduated.label}`, { public: 6, social: 3 }); g.ui.toast(`Congratulations! You graduated: ${r.graduated.label}. You can now apply to be a ${OCCUPATION[r.graduated.job]?.label.split(' (')[0].toLowerCase()}.`, 8000); }
  else g.ui.toast(`Lecture done. ${r.left} to go.`, 4000);
  g.saveGame(); return r;
 }
 libraryView(l) { const g = this.g, E = this.E, key = `library:${this.day}`, done = this.W.last.library === this.day; return { title: 'Library', text: E.enrolled ? `Revise for ${PROGRAMME[E.enrolled].label}.` : 'Read quietly.', options: [{ label: 'Study for two hours', sub: '+ skill practice · once a day', disabled: done, why: 'Already studied today', act: () => { this.W.last.library = this.day; g.closeChoice(); g.skipTime(120); g.skills.add(E.enrolled ? PROGRAMME[E.enrolled].skill : 'charisma', 20); g.needs.adjust({ energy: -6, fun: -3 }); E.studied++; g.saveGame(); g.ui.toast('A good study session.'); } }, { label: 'Close', ghost: true, act: () => g.closeChoice() }] }; }
 /** The staff room / staff door of a building: the jobs there. */
 staffView(l, careers = null) {
  const g = this.g, ids = careers ?? (l?.university ? ['lecturer'] : l?.id === 'ckc' ? ['teacher'] : []);
  const opts = this.adult() ? g.life.siteOptions({ careers: ids }) : [];
  opts.push({ label: 'Close', ghost: true, act: () => g.closeChoice() });
  return { title: 'Staff room', kicker: (l?.name ?? '').toUpperCase(), text: this.adult() ? 'Apply here; once hired, come back in working hours (7:00–20:00, Mon–Sat) for a shift.' : 'Staff only.', note: ids.map((id) => OCCUPATION[id]?.degree ? `${OCCUPATION[id].label}: needs ${OCCUPATION[id].degree === 'any' ? 'a degree' : `a degree in ${PROGRAMME[OCCUPATION[id].degree]?.label}`} (Shanahan University).` : '').join(' '), options: opts };
 }
 // ── a shift is a case ────────────────────────────────────────────────────────────────────────────
 runCase(id) {
  const g = this.g, list = CASES[OCCUPATION[id].cases] ?? [], c = g.life.work.current, cs = pick(list, (c?.shifts ?? 0) + this.day); if (!cs) return g.life.finishShift(null);
  const st = { i: 0, good: 0 };
  const step = () => {
   const s = cs.steps[st.i];
   if (!s) { // the shift's dilemma (every third shift), then pay
    const due = g.life.work.dilemmaDue(), d = OCCUPATION[id].dilemma, bonus = Math.round((OCCUPATION[id].shiftPay * RANK_PAY[c.rank] * 0.15 * st.good) / 50) * 50, title = `${cs.title}: ${st.good}/${cs.steps.length} right`;
    if (st.good < cs.steps.length) g.life.note(`case-miss:${id}:${c.shifts}:${this.day}`, `${cs.title}: not handled well`, { prof: { [id]: -1 } });
    if (!due) return g.life.finishShift(null, { bonus, title });
    return { title: 'On the job', kicker: `${OCCUPATION[id].ranks[c.rank].toUpperCase()} · A CHOICE`, text: d.prompt, note: 'Nobody makes this choice for you.', options: [{ label: d.honest, sub: 'Do it properly', act: () => { g.closeChoice(); g.life.finishShift('honest', { bonus, title }); } }, ...d.shortcut.map((t) => ({ label: t, sub: 'More money, if nobody notices', act: () => { g.closeChoice(); g.life.finishShift('shortcut', { bonus, title }); } }))] };
   }
   return { title: cs.title, kicker: `${OCCUPATION[id].ranks[c.rank].toUpperCase()} · ${st.i + 1} OF ${cs.steps.length}`, text: st.i === 0 ? `${cs.text}\n\n${s.q}` : s.q, options: s.a.map(([t, ok]) => ({ label: t, act: () => { st.good += ok; st.i++; const next = step(); if (next) g.openChoice(() => next); } })) };
  };
  const first = step(); if (first) g.openChoice(() => first);
 }
 // ── freelance: The Onitsha Courier ─────────────────────────────────────────────────────────────
 /** Today's assignments: three beats plus any city news (an election declared, a project opened). */
 assignments() {
  const g = this.g, out = [], d = this.day;
  for (let k = 0; k < 3; k++) { const b = pick(STORY_BEATS, d * 3 + k), L = g.world.landmarks.get(b.place); if (L && !out.some((o) => o.id === b.id)) out.push({ ...b, key: `${b.id}:${d}`, x: L.x, z: L.z, pay: 6000 }); }
  const P = g.saveData?.politics; for (const [n, S] of Object.entries(P?.seasons ?? {})) if (S.declared) { const L = g.world.landmarks.get('ochanja'); out.push({ id: `election${n}`, key: `election:${n}`, place: 'electoral', title: `Election results, season ${+n + 1}`, angle: (S.summary ?? []).slice(0, 2).join('; '), x: g.politics?.office?.place.x ?? L?.x, z: g.politics?.office?.place.z ?? L?.z, pay: 12000 }); }
  for (const pr of P?.projects ?? []) if (pr.done) out.push({ id: `project-${pr.id}`, key: `project:${pr.id}`, title: `A new ${pr.kind} opens`, angle: `commissioned by ${pr.by}`, x: pr.x, z: pr.z, pay: 9000 });
  return out.filter((a) => !(this.W.feed ?? []).some((f) => f.key === a.key)).slice(0, 6);
 }
 takeStory(a) { const W = this.W; W.story = { ...a, taken: this.day, reported: false }; this.g.saveGame(); return W.story; }
 /** At the place: interview people and take photos. */
 report() { const g = this.g, s = this.W.story; if (!s) return { ok: false, error: 'Take an assignment first.' }; if (Math.hypot(g.player.position.x - s.x, g.player.position.z - s.z) > 60) return { ok: false, error: 'Go to the place first (it\'s marked on your map).' }; s.reported = true; g.skipTime(60); g.needs.adjust({ energy: -6, social: 6 }); g.skills.add('photography', 15); g.saveGame(); return { ok: true }; }
 file() {
  const g = this.g, W = this.W, s = W.story; if (!s?.reported) return { ok: false, error: s ? 'Report from the place first.' : 'Take an assignment first.' };
  const q = Math.min(1, 0.45 + g.skills.level('photography') * 0.05 + g.skills.level('charisma') * 0.04 + ((g.saveData.education?.degrees ?? []).includes('masscomm') ? 0.2 : 0)), r = g.life.work.w.self.journalist?.rank ?? 0, pay = Math.round((s.pay * (1 + r * 0.25) * (0.6 + q * 0.6)) / 50) * 50;
  const tx = g.economy.transact({ key: `story:${s.key}`, amount: pay, reason: `Story fee: The Onitsha Courier (${s.title})` }); if (tx?.ok === false) return { ok: false, error: tx.error };
  (W.feed ??= []).push({ key: s.key, day: this.day, title: s.title, angle: s.angle, by: g.saveData.character.name }); if (W.feed.length > 30) W.feed.shift(); W.filed++; W.story = null;
  g.life.selfWork('journalist', `story:${s.key}`, `Filed a story for The Onitsha Courier: ${s.title} · ${naira(pay)}`, { prof: 2, public: 0.6 }); g.saveGame(); return { ok: true, pay };
 }
 // ── freelance: the DJ booth ────────────────────────────────────────────────────────────────────
 boothView() {
  const g = this.g, W = this.W, dj = W.last.dj === this.day, mc = W.last.mc === this.day, rk = (id) => g.life.work.w.self[id]?.rank ?? 0;
  const djPay = Math.round((7000 * (1 + rk('dj') * 0.4) * (0.7 + g.skills.level('music') * 0.06)) / 50) * 50, mcPay = Math.round((5000 * (1 + rk('hypeman') * 0.4) * (0.7 + g.skills.level('comedy') * 0.06)) / 50) * 50;
  return { title: 'The DJ booth', kicker: (g.club?.inside?.name ?? 'THE CLUB').toUpperCase(), text: 'The resident DJ waves you over.', options: [
   { label: 'Choose the music', sub: 'Playlist and volume', act: () => g.openChoice(() => g.venueMusic.view()) },
   { label: `Play a set (DJ) · about ${naira(djPay)}`, sub: `An hour on the decks · music ${g.skills.level('music')}`, disabled: dj, why: 'One set a night', act: () => this.gig('dj', djPay) },
   { label: `Grab the mic (hypeman) · about ${naira(mcPay)}`, sub: `Hype the crowd for an hour · comedy ${g.skills.level('comedy')}`, disabled: mc, why: 'Once a night', act: () => this.gig('hypeman', mcPay) },
   { label: 'Close', ghost: true, act: () => g.closeChoice() }] };
 }
 gig(kind, pay) {
  const g = this.g, W = this.W, k = kind === 'dj' ? 'dj' : 'mc'; if (W.last[k] === this.day) return false; W.last[k] = this.day;
  g.closeChoice(); g.skipTime(60); g.needs.adjust({ energy: -14, fun: 14, social: 10 }); g.skills.add(kind === 'dj' ? 'music' : 'comedy', 30);
  g.economy.transact({ key: `gig:${kind}:${this.day}:${g.club?.inside?.id ?? 'club'}`, amount: pay, reason: `${kind === 'dj' ? 'DJ set' : 'MC fee'}: ${g.club?.inside?.name ?? 'the club'}` });
  g.life.selfWork(kind, `gig:${kind}:${this.day}`, `${kind === 'dj' ? 'Played a DJ set' : 'Hyped the crowd as MC'} at ${g.club?.inside?.name ?? 'the club'} · ${naira(pay)}`, { prof: 2, public: 0.5 });
  g.saveGame(); g.ui.toast(kind === 'dj' ? 'The floor was full. Good set!' : 'The crowd loved it!', 4000); return true;
 }
}
