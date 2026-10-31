import { freeGeometryAfterUpload } from '../render/CanvasRelease.js';
import {VEHICLE_MODELS} from '../data/housing.js';
import {ensureNPCVehicleOwners} from '../vehicles/NPCVehicleOwners.js';
import {VEHICLE_CATALOGUE} from '../data/VehicleCatalogue.js';
import {variantGeometry} from '../vehicles/VehicleVariants.js';
import {SeatedOccupants} from '../vehicles/SeatedOccupants.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildKekeGeometry } from '../vehicles/KekeModel.js';
import { buildMinibusGeometry } from '../vehicles/MinibusModel.js';
import { executiveSedan, compactSedan, luxurySuv, lorry, coasterBus, commercialBus, PAINTS } from '../vehicles/CarModels.js';
import { mulberry32 } from '../core/utils.js';

/*
  Road traffic.
  - Ambient vehicles drive on the right along the OSM road graph, choosing a new road at every junction.
  - Public transport vehicles (TransitFleet) share the same roads and the same driving rules, but follow
    their line, pull in to the kerb at stops and dwell there. The fleet runs everywhere; vehicles far
    from the player use a cheap update (no car-following, not drawn).
  - Car-following keeps gaps; junctions are claimed one vehicle at a time, which naturally builds
    queues at busy crossings (Upper Iweka, the market roads). After a few seconds of waiting a driver
    squeezes through anyway. Drivers stuck behind a bus at a stop swing out and pass it.
  - Vehicles stop for the player and honk if kept waiting.
  - Density follows place and time: Upper Iweka and the markets are packed by day, roads thin out at night.
  - Rendering: one InstancedMesh per model, plus lamps at night, line boards on public transport and
    seated drivers/passengers in keke (the open sides make them visible).
*/

// lamp positions: [x offset of each lamp, height]
const LAMPS = { keke: [0.27, 0.7], minibus: [0.7, 0.9], executive: [0.62, 0.8], sedan: [0.58, 0.76], suv: [0.7, 1.12], bus: [0.7, 0.8], lorry: [0.85, 1.0], cbus: [0.68, 0.86] };
// line board (destination board) position on public transport: [y, z]
const BOARD = { keke: [1.62, 0.98], minibus: [2.08, 2.66], cbus: [2.36, 2.24], bus: [2.42, 3.12] };

/** Oriented rectangle overlap of two vehicles (separating axes on their two headings). */
export function obbOverlap(a, b, m = 0) {
  for (const [ax, az] of [[a.dx, a.dz], [-a.dz, a.dx], [b.dx, b.dz], [-b.dz, b.dx]]) {
    const ext = (v) => Math.abs(v.dx * ax + v.dz * az) * v.T.len / 2 + Math.abs(-v.dz * ax + v.dx * az) * v.T.wid / 2;
    if (Math.abs((b.x - a.x) * ax + (b.z - a.z) * az) > ext(a) + ext(b) + m) return false;
  }
  return true;
}
/** What a driver shouts when their vehicle is hit (Pidgin, as Onitsha drivers would). */
export const CRASH_LINES = {
  player: ['Oga! You don jam my motor!', 'Wetin be this? You no dey look road?', 'Who go pay for this dent?', 'Chai! My side mirror!', 'Park there! You go settle me today!'],
  npc: ['Ehn! Who teach you drive?', 'Oya come down make we settle am!', 'Na so una dey drive for this Onitsha?', 'You no see me? Kai!', 'Driver! You don scratch my body!'],
};
export const TYPES = {
  keke:      { len: 2.7, wid: 1.35, max: 9.5, geo: () => buildKekeGeometry(), paints: null },
  minibus:   { len: 5.3, wid: 1.95, max: 11, geo: () => buildMinibusGeometry(), paints: null },
  executive: { len: 5.0, wid: 1.9, max: 14, geo: executiveSedan, paints: PAINTS.executive },
  sedan:     { len: 4.6, wid: 1.8, max: 13, geo: compactSedan, paints: PAINTS.sedan },
  suv:       { len: 5.0, wid: 2.0, max: 13.5, geo: luxurySuv, paints: PAINTS.suv },
  bus:       { len: 7.0, wid: 2.1, max: 10.5, geo: coasterBus, paints: PAINTS.bus },
  lorry:     { len: 7.2, wid: 2.4, max: 8.5, geo: lorry, paints: PAINTS.lorry },
  cbus:      { len: 5.9, wid: 2.0, max: 11, geo: commercialBus, paints: PAINTS.cbus },
};
for(const M of VEHICLE_CATALOGUE)TYPES[M.id]={len:M.len,wid:M.wid,max:M.maxSpeed*.6,geo:()=>variantGeometry(M.id),paints:PAINTS[['suv','pickup'].includes(M.body)?'suv':['executive'].includes(M.body)?'executive':'sedan']};
TYPES.keke.paints=null;
for(const [id,M] of Object.entries(VEHICLE_MODELS))if(!TYPES[id])TYPES[id]=TYPES[M.body??id];
const PRIVATE_BY_BODY=Object.groupBy(VEHICLE_CATALOGUE,v=>v.body);
// public transport on its lines is the TransitFleet; ambient keke/buses are private hire or full
const MIX_DEFAULT = { keke: 0.22, minibus: 0.08, executive: 0.12, sedan: 0.26, suv: 0.16, bus: 0.04, lorry: 0.07, cbus: 0.05 };
const MIX_RESIDENTIAL = { keke: 0.36, minibus: 0.03, executive: 0.1, sedan: 0.31, suv: 0.18, bus: 0, lorry: 0.02, cbus: 0 };
const MIX_IWEKA = { keke: 0.16, minibus: 0.15, executive: 0.13, sedan: 0.18, suv: 0.13, bus: 0.09, lorry: 0.08, cbus: 0.08 };
const ROAD_LIMIT = { trunk: 14, trunk_link: 10, primary: 13, primary_link: 10, secondary: 12, secondary_link: 9, tertiary: 11, tertiary_link: 9, unclassified: 9, residential: 8, living_street: 5, service: 6 };
const NEAR = 300; // fleet vehicles within this distance of the focus are fully simulated and drawn

