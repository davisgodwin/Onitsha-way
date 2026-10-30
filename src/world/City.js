import {obb} from './BuildingBounds.js';
export {obb} from './BuildingBounds.js';
import { roadConflict } from './StreetLayout.js';
import * as THREE from 'three';
import { GeoBuilder } from './GeoBuilder.js';
import { mulberry32, hashString } from '../core/utils.js';
import { FACADE, atlasUV, ROOF, SIGN_GRID } from '../render/WorldTextures.js';
import { CONFIG } from '../config.js';
import { isMajorRoad, offsetPolyline } from './RoadBuilder.js';
import { planBuilding, drawParts, oldCoreWeight, drawUnfinished } from './buildings/ResidentialKit.js';
import { LEGACY_HOMES } from '../data/legacyHomes.js';
import { drawCompound } from './buildings/CompoundKit.js';
import { polysOverlap } from './ExpansionSites.js';
const pointIn = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };

/*
  Streamed city.
  prepare(): runs once at load for all ~13k OSM footprints — classifies each building, decides its
             look (deterministically from its seed), places compound walls, kiosks, generators and
             billboards, and registers every collider. This is data only; no meshes yet.
  Chunks (200 m squares) are turned into merged meshes on demand around the player by a time-
  budgeted generator, and disposed again when far away. Collision never streams: it is always complete.
*/

export const CHUNK = 200;
const WALL_PAINTS = ['#f3efe6', '#eadcc2', '#cfe1e8', '#f2d6c2', '#e3edc6', '#f0e2a6', '#dcd6ee', '#ffffff', '#e2c6a3', '#c9dcc4', '#f5c9b8', '#bfd7ea'];
const LONGSPAN = ['#9b2226', '#2d6a4f', '#1d4e89', '#7f5539', '#6c757d'];
const FH = () => CONFIG.world.floorHeight;

