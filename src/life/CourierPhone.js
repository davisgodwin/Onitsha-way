import { naira } from '../economy/Economy.js';
import { PROGRAMME } from '../data/education.js';
/** v0.46 the phone's Courier app: today's news (stories filed by you), assignments for a freelance journalist, and
 *  your studies at Shanahan University. */
export function courierApp(ph) {
 const g = ph.g, O = g.occupationsCity; if (!O?.W) return; const W = O.W, again = (m) => ph.render('courier', m), small = (t) => ph.text(t, 'phone-copy profile-small'), sec = (t) => { const h = document.createElement('h3'); h.className = 'profile-h'; h.textContent = t; ph.body.append(h); };
 const card = document.createElement('div'); card.className = 'profile-card'; const a = document.createElement('strong'); a.textContent = 'The Onitsha Courier'; const b = document.createElement('span'); b.textContent = `${W.filed} stor${W.filed === 1 ? 'y' : 'ies'} filed by you`; card.append(a, b); ph.body.append(card);
 sec('The news'); const feed = g.news?.latest(10) ?? [...(W.feed ?? [])].reverse().slice(0, 6); if (!feed.length) small('Nothing yet.'); for (const f of feed) small(`Day ${f.day} · ${f.title}${f.body ? ' — ' + f.body : f.angle ? ' — ' + f.angle : ''}`);
 if (!O.adult()) { small('Writing for the paper is for adults.'); return; }
 sec('Freelance journalism');
 const s = W.story;
 if (s) {
  small(`Your assignment: ${s.title}. Find out ${s.angle}.`);
  ph.button('Show me where', 'It\'s marked on your map', () => ph.mark(s.x, s.z, s.title));
  ph.button(s.reported ? 'Reported ✓' : 'Interview people and take photos here', s.reported ? 'Now file it' : 'You have to be at the place (an hour)', () => { const r = O.report(); again(r.ok ? 'Got it: quotes and photos.' : r.error); }, s.reported);
  ph.button('File the story', 'The Courier pays when it runs', () => { const r = O.file(); again(r.ok ? `Filed. ${naira(r.pay)} paid.` : r.error); }, !s.reported);
  ph.button('Drop this assignment', '', () => { W.story = null; g.saveGame(); again(); });
 } else for (const x of O.assignments()) ph.button(x.title, `Find out ${x.angle} · about ${naira(x.pay)}`, () => { O.takeStory(x); again('Assignment taken: go there and report.'); });
 const E = g.saveData.education; sec('Studies');
 small(E?.enrolled ? `Shanahan University: ${PROGRAMME[E.enrolled].label}, ${E.lectures}/${PROGRAMME[E.enrolled].lectures} lectures.` : E?.degrees.length ? `Degrees: ${E.degrees.map((d) => PROGRAMME[d].label).join(', ')}.` : 'No degree yet. Shanahan University (map: schools) offers medicine, nursing, law, education, computer science and mass communication.');
}
