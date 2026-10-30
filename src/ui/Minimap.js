import {MapLabels} from './MapLabels.js';
import { isMajorRoad } from '../world/RoadBuilder.js';
import { COMING_SOON, project } from '../world/PlayArea.js';

/**
 * Minimap (heading-up, vector-drawn live around the player) and a zoomable, pannable full map (north-up).
 * v0.49: the full map is a light street map in the style of a phone maps app: search (places, streets, areas),
 * category chips, a key, every neighbourhood and place labelled, crisp streets and buildings when zoomed in, and
 * the COMING SOON land outside Onitsha shaded and named. Both maps share one coordinate system: world metres.
 */
const C = {
  ground: '#ece6d9', water: '#9fd0e4', waterEdge: '#7fb9d1', residential: '#ddd4c4', commercial: '#efcf9d', stalls: '#eab68a', shed: '#d5ccbd',
  mall: '#eba2a2', church: '#ddd3ea', asphalt: '#ffffff', edge: '#cdbfa8', major: '#ffd98a', majorEdge: '#e2ad4a', dirt: '#dcc19d', bridge: '#d2d6da',
  park: '#c6e3ad', gra: '#dcebd0', market: '#f3dcc0', built: '#e4ddcf', wall: '#b9ad99', soon: 'rgba(92,96,110,0.38)', soonLine: '#c0392b',
};
/** what each kind of place is, for the colour, the chips and the key */
export const MAP_CATS = [
  { id: 'all', label: 'All', color: '#3c4043' },
  { id: 'homes', label: 'Homes', color: '#e8452c', kinds: ['home', 'home-mine', 'friend', 'tolet'] },
  { id: 'food', label: 'Food & markets', color: '#e8710a', kinds: ['eatery', 'market', 'plaza'] },
  { id: 'night', label: 'Bars, clubs & hotels', color: '#9334e6', kinds: ['venue', 'hotel', 'bar', 'club'] },
  { id: 'shop', label: 'Shopping & cars', color: '#1a73e8', kinds: ['mall', 'car', 'dealer', 'business', 'shop', 'store', 'showroom'] },
  { id: 'services', label: 'Services', color: '#188038', kinds: ['hospital', 'bank', 'fuel', 'ict', 'workplace', 'office', 'school', 'church', 'public', 'university'] },
  { id: 'gov', label: 'Police & government', color: '#174ea6', kinds: ['police', 'efcc', 'court', 'checkpoint'] },
  { id: 'transport', label: 'Transport', color: '#f2b400', kinds: ['stop', 'park', 'interchange', 'bridgehead', 'terminal'] },
  { id: 'fun', label: 'Fun & sport', color: '#12a4af', kinds: ['stadium', 'waterfront', 'monument', 'recreation', 'field', 'landmark', 'agbero'] },
  { id: 'jobs', label: 'Jobs', color: '#d93025', kinds: ['job'] },
];
const CAT_OF = new Map(); for (const c of MAP_CATS) for (const k of c.kinds ?? []) CAT_OF.set(k, c);
export const catOf = (kind) => CAT_OF.get(String(kind).replace(/-mine$/, '')) ?? CAT_OF.get(kind) ?? null;
const GLYPH = { monument: 'Z', stadium: 'S', mall: 'S', job: 'J', ict: 'IT', workplace: 'W', hotel: 'H', fuel: 'F', waterfront: '≈', police: 'P', efcc: 'E', court: 'C', checkpoint: '!', dealer: 'D', agbero: 'A',
  bank: '₦', office: '✓', venue: '♪', bar: '♪', club: '♪', market: 'M', plaza: 'M', school: 'Sc', church: '✝', recreation: 'R', field: '⚽', showroom: 'A', terminal: 'B', park: 'B', interchange: 'B', bridgehead: 'B', public: 'i', university: 'U', landmark: '★', soon: '!' };