function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length]; a += x1 * z2 - x2 * z1; } return a / 2; }
function inPoly(x, z, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

export class City {
  constructor({ map, tex, collision, landmarks, quality = 'medium' }) {
    this.map = map; this.tex = tex; this.collision = collision; this.landmarks = landmarks;
    this.quality = quality;
    this.group = new THREE.Group(); this.group.name = 'City';
    this.chunks = new Map();      // key -> {key, gx, gz, items:[], fences:[], kiosks:[], boards:[], group|null, job}
    this.stats = { buildings: 0, shops: 0, signs: 0, fences: 0, kiosks: 0, generators: 0, billboards: 0, trimmed: map.meta.cleanup?.trimmed ?? 0 };
    this.materials = {
      wall: new THREE.MeshStandardMaterial({ map: tex.facade, vertexColors: true, roughness: 0.9, emissive: '#ffffff', emissiveMap: tex.facadeGlow, emissiveIntensity: 0 }),
      roof: new THREE.MeshStandardMaterial({ map: tex.roof, vertexColors: true, roughness: 0.6, metalness: 0.25, side: THREE.DoubleSide }),
      sign: new THREE.MeshStandardMaterial({ map: tex.signs, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex.signs, emissiveIntensity: 0 }),
      board: new THREE.MeshStandardMaterial({ map: tex.billboards, roughness: 0.55, emissive: '#ffffff', emissiveMap: tex.billboards, emissiveIntensity: 0 }),
      misc: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 }),
    };
    this.job = null;
    this.shopSpots = []; this.gateSpots = [];
  }

  chunkKey(x, z) { return Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK); }
  chunkFor(x, z) {
    const k = this.chunkKey(x, z);
    if (!this.chunks.has(k)) {
      const [gx, gz] = k.split(',').map(Number);
      this.chunks.set(k, { key: k, gx, gz, cx: (gx + 0.5) * CHUNK, cz: (gz + 0.5) * CHUNK, items: [], fences: [], kiosks: [], boards: [], group: null });
    }
    return this.chunks.get(k);
  }

  // ------------------------------------------------------------------ prepare (data only)
  /**
   * Two phases. The area of the Milestone 2–5 map is prepared first, exactly as before (same order,
   * same random sequences), so everything placed from it — and the residents whose ids come from that
   * order — stays the same. The new area (Asaba bank, the strip south of Bridgehead) is added after
   * the old area's street props, by prepare({ extra: true }).
   */
  prepare({ extra = false, ext = false } = {}) {
    const specials = new Map(this.landmarks.list.filter((l) => l.osmBuilding).map((l) => [l.osmBuilding, l]));
    const legacyCount = this.map.meta.legacy?.buildings ?? Infinity;
    // v0.48: a third phase for a map extension (GRA, the east), so the first two come out exactly as before
    const EX = this.map.meta.extensions?.[0]?.before, extCount = EX?.buildings ?? Infinity, phase = ext ? 2 : extra ? 1 : 0;
    let bi = -1; const phaseItems = [];
    for (const b of this.map.buildings) {
      bi++;
      if ((bi < legacyCount ? 0 : bi < extCount ? 1 : 2) !== phase) continue;
      const pts = b.pts; if (b.layoutHidden || pts.length < 3) continue;
      const rng = mulberry32(Math.floor(b.seed * 1e9) + 3);
      const box = obb(pts);
      const area = polyArea(pts);
      const rect = box ? area / box.area : 0;
      let kind = b.kind;
      const lm = specials.get(String(b.id));
      if (lm?.kind === 'mall') kind = 'mall';
      else if (lm?.kind === 'church' || kind === 'worship') kind = 'church';
      else if (box && box.d < 5 && box.w / box.d > 2.6 && area < 300) kind = 'stalls';
      b.renderKind = kind;
      let levels = kind === 'stalls' ? 1 : b.levels;
      let gh = kind === 'commercial' || kind === 'stalls' ? CONFIG.world.shopFloorHeight : kind === 'shed' ? 2.7 : FH();
      if (kind === 'mall') { levels = 2; gh = 6; }
      if (kind === 'church') { levels = 1; gh = 15; }
      const H = gh + (levels - 1) * FH();
      let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
      const blockWalls = (kind === 'residential' || kind === 'shed') && rng() < 0.16;
      const paint = kind === 'church' ? '#f6f3ec' : kind === 'mall' ? '#ffffff' : WALL_PAINTS[Math.floor(rng() * WALL_PAINTS.length)];
      let pitched = box && ((rect > 0.8 && box.d < 22) || (kind === 'church' && rect > 0.6 && box.d < 45)) && (kind === 'residential' || kind === 'shed' || kind === 'stalls' || kind === 'church' || (kind === 'commercial' && levels <= 2 && rng() < 0.3));
      if(pitched){const p=box,ov=.45;const corners=[[-p.w/2-ov,-p.d/2-ov],[p.w/2+ov,-p.d/2-ov],[p.w/2+ov,p.d/2+ov],[-p.w/2-ov,p.d/2+ov]].map(([a,b])=>[p.cx+p.ux*a+p.vx*b,p.cz+p.uz*a+p.vz*b]);if(roadConflict(this.map,corners,.55))pitched=false;}
      let roof;
      if (pitched) {
        const rr = rng();
        const tile = kind === 'church' ? ROOF.LONGSPAN : kind === 'stalls' ? (rr < 0.6 ? ROOF.RUST : ROOF.ZINC) : rr < 0.4 ? ROOF.ZINC : rr < 0.75 ? ROOF.RUST : ROOF.LONGSPAN;
        const color = kind === 'church' ? '#8d2a2a' : tile === ROOF.LONGSPAN ? LONGSPAN[Math.floor(rng() * LONGSPAN.length)] : null;
        roof = { pitched: true, tile, color, shade: 0.85 + rng() * 0.15, gable: kind === 'stalls' || kind === 'church' || box.w / box.d > 1.8 || rng() < 0.35, steep: kind === 'church' };
      } else {
        roof = { pitched: false, tank: area > 50 && rng() < 0.55 && kind !== 'mall' ? rng() : -1 };
      }
      const item = { b, kind, levels, gh, H, box, area, cx, cz, paint, blockWalls, roof, legacy: bi < legacyCount, phase };
      if ((kind === 'commercial' || kind === 'stalls') && b.front >= 0) { // where a shopkeeper stands
        const [fax, faz] = pts[b.front], [fbx, fbz] = pts[(b.front + 1) % pts.length];
        const fl = Math.hypot(fbx - fax, fbz - faz) || 1, fnx = (fbz - faz) / fl, fnz = -(fbx - fax) / fl;
        this.shopSpots.push({ x: (fax + fbx) / 2 + fnx * 1.1, z: (faz + fbz) / 2 + fnz * 1.1, nx: fnx, nz: fnz });
      }
      this.chunkFor(cx, cz).items.push(item); phaseItems.push(item);
      this.collision.addPolygon(pts, H);
      this.stats.buildings++;

      // rooftop billboard on some multi-storey commercial blocks
      if (kind === 'commercial' && !pitched && levels >= 2 && b.front >= 0 && rng() < 0.07) {
        const [ax, az] = pts[b.front], [bx, bz] = pts[(b.front + 1) % pts.length];
        const L = Math.hypot(bx - ax, bz - az);
        if (L > 7) {
          this.chunkFor(cx, cz).boards.push({ ax, az, bx, bz, L, H, ad: Math.floor(rng() * 4) });
          this.stats.billboards++;
        }
      }
    }
    this.planBuildingTypes(phaseItems);
    this.placeCompoundWalls(phase);
    const legacyRoads = this.map.meta.legacy?.roads ?? Infinity, extRoads = EX?.roads ?? Infinity;
    this.placeKiosks(ext ? (i) => i >= extRoads : extra ? (i) => i >= legacyRoads && i < extRoads : (i) => i < legacyRoads, ext ? 7171 : extra ? 9091 : 555);
  }

  inLandmark(x, z, kinds) {
    const l = this.landmarks.at(x, z);
    return l && kinds.includes(l.kind);
  }

  /** Warm lit windows and compound security lights: invisible by day, glowing at night (one material for the city). */
  makeGlowMaterial() { const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: true }); m.name = 'city-night-glow'; return m; }
  setNight(k) { const m = this.glowMaterial; if (!m) return; const o = Math.max(0, Math.min(1, (k - 0.25) / 0.45)) * 0.92; if (Math.abs(m.opacity - o) > 0.01) { m.opacity = o; m.visible = o > 0.01; } }
  addLitWindows(it, glow) {
    const rng = mulberry32(Math.floor(it.b.seed * 1e9) + 777); if (rng() > 0.42) return;
    const pts = it.b.pts, warm = [new THREE.Color('#ffd28a'), new THREE.Color('#ffe7b8'), new THREE.Color('#fff3d6')], fh = FH();
    for (let e = 0; e < pts.length; e++) {
      const [ax, az] = pts[e], [bx, bz] = pts[(e + 1) % pts.length], L = Math.hypot(bx - ax, bz - az); if (L < 3) continue;
      let nx = (bz - az) / L, nz = -(bx - ax) / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (inPoly(mx + nx * 0.3, mz + nz * 0.3, pts)) { nx = -nx; nz = -nz; }
      const nb = Math.max(1, Math.round(L / 3));
      for (let f = 0; f < it.levels; f++) for (let k = 0; k < nb; k++) {
        if (rng() > 0.38) continue;
        const t = (k + 0.5) / nb, cx = ax + (bx - ax) * t + nx * 0.04, cz = az + (bz - az) * t + nz * 0.04, hw = 0.55, y0 = (f === 0 ? 0 : it.gh + (f - 1) * fh) + 1.0, y1 = y0 + 0.95, ux = (bx - ax) / L, uz = (bz - az) / L, col = warm[Math.floor(rng() * 3)];
        glow.quad([[cx - ux * hw, y0, cz - uz * hw], [cx + ux * hw, y0, cz + uz * hw], [cx + ux * hw, y1, cz + uz * hw], [cx - ux * hw, y1, cz - uz * hw]], [[0, 0], [1, 0], [1, 1], [0, 1]], [nx, 0, nz], col);
      }
    }
  }

  /**
   * v0.38: houses added on empty land (see ResidentialInfill). They are ordinary city buildings from here on:
   * same chunk streaming, colliders, building kit and compound walls. `list`: [{id, pts, front, levels, seed, compound}].
   * Chunks already built are rebuilt so the new houses appear at once.
   */
  addBuildings(list) {
    const fh = FH(), items = [], touched = new Set();
    for (const b of list) {
      const pts = b.pts, box = obb(pts), area = Math.abs(polyArea(pts)), levels = b.levels, gh = FH(), H = gh + (levels - 1) * fh;
      let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
      b.kind = 'residential'; b.renderKind = 'residential'; b.synthetic = true;
      const item = { b, kind: 'residential', levels, gh, H, box, area, cx, cz, paint: '#efe7d3', blockWalls: false, roof: { pitched: false, tank: -1 }, legacy: false, infill: true };
      const ch = this.chunkFor(cx, cz); ch.items.push(item); items.push(item); touched.add(ch);
      if (!b.registered) this.collision.addPolygon(pts, H);
      this.stats.buildings++; this.stats.infill = (this.stats.infill ?? 0) + 1;
      if (b.compound) { ch.compounds ??= []; ch.compounds.push({ ...b.compound, paint: null, item }); }
    }
    this.planBuildingTypes(items);
    for (const ch of touched) for (const c of ch.compounds ?? []) if (c.item) c.paint = c.item.paint;
    for (const ch of touched) if (ch.group) this.disposeChunk(ch);
    return items;
  }

  /**
   * v0.38 building kit: give each residential footprint (and some 2–3 storey commercial ones) an Onitsha building
   * type with its paint, roof, veranda / porch / balconies. Runs after every footprint of this phase has its
   * collider, so the parts never overlap a neighbour or a road. Pillars get small colliders.
   */
  planBuildingTypes(items) {
    this.legacyHomeIds ??= new Set(LEGACY_HOMES.map((h) => String(h.buildingId)));
    const col = this.collision, map = this.map, fh = FH(), types = this.stats.buildingTypes ??= {};
    const clear = (poly) => {
      if (roadConflict(map, poly, 0.5)) return false;
      const [a, b, c, d] = poly; // strip: a,b on the wall line, c,d at the outer edge
      for (let i = 0; i <= 6; i++) for (const f of [0.35, 0.7, 1]) {
        const t = i / 6, x0 = a[0] + (b[0] - a[0]) * t, z0 = a[1] + (b[1] - a[1]) * t, x1 = d[0] + (c[0] - d[0]) * t, z1 = d[1] + (c[1] - d[1]) * t;
        const L = Math.hypot(x1 - x0, z1 - z0) || 1, k = Math.max(0.35 / L, f);
        if (!col.isFree(x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, 0.12) || map.onCarriageway(x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, 0.4)) return false;
      }
      return true;
    };
    for (const it of items) {
      if (it.kind !== 'residential' && it.kind !== 'commercial') continue;
      const rng = mulberry32(Math.floor(it.b.seed * 1e9) + 4401);
      it.rect = it.box ? it.area / it.box.area : 0;
      const plan = planBuilding(it, rng, { clear, inPoly, oldCore: oldCoreWeight(this.landmarks, it.cx, it.cz), premium: this.districts?.premiumAt(it.cx, it.cz) ?? 0, gh: it.gh, fh });
      if (!plan) continue;
      // v0.39: some buildings are still under construction (never a rentable home)
      if (it.kind === 'residential' && !['storeyflats', 'apartment'].includes(plan.type) && !this.legacyHomeIds.has(String(it.b.id)) && it.box && it.rect > 0.75 && mulberry32(Math.floor(it.b.seed * 1e9) + 9917)() < (it.b.synthetic ? 0.07 : 0.025)) {
        it.plan = { type: 'unfinished' }; it._inPoly = inPoly; it.b.unfinished = true; types.unfinished = (types.unfinished ?? 0) + 1;
        it.yardClear = it.b.front >= 0 && (() => { const [ax, az] = it.b.pts[it.b.front], [bx, bz] = it.b.pts[(it.b.front + 1) % it.b.pts.length], L = Math.hypot(bx - ax, bz - az) || 1; let nx = (bz - az) / L, nz = -(bx - ax) / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (inPoly(mx + nx * .3, mz + nz * .3, it.b.pts)) { nx = -nx; nz = -nz; } return col.isFree(mx + nx * 2.3, mz + nz * 2.3, 1.6) && !map.onCarriageway(mx + nx * 2.3, mz + nz * 2.3, 1.8); })();
        if (it.yardClear) { const [ax, az] = it.b.pts[it.b.front], [bx, bz] = it.b.pts[(it.b.front + 1) % it.b.pts.length], L = Math.hypot(bx - ax, bz - az) || 1; let nx = (bz - az) / L, nz = -(bx - ax) / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (inPoly(mx + nx * .3, mz + nz * .3, it.b.pts)) { nx = -nx; nz = -nz; } col.addCircle(mx + nx * 2.4 - (bx - ax) / L * 1.8, mz + nz * 2.4 - (bz - az) / L * 1.8, 1.1); }
        continue;
      }
      it.plan = plan; it._inPoly = inPoly; types[plan.type] = (types[plan.type] ?? 0) + 1;
      if (it.kind === 'residential') it.paint = plan.paint;
      const shapeOK = it.box && it.area / it.box.area > 0.8 && it.box.d < 22;
      if (plan.roof.pitched && shapeOK && it.kind === 'residential') {
        const p = it.box, ov = .45, corners = [[-p.w/2-ov,-p.d/2-ov],[p.w/2+ov,-p.d/2-ov],[p.w/2+ov,p.d/2+ov],[-p.w/2-ov,p.d/2+ov]].map(([a,b])=>[p.cx+p.ux*a+p.vx*b,p.cz+p.uz*a+p.vz*b]);
        if (!roadConflict(map, corners, .55)) it.roof = { pitched: true, tile: ROOF[plan.roof.tile], color: plan.roof.tile === 'LONGSPAN' ? LONGSPAN[Math.floor(rng() * LONGSPAN.length)] : null, shade: 0.85 + rng() * 0.15, gable: plan.roof.gable };
      } else if (!plan.roof.pitched && it.kind === 'residential') it.roof = { pitched: false, tank: plan.roof.tank };
      for (const part of [plan.veranda, plan.porch]) for (const [x, z] of part?.pillars ?? []) col.addCircle(x, z, 0.2);
    }
  }

  placeCompoundWalls(phase = 0) {
    const col = this.collision;
    // one phase at a time (see prepare): gate residents of the earlier map keep their ids
    const order = [];
    for (const [, ch] of this.chunks) for (const it of ch.items) if ((it.phase ?? (it.legacy ? 0 : 1)) === phase && !it.infill) order.push([ch, it]);
    for (const [ch, it] of order) {
      const b = it.b;
      if (it.kind !== 'residential' || b.front < 0 || it.levels > 2) continue;
      const rng = mulberry32(Math.floor(b.seed * 1e9) + 91);
      if (rng() > 0.6) continue;
      if (this.inLandmark(it.cx, it.cz, ['market', 'park', 'mall', 'interchange'])) continue;
      const pts = b.pts;
      const [ax, az] = pts[b.front], [bx, bz] = pts[(b.front + 1) % pts.length];
      const L = Math.hypot(bx - ax, bz - az); if (L < 6) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux; // outward normal of CCW edge
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const nr = this.map.nearestRoad(mx, mz, { maxDist: 24 });
      if (!nr) continue;
      const dEdge = nr.dist - nr.road.width / 2;
      const clear = isMajorRoad(nr.road) ? 1.3 : 0.6;
      const off = dEdge - clear;
      if (off < 1.8 || off > 11) continue;
      // fence line parallel to the front edge, pushed towards the road
      const sx = ax + nx * off - ux * 1.2, sz = az + nz * off - uz * 1.2;
      const FL = L + 2.4;
      const N = Math.floor(FL / 0.8);
      const free = [];
      for (let i = 0; i <= N; i++) { const t = (i / N) * FL; free.push(col.isFree(sx + ux * t, sz + uz * t, 0.3) && !this.map.onCarriageway(sx+ux*t,sz+uz*t,.65)); }
      // longest free run around the middle
      const mid = Math.floor(N / 2);
      if (!free[mid]) continue;
      let i0 = mid, i1 = mid;
      while (i0 > 0 && free[i0 - 1]) i0--;
      while (i1 < N && free[i1 + 1]) i1++;
      const t0 = (i0 / N) * FL, t1 = (i1 / N) * FL;
      if (t1 - t0 < 7) continue;
      const p0 = [sx + ux * t0, sz + uz * t0], p1 = [sx + ux * t1, sz + uz * t1];
      const tm = (t0 + t1) / 2;
      const g0 = [sx + ux * (tm - 1.6), sz + uz * (tm - 1.6)], g1 = [sx + ux * (tm + 1.6), sz + uz * (tm + 1.6)];
      const fence = { segs: [[p0, g0], [g1, p1]], gate: [g0, g1], block: rng() < 0.5, paint: it.paint, n: [nx, nz], returns: [] };
      // short side returns back towards the house
      for (const [p, sgn] of [[p0, -1], [p1, 1]]) {
        const q = [p[0] - nx * (off - 0.4), p[1] - nz * (off - 0.4)];
        let ok = true;
        for (let k = 1; k < 6; k++) { const t = k / 6; if (!col.isFree(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, 0.25)) { ok = false; break; } }
        if (ok) fence.returns.push([p, q]);
        void sgn;
      }
      for (const [a, c] of [...fence.segs, fence.gate, ...fence.returns]) addThinWall(col, a, c, 0.22, 2.2);
      ch.fences.push(fence); it.fenced = true;
      this.gateSpots.push({ x: (fence.gate[0][0] + fence.gate[1][0]) / 2 + nx * 1.0, z: (fence.gate[0][1] + fence.gate[1][1]) / 2 + nz * 1.0, nx, nz });
      this.stats.fences++;
    }
  }

  /**
   * Kiosks placed beside one road can end up on another one (at junctions, or across a dual carriageway).
   * Called once everything is placed: such kiosks (and their generators) are removed with their walls.
   * Placement itself is unchanged, so nothing else (stalls, residents' ids) moves.
   */
  clearRoadKiosks() {
    let n = 0;
    const on = (x, z, m) => this.map.onCarriageway(x, z, m);
    for (const ch of this.chunks.values()) {
      ch.kiosks = ch.kiosks.filter((k) => {
        const s = Math.sin(k.yaw), c = Math.cos(k.yaw);
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [k.x + c * a * k.w / 2 + s * b * k.d / 2, k.z - s * a * k.w / 2 + c * b * k.d / 2]);
        const bad = !!roadConflict(this.map, corners, .65);
        if (!bad) {
          if (k.gen && on(k.gen.x, k.gen.z, 0.2)) { this.collision.removeCircle(k.gen.ci); k.gen = null; }
          return true;
        }
        this.collision.removePolygon(k.poly);
        if (k.gen) this.collision.removeCircle(k.gen.ci);
        n++;
        return false;
      });
    }
    this.stats.kiosksOnRoads = n;
    this.stats.kiosks -= n;
    return n;
  }

  /**
   * v0.53: kiosks (and their generators) standing in front of an entrance: a compound gate, a house or shop door, a
   * venue's door. `zones` are polygons (the walk-in / drive-in area in front of each entrance). Called once everything
   * is placed; the kiosks are removed with their colliders and their chunk is redrawn.
   */
  clearEntranceKiosks(zones) {
    const C = 16, grid = new Map(); let n = 0;
    for (const ch of this.chunks.values()) for (const k of ch.kiosks) { const key = Math.floor(k.x / C) + ',' + Math.floor(k.z / C); (grid.get(key) ?? grid.set(key, []).get(key)).push({ k, ch }); }
    const foot = (k) => { const s = Math.sin(k.yaw), c = Math.cos(k.yaw); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [k.x + c * a * (k.w / 2 + .2) + s * b * (k.d / 2 + .2), k.z - s * a * (k.w / 2 + .2) + c * b * (k.d / 2 + .2)]); };
    const dead = new Set(), touched = new Set();
    for (const z of zones) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, y] of z) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, y); z1 = Math.max(z1, y); }
      for (let gx = Math.floor((x0 - 3) / C); gx <= Math.floor((x1 + 3) / C); gx++) for (let gz = Math.floor((z0 - 3) / C); gz <= Math.floor((z1 + 3) / C); gz++) for (const e of grid.get(gx + ',' + gz) ?? []) {
        if (dead.has(e.k)) continue; const k = e.k;
        const hitGen = k.gen && pointIn(k.gen.x, k.gen.z, z);
        if (polysOverlap(foot(k), z)) { dead.add(k); touched.add(e.ch); }
        else if (hitGen) { this.collision.removeCircle(k.gen.ci); k.gen = null; touched.add(e.ch); }
      }
    }
    for (const ch of this.chunks.values()) ch.kiosks = ch.kiosks.filter((k) => { if (!dead.has(k)) return true; this.collision.removePolygon(k.poly); if (k.gen) this.collision.removeCircle(k.gen.ci); n++; return false; });
    for (const ch of touched) if (ch.group) this.disposeChunk(ch);
    this.stats.kiosksAtEntrances = n; this.stats.kiosks -= n;
    return n;
  }

  placeKiosks(useRoad = () => true, seed = 555) {
    const col = this.collision;
    const rng = mulberry32(seed);
    let ri = -1;
    for (const road of this.map.roads) {
      ri++;
      if (!useRoad(ri)) continue;
      if (road.bridge || !['residential', 'unclassified', 'tertiary', 'secondary', 'primary'].includes(road.type)) continue;
      const major = isMajorRoad(road);
      for (const side of [1, -1]) {
        const line = offsetPolyline(road.points, side * (road.width / 2 + (major ? 3.1 : 1.9)));
        let acc = rng() * 40;
        for (let i = 0; i < line.length - 1; i++) {
          const [x0, z0] = line[i], [x1, z1] = line[i + 1];
          const L = Math.hypot(x1 - x0, z1 - z0); if (L < 1e-3) continue;
          const dx = (x1 - x0) / L, dz = (z1 - z0) / L;
          for (let d = acc; d < L; d += 46) {
            if (rng() > 0.32) continue;
            const x = x0 + dx * d, z = z0 + dz * d;
            if (!col.isFree(x, z, 1.75)) continue;
            if (this.inLandmark(x, z, ['mall', 'interchange'])) continue;
            // kiosk faces the road
            const yaw = Math.atan2(-(-dz) * side, -(dx) * side);
            const k = { x, z, yaw, w: 2.3, d: 1.9, shop: Math.floor(rng() * 4), paint: WALL_PAINTS[Math.floor(rng() * WALL_PAINTS.length)], sign: Math.floor(rng() * SIGN_GRID.count), gen: null };
            k.poly = addRect(col, x, z, k.w, k.d, yaw);
            if (rng() < 0.45) {
              const gx = x + dx * 1.8, gz = z + dz * 1.8;
              if (col.isFree(gx, gz, 0.45)) { k.gen = { x: gx, z: gz, yaw: yaw + 0.3, color: rng() < 0.5 ? '#c1121f' : '#f2b705' }; k.gen.ci = col.addCircle(gx, gz, 0.4); this.stats.generators++; }
            }
            this.chunkFor(x, z).kiosks.push(k);
            this.stats.kiosks++;
          }
          acc = Math.max(0, acc - L);
        }
      }
    }
  }

  // ------------------------------------------------------------------ streaming
  /** Build every chunk within `radius` synchronously (initial load). */
  buildAround(x, z, radius, onProgress) {
    this._lodFocus={x,z};
    const keys = this.keysWithin(x, z, radius);
    keys.forEach((k, i) => {
      const ch = this.chunks.get(k);
      if (ch && !ch.group) { const gen = this.buildChunk(ch); while (!gen.next().done); }
      onProgress?.((i + 1) / keys.length);
    });
  }

  keysWithin(x, z, radius) {
    const out = [];
    const g0x = Math.floor((x - radius) / CHUNK), g1x = Math.floor((x + radius) / CHUNK);
    const g0z = Math.floor((z - radius) / CHUNK), g1z = Math.floor((z + radius) / CHUNK);
    for (let gx = g0x; gx <= g1x; gx++) for (let gz = g0z; gz <= g1z; gz++) {
      const cx = (gx + 0.5) * CHUNK, cz = (gz + 0.5) * CHUNK;
      const d = Math.hypot(cx - x, cz - z) - CHUNK * 0.7;
      const k = gx + ',' + gz;
      if (d < radius && this.chunks.has(k)) out.push([d, k]);
    }
    return out.sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  }

  /** Call every frame: continues the current chunk job within `budgetMs`, queues new ones, unloads far ones. */
  update(x, z, loadRadius, budgetMs = 4) {
    const t0 = performance.now();
    if(!this._lodFocus||Math.hypot(x-this._lodFocus.x,z-this._lodFocus.z)>8||this._lodQuality!==this.quality){this._lodFocus={x,z};this._lodQuality=this.quality;}
    if (!this.job) {
      const next = this.keysWithin(x, z, loadRadius).map((k) => this.chunks.get(k)).find((c) => !c.group);
      if (next) this.job = this.buildChunk(next);
    }
    while (this.job && performance.now() - t0 < budgetMs) {
      if (this.job.next().done) this.job = null;
    }
    // unload
    const unload = loadRadius + 160;
    for (const ch of this.chunks.values()) {
      if (!ch.group) continue; const d = Math.hypot(ch.cx - x, ch.cz - z) - CHUNK * 0.7;
      if (d > unload) this.disposeChunk(ch);
      else ch.group.visible = d < loadRadius + 20; // v0.49: chunks kept loaded beyond the draw distance aren't drawn
    }
  }

  get loadedCount() { let n = 0; for (const c of this.chunks.values()) if (c.group) n++; return n; }

  disposeChunk(ch) {
    this.group.remove(ch.group);
    ch.group.traverse((o) => {if(!o.userData.sharedModel)o.geometry?.dispose();if(o.isInstancedMesh)o.dispose();});
    ch.group = null; ch.importLOD=null;
  }

  *buildChunk(ch) {
    const walls = new GeoBuilder(), roofs = new GeoBuilder(), signs = new GeoBuilder(), boards = new GeoBuilder(), misc = new GeoBuilder(), glow = new GeoBuilder();
    this._glow = glow;
    let n = 0;
    for (const it of ch.items) {
      this.buildBuilding(it, walls, roofs, signs, misc);
      if (++n % 25 === 0) yield;
    }
    for (const f of ch.fences) this.buildFence(f, walls);
    for (const c of ch.compounds ?? []) drawCompound(c, { misc, walls, glow }, { plainUV: this.compoundUV ??= (() => { const [u0, v0, u1, v1] = atlasUV(FACADE.BLOCK); return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]; })() });
    for (const k of ch.kiosks) this.buildKiosk(k, walls, roofs, signs, misc);
    for (const bb of ch.boards) this.buildBillboard(bb, boards, misc);
    yield;
    const g = new THREE.Group(); g.name = 'chunk:' + ch.key;
    const add = (gb, mat, cast = true) => {
      if (!gb.vertexCount) return;
      const m = new THREE.Mesh(gb.build(), mat); m.castShadow = cast; m.receiveShadow = true; g.add(m);
    };
    add(walls, this.materials.wall); add(roofs, this.materials.roof); add(signs, this.materials.sign, false);
    add(boards, this.materials.board); add(misc, this.materials.misc); add(glow, this.glowMaterial ??= this.makeGlowMaterial(), false);
    ch.group = g;
    this.group.add(g);
  }

  // ------------------------------------------------------------------ geometry
  buildBuilding(it, walls, roofs, signs, misc) {
    const { b, kind, levels, gh, H } = it;
    const pts = b.pts;
    const rng = mulberry32(Math.floor(b.seed * 1e9) + 17);
    const paint = new THREE.Color(it.paint);
    const shopTint = paint.clone().lerp(new THREE.Color('#ffffff'), 0.7);
    const white = new THREE.Color('#ffffff');
    const fh = FH();
    if (it.plan?.type === 'unfinished') { drawUnfinished(it, { misc, walls }, { blockUV: atlasUV(FACADE.BLOCK), fh }); return; }
    for (let e = 0; e < pts.length; e++) {
      const [ax, az] = pts[e], [bx, bz] = pts[(e + 1) % pts.length];
      const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
      const nx = (bz - az) / L, nz = -(bx - ax) / L;
      const isFront = e === b.front || (kind === 'stalls' && L > 3);
      const bayW = kind === 'church' ? 4.2 : 3;
      const nb = Math.max(1, Math.round(L / bayW));
      const doorBay = Math.floor(nb / 2);
      for (let f = 0; f < levels; f++) {
        const y0 = f === 0 ? -0.25 : gh + (f - 1) * fh;
        const y1 = f === 0 ? gh : y0 + fh;
        for (let k = 0; k < nb; k++) {
          const t0 = k / nb, t1 = (k + 1) / nb;
          let cell, col = paint;
          const r = rng();
          if (kind === 'church') { cell = L < 2.5 ? FACADE.PLAIN : FACADE.CHURCH; }
          else if (kind === 'mall') { cell = f === 0 ? (isFront || r < 0.5 ? FACADE.MALL_GLASS : FACADE.MALL_PANEL) : FACADE.MALL_PANEL; col = white; }
          else if (L < 1.6) cell = it.blockWalls ? FACADE.BLOCK : FACADE.PLAIN;
          else if (it.blockWalls) cell = r < 0.35 && f === 0 && isFront && k === doorBay ? FACADE.RES_DOOR : r < 0.6 ? FACADE.RES_WINDOW : FACADE.BLOCK;
          else if (kind === 'commercial' || kind === 'stalls') {
            if (f === 0) {
              if (isFront) {
                cell = r < 0.15 ? FACADE.SHUTTER : r < 0.27 && kind === 'commercial' ? FACADE.TILED : FACADE.SHOP[Math.floor(rng() * 4)];
                col = shopTint; this.stats.shops++;
              } else cell = r < 0.3 ? FACADE.SHUTTER : r < 0.55 ? FACADE.BLOCK : FACADE.PLAIN;
            } else cell = isFront || r < 0.45 ? FACADE.UPPER[Math.floor(rng() * 4)] : FACADE.PLAIN2;
          } else if (kind === 'shed') cell = r < 0.5 ? FACADE.BLOCK : FACADE.PLAIN;
          else if (f === 0) cell = it.plan?.manyDoors && L > 5 && (isFront || r < 0.3) ? (k % 2 === 0 ? FACADE.RES_DOOR : FACADE.RES_WINDOW) : isFront && k === doorBay ? FACADE.RES_DOOR : r < (it.plan?.type === 'modernbungalow' || it.plan?.type === 'duplex' ? 0.8 : 0.62) ? FACADE.RES_WINDOW : FACADE.PLAIN;
          else cell = r < 0.75 ? FACADE.UPPER[Math.floor(rng() * 3)] : FACADE.PLAIN2;
          if (cell === FACADE.BLOCK || cell === FACADE.TILED) col = white;
          const [u0, v0, u1, v1] = atlasUV(cell);
          const xa = ax + (bx - ax) * t0, za = az + (bz - az) * t0, xb = ax + (bx - ax) * t1, zb = az + (bz - az) * t1;
          walls.quad([[xa, y0, za], [xb, y0, zb], [xb, y1, zb], [xa, y1, za]], [[u1, v0], [u0, v0], [u0, v1], [u1, v1]], [nx, 0, nz], col);
        }
      }
      if ((kind === 'commercial' || kind === 'stalls') && isFront && L > 2.6) {
        const nbS = Math.max(1, Math.round(L / 3.4));
        for (let k = 0; k < nbS; k++) {
          if (rng() < 0.3) continue;
          const t0 = (k + 0.06) / nbS, t1 = (k + 0.94) / nbS, off = 0.07;
          const xa = ax + (bx - ax) * t0 + nx * off, za = az + (bz - az) * t0 + nz * off;
          const xb = ax + (bx - ax) * t1 + nx * off, zb = az + (bz - az) * t1 + nz * off;
          const h = Math.min(0.85, ((t1 - t0) * L) / 4);
          const sy0 = gh - 0.02, sy1 = sy0 + h;
          const si = Math.floor(rng() * SIGN_GRID.count);
          const [u0, v0, u1, v1] = atlasUV([si % SIGN_GRID.cols, Math.floor(si / SIGN_GRID.cols)], SIGN_GRID.cols, SIGN_GRID.rows);
          signs.quad([[xa, sy0, za], [xb, sy0, zb], [xb, sy1, zb], [xa, sy1, za]], [[u1, v0], [u0, v0], [u0, v1], [u1, v1]], [nx, 0, nz]);
          this.stats.signs++;
        }
      }
    }
    const roof = it.roof;
    if (roof.pitched) {
      const rcol = roof.color ? new THREE.Color(roof.color) : new THREE.Color().setScalar(roof.shade);
      pitchedRoof(roofs, walls, it.box, H, roof.tile, rcol, roof.gable, paint, roof.steep);
    } else {
      flatRoof(roofs, walls, pts, H, paint);
      if (roof.tank >= 0) {
        const p = interiorPoint(pts, it.cx, it.cz);
        if (p) {
          const r = 0.6 + roof.tank * 0.25;
          misc.box(p[0], p[1], H, H + 0.6, r * 2.2, r * 2.2, 0, new THREE.Color('#5a5650'), undefined); // stand
          misc.cylinder(p[0], p[1], H + 0.6, H + 0.6 + r * 1.9, r, new THREE.Color('#151515'), 14);
        }
      }
    }
    if (it.plan && this._glow) this.addLitWindows(it, this._glow);
    if (it.plan) {
      const [pu0, pv0, pu1, pv1] = atlasUV(FACADE.PLAIN);
      drawParts(it, it.plan, { misc, roofs, walls }, {
        plainUV: [[pu0, pv0 + 0.01], [pu1, pv0 + 0.01], [pu1, pv0 + (pv1 - pv0) * 0.3], [pu0, pv0 + (pv1 - pv0) * 0.3]],
        roofQuad: (c, tile, col) => { const t = typeof tile === 'string' ? ROOF[tile] : tile; roofs.quad(c, [roofUV(t, 0, 0), roofUV(t, 1, 0), roofUV(t, 1, 1), roofUV(t, 0, 1)], faceNormal(c[0], c[1], c[2]), col); },
      });
    }
    if (kind === 'church') this.buildChurchTowers(it, misc, walls, roofs);
  }

  buildChurchTowers(it, misc, walls, roofs) {
    // twin bell towers on the entrance (road-facing) side, white with pointed spires and crosses
    const { b, H, box } = it;
    const pts = b.pts;
    let e = b.front >= 0 ? b.front : 0;
    const [ax, az] = pts[e], [bx, bz] = pts[(e + 1) % pts.length];
    const L = Math.hypot(bx - ax, bz - az) || 1;
    const ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux;
    const yaw = Math.atan2(nx, nz);
    const white = new THREE.Color('#f6f3ec'), spire = new THREE.Color('#8d2a2a'), gold = new THREE.Color('#d4af37');
    const TH = H + 13;
    for (const t of [0.12, 0.88]) {
      const cx = ax + (bx - ax) * t - nx * 2.4, cz = az + (bz - az) * t - nz * 2.4;
      const [u0, v0, u1, v1] = atlasUV(FACADE.CHURCH);
      // tower shaft in facade material, two stacked window tiles
      for (let s = 0; s < 4; s++) {
        const a = (s / 4) * Math.PI * 2 + yaw, n = [Math.sin(a), 0, Math.cos(a)];
        const rx = Math.cos(a), rz = -Math.sin(a);
        const c0 = [cx + n[0] * 2.4 - rx * 2.4, cz + n[2] * 2.4 - rz * 2.4], c1 = [cx + n[0] * 2.4 + rx * 2.4, cz + n[2] * 2.4 + rz * 2.4];
        for (let k = 0; k < 2; k++) {
          const y0 = k === 0 ? -0.2 : TH / 2, y1 = k === 0 ? TH / 2 : TH;
          walls.quad([[c0[0], y0, c0[1]], [c1[0], y0, c1[1]], [c1[0], y1, c1[1]], [c0[0], y1, c0[1]]], [[u1, v0], [u0, v0], [u0, v1], [u1, v1]], n, white);
        }
      }
      // pyramid spire
      const top = [cx, TH + 7, cz];
      for (let s = 0; s < 4; s++) {
        const a0 = (s / 4) * Math.PI * 2 + yaw + Math.PI / 4, a1 = ((s + 1) / 4) * Math.PI * 2 + yaw + Math.PI / 4;
        const r = 2.4 * Math.SQRT2 + 0.2;
        const p0 = [cx + Math.sin(a0) * r, TH, cz + Math.cos(a0) * r], p1 = [cx + Math.sin(a1) * r, TH, cz + Math.cos(a1) * r];
        const am = (a0 + a1) / 2;
        misc.tri(p0, p1, top, [0, 0], [1, 0], [0.5, 1], [Math.sin(am) * 0.8, 0.6, Math.cos(am) * 0.8], spire);
      }
      misc.beam([cx, TH + 7, cz], [cx, TH + 9.4, cz], 0.22, gold);
      misc.beam([cx - ux * 0.7, TH + 8.6, cz - uz * 0.7], [cx + ux * 0.7, TH + 8.6, cz + uz * 0.7], 0.2, gold);
    }
    void box; void roofs;
  }

  buildFence(f, walls) {
    const paint = new THREE.Color(f.paint);
    const cellW = f.block ? FACADE.BLOCK : FACADE.PLAIN;
    const [u0, v0, u1, v1] = atlasUV(cellW);
    const vH = v0 + (v1 - v0) * 0.7;
    const col = f.block ? new THREE.Color('#ffffff') : paint;
    const wall = (a, c, h, uv, colr) => {
      const dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz) || 1;
      const nx = dz / L, nz = -dx / L, t = 0.11;
      for (const s of [1, -1]) {
        walls.quad([[a[0] + nx * t * s, 0, a[1] + nz * t * s], [c[0] + nx * t * s, 0, c[1] + nz * t * s], [c[0] + nx * t * s, h, c[1] + nz * t * s], [a[0] + nx * t * s, h, a[1] + nz * t * s]],
          [[uv[0], uv[1]], [uv[0] + (uv[2] - uv[0]) * Math.min(1, L / 3), uv[1]], [uv[0] + (uv[2] - uv[0]) * Math.min(1, L / 3), uv[3]], [uv[0], uv[3]]], [nx * s, 0, nz * s], colr);
      }
      walls.quad([[a[0] + nx * 0.14, h, a[1] + nz * 0.14], [c[0] + nx * 0.14, h, c[1] + nz * 0.14], [c[0] - nx * 0.14, h, c[1] - nz * 0.14], [a[0] - nx * 0.14, h, a[1] - nz * 0.14]],
        [[u0, v1 - 0.01], [u1, v1 - 0.01], [u1, v1 - 0.005], [u0, v1 - 0.005]], [0, 1, 0], new THREE.Color('#d9d3c7'));
    };
    for (const [a, c] of [...f.segs, ...f.returns]) {
      // split long walls into ~3 m panels so the block texture keeps its scale
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]); const n = Math.max(1, Math.round(L / 3));
      for (let k = 0; k < n; k++) {
        const p = [a[0] + (c[0] - a[0]) * (k / n), a[1] + (c[1] - a[1]) * (k / n)], q = [a[0] + (c[0] - a[0]) * ((k + 1) / n), a[1] + (c[1] - a[1]) * ((k + 1) / n)];
        wall(p, q, 2.1, [u0, v0, u1, vH], col);
      }
    }
    const [gu0, gv0, gu1, gv1] = atlasUV(FACADE.GATE);
    wall(f.gate[0], f.gate[1], 2.3, [gu0, gv0, gu1, gv1], new THREE.Color('#ffffff'));
  }

  buildKiosk(k, walls, roofs, signs, misc) {
    const s = Math.sin(k.yaw), c = Math.cos(k.yaw);
    const fx = s, fz = c, rx = c, rz = -s, hw = k.w / 2, hd = k.d / 2, h = 2.5;
    const P = (a, b) => [k.x + rx * a + fx * b, k.z + rz * a + fz * b];
    const paint = new THREE.Color(k.paint);
    const faces = [[P(-hw, hd), P(hw, hd), [fx, 0, fz], FACADE.SHOP[k.shop]], [P(hw, -hd), P(-hw, -hd), [-fx, 0, -fz], FACADE.PLAIN],
      [P(hw, hd), P(hw, -hd), [rx, 0, rz], FACADE.PLAIN2], [P(-hw, -hd), P(-hw, hd), [-rx, 0, -rz], FACADE.PLAIN2]];
    for (const [a, b2, n, cell] of faces) {
      const [u0, v0, u1, v1] = atlasUV(cell);
      walls.quad([[a[0], 0, a[1]], [b2[0], 0, b2[1]], [b2[0], h, b2[1]], [a[0], h, a[1]]], [[u1, v0], [u0, v0], [u0, v1], [u1, v1]], n, cell === FACADE.PLAIN || cell === FACADE.PLAIN2 ? paint : paint.clone().lerp(new THREE.Color('#fff'), 0.7));
    }
    // overhanging zinc roof + sign
    const ro = 0.45;
    const R = (a, b) => [k.x + rx * a + fx * b, k.z + rz * a + fz * b];
    const corners = [R(-hw - 0.2, hd + ro), R(hw + 0.2, hd + ro), R(hw + 0.2, -hd - 0.2), R(-hw - 0.2, -hd - 0.2)];
    const u = ROOF.RUST / 4;
    roofs.quad(corners.map((p, i) => [p[0], i < 2 ? h + 0.05 : h + 0.3, p[1]]), [[u + 0.01, 0.01], [u + 0.24, 0.01], [u + 0.24, 0.6], [u + 0.01, 0.6]], [0, 1, 0], new THREE.Color('#dddddd'));
    const si = k.sign;
    const [su0, sv0, su1, sv1] = atlasUV([si % SIGN_GRID.cols, Math.floor(si / SIGN_GRID.cols)], SIGN_GRID.cols, SIGN_GRID.rows);
    const a = P(-hw, hd + 0.03), b2 = P(hw, hd + 0.03);
    signs.quad([[a[0], h - 0.1, a[1]], [b2[0], h - 0.1, b2[1]], [b2[0], h + 0.5, b2[1]], [a[0], h + 0.5, a[1]]], [[su1, sv0], [su0, sv0], [su0, sv1], [su1, sv1]], [fx, 0, fz]);
    if (k.gen) {
      const g = k.gen;
      misc.box(g.x, g.z, 0.05, 0.55, 0.72, 0.5, g.yaw, new THREE.Color(g.color));
      misc.box(g.x, g.z, 0.55, 0.62, 0.5, 0.3, g.yaw, new THREE.Color('#222'));
    }
  }

  buildBillboard(bb, boards, misc) {
    const { ax, az, bx, bz, L, H } = bb;
    const ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux;
    const w = Math.min(8, L * 0.7), h = w / 2;
    const mx = (ax + bx) / 2 - nx * 1.4, mz = (az + bz) / 2 - nz * 1.4;
    const y0 = H + 1.7, y1 = y0 + h;
    const p0 = [mx - ux * w / 2, mz - uz * w / 2], p1 = [mx + ux * w / 2, mz + uz * w / 2];
    const i = bb.ad, cx = i % 2, cy = Math.floor(i / 2);
    const u0 = cx / 2 + 0.003, u1 = (cx + 1) / 2 - 0.003, v1 = 1 - cy / 2 - 0.003, v0 = 1 - (cy + 1) / 2 + 0.003;
    boards.quad([[p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]]], [[u1, v0], [u0, v0], [u0, v1], [u1, v1]], [nx, 0, nz]);
    const grey = new THREE.Color('#55585a');
    misc.quad([[p0[0] - nx * 0.05, y0, p0[1] - nz * 0.05], [p1[0] - nx * 0.05, y0, p1[1] - nz * 0.05], [p1[0] - nx * 0.05, y1, p1[1] - nz * 0.05], [p0[0] - nx * 0.05, y1, p0[1] - nz * 0.05]], [[0, 0], [1, 0], [1, 1], [0, 1]], [-nx, 0, -nz], grey);
    for (const t of [0.2, 0.8]) {
      const px = p0[0] + (p1[0] - p0[0]) * t - nx * 0.3, pz = p0[1] + (p1[1] - p0[1]) * t - nz * 0.3;
      misc.beam([px, H, pz], [px, y0 + 0.2, pz], 0.18, grey);
      misc.beam([px - nx * 1.2, H, pz - nz * 1.2], [px, y0 + h * 0.5, pz], 0.12, grey);
    }
  }
}

