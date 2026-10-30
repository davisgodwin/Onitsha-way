import { naira } from '../economy/Economy.js';
/** v0.47 the phone's Ventures app: everything you run for yourself (stage 7, second part). */
export function venturesApp(ph) {
 const g = ph.g, Vn = g.ventures, V = Vn?.V; if (!V) return;
 const sec = (t) => { const h = document.createElement('h3'); h.className = 'profile-h'; h.textContent = t; ph.body.append(h); }, small = (t) => ph.text(t, 'phone-copy profile-small');
 if (!Vn.adult()) { ph.text('Running a business, a crew or a club is for adults.'); return; }
 const open = (fn) => () => { g.closeOverlay('phone'); g.openChoice(fn); };
 const self = g.life?.work?.w?.self ?? {}, rank = (id) => self[id] ? ` · ${self[id].acts} done` : '';
 sec('Your ventures');
 ph.button('Event planning', `Weddings, birthdays, burials${rank('planner')}${V.events.some((e) => !e.done) ? ' · bookings in progress' : ''}`, open(() => Vn.eventView()));
 ph.button('Interior decorating', `Clients' rooms to brief and budget${rank('decorator')}`, open(() => Vn.decorView()));
 ph.button(V.agency ? V.agency.name : 'Tech agency', V.agency ? `${V.agency.staff} developers · ${V.agency.briefs.filter((b) => !b.done).length} briefs open` : 'Register an agency (laptop needed)', open(() => Vn.agencyView()));
 ph.button('Landlord', `${Object.keys(V.lets).length} home(s) let${rank('landlord')}`, open(() => Vn.landlordView()));
 ph.button('Property development', `Finish unfinished buildings${V.builds.length ? ` · ${V.builds.filter((b) => !b.sold).length} project(s)` : ''}`, open(() => Vn.developView()));
 ph.button('Roadside call-outs', `Fix broken-down cars${rank('roadside')}`, open(() => Vn.calloutView()));
 ph.button(V.security ? V.security.name : 'Security company', V.security ? `${V.security.guards} guards · ${V.security.clients.length} clients` : 'Register a security company', open(() => Vn.securityView()));
 ph.button(V.crew ? V.crew.name : 'Street crew', V.crew ? 'Your turf and your rivals' : 'Start a crew (adults)', open(() => Vn.crewView()));
 ph.button('Football', `${V.club ? 'Onitsha City FC' : 'Trial at Onitsha City FC'}${V.coach ? ' · coaching the U-17s' : ''}`, open(() => Vn.footballView()));
 small('Money in and out appears in your wallet history. Rent, wages and fees run day by day while you play.');
}