/*
  Who sits where (vehicle-local, +Z forward, +X = left; seat surface height). The driver sits on the left
  (left-hand drive). The last passenger seat of each public transport type is the one the player takes.
*/
const rows = (zs, xs, y) => zs.flatMap((z) => xs.map((x) => [x, y, z]));
export const SEATS = {
  keke: { driver: [0, 0.86, 0.12], pax: [[0.42, 0.9, -0.86], [0, 0.9, -0.86], [-0.42, 0.9, -0.86]] },
  sedan: { driver: [0.37, 0.52, 0.12], pax: [[-0.37, 0.52, 0.12], [0.37, 0.52, -0.82], [-0.37, 0.52, -0.82]] },
  executive: { driver: [0.38, 0.52, 0.22], pax: [[-0.38, 0.52, 0.22], [0.38, 0.52, -0.85], [-0.38, 0.52, -0.85]] },
  suv: { driver: [0.4, 0.78, 0.2], pax: [[-0.4, 0.78, 0.2], [0.4, 0.78, -0.82], [-0.4, 0.78, -0.82]] },
  minibus: { driver: [0.5, 1.0, 1.75], pax: rows([0.85, -0.05, -0.95, -1.85], [0.5, 0, -0.5], 1.0) },
  cbus: { driver: [0.5, 1.05, 1.95], pax: rows([1.0, 0.1, -0.8, -1.7], [0.5, 0, -0.5], 1.05) },
  bus: { driver: [0.55, 1.1, 2.65], pax: rows([1.7, 0.8, -0.1, -1.0, -1.9, -2.8], [0.55, 0.05, -0.55], 1.1) },
};
SEATS.lorry={driver:[.5,1.1,2.55],pax:[[-.5,1.1,2.55]]};
// Seat positions follow each remodelled silhouette and its actual cabin height.
for(const M of VEHICLE_CATALOGUE){
 if(M.id==='keke')continue;
 const base=SEATS[M.body==='pickup'?'suv':M.body];
 if(M.body==='motorcycle'){SEATS[M.id]={driver:[0,.96,-.1],pax:[[0,.96,-.55]]};continue;}
 if(!base)continue;
 const baseT=TYPES[M.body==='pickup'?'suv':M.body];
 const sy=['sedan','executive','suv','pickup'].includes(M.body)?Math.max(.35,M.height-.98):base.driver[1];
 const adjust=([x,y,z])=>[x*M.wid/baseT.wid,sy+(y-base.driver[1]),z*M.len/baseT.len];
 SEATS[M.id]={driver:adjust(base.driver),pax:base.pax.map(adjust)};
}
for(const [id,M]of Object.entries(VEHICLE_MODELS))if(!SEATS[id])SEATS[id]=SEATS[M.body??id];
/** Colours of the glass parts in the vehicle models (split off into a see-through mesh). */
const GLASS_COLORS = ['#1d2730', '#22313a', '#2b3a44'].map((h) => new THREE.Color(h));

/** Split a vertex-coloured, non-indexed geometry into [opaque, glass] by vertex colour. */
export function splitGlass(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position.array, nor = g.attributes.normal?.array, col = g.attributes.color?.array;
  if (!col) return [g, null];
  const isGlass = (i) => GLASS_COLORS.some((c) => Math.abs(col[i * 3] - c.r) < 0.0006 && Math.abs(col[i * 3 + 1] - c.g) < 0.0006 && Math.abs(col[i * 3 + 2] - c.b) < 0.0006);
  const a = { p: [], n: [], c: [] }, b = { p: [], n: [], c: [] };
  const n = pos.length / 3;
  for (let t = 0; t < n; t += 3) {
    const dst = isGlass(t) ? b : a;
    for (let k = t; k < t + 3; k++) {
      dst.p.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
      if (nor) dst.n.push(nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]);
      dst.c.push(col[k * 3], col[k * 3 + 1], col[k * 3 + 2]);
    }
  }
  const mk = (d) => { if (!d.p.length) return null; const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(d.p, 3)); if (d.n.length) o.setAttribute('normal', new THREE.Float32BufferAttribute(d.n, 3)); else o.computeVertexNormals(); o.setAttribute('color', new THREE.Float32BufferAttribute(d.c, 3)); o.computeBoundingSphere(); return o; };
  return [mk(a), mk(b)];
}
export const GLASS_MATERIAL = () => new THREE.MeshStandardMaterial({ color: '#33424d', transparent: false, opacity: 1, roughness: 0.22, metalness: 0.25, depthWrite: true, side: THREE.DoubleSide });