/** Map icons: a round badge in the place's colour with its letter or shape. */
function placeIcon(g, kind, sx, sy, scale = 1) {
  const mine = String(kind).endsWith('mine'), cat = catOf(kind);
  g.save(); g.translate(sx, sy); g.scale(scale, scale);
  g.fillStyle = mine ? '#188038' : kind === 'soon' ? '#c0392b' : kind === 'friend' ? '#9b5de5' : kind === 'hospital' ? '#d93025' : kind === 'agbero' ? '#a95014' : cat?.color ?? '#5f6368';
  g.strokeStyle = '#fff'; g.lineWidth = 2;
  g.shadowColor = 'rgba(0,0,0,0.28)'; g.shadowBlur = 3; g.shadowOffsetY = 1;
  g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill(); g.shadowColor = 'transparent'; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (kind === 'hospital') { g.fillRect(-1.6, -5, 3.2, 10); g.fillRect(-5, -1.6, 10, 3.2); }
  else if (kind === 'eatery') { g.fillRect(-3.6, -4.5, 1.1, 9); for (const x of [-4.4, -3.1, -1.8]) g.fillRect(x, -4.5, 0.6, 3); g.beginPath(); g.ellipse(2.8, -1.6, 1.7, 2.9, 0, 0, Math.PI * 2); g.fill(); g.fillRect(2.3, 0, 1, 4.5); }
  else if (String(kind).startsWith('home') || kind === 'friend' || kind === 'tolet') { g.beginPath(); g.moveTo(-5.2, -0.5); g.lineTo(0, -5.6); g.lineTo(5.2, -0.5); g.closePath(); g.fill(); g.fillRect(-3.7, -0.6, 7.4, 5.2); }
  else if (GLYPH[kind]) { const t = GLYPH[kind]; g.font = `900 ${t.length > 1 ? 8.5 : 10.5}px system-ui, sans-serif`; g.fillText(t, 0, 0.7); }
  else if (kind === 'car' || kind === 'car-mine') { g.fillRect(-5.5, -1.2, 11, 4); g.fillRect(-3.4, -4, 6.8, 3.2); g.fillStyle = cat?.color ?? '#1a73e8'; g.beginPath(); g.arc(-3, 3.2, 1.4, 0, 7); g.arc(3, 3.2, 1.4, 0, 7); g.fill(); }
  else { g.beginPath(); g.arc(0, 0, 3, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
function routeLine(g, pts, T, width) {
  if (!pts || pts.length < 2) return;
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [w, col] of [[width + 3, '#0b57d0'], [width, '#4f8ff7']]) {
    g.lineWidth = w; g.strokeStyle = col; g.beginPath();
    pts.forEach(([x, z], i) => { const [a, b] = T(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
    g.stroke();
  }
}
/** text with a white halo (labels on a light map) */
function halo(g, text, x, y, fill = '#2b2622', width = 3.5, stroke = 'rgba(255,255,255,0.92)') { g.lineJoin = 'round'; g.lineWidth = width; g.strokeStyle = stroke; g.strokeText(text, x, y); g.fillStyle = fill; g.fillText(text, x, y); }
function centroid(pts) { let a = 0, cx = 0, cz = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; a += f; cx += (pts[j][0] + pts[i][0]) * f; cz += (pts[j][1] + pts[i][1]) * f; } return a ? [cx / (3 * a), cz / (3 * a)] : pts[0]; }
function inPoly(x, z, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; }

export class Minimap {
  constructor(map, landmarks, miniCanvas, bigCanvas) {
    this.map = map; this.landmarks = landmarks;
    this.mini = miniCanvas; this.big = bigCanvas;
    const b = map.fullBounds ?? map.bounds;
    this.ox = b.minX; this.oz = b.minZ;
    this.scale = 0.36; // px per metre in the pre-rendered base; closer in, streets and buildings are drawn live
    this.base = document.createElement('canvas');
    this.base.width = Math.ceil((b.maxX - b.minX) * this.scale);
    this.base.height = Math.ceil((b.maxZ - b.minZ) * this.scale);
    // spatial index of buildings and road segments for the live drawing
    this.cell = 60; this.bGrid = new Map(); this.rGrid = new Map(); this.aGrid = new Map();
    for (const bld of map.buildings) this.indexFootprint(bld);
    for (const r of map.roads) for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, az] = r.points[i], [bx, bz] = r.points[i + 1];
      for (let gx = Math.floor(Math.min(ax, bx) / this.cell); gx <= Math.floor(Math.max(ax, bx) / this.cell); gx++)
        for (let gz = Math.floor(Math.min(az, bz) / this.cell); gz <= Math.floor(Math.max(az, bz) / this.cell); gz++) {
          const k = gx + ',' + gz; if (!this.rGrid.has(k)) this.rGrid.set(k, []); this.rGrid.get(k).push([r, i]);
        }
    }
    this.areas = this.buildAreas();
    this.streets = this.buildStreets();
    this.renderBase();
    this.ground = document.createElement('canvas'); this.gScale = 0.1; this.ground.width = Math.ceil((b.maxX - b.minX) * this.gScale); this.ground.height = Math.ceil((b.maxZ - b.minZ) * this.gScale); this.renderGround();
    this.view = null; // big map view {cx, cz, ppm}
    this.network = null; // public transport (lines + stops), set once the network is built
    this.markers = [];   // extra markers: [{x, z, color}] (other job targets, trip destination)
    this.route = null;   // [[x, z], …] the way to the current destination, along the streets
    this.places = [];    // [{x, z, kind, label}] every place on the map
    this.filter = 'all';
    this.bindBigMapControls();
    this.bindPanel();
  }
  indexFootprint(f) {
    const [x, z] = f.pts[0], k = Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell);
    if (!this.bGrid.has(k)) this.bGrid.set(k, []); this.bGrid.get(k).push(f);
  }
  /** Buildings and compound walls that the game adds after the map (houses on empty land): drawn on both maps. */
  addFootprints(list) {
    const g = this.base.getContext('2d'), s = this.scale, T = (x, z) => [(x - this.ox) * s, (z - this.oz) * s];
    for (const f of list) {
      this.indexFootprint(f);
      if (f.wall) { g.strokeStyle = C.wall; g.lineWidth = 0.6; outline(g, f.wall, T); }
      g.fillStyle = C[f.kind] ?? C.residential; poly(g, f.pts, T);
    }
  }
  /** Shade the COMING SOON land and draw the Onitsha boundary (once the play area is known). */
  setPlayArea(pa) {
    this.playArea = pa; if (!pa) return;
    const s = this.scale, T = (x, z) => [(x - this.ox) * s, (z - this.oz) * s], W = this.base.width, H = this.base.height;
    const shade = document.createElement('canvas'); shade.width = W; shade.height = H; const g = shade.getContext('2d');
    g.fillStyle = C.soon; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    const polys = pa.polygons ?? []; for (const p of polys) poly(g, p, T);
    const o = pa.outside ?? (polys.length ? null : this.map.bounds);
    if (o) { const [x0, y0] = T(o.minX, o.minZ), [x1, y1] = T(o.maxX, o.maxZ); g.fillRect(x0, y0, x1 - x0, y1 - y0); }
    // west of the middle of the Niger is Delta State (Asaba)
    g.globalCompositeOperation = 'source-over'; g.fillStyle = C.soon;
    if (pa.zs?.length) { g.beginPath(); const [ax] = T(this.ox, 0), z0 = pa.zs[0], z1 = pa.zs[pa.zs.length - 1]; g.moveTo(ax, 0); g.lineTo(T(pa.rows.get(z0), 0)[0], 0); for (const z of pa.zs) { const [px, py] = T(pa.rows.get(z), z); g.lineTo(px, py); } g.lineTo(T(pa.rows.get(z1), 0)[0], H); g.lineTo(ax, H); g.closePath();
      g.save(); g.globalCompositeOperation = 'destination-out'; g.fill(); g.restore(); g.fill(); }
    const bg = this.base.getContext('2d'); bg.drawImage(shade, 0, 0); this.ground.getContext('2d').drawImage(shade, 0, 0, this.ground.width, this.ground.height);
    // the LGA lines, dashed
    bg.save(); bg.setLineDash([6, 5]); bg.strokeStyle = 'rgba(120,96,150,0.75)'; bg.lineWidth = 1.4; for (const p of polys) outline(bg, p, T); bg.restore();
    this.soonLabels = COMING_SOON.filter((p) => !p.onitsha).map((p) => { const q = project(this.map.meta, p.lat, p.lon), B = this.map.fullBounds ?? this.map.bounds; // a town beyond the map's edge is named just inside it
      return { x: Math.max(B.minX + 350, Math.min(B.maxX - 350, q.x)), z: Math.max(B.minZ + 250, Math.min(B.maxZ - 250, q.z)), name: p.name, state: p.state }; }).filter((p) => pa.locked(p.x, p.z));
  }
  /** Neighbourhood and area names: OSM places, GRA, the LGAs, districts. */
  buildAreas() {
    const out = [], seen = new Set(), add = (a) => { const k = a.name.toLowerCase(); if (seen.has(k) || !Number.isFinite(a.x)) return; seen.add(k); out.push(a); };
    for (const p of this.map.meta?.playPolygons ?? []) { const [x, z] = centroid(p.pts); add({ name: p.name, x, z, tier: 0, pts: p.pts }); }
    for (const p of this.map.pois ?? []) if (['suburb', 'neighbourhood', 'quarter', 'place', 'village', 'hamlet'].includes(p.kind) && p.name) add({ name: p.name, x: p.x, z: p.z, tier: p.kind === 'suburb' ? 1 : 2, r: /GRA/i.test(p.name) ? 700 : 600 });
    for (const l of this.landmarks.list) if (l.kind === 'district' && !/COMING SOON/i.test(l.name)) add({ name: l.name, x: l.x, z: l.z, tier: 1, r: l.radius ?? 600 });
    for (const a of this.map.areas ?? []) if (a.name && a.pts?.length > 2 && ['residential', 'commercial', 'retail', 'industrial'].includes(a.kind)) { const [x, z] = centroid(a.pts); add({ name: a.name, x, z, tier: 2 }); }
    return out;
  }
  buildStreets() {
    const by = new Map();
    for (const r of this.map.roads) { if (!r.displayName || r.elevated && !/bridge/i.test(r.displayName)) continue; const m = r.points[Math.floor(r.points.length / 2)]; const e = by.get(r.displayName); if (!e || r.length > e.len) by.set(r.displayName, { name: r.displayName, x: m[0], z: m[1], len: r.length ?? 0 }); }
    return [...by.values()];
  }
  /** The area at (x, z), for the chip at the bottom of the map. */
  areaAt(x, z) {
    const soon = this.playArea?.lockedAt(x, z); if (soon) return `${soon.name} · COMING SOON`;
    let best = null, bd = Infinity; for (const a of this.areas) { if (a.tier === 0) continue; const d = Math.hypot(a.x - x, a.z - z); if (d < (a.r ?? 600) && d < bd) { bd = d; best = a; } }
    const lga = this.areas.find((a) => a.tier === 0 && inPoly(x, z, a.pts));
    const near = best ? (bd < (best.r ?? 600) * 0.6 ? best.name : `Near ${best.name}`) : null;
    return [near, lga?.name ?? 'Onitsha'].filter(Boolean).join(' · ');
  }

  // ---------------------------------------------------------------- base image
  renderBase() {
    const g = this.base.getContext('2d'), s = this.scale;
    const T = (x, z) => [(x - this.ox) * s, (z - this.oz) * s];
    g.fillStyle = C.ground; g.fillRect(0, 0, this.base.width, this.base.height);
    // GRA and the markets get a tint, parks and pitches are green
    for (const a of this.map.areas ?? []) if (a.pts?.length > 2) { const col = ['park', 'pitch', 'wood', 'garden', 'meadow'].includes(a.kind) ? C.park : null; if (col) { g.fillStyle = col; poly(g, a.pts, T); } }
    for (const a of this.areas) if (/GRA/i.test(a.name) && a.r) { const [x, y] = T(a.x, a.z); const gr = g.createRadialGradient(x, y, 0, x, y, a.r * s); gr.addColorStop(0, C.gra); gr.addColorStop(0.85, C.gra); gr.addColorStop(1, 'rgba(220,235,208,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, a.r * s, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = C.water;
    for (const w of this.map.water) poly(g, w.outer, T);
    for (const l of this.map.land) for (const h of l.holes ?? []) { g.fillStyle = C.water; poly(g, h, T); }
    for (const l of this.map.land) if (l.outer.length < 400 && l.outer.length > 4) { g.fillStyle = C.ground; poly(g, l.outer, T); }
    drawRoads(g, this.map.roads, T, s, 1);
    for (const b of this.map.buildings) { g.fillStyle = C[b.renderKind ?? b.kind] ?? C.residential; poly(g, b.pts, T); }
  }

  /** the land, water, parks and GRA without streets and buildings: under the live drawing when zoomed in */
  renderGround() {
    const g = this.ground.getContext('2d'), s = this.gScale, T = (x, z) => [(x - this.ox) * s, (z - this.oz) * s];
    g.fillStyle = C.ground; g.fillRect(0, 0, this.ground.width, this.ground.height);
    for (const a of this.map.areas ?? []) if (a.pts?.length > 2 && ['park', 'pitch', 'wood', 'garden', 'meadow'].includes(a.kind)) { g.fillStyle = C.park; poly(g, a.pts, T); }
    for (const a of this.areas) if (/GRA/i.test(a.name) && a.r) { const [x, y] = T(a.x, a.z); g.fillStyle = C.gra; g.beginPath(); g.arc(x, y, a.r * s, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = C.water; for (const w of this.map.water) poly(g, w.outer, T);
    for (const l of this.map.land) for (const h of l.holes ?? []) poly(g, h, T);
    g.fillStyle = C.ground; for (const l of this.map.land) if (l.outer.length < 400 && l.outer.length > 4) poly(g, l.outer, T);
  }

  // ---------------------------------------------------------------- minimap
  drawMini(px, pz, camYaw, playerHeading) {
    const c = this.mini, g = c.getContext('2d');
    const W = c.width, H = c.height, ppm = 1.7;
    const R = Math.hypot(W, H) / 2 / ppm + 10;
    g.save();
    g.fillStyle = C.ground; g.fillRect(0, 0, W, H);
    g.translate(W / 2, H / 2); g.rotate(camYaw); g.scale(ppm, ppm); g.translate(-px, -pz);
    const T = (x, z) => [x, z];
    g.fillStyle = C.water;
    for (const w of this.map.water) poly(g, w.outer, T);
    const segs = new Set(), blds = new Set();
    const g0x = Math.floor((px - R) / this.cell), g1x = Math.floor((px + R) / this.cell);
    const g0z = Math.floor((pz - R) / this.cell), g1z = Math.floor((pz + R) / this.cell);
    for (let gx = g0x; gx <= g1x; gx++) for (let gz = g0z; gz <= g1z; gz++) {
      const k = gx + ',' + gz;
      for (const s of this.rGrid.get(k) ?? []) segs.add(s);
      for (const b of this.bGrid.get(k) ?? []) blds.add(b);
    }
    drawSegs(g, segs, 1);
    for (const b of blds) { g.fillStyle = C[b.renderKind ?? b.kind] ?? C.residential; poly(g, b.pts, T); }
    if (this.playArea) { g.fillStyle = C.soon; for (let gx = g0x; gx <= g1x; gx++) for (let gz = g0z; gz <= g1z; gz++) { const cx = (gx + 0.5) * this.cell, cz = (gz + 0.5) * this.cell; if (this.playArea.lockedFast(cx, cz)) g.fillRect(gx * this.cell, gz * this.cell, this.cell, this.cell); } }
    if (this.network) for (const st of this.network.stops) {
      if (Math.abs(st.x - px) > R || Math.abs(st.z - pz) > R) continue;
      for (const p of st.platforms) { g.fillStyle = '#f2b400'; g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.fillRect(p.poleX - 2.6, p.poleZ - 2.6, 5.2, 5.2); g.strokeRect(p.poleX - 2.6, p.poleZ - 2.6, 5.2, 5.2); }
    }
    routeLine(g, this.route, T, 3.2);
    g.restore();
    // landmark markers (kept upright)
    g.save(); g.translate(W / 2, H / 2);
    const cs = Math.cos(camYaw), sn = Math.sin(camYaw);
    for (const l of this.landmarks.list) {
      if (l.kind === 'district' || ['ict', 'workplace', 'hotel'].includes(l.kind)) continue;
      let dx = (l.x - px) * ppm, dz = (l.z - pz) * ppm;
      let sx = dx * cs - dz * sn, sy = dx * sn + dz * cs;
      const d = Math.hypot(sx, sy), lim = W / 2 - 10;
      const off = d > lim; if (off) { sx *= lim / d; sy *= lim / d; continue; }
      placeIcon(g, l.kind, sx, sy, 0.85);
      if (Math.abs(sx) < 52 && Math.abs(sy) < 57) { const text = l.name.length > 24 ? l.name.slice(0, 22) + '…' : l.name; g.font = '700 10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; halo(g, text, sx, sy + 15, '#2b2622', 3); }
    }
    for (const pl of this.places) {
      const dx = (pl.x - px) * ppm, dz = (pl.z - pz) * ppm;
      const sx = dx * cs - dz * sn, sy = dx * sn + dz * cs;
      if (Math.hypot(sx, sy) < W / 2 - 8) placeIcon(g, pl.kind, sx, sy, 0.75);
    }
    for (const m of this.markers) {
      let dx = (m.x - px) * ppm, dz = (m.z - pz) * ppm;
      let sx = dx * cs - dz * sn, sy = dx * sn + dz * cs; const d = Math.hypot(sx, sy), lim = W / 2 - 10;
      if (d > lim) { sx *= lim / d; sy *= lim / d; }
      g.fillStyle = m.color ?? '#9ad1ff'; g.strokeStyle = '#14110f'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(sx, sy - 6); g.lineTo(sx + 5, sy); g.lineTo(sx, sy + 6); g.lineTo(sx - 5, sy); g.closePath(); g.fill(); g.stroke();
    }
    if (this.waypoint) {
      let dx = (this.waypoint.x - px) * ppm, dz = (this.waypoint.z - pz) * ppm;
      let sx = dx * cs - dz * sn, sy = dx * sn + dz * cs; const d = Math.hypot(sx, sy), lim = W / 2 - 12;
      if (d > lim) { sx *= lim / d; sy *= lim / d; }
      drawPin(g, sx, sy, '#ea4335', 0.8);
    }
    g.rotate(-(playerHeading - camYaw) + Math.PI);
    g.fillStyle = '#1a73e8'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  // ---------------------------------------------------------------- big map
  openBig(px, pz, heading, focus = null) {
    const W = this.big.clientWidth, H = this.big.clientHeight;
    if (!this.view) this.view = { cx: px, cz: pz, ppm: Math.min(W, H) / 1400 };
    else { this.view.cx = px; this.view.cz = pz; }
    if (focus) {
      this.view.cx = (px + focus.x) / 2; this.view.cz = (pz + focus.z) / 2;
      const span = Math.max(Math.abs(focus.x - px) / Math.max(1, W - 120), Math.abs(focus.z - pz) / Math.max(1, H - 160));
      this.view.ppm = Math.max(0.04, Math.min(2.5, 1 / Math.max(span, 1e-3)));
      if (['waterfront', 'monument', 'stadium'].includes(focus.kind)) { this.view.cx = focus.x; this.view.cz = focus.z; this.view.ppm = Math.min(W, H) / 700; }
    }
    this.player = { px, pz, heading };
    this.renderChips();
    this.drawBig();
  }

  bindBigMapControls() {
    const c = this.big;
    const pointers = new Map();
    let lastDist = 0;
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });
    let down = null;
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); down = pointers.size === 1 ? { x: e.clientX, y: e.clientY, ox: e.offsetX, oy: e.offsetY, t: performance.now() } : null; this.hideResults(); });
    c.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId) || !this.view) return;
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        this.view.cx -= (e.clientX - prev.x) / this.view.ppm; this.view.cz -= (e.clientY - prev.y) / this.view.ppm; this.requestDraw();
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastDist) this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / lastDist);
        lastDist = d;
      }
    });
    const up = (e) => {
      if (e.type === 'pointerup' && down && pointers.size === 1 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 500 && this.view && this.onPick) {
        const v = this.view, W = c.clientWidth, H = c.clientHeight;
        let x = v.cx + (down.ox - W / 2) / v.ppm, z = v.cz + (down.oy - H / 2) / v.ppm;
        const hit = this.visiblePlaces().map((pl) => ({ pl, d: Math.hypot(pl.x - x, pl.z - z) * v.ppm })).filter((h) => h.d < 16).sort((a, b) => a.d - b.d)[0];
        if (hit) { x = hit.pl.x; z = hit.pl.z; }
        this.onPick(x, z, hit?.pl ?? null); this.waypoint = { x, z }; this.drawBig();
      }
      down = null;
      pointers.delete(e.pointerId); if (pointers.size < 2) lastDist = 0;
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }
  requestDraw() { if (this._raf) return; this._raf = requestAnimationFrame(() => { this._raf = 0; this.drawBig(); }); }

  // ---------------------------------------------------------------- search, chips, key
  bindPanel() {
    const root = this.big.parentElement; if (!root) return; this.root = root;
    const input = root.querySelector('[data-slot=map-search]'), clear = root.querySelector('[data-action=map-clear]');
    this.results = root.querySelector('[data-slot=map-results]');
    if (input) {
      input.addEventListener('input', () => { clear.hidden = !input.value; this.search(input.value); });
      input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { const f = this.results?.querySelector('li[data-i]'); f?.click(); } if (e.key === 'Escape') { input.value = ''; clear.hidden = true; this.hideResults(); input.blur(); } });
      input.addEventListener('focus', () => { if (input.value) this.search(input.value); });
      clear?.addEventListener('click', () => { input.value = ''; clear.hidden = true; this.hideResults(); input.focus(); });
    }
    root.querySelector('[data-action=map-legend]')?.addEventListener('click', () => { const l = root.querySelector('[data-slot=map-legend]'); if (!l) return; l.hidden = !l.hidden; if (!l.hidden) this.renderLegend(l); });
  }
  renderChips() {
    const el = this.root?.querySelector('[data-slot=map-chips]'); if (!el) return;
    if (!el.childElementCount) for (const c of MAP_CATS) {
      const b = document.createElement('button'); b.className = 'map-chip'; b.dataset.cat = c.id; b.type = 'button';
      b.innerHTML = c.id === 'all' ? '<span>All places</span>' : `<i style="--c:${c.color}"></i><span>${c.label}</span>`;
      b.addEventListener('click', () => { this.filter = this.filter === c.id ? 'all' : c.id; this.renderChips(); this.drawBig(); });
      el.append(b);
    }
    for (const b of el.children) b.classList.toggle('on', b.dataset.cat === this.filter);
  }
  renderLegend(el) {
    const counts = new Map(); for (const p of this.places) { const c = catOf(p.kind)?.id ?? 'other'; counts.set(c, (counts.get(c) ?? 0) + 1); }
    const rows = MAP_CATS.filter((c) => c.kinds).map((c) => `<div class="row"><span class="sw" style="background:${c.color}"></span><span>${c.label}${counts.get(c.id) ? ` · ${counts.get(c.id)}` : ''}</span></div>`).join('');
    const sq = (col, label, cls = 'sq') => `<div class="row"><span class="sw ${cls}" style="background:${col}"></span><span>${label}</span></div>`;
    el.innerHTML = `<h3>Map key</h3><h4>Places</h4>${rows}<h4>The city</h4>${sq(C.major, 'Main road', 'line')}${sq('#fff;box-shadow:inset 0 0 0 1px #cdbfa8', 'Street', 'line')}${sq('#4f8ff7', 'Your route', 'line')}${sq('#f2b400', 'Bus stop')}${sq(C.residential, 'Houses')}${sq(C.commercial, 'Shops and offices')}${sq(C.stalls, 'Market stalls')}${sq(C.gra, 'GRA')}${sq(C.park, 'Parks and pitches')}${sq(C.water, 'River Niger')}${sq('rgba(92,96,110,.55)', 'COMING SOON: not open yet')}${sq('#c0392b', 'Onitsha boundary (LGA line)', 'line')}`;
  }
  hideResults() { if (this.results) this.results.hidden = true; }
  search(q) {
    const el = this.results; if (!el) return; q = q.trim().toLowerCase();
    if (!q) { el.hidden = true; return; }
    const hits = [], seen = new Set();
    const add = (name, sub, x, z, kind, place) => { const n = String(name), k = n + '|' + Math.round(x / 50) + ',' + Math.round(z / 50); if (seen.has(k)) return; const i = n.toLowerCase().indexOf(q); if (i < 0 && !String(sub).toLowerCase().includes(q)) return; seen.add(k); hits.push({ name: n, sub, x, z, kind, place, rank: i === 0 ? 0 : i > 0 ? 1 : 2 }); };
    for (const a of this.areas) add(a.name, a.tier === 0 ? 'Local government area' : 'Area', a.x, a.z, 'area');
    for (const l of this.landmarks.list) add(l.name, catOf(l.kind)?.label ?? 'Landmark', l.x, l.z, l.kind, { x: l.x, z: l.z, kind: l.kind, label: l.name });
    for (const p of this.places) add(p.label, catOf(p.kind)?.label ?? 'Place', p.x, p.z, p.kind, p);
    for (const st of this.network?.stops ?? []) add(st.name, 'Bus stop', st.x, st.z, 'stop', { x: st.x, z: st.z, kind: 'stop', label: `${st.name} bus stop` });
    for (const s of this.streets) add(s.name, 'Street', s.x, s.z, 'street');
    for (const s of this.soonLabels ?? []) add(s.name, 'COMING SOON', s.x, s.z, 'soon');
    hits.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length);
    el.replaceChildren();
    if (!hits.length) { const li = document.createElement('li'); li.className = 'res-empty'; li.textContent = 'Nothing by that name in Onitsha yet'; el.append(li); }
    hits.slice(0, 12).forEach((h, i) => {
      const li = document.createElement('li'); li.dataset.i = i; const cat = catOf(h.kind);
      const col = h.kind === 'area' ? '#7b6d5f' : h.kind === 'street' ? '#9aa0a6' : h.kind === 'soon' ? '#5c606e' : cat?.color ?? '#5f6368';
      const glyph = h.kind === 'area' ? '◎' : h.kind === 'street' ? '⟂' : h.kind === 'soon' ? '!' : GLYPH[h.kind] ?? (String(h.kind).startsWith('home') ? '⌂' : '•');
      li.innerHTML = `<span class="res-icon" style="background:${col}">${glyph}</span><span class="res-text"><div class="res-name"></div><div class="res-sub"></div></span>`;
      li.querySelector('.res-name').textContent = h.name; li.querySelector('.res-sub').textContent = h.sub;
      li.addEventListener('click', () => this.goTo(h));
      el.append(li);
    });
    el.hidden = false;
  }
  goTo(h) {
    this.hideResults(); const v = this.view; if (!v) return;
    v.cx = h.x; v.cz = h.z; v.ppm = h.kind === 'area' ? Math.max(v.ppm, 0.5) : Math.max(v.ppm, 1.6);
    if (h.kind !== 'soon' && h.kind !== 'area' && this.onPick) { this.onPick(h.x, h.z, h.place ?? { x: h.x, z: h.z, kind: h.kind, label: h.name }); this.waypoint = { x: h.x, z: h.z }; }
    this.drawBig();
  }
  visiblePlaces() { return this.filter === 'all' ? this.places : this.places.filter((p) => catOf(p.kind)?.id === this.filter || String(p.kind).endsWith('mine')); }

  zoomAt(sx, sy, k) {
    if (!this.view) return;
    const v = this.view, W = this.big.clientWidth, H = this.big.clientHeight;
    const wx = v.cx + (sx - W / 2) / v.ppm, wz = v.cz + (sy - H / 2) / v.ppm;
    v.ppm = Math.min(8, Math.max(0.1, v.ppm * k));
    v.cx = wx - (sx - W / 2) / v.ppm; v.cz = wz - (sy - H / 2) / v.ppm;
    this.requestDraw();
  }
  zoomCenter(k) { this.zoomAt(this.big.clientWidth / 2, this.big.clientHeight / 2, k); }
  recenter() { if (this.view && this.player) { this.view.cx = this.player.px; this.view.cz = this.player.pz; this.view.ppm = Math.max(this.view.ppm, 1); this.drawBig(); } }

  drawBig() {
    const c = this.big, g = c.getContext('2d'), v = this.view; if (!v) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth, H = c.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#d9d2c4'; g.fillRect(0, 0, W, H);
    const T = (x, z) => [W / 2 + (x - v.cx) * v.ppm, H / 2 + (z - v.cz) * v.ppm];
    const [x0, y0] = T(this.ox, this.oz);
    g.imageSmoothingEnabled = true;
    if (v.ppm >= 1.1) g.drawImage(this.ground, x0, y0, this.ground.width / this.gScale * v.ppm, this.ground.height / this.gScale * v.ppm);
    else g.drawImage(this.base, x0, y0, this.base.width / this.scale * v.ppm, this.base.height / this.scale * v.ppm);
    const wx0 = v.cx - W / 2 / v.ppm, wx1 = v.cx + W / 2 / v.ppm, wz0 = v.cz - H / 2 / v.ppm, wz1 = v.cz + H / 2 / v.ppm;
    // close in: crisp streets, buildings and compound walls drawn live
    if (v.ppm >= 0.7) {
      const segs = new Set(), blds = new Set();
      for (let gx = Math.floor(wx0 / this.cell); gx <= Math.floor(wx1 / this.cell); gx++) for (let gz = Math.floor(wz0 / this.cell); gz <= Math.floor(wz1 / this.cell); gz++) {
        const k = gx + ',' + gz; for (const s of this.rGrid.get(k) ?? []) segs.add(s); if (v.ppm >= 1.1) for (const b of this.bGrid.get(k) ?? []) blds.add(b);
      }
      g.save(); g.translate(W / 2, H / 2); g.scale(v.ppm, v.ppm); g.translate(-v.cx, -v.cz);
      const I = (x, z) => [x, z];
      drawSegs(g, segs, 2 / v.ppm);
      for (const b of blds) { if (b.wall && v.ppm >= 1.8) { g.strokeStyle = C.wall; g.lineWidth = 1.2 / v.ppm; outline(g, b.wall, I); } g.fillStyle = C[b.renderKind ?? b.kind] ?? C.residential; poly(g, b.pts, I); if (v.ppm >= 2.5) { g.strokeStyle = 'rgba(120,105,85,0.45)'; g.lineWidth = 1 / v.ppm; outline(g, b.pts, I); } }
      if (this.playArea && v.ppm >= 1.1) { g.fillStyle = C.soon; for (let gx = Math.floor(wx0 / this.cell); gx <= Math.floor(wx1 / this.cell); gx++) for (let gz = Math.floor(wz0 / this.cell); gz <= Math.floor(wz1 / this.cell); gz++) { const lx = (gx + 0.5) * this.cell, lz = (gz + 0.5) * this.cell; if (this.playArea.lockedFast(lx, lz)) g.fillRect(gx * this.cell, gz * this.cell, this.cell, this.cell); } }
      g.restore();
    }

    const labels = new MapLabels(W, H);
    for (const el of [this.root?.querySelector('.bigmap-head'), this.root?.querySelector('.map-side'), this.root?.querySelector('.map-close'), this.root?.querySelector('.map-area'), this.root?.querySelector('.map-legend:not([hidden])')]) {
      if (!el || el.hidden) continue; const a = el.getBoundingClientRect(), b = c.getBoundingClientRect(); if (a.height) labels.block(a.left - b.left - 4, a.top - b.top - 4, a.width + 8, a.height + 8);
    }
    const places = this.visiblePlaces();
    for (const pl of places) { if (this.filter === 'all' && (pl.kind === 'agbero' && v.ppm < 0.8 || ['home', 'tolet'].includes(pl.kind) && v.ppm < 0.4)) continue; const [sx, sy] = T(pl.x, pl.z); labels.block(sx - 10, sy - 10, 20, 20); }
    if (this.player) { const [px, py] = T(this.player.px, this.player.pz); labels.block(px - 12, py - 12, 24, 24); }
    if (this.waypoint) { const [wx, wy] = T(this.waypoint.x, this.waypoint.z); labels.block(wx - 12, wy - 30, 24, 32); }
    g.textBaseline = 'middle';
    // COMING SOON places, big and red
    for (const s of this.soonLabels ?? []) {
      const [sx, sy] = T(s.x, s.z); if (sx < -200 || sy < -60 || sx > W + 200 || sy > H + 60) continue;
      g.textAlign = 'center'; g.font = `800 ${v.ppm < 0.3 ? 13 : 16}px "DM Sans", system-ui, sans-serif`; try { g.letterSpacing = '1.5px'; } catch { /* */ }
      if (!labels.reserve(sx - 80, sy - 20, 160, 40)) continue;
      halo(g, s.name.toUpperCase(), sx, sy - 8, '#4a4d57', 4); g.font = '800 11px "DM Sans", system-ui, sans-serif'; halo(g, 'COMING SOON', sx, sy + 9, '#c0392b', 3.5);
      try { g.letterSpacing = '0px'; } catch { /* */ }
    }
    // neighbourhoods and LGAs: big spaced capitals, the LGAs only when zoomed out
    for (const a of this.areas) {
      if (a.tier === 0 ? v.ppm > 0.45 : a.tier === 1 ? v.ppm > 3.5 : v.ppm < 0.25 || v.ppm > 4) continue;
      const [sx, sy] = T(a.x, a.z); if (sx < -100 || sy < -40 || sx > W + 100 || sy > H + 40) continue;
      const size = a.tier === 0 ? 17 : a.tier === 1 ? 15 : 12; g.font = `800 ${size}px "DM Sans", system-ui, sans-serif`; g.textAlign = 'center';
      try { g.letterSpacing = a.tier === 0 ? '4px' : '2px'; } catch { /* */ }
      const text = a.name.toUpperCase(), tw = g.measureText(text).width;
      if (labels.reserve(sx - tw / 2 - 4, sy - size / 2 - 3, tw + 8, size + 6)) halo(g, text, sx, sy, a.tier === 0 ? '#8a7a68' : /GRA/i.test(a.name) ? '#3f6b2f' : '#6b5a48', 4);
      try { g.letterSpacing = '0px'; } catch { /* */ }
    }
    // the river
    if (v.ppm < 2) { const w = this.map.water.find((x) => /niger/i.test(x.name ?? '')) ?? this.map.water[0]; if (w) { const vis = w.outer.filter(([x, z]) => x > wx0 && x < wx1 && z > wz0 && z < wz1); if (vis.length) { let sx = 0, sz = 0; for (const [x, z] of vis) { sx += x; sz += z; } const pz = this.playArea?.lineX ? sz / vis.length : sz / vis.length, px = this.playArea?.lineX?.(pz) ?? sx / vis.length; const [tx, ty] = T(px, pz); g.font = 'italic 700 15px Georgia, serif'; g.textAlign = 'center'; try { g.letterSpacing = '3px'; } catch { /* */ } if (labels.reserve(tx - 70, ty - 10, 140, 20)) halo(g, 'River Niger', tx, ty, '#3d7ea6', 3.5); try { g.letterSpacing = '0px'; } catch { /* */ } } } }
    // street names (more of them as you zoom in)
    const done = new Set();
    const named = this.map.roads.filter((r) => r.name && !r.elevated).sort((a, b) => (isMajorRoad(b) - isMajorRoad(a)) || b.length - a.length);
    g.textAlign = 'center';
    for (const r of named) {
      if (done.has(r.displayName)) continue;
      if (!isMajorRoad(r) && v.ppm < 0.6) continue;
      let best = null, run = null;
      for (let i = 0; i < r.points.length - 1; i++) {
        const [ax, az] = r.points[i], [bx, bz] = r.points[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
        const dir = Math.atan2(bz - az, bx - ax);
        if (run && Math.abs(Math.atan2(Math.sin(dir - run.dir), Math.cos(dir - run.dir))) < 0.3) { run.L += L; run.bx = bx; run.bz = bz; }
        else run = { L, ax, az, bx, bz, dir };
        if (!best || run.L > best.L) best = { ...run };
      }
      if (!best || best.L * v.ppm < 60) continue;
      const [sx, sy] = T(best.ax, best.az), [ex, ey] = T(best.bx, best.bz);
      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      if (mx < -50 || my < 0 || mx > W + 50 || my > H + 50) continue;
      done.add(r.displayName);
      let ang = Math.atan2(ey - sy, ex - sx); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      const major = isMajorRoad(r);
      g.font = `${major ? 700 : 600} ${major ? 12.5 : 11}px "DM Sans", system-ui, sans-serif`;
      const tw = g.measureText(r.displayName).width + 6, th = major ? 16 : 14, bw = Math.abs(Math.cos(ang)) * tw + Math.abs(Math.sin(ang)) * th, bh = Math.abs(Math.sin(ang)) * tw + Math.abs(Math.cos(ang)) * th;
      if (best.L * v.ppm < tw * 0.8) { done.delete(r.displayName); continue; }
      if (!labels.reserve(mx - bw / 2, my - bh / 2, bw, bh)) { done.delete(r.displayName); continue; }
      labels.note(r.displayName, mx, my);
      g.save(); g.translate(mx, my); g.rotate(ang); halo(g, r.displayName, 0, 0, major ? '#5a4a36' : '#6f655b', 3.5); g.restore();
    }
    // public transport lines and stops
    if (this.network && (this.filter === 'all' || this.filter === 'transport')) {
      g.save(); g.globalAlpha = this.filter === 'transport' ? 0.9 : 0.55; g.lineCap = 'round'; g.lineJoin = 'round';
      const MODE_W = { keke: 2, minibus: 3, cbus: 3, coaster: 3.5 };
      for (const line of this.network.lines) {
        g.strokeStyle = line.color; g.lineWidth = MODE_W[line.mode] ?? 2.5; g.setLineDash(line.mode === 'keke' ? [6, 4] : []);
        g.beginPath();
        line.path.forEach(({ edge, fwd }, i) => { const [ax, az] = this.map.nodes[fwd ? edge.a : edge.b], [bx, bz] = this.map.nodes[fwd ? edge.b : edge.a]; const [p0, q0] = T(ax, az), [p1, q1] = T(bx, bz); if (i === 0) g.moveTo(p0, q0); g.lineTo(p1, q1); });
        g.stroke();
      }
      g.setLineDash([]); g.globalAlpha = 1;
      for (const st of this.network.stops) {
        const [sx, sy] = T(st.x, st.z);
        if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
        const r = st.named ? 5 : 3.5; g.fillStyle = '#f2b400'; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.roundRect?.(sx - r, sy - r, r * 2, r * 2, 2) ?? g.rect(sx - r, sy - r, r * 2, r * 2); g.fill(); g.stroke();
        if (v.ppm > 1.1 || (st.named && v.ppm > 0.45) || this.filter === 'transport' && v.ppm > 0.6) {
          g.font = '600 11px "DM Sans", system-ui, sans-serif'; g.textAlign = 'left';
          const pos = labels.place(sx + 8, sy - 7, g.measureText(st.name).width, 15, st.name);
          if (pos) halo(g, st.name, pos.x, pos.y + 8, '#8a6a00', 3);
        }
      }
      g.restore();
    }
    for (const m of this.markers) {
      const [sx, sy] = T(m.x, m.z);
      g.fillStyle = m.color ?? '#9ad1ff'; g.strokeStyle = '#14110f'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(sx, sy - 9); g.lineTo(sx + 8, sy); g.lineTo(sx, sy + 9); g.lineTo(sx - 8, sy); g.closePath(); g.fill(); g.stroke();
    }
    routeLine(g, this.route, T, 4);
    // landmark pins (always named)
    const showLm = (l) => this.filter === 'all' || catOf(l.kind)?.id === this.filter;
    for (const l of this.landmarks.list) {
      if (['ict', 'workplace', 'hotel', 'district'].includes(l.kind) || !showLm(l) || (l.kind === 'monument' && this.waypointLabel === l.name)) continue;
      const [sx, sy] = T(l.x, l.z); if (sx < -30 || sy < -40 || sx > W + 30 || sy > H + 30) continue;
      drawPin(g, sx, sy, catOf(l.kind)?.color ?? '#5f6368', 1, GLYPH[l.kind]);
      g.font = '800 13px "DM Sans", system-ui, sans-serif'; g.textAlign = 'left';
      const pos = labels.place(sx + 12, sy - 30, g.measureText(l.name).width, 18, l.name); if (pos) halo(g, l.name, pos.x, pos.y + 9, '#202124', 4);
    }
    // every place: a badge, named when there's room (more names as you zoom in)
    const order = [...places].sort((a, b) => rankOf(a) - rankOf(b));
    for (const pl of order) {
      if (pl.kind === 'monument') continue;
      if (this.filter === 'all' && !String(pl.kind).endsWith('mine') && (pl.kind === 'agbero' && v.ppm < 0.8 || ['home', 'tolet'].includes(pl.kind) && v.ppm < 0.4)) continue; // fewer badges when zoomed out
      const [sx, sy] = T(pl.x, pl.z);
      if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
      const tiny = v.ppm < 0.22 && rankOf(pl) > 2 && !String(pl.kind).endsWith('mine');
      placeIcon(g, pl.kind, sx, sy, tiny ? 0.62 : 1);
      const marked = this.waypoint && Math.hypot(this.waypoint.x - pl.x, this.waypoint.z - pl.z) < 3;
      const nameAt = marked ? 0 : pl.kind === 'agbero' ? 2.2 : String(pl.kind).startsWith('home') && !String(pl.kind).endsWith('mine') ? 1.1 : rankOf(pl) <= 2 ? 0.2 : 0.45;
      if (v.ppm >= nameAt || pl.kind === 'job' || String(pl.kind).endsWith('mine')) {
        g.font = `${marked ? 800 : 700} 12px "DM Sans", system-ui, sans-serif`; g.textAlign = 'left';
        const text = pl.label.length > 46 ? pl.label.slice(0, 44) + '…' : pl.label, pos = labels.place(sx + 12, sy - 9, g.measureText(text).width, 17, marked ? null : text);
        if (pos) halo(g, text, pos.x, pos.y + 8.5, marked ? '#c5221f' : catOf(pl.kind)?.id === 'homes' ? '#a52714' : '#202124', 3.5);
      }
    }
    if (this.waypoint) {
      const [sx, sy] = T(this.waypoint.x, this.waypoint.z);
      drawPin(g, sx, sy, '#ea4335', 1.25);
      if (this.waypointLabel) { g.font = '800 13px "DM Sans", system-ui, sans-serif'; g.textAlign = 'left'; const pos = labels.place(sx + 14, sy - 38, g.measureText(this.waypointLabel).width); if (pos) halo(g, this.waypointLabel, pos.x, pos.y + 9, '#c5221f', 4); }
    }
    // you: a blue dot with a heading cone, like a phone map
    if (this.player) {
      const [ppx, ppy] = T(this.player.px, this.player.pz);
      g.save(); g.translate(ppx, ppy);
      g.fillStyle = 'rgba(26,115,232,0.16)'; g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill();
      g.rotate(-this.player.heading + Math.PI);
      const cone = g.createRadialGradient(0, 0, 0, 0, 0, 30); cone.addColorStop(0, 'rgba(26,115,232,0.45)'); cone.addColorStop(1, 'rgba(26,115,232,0)');
      g.fillStyle = cone; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 30, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); g.closePath(); g.fill();
      g.fillStyle = '#1a73e8'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
    }
    // north arrow and scale bar
    { const nx = W - 34, ny = W <= 720 ? 96 : H - 70; g.save(); g.translate(nx, ny); g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 4; g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill(); g.shadowColor = 'transparent';
      g.fillStyle = '#ea4335'; g.beginPath(); g.moveTo(0, -11); g.lineTo(5, 0); g.lineTo(-5, 0); g.closePath(); g.fill(); g.fillStyle = '#9aa0a6'; g.beginPath(); g.moveTo(0, 11); g.lineTo(5, 0); g.lineTo(-5, 0); g.closePath(); g.fill(); g.restore(); }
    const nice = [20, 50, 100, 200, 500, 1000, 2000].find((m) => m * v.ppm > 60) ?? 2000;
    const bx = W - 24 - nice * v.ppm, by = H - 22;
    g.strokeStyle = '#3c4043'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx, by - 6); g.lineTo(bx, by); g.lineTo(W - 24, by); g.lineTo(W - 24, by - 6); g.stroke();
    g.font = '700 11px "DM Sans", sans-serif'; g.textAlign = 'right'; halo(g, nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, W - 24, by - 12, '#3c4043', 3);
    // the area in the middle of the map
    const chip = this.root?.querySelector('[data-slot=map-area-name]'); if (chip) { const t = this.areaAt(v.cx, v.cz); if (chip.textContent !== t) chip.textContent = t; }
  }
}
const RANK = { job: 0, 'home-mine': 0, 'car-mine': 0, friend: 1, market: 1, mall: 1, hospital: 1, police: 1, fuel: 2, hotel: 2, venue: 2, bank: 2, school: 2, church: 2, stadium: 1, recreation: 2, showroom: 2, terminal: 1 };
function rankOf(p) { return RANK[p.kind] ?? (String(p.kind).startsWith('home') ? 4 : 3); }
/** a teardrop pin */
function drawPin(g, sx, sy, color, k = 1, glyph = null) {
  g.save(); g.translate(sx, sy); g.scale(k, k);
  g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 4; g.shadowOffsetY = 1.5;
  g.fillStyle = color; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-3, -7, -10, -11, -10, -19); g.arc(0, -19, 10, Math.PI, 0); g.bezierCurveTo(10, -11, 3, -7, 0, 0); g.fill();
  g.shadowColor = 'transparent'; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#fff'; if (glyph) { g.font = `900 ${glyph.length > 1 ? 8 : 10}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(glyph, 0, -18.5); } else { g.beginPath(); g.arc(0, -19, 3.8, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
