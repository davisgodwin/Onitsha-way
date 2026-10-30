/**
 * v0.48: what kind of neighbourhood a spot is in. Pure (unit-tested); built from map evidence only:
 * - 'market'  : the markets, Upper Iweka interchange, Bridgehead and the plazas (OSM landmarks / published positions)
 * - 'dense'   : the old trading districts around them (the same old-core weight the building kit already uses)
 * - 'gra'     : GRA (Government Reserved Area) where the OSM export names it (place nodes or areas called "GRA"),
 *               or, for a preview only, `?preview-gra=x,z,r` in the address bar
 * - 'mixed'   : main roads (trunk, primary, secondary) through ordinary neighbourhoods: shops in front of houses
 * - 'middle'  : everything else (established family neighbourhoods)
 */
const MARKET_KINDS = ['market', 'interchange', 'bridgehead', 'plaza'];
const OLD_CORES = ['main-market', 'ochanja', 'fegge', 'bridgehead'];

function inPoly(x, z, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; }

/** Premium (GRA) areas named in the map data: circles around GRA place nodes, and polygons of areas named GRA. */
export function premiumAreas(map, preview = null) {
  const out = [];
  for (const p of map.pois ?? []) if (/\bGRA\b|Government Reserved/i.test(p.name ?? '') && ['neighbourhood', 'suburb', 'quarter', 'place'].includes(p.kind)) out.push({ x: p.x, z: p.z, r: /phase\s*(ii|2)/i.test(p.name) ? 750 : 650, name: p.name });
  for (const a of map.areas ?? []) if (/\bGRA\b|Government Reserved/i.test(a.name ?? '') && a.pts?.length > 2) out.push({ pts: a.pts, name: a.name });
  if (preview) out.push({ ...preview, name: 'GRA (preview)', preview: true });
  return out;
}
export function parsePreview(search) { const m = /[?&]preview-gra=(-?[\d.]+),(-?[\d.]+),([\d.]+)/.exec(search ?? ''); return m ? { x: +m[1], z: +m[2], r: +m[3] } : null; }

export class Districts {
  constructor({ map, landmarks, preview = null }) {
    this.map = map; this.landmarks = landmarks;
    this.markets = landmarks.list.filter((l) => MARKET_KINDS.includes(l.kind)).map((l) => ({ x: l.x, z: l.z, r: (l.radius ?? 80) * (l.kind === 'interchange' ? 0.9 : 1) }));
    this.cores = OLD_CORES.map((id) => landmarks.get(id)).filter(Boolean);
    this.premium = premiumAreas(map, preview);
  }
  oldCore(x, z) { let w = 0; for (const l of this.cores) w = Math.max(w, 1 - Math.min(1, Math.hypot(x - l.x, z - l.z) / 1100)); return w; }
  /** 0..1: how far inside GRA (1 well inside, fading over the last 120 m of a circle). */
  premiumAt(x, z) { let k = 0; for (const a of this.premium) { if (a.pts) { if (inPoly(x, z, a.pts)) k = 1; } else { const d = Math.hypot(x - a.x, z - a.z); if (d < a.r) k = Math.max(k, Math.min(1, (a.r - d) / 120)); } } return k; }
  at(x, z, road = null) {
    if (this.premiumAt(x, z) > 0.5) return 'gra';
    if (this.markets.some((m) => Math.hypot(x - m.x, z - m.z) < m.r)) return 'market';
    if (this.oldCore(x, z) > 0.55) return 'dense';
    if (road && ['trunk', 'primary', 'secondary'].includes(road.type)) return 'mixed';
    return 'middle';
  }
}
