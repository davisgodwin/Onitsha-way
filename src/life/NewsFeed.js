import * as THREE from 'three';
import { weekdayOf } from '../sim/Calendar.js';
import { season, OFFICE } from '../politics/Politics.js';
import { EVENTS } from '../activities/CityEvents.js';
/**
 * v0.47 stage 8: the city responds.
 * - The news: built from what actually happened (elections declared, public projects opened, businesses opening and
 *   closing, warrants and convictions, league results, events, the stories you file). On the phone (The Courier) and
 *   on three LED news screens in town (by the mall, the Main Market, the bridgehead).
 * - Wanted notices: while the police or the EFCC have a warrant for you, posters with your name go up by the markets
 *   and the parks, and the screens carry it; people who recognise you may call it in.
 * - Announcements: the election season, polling day and the results.
 * - NPCs react to who you are: a well-known name, an office holder, someone feared, someone wanted.
 */
export function newNews() { return { v: 1, items: [], seen: {}, orgs: [], warrants: [] }; }
export function ensureNews(raw) {
 const o = raw && typeof raw === 'object' ? raw : newNews(); o.v = 1;
 o.items = Array.isArray(o.items) ? o.items.filter((x) => x && typeof x.title === 'string').slice(-80) : [];
 o.seen = o.seen && typeof o.seen === 'object' ? o.seen : {}; o.orgs = Array.isArray(o.orgs) ? o.orgs : []; o.warrants = Array.isArray(o.warrants) ? o.warrants : [];
 const keys = Object.keys(o.seen); if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete o.seen[k];
 return o;
}
/** How people see you, from your standing, your office and the law. Pure. */
export function fameOf({ standing = {}, office = null, wanted = false, name = '' } = {}) {
 const pub = standing.public ?? 0, noto = standing.notoriety ?? 0;
 const level = wanted ? 'wanted' : office ? 'office' : noto >= 45 && noto > pub ? 'feared' : pub >= 35 ? 'famous' : pub <= -25 ? 'disliked' : 'ordinary';
 return { level, name, office, pub, noto };
}
/** What a stranger says first, by how they see you (null = their usual line). Pure. */
export function fameOpener(f, rng = Math.random) {
 const n = f.name?.split(' ')[0] ?? '';
 switch (f.level) {
  case 'wanted': return { gen: rng() < 0.5 ? `Ehn… aren't you the one on the poster? Abeg, I no want trouble.` : `My brother, police dey find you. Wetin you do?` };
  case 'office': return { gen: `${f.office.prefix} ${n}! Welcome, sir/ma. Our road still need that light o!` };
  case 'feared': return { gen: rng() < 0.5 ? `Ah… ${n}. Good afternoon. No wahala here.` : `Oga ${n}, we dey here, we no see anything.` };
  case 'famous': return { gen: rng() < 0.5 ? `${n}! I see you for paper this week. Correct person!` : `Na you be ${n}? The whole Onitsha dey talk about you.` };
  case 'disliked': return { gen: `Hmm, ${n}. People dey talk about you, and e no sweet.` };
  default: return null;
 }
}
const SCREENS = [{ near: 'shoprite', dx: -40, dz: 30 }, { near: 'main-market', dx: -28, dz: 26 }, { near: 'bridgehead', dx: 26, dz: 18 }];
const POSTERS = [{ near: 'main-market', dx: 18, dz: -12 }, { near: 'upper-iweka-park', dx: -16, dz: 14 }, { near: 'ochanja', dx: 14, dz: 16 }, { near: 'bridgehead', dx: -20, dz: -14 }];
export class NewsFeed {
 constructor(g) { this.g = g; this.group = new THREE.Group(); this.group.name = 'News'; this.screens = []; this.posters = []; this.day = null; this.sig = ''; this.t = 0; }
 get N() { const s = this.g.saveData; if (!s) return null; return (s.news = ensureNews(s.news)); }
 setup() {
  const g = this.g, w = g.world;
  for (const s of SCREENS) { const L = w.landmarks.get(s.near); if (!L) continue; let x = L.x + s.dx, z = L.z + s.dz; try { [x, z] = w.findFreeSpot(x, z, 2); } catch { /* keep */ } const sc = this.buildScreen(x, z); this.screens.push(sc); g.interactions.register({ x, z, radius: 6, enabled: () => !!g.saveData && !g.civic?.inside && !g.homes?.inside, label: () => 'News screen — read the news', onInteract: () => g.openChoice(() => this.view()) }); }
  for (const p of POSTERS) { const L = w.landmarks.get(p.near); if (!L) continue; let x = L.x + p.dx, z = L.z + p.dz; try { [x, z] = w.findFreeSpot(x, z, 1.2); } catch { /* keep */ } this.posters.push({ x, z, mesh: null }); }
  g.renderer.scene.add(this.group);
 }
 places() { return this.screens.map((s, i) => ({ x: s.x, z: s.z, kind: 'office', id: 'news-screen-' + i, label: 'News screen' })); }
 /** Add a story once (key dedupes it). tag: politics, city, business, crime, court, sport, events, people. */
 add(tag, title, body = '', key = null) { const N = this.N; if (!N) return false; const k = key ?? `${tag}:${title}`; if (N.seen[k]) return false; N.seen[k] = this.g.clock.day; N.items.push({ day: this.g.clock.day, tag, title: String(title).slice(0, 120), body: String(body).slice(0, 240) }); if (N.items.length > 80) N.items.shift(); this.paint(); return true; }
 latest(n = 8) { const N = this.N, mine = (this.g.saveData?.gigs?.feed ?? []).map((f) => ({ day: f.day, tag: 'courier', title: f.title, body: `${f.angle ?? ''} (by ${f.by})` })); return [...(N?.items ?? []), ...mine].sort((a, b) => b.day - a.day).slice(0, n); }
 wanted() { return this.g.justice?.ready ? this.g.justice.cases.warrants() : []; }
 fame() { const g = this.g, P = g.saveData?.politics; return fameOf({ standing: g.life?.standing?.s ?? {}, office: P?.office ? OFFICE[P.office.id] : null, wanted: this.wanted().length > 0, name: g.saveData?.character?.name ?? '' }); }
 /** Someone recognises you from the wanted posters and calls the police: the warrant case gets a little stronger. */
 recognised(npc) { const W = this.wanted(); if (!W.length || Math.random() > 0.2) return false; const c = W[0]; this.g.justice.cases.add(c.id, 0.15); this.g.ui?.toast?.('Someone looked at you twice and reached for their phone.', 4500); return true; }
 update(dt) {
  const g = this.g; if (!g.saveData || !this.N) return;
  if (this.saveRef !== g.saveData) { this.saveRef = g.saveData; this.day = null; }
  this.t += dt ?? 0; if (this.day === g.clock.day && this.t < 5) return; this.t = 0;
  const newDay = this.day !== g.clock.day; this.day = g.clock.day;
  this.scan(newDay); this.posterCheck(); this.paint();
 }
 /** Look at what happened since the last look and write it up. */
 scan(newDay) {
  const g = this.g, N = this.N, day = g.clock.day, P = g.saveData.politics;
  // politics: the season, polling day, results, projects
  if (P) { const s = season(day);
   if (s.at === 1) this.add('politics', `Election season ${s.n + 1} opens`, 'Nominations are open at the Electoral Offices for councillor, LGA chairman, the House of Assembly and governor.', `season-open:${s.n}`);
   if (s.phase === 'election') this.add('politics', 'Polls open today, 8:00–17:00', 'Registered voters: bring your voter card to your polling unit. One vote per election.', `polls:${s.n}`);
   for (const [n, S] of Object.entries(P.seasons ?? {})) if (S.declared) for (const line of S.summary ?? []) this.add('politics', `Declared: ${line}`, 'Counted from the polling-unit record.', `result:${n}:${line}`);
   for (const pr of P.projects ?? []) if (pr.done) this.add('city', `New ${pr.kind} opens`, `Commissioned by ${pr.by}.`, `project:${pr.id}`); }
  // businesses opening and closing
  const orgs = (g.business?.orgs?.list ?? []).map((o) => ({ id: o.id, name: o.name })), was = new Map(N.orgs.map((o) => [o.id, o.name]));
  for (const o of orgs) if (!was.has(o.id)) this.add('business', `${o.name} opens`, 'A new business in town.', `open:${o.id}`);
  for (const [id, name] of was) if (!orgs.some((o) => o.id === id)) this.add('business', `${name} closes its doors`, '', `close:${id}`);
  N.orgs = orgs;
  // the law: warrants and convictions
  const W = this.wanted(), me = g.saveData.character.name;
  for (const c of W) this.add('crime', `WANTED: ${me}`, `The ${c.agency === 'efcc' ? 'EFCC' : 'police'} want ${me} in connection with: ${c.offence}.`, `wanted:${c.id}`);
  for (const c of g.saveData.justice?.cases ?? []) if (String(c.outcome ?? '').startsWith('convicted')) this.add('court', `Convicted: ${me}`, `${c.offence}. The Magistrate Court gave its verdict on day ${c.closedDay}.`, `convicted:${c.id}`);
  // what's on today
  if (newDay) { const wd = weekdayOf(day); for (const e of EVENTS) if (e.days.includes(wd)) this.add('events', `Today: ${e.name}`, `${e.where}, ${e.hours[0]}:00–${e.hours[1]}:00.`, `ev:${e.id}:${day}`); }
  // your public life: offices, degrees, promotions (from the life log, the big ones)
  for (const l of (g.life?.standing?.s?.log ?? []).slice(-12)) if (/^(Elected|Graduated|Promoted to|Signed for|Commissioned)/.test(l.text)) this.add('people', `${me}: ${l.text}`, '', `log:${l.day}:${l.text}`);
 }
 // ── what you see ────────────────────────────────────────────────────────────────────────────────
 buildScreen(x, z) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); const yaw = Math.random() * 0; grp.rotation.y = yaw;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.6, 0.35), new THREE.MeshStandardMaterial({ color: '#2b2f33' })); post.position.y = 2.8; grp.add(post);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.4, 0.35), new THREE.MeshStandardMaterial({ color: '#15181c' })); frame.position.set(0, 6.6, 0); grp.add(frame);
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex }); for (const s of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), mat); m.position.set(0, 6.6, 0.19 * s); if (s < 0) m.rotation.y = Math.PI; grp.add(m); }
  this.group.add(grp); this.g.world.collision.addCircle(x, z, 0.4); return { x, z, cv, tex, group: grp };
 }
 paint() {
  const items = this.latest(4), W = this.wanted(), sig = JSON.stringify([items.map((i) => i.title), W.length, this.g.clock.day]); if (sig === this.sig) return; this.sig = sig;
  for (const s of this.screens) { const c = s.cv.getContext('2d'), Wd = s.cv.width, H = s.cv.height; c.fillStyle = '#05080c'; c.fillRect(0, 0, Wd, H); c.fillStyle = W.length ? '#c0392b' : '#1d4f7a'; c.fillRect(0, 0, Wd, 96); c.fillStyle = '#fff'; c.font = '800 54px Arial'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(W.length ? 'WANTED · POLICE NOTICE' : 'THE ONITSHA COURIER · NEWS', 30, 50, Wd - 60);
   const lines = W.length ? [`${this.g.saveData?.character?.name ?? ''}`, W[0].offence, 'Seen this person? Call the Nigeria Police.'] : items.map((i) => i.title); if (!lines.length) lines.push('Welcome to Onitsha.');
   c.font = '700 44px Arial'; lines.slice(0, 4).forEach((t, i) => { c.fillStyle = i === 0 ? '#ffd166' : '#e9eef2'; c.fillText(t, 30, 160 + i * 92, Wd - 60); }); s.tex.needsUpdate = true; }
 }
 posterCheck() {
  const W = this.wanted(), name = this.g.saveData?.character?.name ?? '', key = W.length ? `${name}:${W[0].offence}` : '';
  for (const p of this.posters) {
   if (p.key === key) continue; if (p.mesh) { p.mesh.parent?.remove(p.mesh); p.mesh.traverse((o) => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); p.mesh = null; } p.key = key; if (!W.length) continue;
   const cv = document.createElement('canvas'); cv.width = 512; cv.height = 680; const c = cv.getContext('2d'); c.fillStyle = '#f3ead2'; c.fillRect(0, 0, 512, 680); c.fillStyle = '#7a1f1f'; c.font = '900 92px Arial'; c.textAlign = 'center'; c.fillText('WANTED', 256, 110); c.fillStyle = '#2a2a2a'; c.fillRect(146, 150, 220, 250); c.fillStyle = '#f3ead2'; c.beginPath(); c.arc(256, 240, 60, 0, 7); c.fill(); c.fillRect(186, 300, 140, 100); c.fillStyle = '#1b1b1b'; c.font = '800 44px Arial'; c.fillText(name.toUpperCase(), 256, 470, 480); c.font = '600 28px Arial'; c.fillText(W[0].offence.slice(0, 34), 256, 525, 480); c.fillText('Information to the Nigeria Police', 256, 600, 480);
   const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const grp = new THREE.Group(); grp.position.set(p.x, 0, p.z); const board = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.46), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide })); board.position.y = 1.9; const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.08), new THREE.MeshStandardMaterial({ color: '#6b5a48' })); post.position.y = 0.95; grp.add(board, post); grp.name = 'wanted-poster'; this.group.add(grp); p.mesh = grp;
  }
 }
 view() { const g = this.g, items = this.latest(12); return { title: 'The Onitsha Courier', kicker: 'THE NEWS', text: items.length ? items.map((i) => `Day ${i.day} · ${i.title}${i.body ? ' — ' + i.body : ''}`).join('\n') : 'Nothing yet.', options: [{ label: 'Close', act: () => g.closeChoice() }] }; }
}
