import { naira } from '../economy/Economy.js';
import { SEASON, PARTIES, PARTY, OFFICES, OFFICE, PROJECTS, CAMPAIGN, MEMBERSHIP_FEE, season } from './Politics.js';
/** v0.45 the phone's Politics app: the season, your party, your campaign, your office, and the players' elections. */
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
export function politicsApp(ph, notice = '') {
 const g = ph.g, C = g.politics, P = C?.P; if (!P) return;
 const sec = (t) => ph.body.append(el('h3', t, 'profile-h')), small = (t) => ph.text(t, 'phone-copy profile-small'), again = (msg) => ph.render('politics', msg);
 if (!C.adult()) { ph.text('Voting, parties and elections are for adults. When you are 18 you can register at the electoral offices.'); return; }
 const s = season(g.clock.day), phaseWord = { nominations: 'Nominations are open', campaign: 'The campaign is on', election: 'Election day', term: 'Results are in; the new office holders serve' }[s.phase];
 const card = el('div', null, 'profile-card'); card.append(el('strong', P.office ? `${OFFICE[P.office.id].prefix} ${C.me()}` : `Season ${s.n + 1} · day ${s.at} of ${SEASON.length}`), el('span', P.office ? OFFICE[P.office.id].title : `${phaseWord}. Election day: day ${s.electionDay}.`)); ph.body.append(card);
 if (C.office) ph.button('Find the Electoral Offices', 'Register to vote (INEC), nominations (ANSIEC), results, the debate, and the polling unit on election day', () => ph.mark(C.office.place.x, C.office.place.z, 'Electoral Offices'));
 small(P.registered ? `Registered voter since day ${P.regDay} · Polling unit 004` : 'Not registered to vote yet: go to the INEC desk at the Electoral Offices.');
 // party
 sec('Party');
 if (P.party) small(`${PARTY[P.party].name} (${PARTY[P.party].short}) · "${PARTY[P.party].slogan}" · member since day ${P.joined}`);
 for (const p of PARTIES) if (p.id !== P.party) ph.button(`${P.party ? 'Switch to' : 'Join'} the ${p.name} (${p.short})`, `"${p.slogan}" · membership ${naira(MEMBERSHIP_FEE)}`, () => again(C.joinParty(p.id) ? `Welcome to the ${p.short}.` : 'Not now.'), !g.economy.canAfford(MEMBERSHIP_FEE) || !!C.myRace());
 // the campaign
 const race = C.myRace();
 if (race) {
  const o = OFFICE[race.office]; sec(`Your campaign · ${o.title}`);
  small(`${o.area} · election on day ${s.electionDay} · campaign fund ${naira(race.campaign.fund ?? 0)} · rallies ${race.campaign.rallies ?? 0} · posters ${race.campaign.posters ?? 0} · debate ${race.campaign.debate ? race.campaign.debate + '/9' : 'not yet'}`);
  const poll = C.poll(race); small('Newspaper poll: ' + poll.map((c) => `${c.me ? 'you' : c.name} (${PARTY[c.party]?.short}) ${c.share}%`).join(' · '));
  if (s.phase === 'campaign') {
   for (const gr of C.grounds) ph.button(`Rally ground · ${gr.label}`, (race.campaign.places ?? []).includes(gr.id) ? 'You have held a rally here' : `Go there to hold a rally (${naira(CAMPAIGN.rally.cost(o))})`, () => ph.mark(gr.x, gr.z, `Rally ground · ${gr.label}`));
   ph.button(`Put up posters · ${naira(CAMPAIGN.posters.cost(o))}`, `${race.campaign.posters ?? 0} of ${CAMPAIGN.posters.max} rounds so far`, () => again(C.posters() ? 'Posters are up at the rally grounds.' : 'Not now.'), (race.campaign.posters ?? 0) >= CAMPAIGN.posters.max);
   for (const amt of [50_000, 500_000]) ph.button(`Put ${naira(amt)} of your own into the campaign`, 'Rallies and posters are paid from the fund first', () => again(C.donate(amt) ? 'Done.' : 'Not enough cash.'), !g.economy.canAfford(amt));
   small(`The candidates' debate is at the Electoral Offices from day ${s.debateDay}.`);
  } else if (s.phase === 'nominations') small(`The campaign starts on day ${s.start + SEASON.nominationsEnd}.`);
 }
 // office
 const off = P.office;
 if (off) {
  const T = OFFICE[off.id], left = off.budget - off.spent; sec('Your office');
  small(`Salary ${naira(T.salary)} a week · term ends on day ${off.until} · public budget ${naira(left)} left of ${naira(off.budget)}`);
  small('Commission a public project: it is built where you are standing (go outside first), and everyone sees it.');
  for (const pr of PROJECTS) ph.button(`${pr.label} · ${naira(pr.cost)}`, `${pr.days} days to build`, () => { const r = C.commission(pr.id); again(r.ok ? `Work has started on the ${pr.label.toLowerCase()}.` : r.error); }, pr.cost > left);
  ph.button(`(Divert ${naira(Math.min(left, Math.round(T.budget * 0.1)))} of public money to yourself)`, 'Corruption. The EFCC investigates, and a conviction removes you from office', () => { const r = C.divert(Math.round(T.budget * 0.1)); again(r.ok ? `${naira(r.amount)} is in your wallet. People will ask questions.` : r.error); }, left <= 0);
 }
 const built = P.projects.filter((p) => true).slice(-6); if (built.length) { sec('Public projects'); for (const p of built) ph.button(`${PROJECTS.find((x) => x.id === p.kind).label}${p.done ? '' : ' · under construction'}`, `${p.by} · day ${p.day}`, () => ph.mark(p.x, p.z, PROJECTS.find((x) => x.id === p.kind).label)); }
 // results
 const lines = C.resultLines(); if (lines.length) { sec('Results'); for (const l of lines.slice(0, 6)) small(l.trim()); }
 const hist = P.history.slice(-4).reverse(); if (hist.length) { sec('Your record'); for (const h of hist) small(h.left ? `Day ${h.day}: ${h.left}` : `Season ${h.n + 1}: ${OFFICE[h.office].title} — ${h.won ? 'won' : 'lost'} (${h.share}%)`); }
 if (P.barredUntil > g.clock.day) small(`Barred from standing until day ${P.barredUntil}.`);
 // the players' elections
 const o = g.online; if (o?.connected) {
  sec("Players' elections (online)"); ph.button('Refresh', 'Ask the server for the latest', () => { ph.elections = null; again(); });
  const E = ph.elections;
  if (!E) { small('Checking with the server…'); if (!ph.electionsLoading) { ph.electionsLoading = true; o.request('electionStatus').then((r) => { ph.elections = r.elections; }).catch(() => {}).finally(() => { ph.electionsLoading = false; if (ph.app === 'politics') again(); }); } }
  else {
   const word = { nominations: 'Nominations (Mon–Thu)', campaign: 'Campaign (Fri)', voting: 'Voting today (Sat)', results: 'Results (Sun)' }[E.phase];
   small(`Week of ${E.cycle} · ${word}. The players on this server elect their own councillor, chairman, assembly member and governor every week.`);
   if (E.phase === 'nominations' && !E.standing && P.party) for (const of of OFFICES) ph.button(`Stand for ${of.title} (players)`, `As the ${PARTY[P.party].short} candidate · free`, async () => { try { const r = await o.request('electionDeclare', { office: of.id, party: P.party }); ph.elections = r.elections; again(r.message); } catch (e) { again(e.message); } });
   if (E.standing) small(`You are standing for ${OFFICE[E.standing].title} this week.`);
   for (const of of OFFICES) { const cands = E.candidates.filter((c) => c.office === of.id); if (!cands.length) continue; const voted = E.voted.includes(of.id);
    if (E.phase === 'voting' && !voted) for (const c of cands) ph.button(`Vote ${c.name} (${PARTY[c.party]?.short}) · ${of.title}`, 'One vote per office this week', async () => { try { const r = await o.request('electionVote', { office: of.id, candidate: c.id }); ph.elections = r.elections; again(r.message); } catch (e) { again(e.message); } });
    else small(`${of.title}: ${cands.map((c) => `${c.name} (${PARTY[c.party]?.short})`).join(', ')}${voted ? ' · you voted' : ''}`); }
   const R = E.results ?? {}; const keys = Object.keys(R); if (keys.length) { small(`Results, week of ${E.resultsCycle}:`); for (const k of keys) { const r = R[k]; small(`${OFFICE[k].title}: ${r.winner ? `${r.names[r.winner]} (${PARTY[r.parties[r.winner]]?.short}) · ${r.totals[r.winner]} of ${r.cast}` : r.tie ? 'a tie: contested again next week' : 'no votes'}`); } }
  }
 }
}
