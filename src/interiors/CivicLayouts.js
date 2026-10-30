import { LAYOUTS } from './InteriorKit.js';
import { SEAT_HEIGHT } from '../characters/CharacterAnimator.js';
/**
 * v0.45 interiors for the places that still had the old plain box rooms: the palace visitors' hall, the churches, the
 * school, the ICT hub, the hotels, and the new eateries. Same kit and the same rules as v0.44: built when you walk in,
 * one mesh per room, seats you can sit on.
 *
 * The palace, churches and school are stylised visitor rooms, not replicas of the real interiors. The palace hall has
 * an empty, roped-off dais: the game never shows the Obi or any real person.
 */
const NAVY = 0, MAROON = 1, CREAM = 2, GREEN = 3, GREY = 4, GOLD = 5, WHITE = 10, BLACK = 11;

/** Uli-style wall painting (invented motifs in the spirit of Igbo uli: spirals, lines, dots and leaf shapes). */
export function uli(c, W, H, { ground = '#efe2c4', ink = '#2a1a10', accent = '#9b3a22', seed = 1 } = {}) {
 c.fillStyle = ground; c.fillRect(0, 0, W, H); c.strokeStyle = ink; c.lineWidth = 6; c.strokeRect(12, 12, W - 24, H - 24); c.lineWidth = 2; c.strokeRect(24, 24, W - 48, H - 48);
 let s = seed * 7919; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
 c.lineCap = 'round';
 const spiral = (x, y, R) => { c.beginPath(); for (let a = 0; a < Math.PI * 5; a += 0.15) { const q = (R * a) / (Math.PI * 5); c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.stroke(); };
 const leaf = (x, y, L, a) => { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L / 2, -L / 4, L, 0); c.quadraticCurveTo(L / 2, L / 4, 0, 0); c.fillStyle = accent; c.fill(); c.stroke(); c.restore(); };
 c.lineWidth = 5; c.strokeStyle = ink;
 const cols = 3, rows = Math.max(2, Math.round((H / W) * 3));
 for (let i = 0; i < cols; i++) for (let k = 0; k < rows; k++) {
  const x = 40 + ((W - 80) * (i + 0.5)) / cols, y = 40 + ((H - 80) * (k + 0.5)) / rows, R = Math.min(W / cols, (H - 80) / rows) * 0.32;
  const kind = Math.floor(r() * 4);
  if (kind === 0) spiral(x, y, R);
  else if (kind === 1) { for (let j = 0; j < 4; j++) leaf(x, y, R, (j * Math.PI) / 2 + 0.4); }
  else if (kind === 2) { c.beginPath(); c.arc(x, y, R * 0.8, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(x, y, R * 0.4, 0, Math.PI * 2); c.stroke(); c.fillStyle = accent; c.beginPath(); c.arc(x, y, R * 0.14, 0, Math.PI * 2); c.fill(); }
  else { c.beginPath(); for (let j = 0; j <= 20; j++) { const t = j / 20; c.lineTo(x - R + 2 * R * t, y + Math.sin(t * Math.PI * 3) * R * 0.35); } c.stroke(); for (let j = 0; j < 5; j++) { c.fillStyle = ink; c.beginPath(); c.arc(x - R + (j * R) / 2, y + R * 0.7, 4, 0, Math.PI * 2); c.fill(); } }
 }
}
/** A wall menu / notice board: a title and lines of text. */
export function board(title, lines, { bg = '#1d2b24', fg = '#f6efd8', accent = '#f2c14e' } = {}) {
 return (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.strokeStyle = accent; c.lineWidth = 6; c.strokeRect(6, 6, W - 12, H - 12);
  const tf = Math.min(44, H * 0.16), top = tf + 22, step = (H - top - 14) / Math.max(1, lines.length), lf = Math.min(26, step * 0.72);
  c.fillStyle = accent; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${tf}px Arial`; c.fillText(title, W / 2, 10 + tf / 2 + 4, W - 40);
  c.font = `600 ${lf}px Arial`; lines.forEach((l, i) => { const y = top + step * (i + 0.5); c.textAlign = 'left'; c.fillStyle = fg; if (Array.isArray(l)) { c.fillText(l[0], 24, y, W * 0.66); c.textAlign = 'right'; c.fillStyle = accent; c.fillText(l[1], W - 24, y); } else c.fillText(l, 24, y, W - 48); }); };
}

Object.assign(LAYOUTS, {
 /** Ime Obi visitors' hall: carved pillars, a red runner to an empty roped-off dais, a heritage gallery, the visitors' book. */
 palace(R) {
  const W = 22, D = 20, RED = '#8e1b2a', GOLDC = '#d4a73c', WOOD = '#4a2a18';
  R.shell({ w: W, d: D, h: 5.5, floor: '#b8946a', wall: '#f1e6cf', band: '#7d1d28', ceiling: '#efe4cc', door: 3.4 }); R.lights(3, 3, '#fff1d6');
  for (const z of [7.5, 13.5]) { R.cyl(11, z, 4.7, 5.5, 0.03, '#c9a24a'); R.cyl(11, z, 4.35, 4.7, 0.75, '#f6dc8c', true); R.cyl(11, z, 4.2, 4.35, 0.45, '#c9a24a'); }
  // the runner from the door to the dais
  R.box(2.6, 0.02, 15, 11, 0.01, 12.4, RED); for (const s of [-1, 1]) R.box(0.12, 0.025, 15, 11 + s * 1.3, 0.012, 12.4, GOLDC);
  // the dais, the empty carved chair, two ceremonial umbrellas
  R.box(9, 0.45, 3.6, 11, 0.225, 2.2, '#5a3420', true); R.box(9.2, 0.05, 3.8, 11, 0.47, 2.2, RED); R.box(5, 0.22, 0.7, 11, 0.11, 4.35, '#5a3420');
  R.box(1.3, 0.53, 1, 11, 0.735, 1.6, '#3d2414'); R.box(1.2, 0.1, 0.9, 11, 1.05, 1.6, '#b0222f'); R.box(1.4, 2.2, 0.18, 11, 2.1, 1.05, '#3d2414'); R.box(1.5, 0.2, 0.24, 11, 3.25, 1.05, GOLDC);
  for (let i = 0; i < 5; i++) R.box(0.12, 0.12, 0.03, 10.5 + i * 0.25, 2.6, 1.16, GOLDC); for (const s of [-1, 1]) R.box(0.15, 0.4, 0.9, 11 + s * 0.65, 1.25, 1.6, '#3d2414');
  for (const s of [-1, 1]) { const x = 11 + s * 2.4; R.cyl(x, 1.5, 0.47, 3.0, 0.04, '#c9a24a'); R.cyl(x, 1.5, 2.85, 3.05, 0.95, RED); R.cyl(x, 1.5, 2.72, 2.85, 1.0, GOLDC); }
  // the rope line visitors stay behind
  for (const x of [7.2, 9.2, 12.8, 14.8]) { R.box(0.08, 0.9, 0.08, x, 0.45, 5.1, '#c9a24a'); R.cyl(x, 5.1, 0.88, 0.97, 0.07, GOLDC); } R.box(7.6, 0.05, 0.05, 11, 0.8, 5.1, RED); R.solid(11, 4.2, 9.4, 2.4, 1.2); R.solid(11, 2.2, 9.4, 3.8, 1.2);
  R.sign('ROYAL DAIS · VISITORS PLEASE STAY BEHIND THE ROPE', 11, 1.2, 5.16, 4.4, 0.26, '#7d1d28', '#f6dc8c');
  R.sign('IME OBI', 11, 4.85, 0.13, 6, 0.7, '#7d1d28', '#f6dc8c', 0, "PALACE VISITORS' HALL · ONITSHA");
  R.mural(4.6, 2.7, 0.13, 4.6, 3.2, 0, (c, w, h) => uli(c, w, h, { seed: 2 })); R.mural(17.4, 2.7, 0.13, 4.6, 3.2, 0, (c, w, h) => uli(c, w, h, { seed: 5 }));
  // carved pillars
  for (const x of [4.2, 17.8]) for (const z of [7, 11, 15]) { R.box(0.7, 5.5, 0.7, x, 2.75, z, WOOD, true); for (const y of [0.35, 1.9, 3.5, 5.1]) { R.box(0.8, 0.14, 0.8, x, y, z, GOLDC); R.box(0.74, 0.06, 0.74, x, y + 0.32, z, '#2a170c'); } }
  // visitors' benches facing the dais
  for (const z of [8, 10, 12, 14]) { R.bench(7.1, z, 3.4, '#5a3420'); R.bench(14.9, z, 3.4, '#5a3420'); }
  // heritage gallery (left wall): drums, pots, a carved stool, uli panels
  R.sign('HERITAGE GALLERY', 0.16, 3.6, 10.5, 3.4, 0.42, '#7d1d28', '#f6dc8c', Math.PI / 2);
  R.mural(0.14, 2.3, 8.2, 2.6, 1.6, Math.PI / 2, (c, w, h) => uli(c, w, h, { seed: 9, ground: '#e8d6b0' })); R.mural(0.14, 2.3, 12.8, 2.6, 1.6, Math.PI / 2, (c, w, h) => uli(c, w, h, { seed: 13, ground: '#e8d6b0' }));
  [7, 9.3, 11.7, 14].forEach((z, i) => { R.box(0.9, 0.85, 0.9, 1.3, 0.425, z, '#efe2c4', true);
   if (i === 0) { R.cyl(1.3, z, 0.85, 1.65, 0.32, '#6b3d22'); R.cyl(1.3, z, 1.65, 1.69, 0.33, '#e6d3a8'); }
   else if (i === 1) { R.cyl(1.3, z, 0.85, 1.25, 0.3, '#9b5a33'); R.cyl(1.3, z, 1.25, 1.45, 0.17, '#9b5a33'); R.cyl(1.3, z, 1.45, 1.5, 0.21, '#7a4325'); }
   else if (i === 2) { R.box(0.6, 0.06, 0.45, 1.3, 1.25, z, '#3d2414'); for (const s of [-1, 1]) R.box(0.12, 0.35, 0.4, 1.3 + s * 0.22, 1.05, z, '#3d2414'); }
   else { R.cyl(1.3, z, 0.85, 1.05, 0.22, GOLDC); R.box(0.05, 0.6, 0.05, 1.3, 1.35, z, '#3d2414'); R.box(0.4, 0.05, 0.05, 1.3, 1.55, z, '#3d2414'); } });
  // the visitors' book and the palace attendant (right, near the door)
  R.desk(19.4, 16.2, { monitor: false, color: '#5a3420', face: -1 }); R.box(0.5, 0.05, 0.35, 19.4, 0.8, 16.2, '#f4ecd8'); R.person(19.4, 15.4, 0, { outfit: 'senator', color: WHITE, bottomColor: WHITE });
  R.sign("VISITORS' BOOK", 21.84, 2.3, 16.2, 2.2, 0.32, '#7d1d28', '#f6dc8c', -Math.PI / 2);
  // palace guards at the ends of the rope
  R.person(6.4, 5.5, 0, { outfit: 'senator', color: MAROON, bottomColor: WHITE }); R.person(15.6, 5.5, 0, { outfit: 'senator', color: MAROON, bottomColor: WHITE });
  R.door('back', 19.6, 'PRIVATE', '#3d2414'); R.door('back', 2.4, 'PRIVATE', '#3d2414'); R.plant(1, 18.8); R.plant(21, 18.8);
  return { spawn: { x: 11, z: 18.6 }, exit: { x: 11, z: 19.4 }, book: { x: 19.4, z: 17.2 }, gallery: { x: 2.4, z: 10.5 }, dais: { x: 11, z: 6 } };
 },
 /** A church nave: pews either side of the aisle, the sanctuary with the altar, a lectern, coloured windows. */
 church(R, { name = 'CHURCH', style = 'plain' } = {}) {
  const basil = style === 'basilica', angl = style === 'anglican';
  R.shell({ w: 20, d: 22, h: 7, floor: basil ? '#b9a98a' : '#c8bfae', wall: basil ? '#efe5cc' : '#f4efe4', band: basil ? '#8d2f28' : angl ? '#2d3f6b' : '#5a4a7a', ceiling: basil ? '#e8dcc0' : '#efe9dc' });
  if (basil) { // columns down the nave, pointed arches painted between them, a painted apse over the altar, the relic shrine
   for (const x of [4.2, 15.8]) for (let z = 7; z <= 19; z += 3) { R.cyl(x, z, 0, 6.2, 0.32, '#e6dcc2'); R.box(0.9, 0.3, 0.9, x, 6.25, z, '#d4af37'); }
   R.mural(10, 4.6, 0.13, 7, 3.6, 0, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1d3f73'); g.addColorStop(1, '#3f6fb5'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#f2c14e'; for (let i = 0; i < 40; i++) c.fillRect((i * 97) % w, (i * 53) % (h * 0.6), 4, 4); c.strokeStyle = '#f2c14e'; c.lineWidth = 8; c.beginPath(); c.arc(w / 2, h, h * 0.8, Math.PI, 0); c.stroke(); c.fillStyle = '#fff6e2'; c.beginPath(); c.arc(w / 2, h * 0.55, h * 0.12, 0, 7); c.fill(); });
   for (const x of [0.13, 19.87]) for (const z of [8.5, 13, 17.5]) R.mural(x, 4.2, z, 1.2, 2.4, x < 1 ? Math.PI / 2 : -Math.PI / 2, (c, w, h) => { c.fillStyle = '#efe5cc'; c.fillRect(0, 0, w, h); c.fillStyle = '#3f6fb5'; c.beginPath(); c.moveTo(w * 0.1, h); c.lineTo(w * 0.1, h * 0.35); c.quadraticCurveTo(w / 2, -h * 0.05, w * 0.9, h * 0.35); c.lineTo(w * 0.9, h); c.fill(); c.fillStyle = '#c0392b'; c.fillRect(w * 0.42, h * 0.3, w * 0.16, h * 0.7); c.fillStyle = '#f2c14e'; c.fillRect(w * 0.2, h * 0.55, w * 0.6, h * 0.08); });
   R.box(1.4, 1.1, 0.8, 2.4, 0.55, 5.4, '#d6c7a0', true); R.box(1.6, 0.08, 1, 2.4, 1.12, 5.4, '#d4af37'); R.sign('RELICS OF BLESSED IWENE TANSI', 2.4, 1.6, 5.82, 2.2, 0.22, '#8d2f28', '#f6e7b0');
  }
  if (angl) { // tall coloured glass slits between concrete arches, a wide choir, the bishop's chair
   for (const x of [0.13, 19.87]) for (let z = 7.5; z <= 19; z += 2.9) R.mural(x, 3.4, z, 2.4, 5.6, x < 1 ? Math.PI / 2 : -Math.PI / 2, (c, w, h) => { c.fillStyle = '#e9e6dd'; c.fillRect(0, 0, w, h); c.fillStyle = '#d8d5cc'; c.beginPath(); c.moveTo(0, h); c.lineTo(0, w / 2); c.arc(w / 2, w / 2, w / 2, Math.PI, 0); c.lineTo(w, h); c.lineTo(w * 0.85, h); c.lineTo(w * 0.85, w / 2); c.arc(w / 2, w / 2, w * 0.35, 0, Math.PI, true); c.lineTo(w * 0.15, h); c.fill(); ['#3f6fb5', '#c0392b', '#f2c14e', '#2f8f5a', '#8e44ad'].forEach((col, i) => { c.fillStyle = col; c.fillRect(w * 0.3 + i * w * 0.08, h * 0.25, w * 0.07, h * 0.7); }); });
   R.box(1.2, 2.2, 0.9, 14.2, 0.4 + 1.1, 2.2, '#5a3a24', true); R.sign("BISHOP'S CATHEDRA", 14.2, 2.95, 2.7, 1.8, 0.2, '#2d3f6b', '#fff');
  } R.lights(2, 4, '#fff6e2'); R.fan(6, 10); R.fan(14, 10); R.fan(6, 16); R.fan(14, 16);
  R.box(16, 0.4, 4.6, 10, 0.2, 2.6, '#a08868', true); R.box(6, 0.2, 0.6, 10, 0.1, 5.2, '#a08868');
  R.box(3, 1, 1, 10, 0.9, 2, '#efe7d6', true); R.box(3.1, 0.04, 1.1, 10, 1.42, 2, '#f6f2e8'); R.box(0.6, 0.8, 0.02, 10, 1.0, 2.52, '#b08a3c');
  for (const x of [8.9, 11.1]) { R.cyl(x, 2, 1.44, 1.8, 0.04, '#f6f2e8'); R.cyl(x, 2, 1.8, 1.88, 0.02, '#ffd27a', true); }
  R.box(0.28, 3, 0.1, 10, 4.4, 0.16, '#b08a3c'); R.box(1.6, 0.28, 0.1, 10, 5.2, 0.16, '#b08a3c');
  R.box(0.6, 1.2, 0.5, 6.4, 1.0, 3.6, '#7a5a3a', true); R.box(0.7, 0.05, 0.55, 6.4, 1.62, 3.6, '#6b4a30');
  for (let i = 0; i < 6; i++) R.chair(13 + (i % 3) * 0.6, 3 + Math.floor(i / 3) * 0.7, { color: '#5a4a7a', face: -1 });
  R.box(1.4, 0.9, 0.5, 16.2, 0.85, 1.4, '#2a2a2a', true); R.box(1.3, 0.04, 0.3, 16.2, 1.32, 1.55, '#f4f4f0');
  const panes = ['#3f6fb5', '#c0392b', '#f2c14e', '#2f8f5a', '#8e44ad'];
  for (const [x, rot] of [[0.12, Math.PI / 2], [19.88, -Math.PI / 2]]) for (const z of [7, 11, 15, 19]) for (let k = 0; k < 4; k++) R.box(0.04, 0.7, 1.1, x, 2.4 + k * 0.72, z, panes[(k + Math.round(z)) % panes.length], false, true);
  for (let z = 8; z <= 19.5; z += 1.45) { R.bench(5.2, z, 6, '#6b4a30'); R.bench(14.8, z, 6, '#6b4a30'); }
  R.box(2.2, 0.02, 15, 10, 0.01, 13, '#7d2a3a');
  R.sign(name.toUpperCase(), 10, 6.45, 0.13, 10, 0.5, basil ? '#8d2f28' : angl ? '#2d3f6b' : '#5a4a7a', '#fff6e2');
  R.sign('VISITORS WELCOME · PLEASE KEEP SILENT', 10, 2.8, 21.8, 5, 0.32, '#5a4a7a', '#fff6e2', Math.PI);
  R.plant(1, 21); R.plant(19, 21);
  return { spawn: { x: 10, z: 20.6 }, exit: { x: 10, z: 21.4 }, pew: { x: 10, z: 12 }, sanctuary: { x: 10, z: 6.2 } };
 },
 /** A school visitors' classroom: blackboard, rows of desks, the teacher's desk, a trophy cabinet, a notice board. */
 school(R, { name = 'SCHOOL' } = {}) {
  R.shell({ w: 18, d: 14, h: 4, floor: '#c9bfa6', wall: '#eae6d2', band: '#2f5d3a' }); R.lights(3, 2, '#fbfff2'); R.fan(6, 7); R.fan(12, 7);
  R.box(7, 2, 0.08, 9, 2, 0.17, '#27483e'); R.box(7.2, 0.08, 0.15, 9, 0.97, 0.22, '#8a674b'); R.sign('LEARN • BUILD • CREATE', 9, 2.6, 0.22, 4, 0.4, '#27483e', '#f4edca');
  R.sign(name.toUpperCase(), 9, 3.5, 0.13, 9, 0.4, '#2f5d3a', '#f4edca');
  R.desk(9, 2.3, { monitor: false, color: '#8a674b', w: 1.8, face: -1 }); R.chair(9, 1.5, { color: '#5a4a3a', face: -1 });
  for (const x of [4, 7, 11, 14]) for (const z of [5, 7.2, 9.4]) { R.desk(x, z, { monitor: false, color: '#b99562', w: 1.2, d: 0.55, face: 1 }); R.chair(x - 0.28, z + 0.55, { color: '#6e826a' }); R.chair(x + 0.28, z + 0.55, { color: '#6e826a' }); }
  R.box(1.6, 2, 0.5, 16.5, 1, 1.2, '#7a5a3a', true); R.glass(1.5, 1.4, 0.04, 16.5, 1.3, 1.47); for (const y of [0.9, 1.5]) { R.box(1.4, 0.03, 0.4, 16.5, y, 1.2, '#d9cfa8'); for (let k = 0; k < 3; k++) R.cyl(16 + k * 0.5, 1.2, y + 0.02, y + 0.32, 0.08, '#d4a73c'); }
  R.mural(0.14, 2.1, 7, 3.4, 1.6, Math.PI / 2, board('NOTICE BOARD', ['Adult evening classes: Mon–Fri', 'Coding club · public speaking', 'Inter-house sports: next term', 'Visitors sign in at the office'], { bg: '#7a5a3a', accent: '#f4edca' }));
  R.shelf(17.3, 7, 1.2, { goods: ['#2f5d3a', '#7d1d28', '#1d2b4f', '#c9a227'], frame: '#7a5a3a', seed: 4 }); R.plant(1, 13); R.plant(17, 13);
  R.door('right', 10.6, 'STAFF ROOM');
  return { spawn: { x: 9, z: 12.5 }, exit: { x: 9, z: 13.4 }, desk: { x: 9, z: 3.4 }, staff: { x: 16.9, z: 10.6 } };
 },
 /** The ICT hub: rows of computers, an equipment counter, a photo studio corner, a gig board. */
 ictlab(R, { name = 'ICT HUB' } = {}) {
  R.shell({ w: 20, d: 16, h: 4, floor: '#d4d6d8', wall: '#eef1f2', band: '#2a7d5a' }); R.lights(3, 3, '#f4fbff');
  R.sign(name.toUpperCase(), 7, 3.35, 0.13, 9, 0.5, '#1f3a4a', '#d9f3d0', 0, 'CODE LAB · PHOTO STUDIO · EQUIPMENT DESK');
  for (const x of [2.5, 5, 7.5, 10]) for (const z of [3.5, 6.5]) { R.desk(x, z, { face: 1, color: '#e8e8e4', w: 1.3 }); R.chair(x, z + 0.65, { color: '#1f3a4a' }); }
  R.counter(5, 11.3, 4.5, { color: '#2a7d5a', top: '#f2f2f2' }); R.person(5, 10.5, 0, { outfit: 'polo_chinos', color: GREEN, gender: 'female' }); R.shelf(5, 9.3, 4, { goods: ['#222', '#555', '#888', '#2a7d5a'], frame: '#9aa0a6', seed: 6, levels: 3 });
  R.sign('EQUIPMENT DESK', 5, 2.3, 9.0, 2.4, 0.3, '#2a7d5a', '#fff');
  // photo studio (right): a white sweep, two softboxes, a camera on a tripod
  R.box(0.2, 3, 5, 13.2, 1.5, 4, '#cfd3d6', true); R.box(5.5, 3, 0.05, 16.6, 1.6, 0.2, '#f7f7f5'); R.box(5.5, 0.02, 3, 16.6, 0.02, 1.7, '#f7f7f5');
  for (const x of [14.5, 18.7]) { R.box(0.04, 1.8, 0.04, x, 0.9, 3.8, '#2a2a2a'); R.box(0.7, 0.7, 0.3, x, 2, 3.8, '#f7f7f5', false, true); }
  R.box(0.04, 1.4, 0.04, 16.6, 0.7, 5.8, '#2a2a2a'); R.box(0.2, 0.15, 0.25, 16.6, 1.45, 5.8, '#111'); R.chair(16.6, 1.6, { color: '#c9a227', face: -1 });
  R.sign('PHOTO STUDIO', 16.6, 3.3, 0.24, 3, 0.35, '#1f3a4a', '#fff');
  R.mural(19.86, 2, 10.5, 4, 1.8, -Math.PI / 2, board('GIG BOARD', [['Website for a market trader', '₦25,000'], ['Product photos · 20 items', '₦15,000'], ['Wedding photos (Saturday)', '₦40,000'], ['Teach Excel basics', '₦8,000']], { bg: '#1f3a4a', accent: '#8fe0b0' }));
  R.sofa(16, 13.6, 2.6, { color: '#2a7d5a' }); R.plant(1, 15); R.plant(19, 15);
  return { spawn: { x: 10, z: 14.6 }, exit: { x: 10, z: 15.4 }, desk: { x: 5, z: 12.4 }, lab: { x: 6.2, z: 8 }, studio: { x: 16.6, z: 7 } };
 },
 /**
  * v0.46 a hotel: reception, a lounge and restaurant at the front, and a corridor of four rooms you can walk into and
  * book: standard, deluxe, executive and a suite, each furnished to its price (prices come from opts.rooms).
  */
 hotel(R, { name = 'HOTEL', rooms = [] } = {}) {
  const W = 30, D = 24, wall = '#e8dfcd', carpet = ['#7d6a52', '#6a4f6e', '#3f5d6e', '#7d2a2a'];
  R.shell({ w: W, d: D, h: 4.2, floor: '#b49a78', wall: '#f2ebdd', band: '#39494b' }); R.lights(4, 3, '#fff2dc');
  // rooms along the back, doorways onto a corridor at z = 9
  const rw = W / 4, labels = ['STANDARD', 'DELUXE', 'EXECUTIVE', 'SUITE'], anchors = {};
  for (let k = 1; k < 4; k++) R.box(0.15, 4.2, 8.6, k * rw, 2.1, 4.4, wall, true);
  for (let k = 0; k < 4; k++) { const x0 = k * rw, cx = x0 + rw / 2; R.box(rw / 2 - 0.8, 4.2, 0.15, x0 + (rw / 2 - 0.8) / 2, 2.1, 8.7, wall, true); R.box(rw / 2 - 0.8, 4.2, 0.15, x0 + rw - (rw / 2 - 0.8) / 2, 2.1, 8.7, wall, true); R.box(1.6, 1.6, 0.15, cx, 3.4, 8.7, wall);
   R.box(rw - 0.3, 0.02, 8.3, cx, 0.01, 4.4, carpet[k]); const r = rooms[k]; R.sign(`${labels[k]}${r ? ' · ₦' + r.price.toLocaleString('en-NG') : ''}`, cx, 3.0, 8.8, 2.6, 0.32, '#374f57', '#f9deb1', 0);
   anchors['room' + k] = { x: cx, z: 9.6 };
   if (k === 0) { R.bed(x0 + 2, 3, { color: '#f4efe6' }); R.chair(x0 + 5.5, 6.5, { color: '#6a3b2a', face: -1 }); R.box(1.1, 0.6, 0.05, x0 + 5.4, 1.7, 0.17, '#111'); R.box(1.05, 0.55, 0.02, x0 + 5.4, 1.7, 0.2, '#4a7fb5', false, true); }
   if (k === 1) { R.bed(x0 + 2, 3, { color: '#efe2f0' }); R.bed(x0 + 3.05, 3, { color: '#efe2f0' }); R.sofa(x0 + 5.7, 6.8, 1.8, { color: '#6a4f6e' }); R.box(1.1, 2, 0.6, x0 + 6.6, 1, 1.0, '#5a3a24', true); R.box(1.4, 0.75, 0.05, x0 + 4.9, 1.8, 0.17, '#111'); R.box(1.3, 0.7, 0.02, x0 + 4.9, 1.8, 0.2, '#4a7fb5', false, true); }
   if (k === 2) { R.bed(x0 + 1.8, 3, { color: '#e6eef2' }); R.bed(x0 + 2.85, 3, { color: '#e6eef2' }); R.desk(x0 + 5.7, 1.4, { face: -1, color: '#3d2a1a' }); R.chair(x0 + 5.7, 2.1, { color: '#2c2c2c' }); for (const dx of [4.7, 6.3]) R.chair(x0 + dx, 6.8, { color: '#3f5d6e' }); R.table(x0 + 5.5, 5.9, { round: true, w: 0.7, color: '#3d2a1a' }); R.box(0.6, 0.85, 0.55, x0 + 7.1, 0.43, 3.7, '#e8e8e8', true); R.sign('MINIBAR', x0 + 7.1, 1.0, 4.0, 0.5, 0.12, '#374f57', '#fff'); }
   if (k === 3) { R.bed(x0 + 1.9, 2.8, { color: '#f6efe2' }); R.bed(x0 + 2.95, 2.8, { color: '#f6efe2' }); R.box(2.4, 1.2, 0.12, x0 + 2.4, 1.3, 0.17, '#7d2a2a'); R.sofa(x0 + 5.6, 7.0, 2.4, { color: '#7d2a2a' }); R.table(x0 + 5.6, 5.8, { w: 1.4, d: 0.7, color: '#3d2a1a' }); R.box(1.8, 1.0, 0.05, x0 + 5.6, 1.9, 0.17, '#111'); R.box(1.7, 0.95, 0.02, x0 + 5.6, 1.9, 0.2, '#4a7fb5', false, true); R.cyl(x0 + 3.7, 5, 3.4, 4.2, 0.5, '#f6e7b0', true); R.plant(x0 + 7.1, 1); R.door('back', x0 + 6.5, 'BATH'); }
   if (k < 3) R.door('back', x0 + rw - 1.1, 'BATH');
  }
  // corridor and front of house
  R.box(W - 0.4, 0.02, 2.4, W / 2, 0.012, 10.2, '#6e2e2e');
  R.sign(name.toUpperCase(), 5, 3.5, 23.85, 8, 0.55, '#374f57', '#f9deb1', Math.PI, 'RECEPTION · ROOMS · RESTAURANT');
  R.counter(5, 14.8, 5, { color: '#5a3a24', top: '#e8dcc4' }); R.person(5, 14.0, 0, { outfit: 'suit_tie', color: NAVY, gender: 'female' }); R.box(2.4, 1, 0.06, 5, 2.2, 12.6, '#5a3a24'); for (let i = 0; i < 12; i++) R.box(0.06, 0.12, 0.03, 3.9 + (i % 6) * 0.42, 1.95 + Math.floor(i / 6) * 0.35, 12.65, '#d4a73c');
  R.box(0.15, 2.6, 2.4, 2.5, 1.3, 13.3, wall, true); R.cyl(6.6, 14.6, 1.08, 1.16, 0.08, '#d4a73c');
  R.sofa(11, 15, 2.6, { color: '#6a3b2a', face: -1 }); R.sofa(11, 18.4, 2.6, { color: '#6a3b2a' }); R.table(11, 16.7, { w: 1.2, d: 0.6, color: '#3d2a1a' });
  for (const [x, z] of [[19, 15], [22.5, 15], [19, 19], [22.5, 19], [26, 17]]) { R.table(x, z, { round: true, w: 1, cloth: '#f2ead8' }); R.chair(x, z + 0.75, { color: '#6a3b2a' }); R.chair(x, z - 0.75, { color: '#6a3b2a', face: -1 }); }
  R.sign('RESTAURANT', 22.5, 2.9, 12.0, 2.6, 0.32, '#374f57', '#f9deb1', 0); R.box(4, 1, 0.6, 26.8, 0.5, 21.6, '#5a3a24', true); R.person(26.8, 22.3, Math.PI, { outfit: 'shirt_trousers', color: WHITE, bottomColor: BLACK });
  R.plant(1, 23); R.plant(29, 23); R.plant(15, 12.4);
  return { spawn: { x: 15, z: 22.6 }, exit: { x: 15, z: 23.4 }, reception: { x: 5, z: 16 }, dining: { x: 21, z: 17 }, ...anchors };
 },
 /**
  * v0.46 a university block: the admissions office in the foyer, a tiered lecture theatre with a projector screen, a
  * library corner with shelves and reading tables, and the staff room door.
  */
 university(R, { name = 'UNIVERSITY' } = {}) {
  const W = 28, D = 22, blue = '#1d3f73';
  R.shell({ w: W, d: D, h: 5.5, floor: '#d9d4c8', wall: '#f3f0e8', band: blue, ceiling: '#f4f2ec' }); R.lights(4, 3, '#f7fbff');
  // lecture theatre (left two-thirds, at the back): screen and lectern on the back wall, rows rising towards you
  R.box(10, 3.4, 0.06, 9, 3.0, 0.16, '#e9eef2', false, true); R.sign('INTRODUCTION TO COMPUTER SCIENCE · LECTURE 4', 9, 4.9, 0.17, 9, 0.4, blue, '#fff');
  R.box(1, 1.2, 0.6, 9, 0.6, 2.0, '#5a3a24', true); R.person(9, 1.4, 0, { outfit: 'suit', color: GREY, gender: 'female' });
  for (let row = 0; row < 5; row++) { const z = 4.5 + row * 1.5, y = row * 0.28; if (row) R.box(16, y, 1.5, 9, y / 2, z + 0.2, '#c8c0ae', true); R.box(15, 0.06, 0.4, 9, y + 0.75, z - 0.35, '#7a5a3a'); R.box(15, 0.45, 0.45, 9, y + 0.22, z + 0.25, '#2d4f7a'); for (let k = 0; k < 10; k++) R.seat(1.8 + k * 1.6, z + 0.25, y + 0.49, Math.PI); }
  R.box(0.15, 4, 9, 17.4, 2, 7.5, '#e6e2d8', true); R.sign('LECTURE THEATRE 1', 9, 4.0, 12.1, 4, 0.36, blue, '#fff', Math.PI);
  // library (right): shelves and reading tables
  for (const z of [1.5, 4.0, 6.5]) R.shelf(23, z, 8, { goods: ['#1d3f73', '#7d1d28', '#2f5d3a', '#c9a227', '#f2f0e6'], frame: '#6b4a30', seed: Math.round(z * 3), both: true, depth: 0.4 });
  for (const z of [9.5, 12.2]) { R.table(22.5, z, { w: 2.4, d: 1, color: '#6b4a30' }); for (const dx of [-0.7, 0.7]) { R.chair(22.5 + dx, z + 0.8, { color: blue }); R.chair(22.5 + dx, z - 0.8, { color: blue, face: -1 }); } }
  R.sign('LIBRARY · QUIET PLEASE', 23, 4.6, 0.17, 5, 0.4, blue, '#fff');
  // foyer: admissions counter, notice board, the crest, seating
  R.counter(5, 16.5, 5, { color: blue, top: '#f2f2f2' }); R.person(5, 15.7, 0, { outfit: 'suit_tie', color: NAVY }); R.sign('ADMISSIONS & REGISTRY', 5, 2.6, 17.05, 4, 0.34, blue, '#fff', Math.PI);
  R.mural(0.14, 2.3, 18, 3.4, 1.8, Math.PI / 2, board('NOTICES', ['Matriculation: Friday, main hall', 'Library open 8:00–22:00', 'Faculty of Law: moot court', 'Part-time lecturers wanted'], { bg: blue, accent: '#f2c14e' }));
  R.mural(14, 4.4, 21.86, 3, 1.2, Math.PI, (c, w, h) => { c.fillStyle = blue; c.fillRect(0, 0, w, h); c.fillStyle = '#c9a227'; c.font = '800 54px Arial'; c.textAlign = 'center'; c.fillText(name.toUpperCase(), w / 2, h * 0.45, w - 30); c.font = '600 28px Arial'; c.fillText('ONITSHA', w / 2, h * 0.8); });
  R.sofa(10, 19.6, 2.4, { color: blue, face: -1 }); R.sofa(18, 19.6, 2.4, { color: blue, face: -1 }); R.door('right', 17, 'STAFF ROOM'); R.plant(1, 21); R.plant(27, 21);
  return { spawn: { x: 14, z: 20.6 }, exit: { x: 14, z: 21.4 }, admissions: { x: 5, z: 17.8 }, lecture: { x: 9, z: 12.6 }, library: { x: 22.5, z: 14 }, staff: { x: 26.8, z: 17 } };
 },
 /**
  * v0.46 the city's workplaces, inside: each trade gets its own room (a mechanic's workshop, a training kitchen, a
  * fashion workshop, a dispatch office, a property office, the market buyers' desk). opts.trade picks the room.
  */
 workplace(R, { name = 'WORKPLACE', trade = 'office' } = {}) {
  const W = 20, D = 16, col = { motors: '#c0392b', kitchen: '#2f8f5a', fashion: '#8e44ad', dispatch: '#e67e22', property: '#1d4f7a', market: '#b8860b', office: '#35665c' }[trade] ?? '#35665c';
  R.shell({ w: W, d: D, h: 4.2, floor: trade === 'motors' ? '#8f8c86' : '#d6d0c4', wall: '#efebe2', band: col }); R.lights(3, 3, '#fffaf0');
  R.sign(name.toUpperCase(), 10, 3.5, 0.13, 12, 0.5, col, '#fff', 0, 'JOBS · TRAINING · EQUIPMENT');
  R.counter(5, 12, 5, { color: col, top: '#efefe8' }); R.person(5, 11.2, 0, { outfit: 'shirt_trousers', color: CREAM }); R.sign('RECEPTION · APPLY HERE', 5, 2.4, 12.45, 3, 0.3, col, '#fff', Math.PI);
  R.mural(19.86, 2.2, 12, 4, 1.8, -Math.PI / 2, board('VACANCIES · TRAINING', ['Trainees wanted: apply at reception', 'Workshops every weekday', 'Equipment desk: tools for your work', 'Shifts 7:00–20:00, Mon–Sat'], { bg: '#22312c', accent: '#f2c14e' }));
  if (trade === 'motors') { for (const x of [5, 13]) { R.box(4.2, 0.1, 2, x, 0.05, 5, '#444'); R.box(3.8, 1.2, 1.7, x, 0.7, 5, x < 9 ? '#2f6fa8' : '#c0392b', true); R.box(2.2, 0.6, 1.5, x - 0.3, 1.6, 5, '#223'); } R.box(4, 2, 0.6, 17, 1, 1.2, '#7a7f84', true); for (let i = 0; i < 6; i++) R.box(0.5, 0.1, 0.1, 15.5 + i * 0.6, 1.6, 0.9, '#c0c0c0'); for (const z of [9, 9.7]) R.cyl(16.5, z, 0, 0.6, 0.3, '#1b1b1b'); }
  else if (trade === 'kitchen') { R.counter(10, 3.2, 12, { color: '#d9dcdc', top: '#b0b4b6' }); for (const x of [6, 9, 12, 15]) { R.cyl(x, 3.0, 1.1, 1.45, 0.28, '#5a5a5a'); R.box(0.6, 0.02, 0.6, x, 1.09, 3.0, '#e2582a', false, true); } R.shelf(10, 0.6, 10, { goods: ['#d94f3d', '#f2c14e', '#f5f1e6', '#3f8f5a'], seed: 9, levels: 3 }); for (const x of [8, 12]) { R.table(x, 7, { w: 2, d: 0.9, color: '#b0b4b6' }); } R.person(10, 2.4, 0, { outfit: 'shirt_trousers', color: WHITE, bottomColor: WHITE }); }
  else if (trade === 'fashion') { for (const x of [4, 8, 12, 16]) { R.table(x, 4.5, { w: 1.4, d: 0.8, color: '#e8e2d4' }); R.box(0.5, 0.35, 0.25, x, 0.95, 4.4, '#2a2a2a'); R.chair(x, 5.3, { color: '#8e44ad' }); } for (let i = 0; i < 5; i++) R.box(0.5, 1.3, 0.3, 3 + i * 1.2, 0.95, 8.4, ['#c0392b', '#f2c14e', '#2f8f5a', '#3f6fb5', '#8e44ad'][i]); R.box(0.05, 1.8, 6, 17.5, 1.6, 8.5, '#9a9a96'); }
  else if (trade === 'dispatch') { for (const x of [3, 7, 11]) R.shelf(x, 2, 3.2, { goods: ['#c9a46a', '#b38b55', '#e2c48f'], frame: '#7a7f84', seed: x, levels: 4 }); for (let i = 0; i < 8; i++) R.box(0.6, 0.45, 0.5, 14 + (i % 4) * 0.7, 0.23 + Math.floor(i / 4) * 0.45, 4, '#c9a46a'); R.desk(15, 8, { face: -1 }); R.chair(15, 8.8, { color: '#e67e22' }); R.box(1.6, 1.1, 1.0, 16.2, 0.55, 1.2, '#e67e22', true); }
  else { for (const [x, z] of [[4, 4], [8, 4], [12, 4], [16, 4], [8, 7.5], [12, 7.5]]) { R.desk(x, z, { face: 1, color: '#8a6a4a' }); R.chair(x, z + 0.65, { color: col }); } R.mural(10, 2.2, 0.14, 5, 1.6, 0, board(trade === 'property' ? 'LISTINGS' : 'BUYERS TODAY', trade === 'property' ? [['2-bedroom flat, Fegge', '₦650k/yr'], ['Shop, Old Market Rd', '₦1.2m/yr'], ['Self-contain, Odoakpu', '₦280k/yr']] : [['Ankara, 40 rolls', 'wholesale'], ['Phone accessories', 'urgent'], ['Rice, 50 bags', 'delivery']], { bg: '#1d2b24', accent: '#f2c14e' })); }
  R.chairRow(13, 13.6, 4, { color: col }); R.plant(1, 15); R.plant(19, 15);
  return { spawn: { x: 10, z: 14.6 }, exit: { x: 10, z: 15.4 }, desk: { x: 5, z: 13.2 }, board: { x: 18.6, z: 12 }, floor: { x: 10, z: 8.6 } };
 },
 /**
  * An eatery: the counter with a warmer of food, the menu board, the kitchen pass with the cook, a drinks fridge, tables
  * for two by the windows (dates) and tables for four. opts.style: 'local' (buka), 'grill' (suya and grills), 'garden'.
  * Returns the tables: [{ x, z, me: {x, z}, them: {x, z} }] — where you sit and where your date sits.
  */
 eatery(R, { name = 'EATERY', style = 'local', colors = ['#7a2a1a', '#f2c14e'], menu = [] } = {}) {
  const [bg, fg] = colors, floor = style === 'garden' ? '#b8a27e' : style === 'grill' ? '#8f7a62' : '#c9b79a';
  R.shell({ w: 18, d: 14, h: 3.8, floor, wall: style === 'grill' ? '#e6d6c0' : '#f3ead8', band: bg }); R.lights(3, 2, '#fff0d0'); R.fan(5, 7); R.fan(13, 7);
  R.sign(name.toUpperCase(), 9, 3.5, 0.13, 8, 0.46, bg, fg);
  R.mural(9, 2.15, 0.13, 4.4, 2.1, 0, board('MENU', menu.slice(0, 6).map((m) => [m.name, '₦' + m.price.toLocaleString('en-NG')]), { bg: '#1d2420', accent: fg }));
  R.counter(9, 3.6, 6, { color: bg, top: '#e8dcc4' }); R.glass(5.6, 0.5, 0.6, 9, 1.36, 3.6, '#f2e6c8');
  ['#d4542a', '#f2c14e', '#6b8e23', '#8b4513', '#f5f1e6', '#c0392b'].forEach((c, i) => R.box(0.7, 0.08, 0.4, 6.6 + i * 0.95, 1.16, 3.6, c));
  R.box(3, 1.2, 0.08, 4, 2, 0.16, '#3a2a1e'); R.box(2.8, 1, 0.04, 4, 2, 0.2, '#d98c3a', false, true); R.person(4, 1.2, 0, { outfit: 'shirt_trousers', color: WHITE, bottomColor: BLACK }); // kitchen pass + cook
  R.person(9, 2.8, 0, { gender: 'female', outfit: style === 'local' ? 'ankara_gown' : 'polo_chinos', color: style === 'local' ? 9 : MAROON });
  R.box(1, 1.9, 0.65, 15.8, 0.95, 1.1, '#e8e8e8', true); R.box(0.9, 1.6, 0.03, 15.8, 1, 1.45, '#cfefff', false, true); R.sign('COLD DRINKS', 15.8, 2.2, 1.46, 1.2, 0.25, bg, fg);
  if (style === 'grill') { R.box(2, 0.9, 0.8, 13.2, 0.45, 1.2, '#2a2a2a', true); R.box(1.8, 0.05, 0.6, 13.2, 0.92, 1.2, '#e2582a', false, true); R.sign('SUYA · ASUN · FISH', 13.2, 2.1, 0.2, 2.4, 0.3, bg, fg); }
  if (style === 'garden') { for (let i = 0; i < 7; i++) R.box(0.06, 0.06, 13.6, 2 + i * 2.3, 3.6, 7, '#fff2b0', false, true); for (const x of [0.6, 17.4]) for (const z of [5, 9, 12.5]) R.plant(x, z); }
  if (style === 'local') { R.mural(0.14, 2.2, 7, 3, 1.4, Math.PI / 2, (c, w, h) => uli(c, w, h, { seed: 21, ground: '#f3e1b8' })); for (const z of [5.2, 9]) R.box(0.6, 0.6, 0.02, 17.84, 2.2, z, '#3a7d44'); }
  // tables for two along the window walls (dates), tables for four in the middle
  const tables = [];
  for (const [x, z] of [[2.2, 6.5], [2.2, 10], [15.8, 6.5], [15.8, 10]]) { R.table(x, z, { w: 0.8, d: 0.8, color: '#5a3a24', cloth: style === 'garden' ? '#f2ead8' : null }); R.chair(x, z + 0.68, { color: bg }); R.chair(x, z - 0.68, { color: bg, face: -1 }); R.cyl(x, z, 0.77, 0.86, 0.04, '#ffd27a', true); tables.push({ x, z, me: { x, z: z + 0.68 }, them: { x, z: z - 0.68 } }); }
  for (const [x, z] of [[7, 7.2], [11, 7.2], [7, 10.8], [11, 10.8]]) { R.table(x, z, { w: 1.4, d: 0.9, color: '#5a3a24' }); for (const dx of [-0.35, 0.35]) { R.chair(x + dx, z + 0.72, { color: bg }); R.chair(x + dx, z - 0.72, { color: bg, face: -1 }); } }
  R.plant(1, 13.2); R.plant(17, 13.2);
  return { spawn: { x: 9, z: 12.6 }, exit: { x: 9, z: 13.4 }, counter: { x: 9, z: 4.7 }, tables, ...Object.fromEntries(tables.map((t, i) => ['table' + i, { x: t.me.x, z: t.me.z + 0.45 }])) };
 },
 /**
  * The electoral office: voter registration (INEC) and nomination (ANSIEC) desks, a results board, the town-hall end
  * where candidates debate, and on election day the polling unit (ballot box and voting cubicle) in the middle.
  */
 electoral(R, { pollingOpen = false, results = [] } = {}) {
  R.shell({ w: 20, d: 16, h: 4.2, floor: '#d9d6cc', wall: '#f2f1ea', band: '#167b46' }); R.lights(3, 3, '#ffffff'); R.fan(6, 9); R.fan(14, 9);
  R.sign('ELECTORAL OFFICES · ONITSHA NORTH', 10, 3.55, 0.13, 10, 0.5, '#167b46', '#ffffff', 0, 'INEC VOTER REGISTRATION · ANSIEC NOMINATIONS');
  R.counter(4.5, 3.4, 5, { color: '#167b46', top: '#efefe8' }); R.sign('INEC · VOTER REGISTRATION & PVC', 4.5, 2.4, 0.16, 4.6, 0.32, '#167b46', '#fff'); R.person(3.6, 2.6, 0, { outfit: 'shirt_trousers', color: GREEN, gender: 'female' }); R.desk(3.6, 1.8, { face: -1, color: '#d9d9d2' });
  R.counter(15.5, 3.4, 5, { color: '#1d4f7a', top: '#efefe8' }); R.sign('ANSIEC · NOMINATIONS & PARTY FORMS', 15.5, 2.4, 0.16, 4.6, 0.32, '#1d4f7a', '#fff'); R.person(16.4, 2.6, 0, { outfit: 'suit_tie', color: NAVY }); R.desk(16.4, 1.8, { face: -1, color: '#d9d9d2' });
  for (let i = 0; i < 3; i++) R.chairRow(1.5, 6 + i * 1.1, 5, { color: '#167b46' });
  R.mural(19.86, 2.2, 8, 4.4, 2.2, -Math.PI / 2, board('RESULTS', results.length ? results : ['No results declared yet.', 'Results are posted here after each election.'], { bg: '#10331f', accent: '#f2f0df' }));
  // town hall end: a small stage with a lectern for each candidate
  R.box(7, 0.3, 2.4, 10, 0.15, 14.4 - 9, '#7a5a3a', true); for (const x of [8, 10, 12]) { R.box(0.6, 1.1, 0.45, x, 0.85, 5.2, '#5a3a24', true); R.box(0.3, 0.1, 0.1, x, 1.45, 5.0, '#222'); }
  R.sign("CANDIDATES' DEBATE", 10, 2.25, 4.25, 2.6, 0.3, '#167b46', '#fff', 0);
  for (let i = 0; i < 4; i++) R.bench(8.5 + (i % 2) * 3.4, 8.2 + Math.floor(i / 2) * 1.4, 2.8, '#6b4b33');
  // the polling unit (set out on election day)
  if (pollingOpen) {
   R.table(10, 12, { w: 2, d: 0.8, color: '#b0a890' }); R.box(0.6, 0.6, 0.5, 9.6, 1.08, 12, '#f4f4f0'); R.box(0.3, 0.02, 0.05, 9.6, 1.39, 12, '#222'); R.sign('BALLOT BOX', 9.6, 1.1, 12.26, 0.55, 0.16, '#167b46', '#fff');
   R.person(11, 11.3, 0, { outfit: 'shirt_trousers', color: GREEN }); R.box(1.2, 1.6, 0.05, 13.6, 0.8, 11.6, '#cfd5d8'); for (const s of [-1, 1]) R.box(0.05, 1.6, 0.9, 13.6 + s * 0.6, 0.8, 12, '#cfd5d8'); R.sign('VOTING CUBICLE', 13.6, 1.75, 11.57, 1.2, 0.2, '#167b46', '#fff', Math.PI);
   R.sign('POLLING UNIT 004 · OPEN 8:00–17:00', 10, 2.7, 15.84, 4.4, 0.36, '#167b46', '#fff', Math.PI);
  }
  R.flag(1.2, 1.4); R.plant(1, 15.2); R.plant(19, 15.2);
  return { spawn: { x: 10, z: 14.6 }, exit: { x: 10, z: 15.4 }, register: { x: 4.5, z: 4.5 }, nominate: { x: 15.5, z: 4.5 }, results: { x: 18.6, z: 8 }, debate: { x: 10, z: 6.6 }, ...(pollingOpen ? { vote: { x: 10, z: 13 } } : {}) };
 },
});
/** Where a seated figure's origin goes on a chair whose seat surface is at seatY. */
export const seatedY = (seatY = 0.49) => seatY - SEAT_HEIGHT;