function poly(g, pts, T) {
  g.beginPath();
  pts.forEach(([x, z], i) => { const [a, b] = T(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); });
  g.closePath(); g.fill();
}
function outline(g, pts, T) {
  g.beginPath();
  pts.forEach(([x, z], i) => { const [a, b] = T(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); });
  g.closePath(); g.stroke();
}
const isDirt = (r) => r.surface === 'dirt' || (!r.graPaved && ['track', 'path', 'footway'].includes(r.type));
function roadStyle(r, pass) {
  const dirt = isDirt(r), major = isMajorRoad(r) && !dirt;
  if (pass === 'edge') return r.elevated ? '#aab0b5' : major ? C.majorEdge : dirt ? '#c9a77c' : C.edge;
  return r.elevated ? C.bridge : major ? C.major : dirt ? C.dirt : C.asphalt;
}
function drawRoads(g, roads, T, s, minW) {
  const sorted = [...roads].sort((a, b) => (isMajorRoad(a) ? 1 : 0) - (isMajorRoad(b) ? 1 : 0) || (a.elevated ? 1 : 0) - (b.elevated ? 1 : 0));
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const pass of ['edge', 'fill']) for (const r of sorted) {
    g.strokeStyle = roadStyle(r, pass);
    g.lineWidth = Math.max(minW, r.width * s) + (pass === 'edge' ? 1.6 : 0);
    g.beginPath();
    r.points.forEach(([x, z], i) => { const [a, b] = T(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); });
    g.stroke();
  }
}
/** road segments in world units (the live drawing): outline then fill, minor first */
function drawSegs(g, segs, edgeW) {
  const list = [...segs].sort(([a], [b]) => (isMajorRoad(a) ? 1 : 0) - (isMajorRoad(b) ? 1 : 0) || (a.elevated ? 1 : 0) - (b.elevated ? 1 : 0));
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const pass of ['edge', 'fill']) for (const [r, i] of list) {
    g.strokeStyle = roadStyle(r, pass); g.lineWidth = r.width + (pass === 'edge' ? edgeW : 0);
    g.beginPath(); g.moveTo(...r.points[i]); g.lineTo(...r.points[i + 1]); g.stroke();
  }
}