export class TrafficSystem {
  constructor(scene, graph, { landmarks, districts = null, quality = 'medium' } = {}) {
    this.districts = districts;
    this.scene = scene; this.graph = graph; this.landmarks = landmarks;
    this.rng = mulberry32(99);
    this.vehicles = [];
    this.fleet = null;
    this.near = [];
    this.obstacles = []; // the player's own vehicles (parked or driven): traffic keeps clear of them
    this.locks = new Map();     // junction node -> {id, t}
    this.time = 0;
    this.setQuality(quality);
    this.meshes = {};
    this.group = new THREE.Group(); this.group.name = 'Traffic';
    this.glass = {};
    for (const [k, t] of Object.entries(TYPES)) {
      const src = t.geo(), [bodyGeo, glassGeo] = splitGlass(src);
      // v0.55: these copies are only drawn (instanced, never picked): their arrays go once on the graphics card (~20 MB)
      for (const q of [bodyGeo, glassGeo]) if (q && q !== src) freeGeometryAfterUpload(q);
      const m = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.27, metalness: 0.45 }), this.capacity);
      m.count = 0; m.castShadow = true; m.frustumCulled = false; m.name = 'traffic:' + k;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      this.meshes[k] = m; this.group.add(m);
      if (glassGeo) { // see-through windows, so drivers and passengers show
        const gm = new THREE.InstancedMesh(glassGeo, GLASS_MATERIAL(), this.capacity);
        gm.count = 0; gm.frustumCulled = false; gm.renderOrder = 2; gm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.glass[k] = gm; this.group.add(gm);
      }
    }
    // night lighting: lamp lenses (instanced) and a soft light pool on the road ahead
    const lens = new THREE.BoxGeometry(0.26, 0.14, 0.05);
    this.headLamps = new THREE.InstancedMesh(lens, new THREE.MeshBasicMaterial({ color: '#fff6dc' }), this.capacity * 2);
    this.tailLamps = new THREE.InstancedMesh(lens, new THREE.MeshBasicMaterial({ color: '#ff2a1a' }), this.capacity * 2);
    const poolTex = (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
      const grd = g.createRadialGradient(32, 110, 4, 32, 70, 70);
      grd.addColorStop(0, 'rgba(255,240,200,0.9)'); grd.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 64, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const poolGeo = new THREE.PlaneGeometry(4.2, 13); poolGeo.rotateX(-Math.PI / 2); poolGeo.translate(0, 0.12, 8);
    this.pools = new THREE.InstancedMesh(poolGeo, new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 }), this.capacity);
    // public transport line boards and keke occupants
    this.boards = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.2, 0.05), new THREE.MeshBasicMaterial({ color: '#ffffff' }), this.capacity);
    this.occupants=new SeatedOccupants(this.group,180);
    for (const m of [this.headLamps,this.tailLamps,this.pools,this.boards]){m.count=0;m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.group.add(m);}
    this.boards.setColorAt(0,new THREE.Color(1,1,1));
    this.night = 0;
    this._e = new THREE.Euler(0, 0, 0, 'YXZ'); this._lm = new THREE.Matrix4(); this._lp = new THREE.Vector3();
    scene.add(this.group);
    this._m4 = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this._up = new THREE.Vector3(0, 1, 0); this._c = new THREE.Color();
    this.hornEvents = []; this.crashEvents = [];
    this.nextId = 1;
    this.SKIN = ['#3b2219', '#4a2c1f', '#5c3a24', '#6b4430', '#7d5238', '#8d6142'].map((c) => new THREE.Color(c));
    this.CLOTH = ['#c0392b', '#1d4e89', '#f1c40f', '#2e7d32', '#f4f1ea', '#6a1b9a', '#e67e22', '#263238', '#00838f'].map((c) => new THREE.Color(c));
  }

  setQuality(q) {
    this.quality=q;
    this.base = { low: 26, medium: 48, high: 75 }[q] ?? 48;
    this.capacity = 170;
  }

  setOwnershipState(world){this.residentOwners=ensureNPCVehicleOwners(world);}

  /** Public transport: the fleet's vehicles join the traffic. */
  attachFleet(fleet) {
    this.fleet = fleet;
    fleet.populate((line, D) => {
      const T = TYPES[line.M.traffic];
      const v = { id: this.nextId++, type: line.M.traffic, T, color: new THREE.Color(T.paints ? T.paints[Math.floor(this.rng() * T.paints.length)] : '#ffffff'),
        boardColor: new THREE.Color(line.color), edge: null, fwd: true, s: 0, lat: 0, speed: 0, limit: T.max, x: 0, y: 0, z: 0, pitch: 0, dx: 0, dz: 1, yaw: 0, wait: 0, honkT: 0, persistent: true };
      this.placeOnLine(v, line, D);
      return v;
    });
  }

  /** Put a fleet vehicle at distance D round its loop (also used to bring a vehicle to a waiting player). */
  placeOnLine(v, line, D) {
    const { i, s } = this.fleet ? this.fleet.net.locate(line, D) : { i: 0, s: 0 };
    const { edge, fwd } = line.path[i];
    v.edge = edge; v.fwd = fwd; v.s = s; if (v.transit) v.transit.leg = i;
    v.lat = this.laneOffset(edge, v.type); v.latT = v.lat;
    v.limit = this.limitFor(v, edge);
    const p = this.graph.pointAt(edge, fwd, s, v.lat);
    v.x = p.x; v.z = p.z; v.dx = p.dx; v.dz = p.dz; v.yaw = Math.atan2(p.dx, p.dz);
    v.y = this.graph.heightAt(edge, fwd, s); v.speed = 0;
  }

  limitFor(v, edge) { return Math.min(v.T.max, ROAD_LIMIT[edge.road.type] ?? 9) * (edge.road.surface === 'dirt' ? 0.65 : 1) * (0.85 + this.rng() * 0.25); }

  /** How busy this spot should be (1 = normal). */
  crowdFactor(x, z, hour) {
    const day = hour >= 6.5 && hour < 20 ? 1 : hour >= 5.5 && hour < 6.5 ? 0.6 : hour >= 20 && hour < 22.5 ? 0.6 : 0.25;
    let k = 1;
    for (const l of this.landmarks.list) {
      const d = Math.hypot(x - l.x, z - l.z);
      if (l.id === 'upper-iweka' && d < l.radius * 1.6) k = Math.max(k, 2.1);
      else if ((l.kind === 'market' || l.kind === 'bridgehead' || l.id === 'upper-iweka-park') && d < l.radius * 1.3) k = Math.max(k, 1.5);
    }
    return k * day * (this.timeK ?? 1); // timeK: rush hours, Sundays, rain (set by the game)
  }

  pickType(edge, x, z) {
    const iw = this.landmarks.get('upper-iweka');
    let mix = edge.major ? MIX_DEFAULT : MIX_RESIDENTIAL;
    if (iw && Math.hypot(x - iw.x, z - iw.z) < iw.radius * 1.6) mix = MIX_IWEKA;
    let r = this.rng();
    for (const [k, p] of Object.entries(mix)) { r -= p; if (r <= 0) { const pool = PRIVATE_BY_BODY[k] ?? []; return pool.length ? this.pickModel(pool, x, z) : k; } }
    return 'sedan';
  }

  /**
   * v0.48: which model of a body type. Premium cars are rare (about 1 in 12 of their kind) except in the wealthier
   * parts of town (around Onitsha Mall, and GRA once it is in the map), where they are common.
   */
  wealthAt(x, z) {
    this._wealth ??= ['shoprite', 'gra', 'gra2'].map((id) => this.landmarks.get(id)).filter(Boolean).map((l) => ({ x: l.x, z: l.z, r: l.id === 'shoprite' ? 450 : 700 }));
    return this._wealth.some((q) => Math.hypot(q.x - x, q.z - z) < q.r) || (this.districts?.premiumAt(x, z) ?? 0) > 0.5; // GRA from the map (v0.48)
  }
  pickModel(pool, x, z) {
    const rich = this.wealthAt(x, z); let total = 0; const w = pool.map((m) => { const v = m.premium ? (rich ? 0.9 : 0.09) : 1; total += v; return v; });
    let r = this.rng() * total; for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i].id; } return pool[0].id;
  }

  laneOffset(edge, type) {
    const w = edge.road.width;
    if (edge.road.oneway) return 0;
    return Math.min(w / 4 + (type === 'keke' ? 0.35 : 0), 2.8);
  }
  /** Lateral position when pulled in to the kerb at a stop. */
  kerbOffset(edge, v) {
    const w = edge.road.width;
    return Math.max(this.laneOffset(edge, v.type), w / 2 - v.T.wid / 2 - 0.2);
  }

  spawn(px, pz, hour, all) {
    const ring = this.graph.edgesNear(px, pz, 210, 45, (e) => e.drivable && e.len > 8);
    if (!ring.length) return false;
    // weight edges by road class and local crowd level
    let total = 0; const w = ring.map((e) => { const [ax, az] = this.graph.nodes[e.a]; const v = (e.major ? 3 : 1) * this.crowdFactor(ax, az, hour); total += v; return v; });
    let r = this.rng() * total, e = ring[0];
    for (let i = 0; i < ring.length; i++) { r -= w[i]; if (r <= 0) { e = ring[i]; break; } }
    const fwd = e.road.oneway ? true : this.rng() < 0.5;
    const s = this.rng() * e.len;
    let type = this.pickType(e, ...this.graph.nodes[e.a]);
    if(this.rng()<.05)type='motorcycle';else if(this.rng()<.04)type='toyota_hilux';
    const police=this.vehicles.filter(v=>v.police).length<2;if(police)type='toyota_hilux';
    const ambulance=!police&&TYPES.mercedes_sprinter&&!this.vehicles.some(v=>v.ambulance)&&this.rng()<.08;if(ambulance)type='mercedes_sprinter';
    const lat = this.laneOffset(e, type);
    const p = this.graph.pointAt(e, fwd, s, lat);
    for (const v of all) if (Math.hypot(v.x - p.x, v.z - p.z) < 10) return false;
    for (const v of this.obstacles) if (Math.hypot(v.x - p.x, v.z - p.z) < 10) return false;
    if (Math.hypot(p.x - px, p.z - pz) < 30) return false;
    const T = TYPES[type];
    const paint = T.paints ? T.paints[Math.floor(this.rng() * T.paints.length)] : '#ffffff';
    const y = this.graph.heightAt(e, fwd, s);
    const owner=this.residentOwners?.find(o=>o.model===type&&!this.vehicles.some(v=>v.ownerId===o.id));
    if(this.residentOwners&&!owner&&!police&&!ambulance)return false;
    const ownerId=owner?.id??('resident-driver:'+this.nextId);
    const v = { police, ambulance, ownerId:police?'police-patrol:'+this.nextId:ambulance?'ambulance:'+this.nextId:ownerId, model:type, ownership:police?'police':ambulance?'ambulance':'npc', id: this.nextId++, type, T, color: new THREE.Color(police||ambulance?'#f3f5f4':owner?.paint??paint), edge: e, fwd, s, lat, latT: lat, speed: 0, limit: 0, x: p.x, y, z: p.z, pitch: 0, dx: p.dx, dz: p.dz, yaw: Math.atan2(p.dx, p.dz), wait: 0, honkT: 0, prevNode: -1, passT: 0 };
    v.limit = this.limitFor(v, e); v.speed = v.limit * 0.6;
    this.vehicles.push(v);
    return true;
  }

  /** Called every frame while playing (or in menus with the camera focus). player = {x,z} on foot, or null. */
  update(dt, focus, hour, player, peds = []) {
    this.focus={x:focus.x,z:focus.z};
    this.time += dt;
    const target = Math.round(this.base * this.crowdFactor(focus.x, focus.z, hour));
    // despawn far ambient vehicles; the fleet persists
    // (and ambient cars stuck for a long time away from the player simply leave, so jams can't build up)
    this.vehicles = this.vehicles.filter((v) => { const d = Math.hypot(v.x - focus.x, v.z - focus.z); return d < 280 && !(v.wait > 45 && d > 60); });
    const fleet = this.fleet?.vehicles ?? [];
    const nearFleet = [], farFleet = [];
    for (const v of fleet) (Math.abs(v.x - focus.x) < NEAR && Math.abs(v.z - focus.z) < NEAR ? nearFleet : farFleet).push(v);
    const V = this.near = this.vehicles.concat(nearFleet);
    for (let k = 0; k < 3 && this.vehicles.length < Math.min(target, this.capacity - nearFleet.length); k++) this.spawn(focus.x, focus.z, hour, V);

    for (const v of farFleet) this.updateFar(v, dt);
    const VO = this.obstacles.length ? V.concat(this.obstacles) : V; // car-following also sees the player's vehicles
    for (const v of V) this.updateNear(v, dt, VO, player, peds);
    this.separate(V);
    this.detectCrashes(V);
    this.render();
  }

  /**
   * Time skipped (a skipped ride or drive, a sleep): the city moves on. Buses and kekes carry on round
   * their routes at their usual average pace (dwell at stops included) with new passengers, and the
   * cars around you are replaced by fresh traffic. The vehicle you're riding in is left to the ride skip.
   */
  fastForward(minutes) {
    if (!(minutes > 0)) return;
    const secs = minutes * 60;
    for (const v of this.fleet?.vehicles ?? []) {
      if (v.transit.player) continue;
      const line = v.transit.line;
      const D = (this.fleet.D(v) + v.limit * 0.45 * secs) % line.length;
      this.placeOnLine(v, line, D);
      const riders = v.transit.riders.length;
      v.transit = this.fleet.newState(line, D);
      for (let i = 0; i < riders; i++) v.transit.riders.push(this.fleet.randomDest(line, v.transit.occIdx - 1));
      v.wait = 0;
    }
    this.vehicles = [];
  }

  /** Cheap update for fleet vehicles out of sight: keep to the timetable, no interactions. */
  updateFar(v, dt) {
    let want = this.fleet.control(v, dt, v.limit * 0.8);
    v.speed = want; v.s += want * dt;
    this.advanceEdges(v);
    const sc = Math.min(v.s, v.edge.len);
    const p = this.graph.pointAt(v.edge, v.fwd, sc, v.lat);
    v.x = p.x; v.z = p.z; v.dx = p.dx; v.dz = p.dz; v.yaw = Math.atan2(p.dx, p.dz);
    v.y = this.graph.heightAt(v.edge, v.fwd, sc); v.pitch = 0;
  }

  updateNear(v, dt, V, player, peds) {
    if (v.scripted) { v.scripted.step?.(v, dt); return; } // v0.48: driving through a terminal yard (Terminals.js)
    const g = this.graph;
    // ---- desired speed
    let want = v.limit;
    v.why = null; // what is holding this vehicle back (debugging jams): a vehicle id, 'player', 'ped' or 'junction'
    const endNode = g.endNode(v.edge, v.fwd);
    const toEnd = v.edge.len - v.s;
    const isJunction = g.degree(endNode) >= 3;
    // v0.49: traffic lights and wardens (TrafficControl): stop at the line on red, and on amber when there is room to
    const sig = this.control?.state(endNode, v.edge, v.fwd);
    if (sig) {
      const stopD = toEnd - sig.stop;
      if (stopD > -0.5 && (sig.light === 'red' || (sig.light === 'amber' && stopD > v.speed * v.speed / 9 + 1.5))) { want = Math.min(want, Math.max(0, (stopD - 0.6) * 0.9)); v.why = 'light'; }
    } else if (isJunction && toEnd < 14) {
      want = Math.min(want, 5.5);
      const lock = this.locks.get(endNode);
      if (v.wait > 5) v.junctionT = 3; // waited long enough: go anyway
      if (v.junctionT > 0) v.junctionT -= dt;
      if (lock && lock.id !== v.id && this.time - lock.t < 4.5) {
        if (!(v.junctionT > 0)) { want = Math.min(want, Math.max(0, (toEnd - 6) * 0.8)); v.why = 'junction'; }
      } else if (toEnd < 10 && (lock?.id !== v.id || v.speed > 1)) this.locks.set(endNode, { id: v.id, t: this.time }); // a stationary holder lets its claim expire
    }
    // ---- v0.49: never drive into a junction that another vehicle is crossing (they're already in it)
    if (isJunction && toEnd < 22) {
      const [nx0, nz0] = g.nodes[endNode], box = sig?.stop ?? 8, stopD = toEnd - box;
      if (stopD > 0.3 && !(v.wait > 12 && (!player || Math.hypot(player.x - v.x, player.z - v.z) > 40))) {
        for (const o of V) {
          if (o === v || Math.abs(o.y - v.y) > 2.5) continue;
          const dn = Math.hypot(o.x - nx0, o.z - nz0); if (dn > box) continue;
          if (o.dx * v.dx + o.dz * v.dz > 0.85 && o.speed > 0.5) continue; // going our way, ahead of us: car following handles it
          want = Math.min(want, Math.max(0, (stopD - 0.6) * 0.9)); v.why = v.why ?? 'box'; break;
        }
      }
    }
    // ---- car following (anything roughly ahead in our lane)
    // Gridlock breakers: junction queues can form cycles (A waits for B waits for … A). After a few
    // seconds a driver squeezes past crossing/oncoming traffic, as Onitsha drivers do; after a long
    // wait out of the player's close view the vehicle creeps through whatever is in front.
    if (v.wait > 4) v.edgeT = 4;   // honked long enough: edge past people standing in the road
    if (v.wait > 8) v.squeezeT = 4;
    if (v.wait > 30 && (!player || Math.hypot(player.x - v.x, player.z - v.z) > 50)) v.ghostT = 5;
    if (v.squeezeT > 0) v.squeezeT -= dt;
    if (v.edgeT > 0) v.edgeT -= dt;
    if (v.ghostT > 0) v.ghostT -= dt;
    const patient = v.squeezeT > 0, ghost = v.ghostT > 0;
    let gap = Infinity;
    for (const o of V) {
      if (ghost) break;
      if (o === v || Math.abs(o.y - v.y) > 2.5) continue; // deck traffic vs traffic underneath
      if (patient && o.dx * v.dx + o.dz * v.dz < 0.5 && o.speed < 0.5 && Math.hypot(o.x - v.x, o.z - v.z) > (v.T.len + o.T.len) / 2 + 1.5) continue; // v0.49: never squeeze into a vehicle right next to you
      // two drivers at a merge each waiting for the other: the lower id goes first
      if (o.why === v.id && v.wait > 3 && v.id < o.id) continue;
      const rx = o.x - v.x, rz = o.z - v.z;
      const ahead = rx * v.dx + rz * v.dz;
      if (ahead <= 0 || ahead > 22) continue;
      const side = Math.abs(rx * -v.dz + rz * v.dx);
      // v0.49: anything close in front counts, wherever its lane is (a car that has just turned out of our way is
      // still in front of our bumper)
      const close = ahead < (v.T.len + o.T.len) / 2 + 3 && side < (v.T.wid + o.T.wid) / 2 + 0.6;
      if (side > 1.9 && !close) continue;
      if (o.dx * v.dx + o.dz * v.dz < -0.3 && side > 1.0 && !close) continue; // oncoming in the other lane
      // stuck behind a bus/keke loading at a stop: swing out and pass it
      if (o.transit && o.transit.dwell > 0 && !v.transit && v.wait > 1.2 && !v.edge.road.oneway) { v.passT = 4; continue; }
      if (v.passT > 0 && o.transit?.dwell > 0) continue;
      const gg = ahead - (v.T.len + o.T.len) / 2; if (gg < gap) { gap = gg; v.why = o.id; }
    }
    // ---- the player (on foot)
    if (player && v.y < 1.5) {
      const rx = player.x - v.x, rz = player.z - v.z;
      const ahead = rx * v.dx + rz * v.dz, side = Math.abs(rx * -v.dz + rz * v.dx);
      // directly in front: wait and honk; standing at the side of a narrow street: honk, then edge past
      const inFront = side < v.T.wid / 2 - 0.15;
      if (ahead > 0 && ahead < 14 && side < v.T.wid / 2 + 0.9 && (inFront || !(v.edgeT > 0))) {
        gap = Math.min(gap, ahead - v.T.len / 2 - 0.6); v.why = 'player';
        if (ahead < 9 && v.speed < 1 && this.time > v.honkT) { v.honkT = this.time + 3 + this.rng() * 3; this.hornEvents.push({ x: v.x, z: v.z }); }
      }
    }
    if (v.y < 1.5 && !(v.edgeT > 0) && !patient) for (const p of peds) { // pedestrians in the lane (crossing at junctions, walking the edge); after a few seconds of horn the driver edges past
      const rx = p.x - v.x, rz = p.z - v.z;
      const ahead = rx * v.dx + rz * v.dz;
      if (ahead <= 0 || ahead > 9) continue;
      if (Math.abs(rx * -v.dz + rz * v.dx) < v.T.wid / 2 + 0.4) { gap = Math.min(gap, ahead - v.T.len / 2 - 0.5); v.why = 'ped'; }
    }
    if (gap < Infinity) want = Math.min(want, Math.max(0, Math.min((gap - 2.2) * 1.1, Math.sqrt(2 * 5 * Math.max(0, gap - 2.2))))); // v0.49: never faster than it can stop in
    if (v.crash && this.time < v.crash.until) { want = 0; v.why = 'crash'; if (v.crash.honks > 0 && this.time > v.honkT) { v.crash.honks--; v.honkT = this.time + 0.45 + this.rng() * 0.4; this.hornEvents.push({ x: v.x, z: v.z }); } }
    else if (v.crash) v.crash = null;
    // ---- stops (public transport)
    if (v.transit) want = this.fleet.control(v, dt, want);
    if(this.policeControl)want=this.policeControl(v,want,dt);
    // ---- integrate
    const acc = want > v.speed ? 2.6 : 7;
    v.speed += Math.sign(want - v.speed) * Math.min(Math.abs(want - v.speed), acc * dt);
    if (v.transit?.dwell > 0) v.speed = 0;
    v.wait = v.speed < 0.3 && !(v.transit?.dwell > 0) ? v.wait + dt : 0;
    if (v.passT > 0) v.passT -= dt;
    if (v.wait > 1.5 && v.type === 'keke' && this.time > v.honkT && this.rng() < 0.0006) { v.honkT = this.time + 4; this.hornEvents.push({ x: v.x, z: v.z }); }
    v.s += v.speed * dt;
    this.advanceEdges(v);
    // ---- lateral: lane, pulling in to the kerb, passing
    let latT = v.transit && this.fleet.pullingIn(v) ? this.kerbOffset(v.edge, v) : this.laneOffset(v.edge, v.type);
    if (v.passT > 0) latT -= 1.7;
    v.lat += (latT - v.lat) * (1 - Math.exp(-2.2 * dt));
    const sc = Math.min(v.s, v.edge.len);
    const p = g.pointAt(v.edge, v.fwd, sc, v.lat);
    // height + nose pitch on bridge ramps
    const h0 = g.heightAt(v.edge, v.fwd, sc), h1 = g.heightAt(v.edge, v.fwd, Math.min(v.edge.len, sc + 2));
    v.y += (h0 - v.y) * (1 - Math.exp(-12 * dt));
    v.pitch = -Math.atan2(h1 - h0, Math.min(2, v.edge.len - sc) || 2);
    // smooth position/heading so corners don't snap
    const k = 1 - Math.exp(-10 * dt);
    v.x += (p.x - v.x) * k; v.z += (p.z - v.z) * k;
    const yaw = Math.atan2(p.dx, p.dz);
    let d = yaw - v.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    v.yaw += d * Math.min(1, 6 * dt);
    v.dx = Math.sin(v.yaw); v.dz = Math.cos(v.yaw);
  }

  /** Move on to the next edge(s): along the line for public transport, a free choice otherwise. */
  advanceEdges(v) {
    const g = this.graph;
    let guard = 0;
    while (v.s > v.edge.len && guard++ < 6) {
      v.s -= v.edge.len;
      const node = g.endNode(v.edge, v.fwd);
      const lock = this.locks.get(node); if (lock && lock.id === v.id) this.locks.delete(node);
      if (v.transit) {
        const t = v.transit, path = t.line.path;
        t.leg = (t.leg + 1) % path.length;
        v.edge = path[t.leg].edge; v.fwd = path[t.leg].fwd;
        v.limit = this.limitFor(v, v.edge);
        continue;
      }
      const opts = g.options(node, v.edge, { vehicle: true });
      if (!opts.length) { v.fwd = !v.fwd; v.s = 0; break; }
      // prefer staying on bigger roads, avoid sharp U-turns
      let best = null, bestScore = -Infinity;
      for (const o of opts) {
        const ndx = o.fwd ? o.edge.dx : -o.edge.dx, ndz = o.fwd ? o.edge.dz : -o.edge.dz;
        const straight = ndx * v.dx + ndz * v.dz;
        const score = straight * 0.6 + (o.edge.major ? 0.5 : 0) + this.rng() * 1.4 - (o.edge === v.edge ? 3 : 0);
        if (score > bestScore) { bestScore = score; best = o; }
      }
      v.edge = best.edge; v.fwd = best.fwd;
      v.limit = this.limitFor(v, v.edge);
    }
  }

  /** World matrix of a vehicle into this._m4. */
  vehicleMatrix(v) {
    this._e.set(v.pitch, v.yaw, 0);
    this._q.setFromEuler(this._e);
    return this._m4.compose(this._p.set(v.x, v.y, v.z), this._q, this._s);
  }

  /** Local → world for a point on a vehicle (seat positions, doors). */
  localToWorld(v, lx, ly, lz, out = new THREE.Vector3()) {
    return out.set(lx, ly, lz).applyMatrix4(this.vehicleMatrix(v));
  }

  render() {
    const counts = {};
    for (const k of Object.keys(this.meshes)) counts[k] = 0;
    let nb = 0, nf = 0;
    const V = this.near;this.occupants.begin();
    for (const v of V) {
      if (v.hidden) continue;
      const m = this.meshes[v.type]; const i = counts[v.type]++;
      if (i >= this.capacity) continue;
      this.vehicleMatrix(v);
      m.setMatrixAt(i, this._m4);
      m.setColorAt(i, v.color);
      this.glass[v.type]?.setMatrixAt(i, this._m4);
      // line board on public transport
      if (v.transit && BOARD[v.type]) {
        const [by, bz] = BOARD[v.type];
        this._lm.makeTranslation(0, by, bz); this._lm.premultiply(this._m4);
        this.boards.setMatrixAt(nb, this._lm); this.boards.setColorAt(nb, v.boardColor); nb++;
      }
      // Real supplied characters, baked and instanced. Hide occupants beyond the local detail radius.
      const S=SEATS[v.type],focus=this.focus??{x:v.x,z:v.z};
      const detailRange={low:55,medium:80,high:105}[this.quality]??80;
      if(S&&Math.hypot(v.x-focus.x,v.z-focus.z)<detailRange){
        const r=mulberry32(v.id*977),slots=v.transit?.player?S.pax.slice(0,-1):S.pax;
        const pax=v.transit?v.transit.riders.length:v.type==='keke'?Math.floor(r()*4):Math.floor(r()*r()*(S.pax.length>3?9:3));
        const seats=[S.driver,...slots.slice(0,Math.min(pax,slots.length))];
        for(let j=0;j<seats.length;j++)this.occupants.add(this._m4,seats[j],v.id*7+j,{bike:v.type==='motorcycle'});
      }
    }
    this.occupants.end();this.boards.count=nb;this.boards.instanceMatrix.needsUpdate=true;if(this.boards.instanceColor)this.boards.instanceColor.needsUpdate=true;
    // lamps after dark
    let nl = 0, np = 0;
    const blinkOn = Math.floor(this.time * 2.4) % 2 === 0, crashed = V.filter((v) => v.crash && blinkOn);
    if (this.night > 0.3 || crashed.length) {
      for (const v of (this.night > 0.3 ? V.concat(this.obstacles.filter((o) => o.lit)) : crashed)) {
        if (v.hidden || nl >= this.capacity * 2 - 2) continue;
        const [lx, ly] = LAMPS[v.type] ?? [0.6, 0.8];
        this.vehicleMatrix(v);
        for (const sx of [-lx, lx]) {
          this._lm.makeTranslation(sx, ly, v.T.len / 2 + 0.04); this._lm.premultiply(this._m4); this.headLamps.setMatrixAt(nl, this._lm);
          this._lm.makeTranslation(sx * 1.05, ly + 0.05, -v.T.len / 2 - 0.04); this._lm.premultiply(this._m4); this.tailLamps.setMatrixAt(nl, this._lm);
          nl++;
        }
        if (np < this.capacity) { this._lm.makeTranslation(0, 0, v.T.len / 2 - 2); this._lm.premultiply(this._m4); this.pools.setMatrixAt(np++, this._lm); }
      }
    }
    this.headLamps.count = this.tailLamps.count = nl; this.pools.count = np;
    for (const m of [this.headLamps, this.tailLamps, this.pools]) m.instanceMatrix.needsUpdate = true;
    for (const [k, m] of Object.entries(this.meshes)) {
      m.count = Math.min(counts[k], this.capacity);
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      const gm = this.glass[k]; if (gm) { gm.count = m.count; gm.instanceMatrix.needsUpdate = true; gm.visible = m.count > 0; }
      m.visible = m.count > 0; // an empty instanced mesh would still cost a draw call and its state changes
    }
    for (const m of [this.headLamps, this.tailLamps, this.pools, this.boards]) m.visible = m.count > 0;
  }

  /** Push a circle (the player, or a part of the player's car) out of any vehicle body. */
  pushOut(pos, r, skip = null, y = 0) {
    let hitV = null;
    const list = this.obstacles.length ? this.near.concat(this.obstacles) : this.near;
    for (const v of list) {
      if (v === skip) continue;
      const rx = pos.x - v.x, rz = pos.z - v.z;
      if (rx * rx + rz * rz > 36 || Math.abs(v.y - y) > 1.5) continue;
      const along = rx * v.dx + rz * v.dz, side = rx * -v.dz + rz * v.dx;
      const hl = v.T.len / 2 + r, hw = v.T.wid / 2 + r;
      if (Math.abs(along) < hl && Math.abs(side) < hw) {
        const pa = hl - Math.abs(along), ps = hw - Math.abs(side);
        if (ps < pa) { const s = Math.sign(side) || 1; pos.x += -v.dz * s * ps; pos.z += v.dx * s * ps; }
        else { const s = Math.sign(along) || 1; pos.x += v.dx * s * pa; pos.z += v.dz * s * pa; }
        hitV = v;
      }
    }
    return hitV;
  }

  /**
   * A driver whose vehicle is hit (by another driver or the player) reacts: brakes hard, puts the hazard lights
   * on, leans on the horn and shouts, then drives on after a few seconds. `by` is 'player' or 'npc'.
   */
  hit(v, by = 'npc', strength = 1) {
    if (!v || v.transit?.player) return false;
    if (v.crash && this.time < v.crash.until) { v.crash.until = Math.max(v.crash.until, this.time + 2); return false; }
    const lines = by === 'player' ? CRASH_LINES.player : CRASH_LINES.npc;
    v.crash = { by, at: this.time, until: this.time + 4 + this.rng() * 3 + Math.min(3, strength), honks: 2 + Math.floor(this.rng() * 3), line: lines[Math.floor(this.rng() * lines.length)] };
    v.speed *= 0.2; v.honkT = 0; this.crashCount = (this.crashCount ?? 0) + 1;
    this.crashEvents.push({ x: v.x, z: v.z, by, id: v.id });
    return true;
  }
  /**
   * v0.49: vehicles never drive through each other. If two bodies touch, the one behind (seen from its own
   * heading) is held back along its road and slowed to below the other's speed, so the overlap is undone at once.
   */
  separate(V) {
    for (let i = 0; i < V.length; i++) {
      const a = V[i]; if (a.hidden || a.ghostT > 0 || a.scripted) continue;
      for (let j = i + 1; j < V.length; j++) {
        const b = V[j]; if (b.hidden || b.ghostT > 0 || b.scripted || Math.abs(a.y - b.y) > 1.5) continue;
        const dx = b.x - a.x, dz = b.z - a.z, r = (a.T.len + b.T.len) / 2 + 0.3; if (dx * dx + dz * dz > r * r) continue;
        if (!obbOverlap(a, b, 0.12)) continue;
        const aheadOfA = dx * a.dx + dz * a.dz, aheadOfB = -dx * b.dx - dz * b.dz;
        const f = aheadOfA >= aheadOfB ? a : b, l = f === a ? b : a; // f: the follower (the other is more in front of it)
        if (f.transit?.player) continue;
        const push = 0.35;
        f.s = Math.max(0, f.s - push); f.x -= f.dx * push; f.z -= f.dz * push;
        f.speed = Math.min(f.speed, l.speed * 0.5); f.held = (f.held ?? 0) + 1;
      }
    }
  }
  /** NPC vehicles that actually overlap (squeezing, cutting in at a junction): both drivers react. */
  detectCrashes(V) {
    for (let i = 0; i < V.length; i++) {
      const a = V[i]; if (a.hidden || a.ghostT > 0) continue;
      for (let j = i + 1; j < V.length; j++) {
        const b = V[j]; if (b.hidden || b.ghostT > 0 || Math.abs(a.y - b.y) > 1.5) continue;
        const dx = b.x - a.x, dz = b.z - a.z, r = (a.T.len + b.T.len) / 2; if (dx * dx + dz * dz > r * r) continue;
        if (Math.max(a.speed, b.speed) < 2.5 || !obbOverlap(a, b, 0.05)) continue;
        if (this.time - (a.crash?.at ?? -99) < 8 || this.time - (b.crash?.at ?? -99) < 8) continue;
        this.hit(a, 'npc', a.speed / 4); this.hit(b, 'npc', b.speed / 4);
      }
    }
  }
  /** Speech bubbles for drivers who were just hit (shown for 3.5 s). */
  crashBubbles() { const out = []; for (const v of this.near) if (v.crash && this.time - v.crash.at < 3.5) out.push({ v, text: v.crash.line }); return out; }
  takeCrashes() { const c = this.crashEvents; this.crashEvents = []; return c; }

  /** Is a spot clear of every vehicle body (with margin)? */
  isClear(x, z, margin = 0.4) {
    for (const v of this.near) {
      const rx = x - v.x, rz = z - v.z;
      if (rx * rx + rz * rz > 64) continue;
      const along = rx * v.dx + rz * v.dz, side = rx * -v.dz + rz * v.dx;
      if (Math.abs(along) < v.T.len / 2 + margin && Math.abs(side) < v.T.wid / 2 + margin) return false;
    }
    return true;
  }

  typeInfo(type) { return TYPES[type]; }
  setNight(k) { this.night = k; }
  countNear(x, z, r) { let n = 0; for (const v of this.near) if (Math.hypot(v.x - x, v.z - z) < r) n++; return n; }
  takeHorns() { const h = this.hornEvents; this.hornEvents = []; return h; }
  stats() { const c = {}; for (const v of this.near) c[v.type] = (c[v.type] ?? 0) + 1; return { total: this.near.length, ambient: this.vehicles.length, fleet: this.fleet?.vehicles.length ?? 0, ...c }; }
}