// ------------------------------------------------------------------ shared helpers
function addThinWall(col, a, c, t, h) {
  const dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.2) return;
  const nx = (dz / L) * t / 2, nz = (-dx / L) * t / 2;
  const pts = [[a[0] + nx, a[1] + nz], [c[0] + nx, c[1] + nz], [c[0] - nx, c[1] - nz], [a[0] - nx, a[1] - nz]];
  if (polyArea(pts) < 0) pts.reverse();
  col.addPolygon(pts, h);
}
function addRect(col, x, z, w, d, yaw) {
  const s = Math.sin(yaw), c = Math.cos(yaw), fx = s, fz = c, rx = c, rz = -s;
  const P = (a, b) => [x + rx * a + fx * b, z + rz * a + fz * b];
  const pts = [P(-w / 2, -d / 2), P(w / 2, -d / 2), P(w / 2, d / 2), P(-w / 2, d / 2)];
  if (polyArea(pts) < 0) pts.reverse();
  return col.addPolygon(pts, 2.5);
}
function interiorPoint(pts, cx, cz) {
  if (inPoly(cx, cz, pts)) return [cx, cz];
  for (let i = 0; i < pts.length; i++) {
    const x = (pts[i][0] + pts[(i + 2) % pts.length][0]) / 2, z = (pts[i][1] + pts[(i + 2) % pts.length][1]) / 2;
    if (inPoly(x, z, pts)) return [x, z];
  }
  return null;
}
function roofUV(tile, a, b) { return [tile / 4 + 0.004 + a * (0.25 - 0.008), 0.004 + b * 0.992]; }
function faceNormal(a, b, c) {
  const v1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const v2 = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const n = v1.cross(v2).normalize(); if (n.y < 0) n.negate();
  return [n.x, n.y, n.z];
}
function pitchedRoof(roofs, walls, box, H, tile, col, gable, paint, steep = false) {
  const ov = 0.45;
  const W = box.w / 2 + ov, D = box.d / 2 + ov;
  const rise = steep ? D * Math.tan(0.62) : Math.min(2.4, D * Math.tan(0.36));
  const P = (a, b, y) => [box.cx + box.ux * a + box.vx * b, y, box.cz + box.uz * a + box.vz * b];
  const top = H + rise, eave = H - 0.05;
  const r0 = gable ? -W : -(W - D), r1 = gable ? W : W - D;
  for (const s of [1, -1]) {
    const c = [P(-W, s * D, eave), P(W, s * D, eave), P(r1, 0, top), P(r0, 0, top)];
    roofs.quad(c, [roofUV(tile, 0, 0), roofUV(tile, 1, 0), roofUV(tile, (r1 + W) / (2 * W), 1), roofUV(tile, (r0 + W) / (2 * W), 1)], faceNormal(c[0], c[1], c[2]), col);
  }
  if (!gable) {
    for (const s of [1, -1]) {
      const a = P(s * W, -D, eave), b = P(s * W, D, eave), c = P(s * (W - D), 0, top);
      roofs.tri(a, b, c, roofUV(tile, 0, 0), roofUV(tile, 1, 0), roofUV(tile, 0.5, 1), faceNormal(a, b, c), col);
    }
  } else {
    const [u0, v0, u1, v1] = atlasUV(FACADE.PLAIN);
    for (const s of [1, -1]) {
      const a = P(s * (W - ov), -(D - ov), H - 0.02), b = P(s * (W - ov), D - ov, H - 0.02), c = P(s * (W - ov), 0, top - rise * (ov / D));
      walls.tri(a, b, c, [u0, v0], [u1, v0], [(u0 + u1) / 2, v1], [box.ux * s, 0, box.uz * s], paint);
    }
  }
  const fcol = new THREE.Color('#3b2f2a');
  const corners = [P(-W, -D, eave), P(W, -D, eave), P(W, D, eave), P(-W, D, eave)];
  const su0 = ROOF.SLAB / 4;
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    const mx = (a[0] + b[0]) / 2 - box.cx, mz = (a[2] + b[2]) / 2 - box.cz, ml = Math.hypot(mx, mz) || 1;
    roofs.quad([[a[0], eave - 0.22, a[2]], [b[0], eave - 0.22, b[2]], [b[0], eave, b[2]], [a[0], eave, a[2]]],
      [[su0 + 0.01, 0.1], [su0 + 0.2, 0.1], [su0 + 0.2, 0.2], [su0 + 0.01, 0.2]], [mx / ml, 0, mz / ml], fcol);
  }
}
function flatRoof(roofs, walls, pts, H, paint) {
  const contour = pts.map(([x, z]) => new THREE.Vector2(x, z));
  let tris;
  try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch { tris = []; }
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  const sx = Math.max(1, maxX - minX), sz = Math.max(1, maxZ - minZ);
  const col = new THREE.Color().setScalar(0.92);
  for (const [i0, i1, i2] of tris) {
    const a = pts[i0], b = pts[i1], c = pts[i2];
    const uv = (p) => roofUV(ROOF.SLAB, (p[0] - minX) / sx, (p[1] - minZ) / sz);
    roofs.tri([a[0], H, a[1]], [b[0], H, b[1]], [c[0], H, c[1]], uv(a), uv(b), uv(c), [0, 1, 0], col);
  }
  const ph = 0.75, t = 0.15;
  const [u0, v0, u1, v1] = atlasUV(FACADE.PARAPET);
  const vm = v0 + (v1 - v0) * 0.3;
  const coping = new THREE.Color('#d8d2c6');
  for (let e = 0; e < pts.length; e++) {
    const [ax, az] = pts[e], [bx, bz] = pts[(e + 1) % pts.length];
    const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
    const nx = (bz - az) / L, nz = -(bx - ax) / L;
    walls.quad([[ax, H, az], [bx, H, bz], [bx, H + ph, bz], [ax, H + ph, az]], [[u0, v0], [u1, v0], [u1, vm], [u0, vm]], [nx, 0, nz], paint);
    const ix = -nx * t, iz = -nz * t;
    walls.quad([[ax + ix, H, az + iz], [bx + ix, H, bz + iz], [bx + ix, H + ph, bz + iz], [ax + ix, H + ph, az + iz]], [[u0, v0], [u1, v0], [u1, vm], [u0, vm]], [-nx, 0, -nz], paint.clone().multiplyScalar(0.8));
    walls.quad([[ax, H + ph, az], [bx, H + ph, bz], [bx + ix, H + ph, bz + iz], [ax + ix, H + ph, az + iz]], [[u0, v1 - 0.01], [u1, v1 - 0.01], [u1, v1 - 0.005], [u0, v1 - 0.005]], [0, 1, 0], coping);
  }
}
void hashString;
