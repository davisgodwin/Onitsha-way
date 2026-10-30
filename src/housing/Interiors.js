import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { generatePlan } from './FloorPlans.js';

/*
  Reusable home interiors: one per home type (self-contain, room and parlour, 2-bedroom flat), built
  once and shared by every house of that type. They sit far outside the city (x ≈ 9 km), in a zone the
  collision world accepts, so the outdoor world never overlaps them and the camera's far plane hides the
  city while you are inside. Walls and furniture are colliders; furniture has use points.
  Everything is procedural (canvas textures, boxes) — no third-party assets.
*/

export const INTERIOR_ZONE = { minX: 8900, maxX: 9300, minZ: -60, maxZ: 60 };
const ORIGINS = { selfcon: [9000, 0], roomparlour: [9060, 0], flat: [9140, 0], duplex: [9200, 0], duplexUp: [9250, 0] };
const H = 2.9; // ceiling height

function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4;
  return t;
}
function textures() {
  const tiles = canvasTex(256, 256, (g) => {
    g.fillStyle = '#d9cfbf'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#d2c6b3' : '#ddd3c4'; g.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); }
    g.strokeStyle = '#b7aa95'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
  });
  const wall = canvasTex(256, 256, (g) => {
    g.fillStyle = '#efe6cf'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,100,70,${Math.random() * 0.04})`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
    g.fillStyle = '#7a5a3a'; g.fillRect(0, 238, 256, 18); // skirting
  });
  const ceiling = canvasTex(128, 128, (g) => { g.fillStyle = '#f7f4ec'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#e4ded0'; g.strokeRect(8, 8, 112, 112); });
  const window = canvasTex(128, 128, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#bfe0f2'); gr.addColorStop(1, '#f2e6c9');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#6b6b6b'; for (let i = 1; i < 6; i++) g.fillRect(i * 21 - 2, 0, 4, 128); // burglar-proof bars
    g.fillRect(0, 62, 128, 4); g.strokeStyle = '#4a3b2c'; g.lineWidth = 8; g.strokeRect(0, 0, 128, 128);
  });
  const rug = canvasTex(128, 128, (g) => {
    g.fillStyle = '#7b1e2a'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#e0b04a'; g.lineWidth = 6; g.strokeRect(10, 10, 108, 108);
    g.fillStyle = '#1d4e89'; for (let i = 0; i < 4; i++) g.fillRect(28 + i * 20, 54, 12, 20);
  });
  const calendar = canvasTex(128, 160, (g) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 160); g.fillStyle = '#1f7a3a'; g.fillRect(0, 0, 128, 54);
    g.fillStyle = '#fff'; g.font = '800 20px sans-serif'; g.textAlign = 'center'; g.fillText('CALENDAR', 64, 34);
    g.fillStyle = '#333'; for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) g.fillRect(8 + c * 16.5, 66 + r * 17, 12, 12);
  });
  const tv = canvasTex(128, 80, (g) => { g.fillStyle = '#0c0f12'; g.fillRect(0, 0, 128, 80); g.fillStyle = '#18324a'; g.fillRect(6, 6, 116, 68); });
  return { tiles, wall, ceiling, window, rug, calendar, tv };
}

/** Builds all interiors into the scene and registers their colliders. */
export function buildInteriors(scene, collision) {
  collision.addZone?.(INTERIOR_ZONE);
  const T = textures();
  const mats = {
    floor: new THREE.MeshStandardMaterial({ map: T.tiles, roughness: 0.8 }),
    wall: new THREE.MeshStandardMaterial({ map: T.wall, roughness: 0.95 }),
    ceiling: new THREE.MeshStandardMaterial({ map: T.ceiling, roughness: 1, side: THREE.DoubleSide }),
    furniture: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }),
    window: new THREE.MeshStandardMaterial({ map: T.window, emissive: '#ffffff', emissiveMap: T.window, emissiveIntensity: 0.9, roughness: 1 }),
    rug: new THREE.MeshStandardMaterial({ map: T.rug, roughness: 1 }),
    calendar: new THREE.MeshStandardMaterial({ map: T.calendar, roughness: 1 }),
    tv: new THREE.MeshStandardMaterial({ map: T.tv, roughness: 0.3, emissive: '#3a6a9a', emissiveIntensity: 0 }),
    bulbOff: new THREE.MeshStandardMaterial({color:'#171c21',roughness:.5}),
    bulb: new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff2c4', emissiveIntensity: 0 }),
  };
  const lit = [mats.floor, mats.wall, mats.ceiling, mats.furniture, mats.rug, mats.calendar];
  const roomLights=Array.from({length:6},()=>{const l=new THREE.PointLight('#ffe2b2',0,9,2);l.name='HomeCeilingLight';l.castShadow=false;scene.add(l);return l;});
  const layouts = {};
  const labelMats = new Map();
  const labelMat = (text) => { if (!labelMats.has(text)) { const t = canvasTex(512, 128, (g) => { g.clearRect(0, 0, 512, 128); g.fillStyle = 'rgba(40,52,68,.82)'; g.font = '600 54px system-ui, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text.toUpperCase(), 256, 66, 500); }); labelMats.set(text, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); } return labelMats.get(text); };
  /** Build one layout slot for a particular home's floor plan (v0.39: every home has its own plan). */
  const make = (id, W, D, unfurnished = true, homeKey = 'default', removed = []) => {
    const [ox, oz] = ORIGINS[id];
    const L = new LayoutBuilder(ox, oz, collision); L.unfurnished=unfurnished; L.lights=[];
    const plan = generatePlan(homeKey, id, W, D);
    buildFromPlan(L, plan, new Set(removed));
    L.use('decorate', L.spawn.x - L.ox, L.spawn.z - L.oz - 0.35, 'Home — decorate & manage power');
    for (const r of plan.rooms) { const k = 'label:' + r.label; mats[k] ??= labelMat(r.label); L.plane(k, (r.x0 + r.x1) / 2, 0.02, (r.z0 + r.z1) / 2, Math.min(2.6, r.x1 - r.x0 - 0.3), Math.min(0.65, (r.x1 - r.x0 - 0.3) / 4), 0, true); }
    const group = L.finish(mats);
    for (const m of group.children) if (String(m.userData.interiorPart).startsWith('label:')) { m.visible = false; m.userData.roomLabel = true; }
    group.name = 'Interior:' + id;
    scene.add(group);
    return { unfurnished, group, spawn: L.spawn, items: L.items, bounds: L.bounds, polys: L.polys, size: [W, D], lights: L.lights, plan, homeKey, removed: [...removed] };
  };
  for (const id of Object.keys(LAYOUTS)) {
    const [W, D] = LAYOUT_SIZE[id].base;
    layouts[id] = { id, origin: { x: ORIGINS[id][0], z: ORIGINS[id][1] }, ceiling: H, ...make(id, W, D) };
  }
  /** Rebuild a layout at a new size (walls, furniture, colliders, use points). Returns true if it changed. */
  const resize = (id, W, D, unfurnished = true, homeKey = 'default', removed = []) => {
    const lay = layouts[id], S = LAYOUT_SIZE[id];
    W = Math.round(Math.max(S.W[0], Math.min(S.W[1], W)) * 10) / 10; D = Math.round(Math.max(S.D[0], Math.min(S.D[1], D)) * 10) / 10;
    if (lay.size[0] === W && lay.size[1] === D && lay.unfurnished===unfurnished && lay.homeKey === homeKey && String(lay.removed) === String(removed)) return false;
    scene.remove(lay.group);
    lay.group.traverse((o) => o.geometry?.dispose());
    for (const pi of lay.polys) collision.removePolygon(pi);
    Object.assign(lay, make(id, W, D, unfurnished, homeKey, removed));
    return true;
  };
  // every house gets its own paint, floor and rug colours (tints over the shared textures)
  const WALLS = ['#ffffff', '#f3e3c3', '#d9ecf2', '#e8f0d8', '#f6d9d0', '#efe6ff', '#fff3b8'];
  const FLOORS = ['#ffffff', '#e8d2b0', '#c9d6e0', '#d8c4c4', '#bfc9b8'];
  const RUGS = ['#ffffff', '#b6d0ff', '#ffd0a8', '#c8f0c0', '#f0b8d8'];
  return {
    layouts, resize,
    repaint(color) { mats.wall.color.set(color); },
    refloor(color) { mats.floor.color.set(color); },
    /** Tint the shared rooms for one particular house (deterministic from its id). */
    setLook(id) {
      let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); } h >>>= 0;
      mats.wall.color.set(WALLS[h % WALLS.length]); mats.floor.color.set(FLOORS[(h >>> 5) % FLOORS.length]); mats.rug.color.set(RUGS[(h >>> 9) % RUGS.length]);
    },
    /** Ceiling lamp and daylight through the windows. */
    setLight({ lamp, daylight, layout=null }) {
      roomLights.forEach((l,i)=>{const point=layout?.lights?.[i];l.intensity=lamp&&point?14:0;if(point)l.position.set(point.x,H-.42,point.z);});
      void lit; // room light comes from the scene lights (Atmosphere.indoor); only the bulb and windows glow
      mats.bulb.emissiveIntensity = lamp ? 1.6 : 0;
      mats.window.emissiveIntensity = 0.12 + 0.85 * daylight;
    },
    setTv(on) { mats.tv.emissiveIntensity = on ? 0.9 : 0; },
  };
}

/** Collects boxes (vertex-coloured), wall slabs, colliders and use points for one layout. */
class LayoutBuilder {
  constructor(ox, oz, collision) {
    this.ox = ox; this.oz = oz; this.col = collision;
    this.parts = []; this.walls = []; this.floors = []; this.ceils = []; this.planes = []; this.items = [];
    this.bounds = null; this.spawn = null; this.polys = [];
  }
  P(x, z) { return [this.ox + x, this.oz + z]; }
  /** Room shell: floor and ceiling over [0,W]×[0,D]. */
  room(W, D) {
    this.bounds = { minX: this.ox, maxX: this.ox + W, minZ: this.oz, maxZ: this.oz + D };
    const f = new THREE.PlaneGeometry(W, D); f.rotateX(-Math.PI / 2); f.translate(this.ox + W / 2, 0, this.oz + D / 2);
    f.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? D : W) / 1.2; });
    this.floors.push(f);
    const c = new THREE.PlaneGeometry(W, D); c.rotateX(Math.PI / 2); c.translate(this.ox + W / 2, H, this.oz + D / 2); this.ceils.push(c);
    // outer walls
    this.wall(0, 0, W, 0); this.wall(W, 0, W, D); this.wall(W, D, 0, D); this.wall(0, D, 0, 0);
  }
  /** Wall slab along a segment (thickness 0.16), from floor to ceiling, with an optional gap [g0, g1] along it. */
  wall(x0, z0, x1, z1, gap = null) {
    const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    const spans = gap ? [[0, gap[0]], [gap[1], L]] : [[0, L]];
    for (const [a, b] of spans) {
      if (b - a < 0.05) continue;
      const cx = x0 + ux * (a + b) / 2, cz = z0 + uz * (a + b) / 2;
      const g = new THREE.BoxGeometry(b - a, H, 0.16);
      g.attributes.uv.array.forEach((v, i, arr) => { arr[i] = i % 2 ? v : v * (b - a) / 2.2; });
      g.rotateY(-Math.atan2(uz, ux)); g.translate(this.ox + cx, H / 2, this.oz + cz);
      this.walls.push(g);
      this.solid(cx, cz, b - a, 0.16, Math.atan2(uz, ux));
    }
    if (gap) { // lintel over the doorway
      const cx = x0 + ux * (gap[0] + gap[1]) / 2, cz = z0 + uz * (gap[0] + gap[1]) / 2;
      const g = new THREE.BoxGeometry(gap[1] - gap[0], H - 2.15, 0.16); g.rotateY(-Math.atan2(uz, ux)); g.translate(this.ox + cx, 2.15 + (H - 2.15) / 2, this.oz + cz); this.walls.push(g);
    }
  }
  /** Collider rectangle (centre, size along/across, angle of the "along" axis). */
  solid(cx, cz, w, d, ang = 0) {
    const c = Math.cos(ang), s = Math.sin(ang), hw = w / 2, hd = d / 2;
    const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [this.ox + cx + a * c - b * s, this.oz + cz + a * s + b * c]);
    let area = 0; for (let i = 0; i < 4; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % 4]; area += x1 * z2 - x2 * z1; }
    this.polys.push(this.col.addPolygon(area > 0 ? pts : pts.reverse(), H));
  }
  /** A coloured box (local x/z of the box's min corner on the floor plan, y from the floor). */
  box(x0, z0, x1, z1, y0, y1, hex, collide = false) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate(this.ox + (x0 + x1) / 2, (y0 + y1) / 2, this.oz + (z0 + z1) / 2);
    const col = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv');
    this.parts.push(g.toNonIndexed());
    if (collide) this.solid((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0);
  }
  /** A textured plane on a wall or the floor: kind = material key. */
  plane(kind, x, y, z, w, h, rotY = 0, flat = false) {
    if(this.unfurnished && ['rug','calendar'].includes(kind))return;
    const g = new THREE.PlaneGeometry(w, h);
    if (flat) g.rotateX(-Math.PI / 2); else g.rotateY(rotY);
    g.translate(this.ox + x, y, this.oz + z);
    this.planes.push([kind, g]);
  }
  use(kind, x, z, label, extra = {}) { this.items.push({ kind, x: this.ox + x, z: this.oz + z, label, radius: 1.45, ...extra }); }
  start(x, z, heading) { this.spawn = { x: this.ox + x, z: this.oz + z, heading }; }

  finish(mats) {
    const group = new THREE.Group();
    const add = (geos, mat) => { if (!geos.length) return; const m = new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false), mat); m.userData.interiorPart=Object.entries(mats).find(([,v])=>v===mat)?.[0];group.add(m); };
    add(this.floors, mats.floor); add(this.ceils, mats.ceiling); add(this.walls, mats.wall); add(this.parts, mats.furniture);
    const byKind = {};
    for (const [k, g] of this.planes) (byKind[k] ??= []).push(g);
    for (const [k, list] of Object.entries(byKind)) add(list, mats[k]);
    return group;
  }
}

// ---------------------------------------------------------------- furniture pieces (local coordinates)
const WOOD = '#7a4e2d', DARK = '#3a2a1e', FOAM = '#efe9dc', WRAP = '#2b6cb0', STEEL = '#b9bcc0';
function bed(L, x, z, w = 1.5, d = 2.05) {
  if(L.unfurnished)return;
  L.box(x, z, x + w, z + d, 0, 0.32, WOOD, true);
  L.box(x + 0.04, z + 0.04, x + w - 0.04, z + d - 0.04, 0.32, 0.55, FOAM);
  L.box(x + 0.1, z + 0.6, x + w - 0.1, z + d - 0.1, 0.55, 0.58, WRAP);      // ankara wrapper as a bedsheet
  L.box(x + 0.2, z + 0.1, x + w - 0.2, z + 0.5, 0.55, 0.68, '#f8f4ea');      // pillow
  L.box(x, z - 0.06, x + w, z, 0, 1.0, WOOD);                               // headboard
  L.use('bed', x + w / 2, z + d + 0.55, 'Bed — sleep or rest');
}
function wardrobe(L, x, z, w = 1.0, d = 0.6) {
  if(L.unfurnished)return;
  L.box(x, z, x + w, z + d, 0, 2.1, '#8a5a34', true);
  L.box(x + w / 2 - 0.01, z + d, x + w / 2 + 0.01, z + d + 0.01, 0.1, 2.0, DARK);
  L.use('wardrobe', x + w / 2, z + d + 0.6, 'Wardrobe — change clothes');
}
function kitchen(L, x, z) {
  // Fixed landlord kitchen: present even when the movable furnishings have not been bought.
  const w=.68, d=2.6;
  L.box(x,z,x+w,z+d,0,.88,'#8a684d',true);
  L.box(x-.025,z-.025,x+w+.025,z+d+.025,.88,.94,'#d3d3c7');
  // Cooker and two circular burners, sink, tap, cupboard doors and tiled splashback.
  L.box(x+.04,z+.12,x+w-.04,z+.94,.94,.98,'#22282c');
  for(const zz of [z+.34,z+.72]) { const burner=new THREE.TorusGeometry(.12,.024,6,16);burner.rotateX(Math.PI/2);burner.translate(L.ox+x+.34,1,L.oz+zz);L.planes.push(['bulbOff',burner]); }
  L.box(x+.08,z+1.5,x+w-.08,z+2.25,.945,.96,'#758b93');
  L.box(x+.13,z+1.57,x+w-.13,z+2.18,.96,.975,'#b3cbd0');
  L.box(x+w-.1,z+1.8,x+w-.055,z+1.85,.97,1.25,'#bdc6c6');
  L.box(x+.3,z+1.8,x+w-.06,z+1.85,1.21,1.25,'#bdc6c6');
  L.box(x+w-.04,z,x+w,z+d,.95,1.55,'#c8dbd9');
  for(const zz of [z+.45,z+1.2,z+2.15]) L.box(x-.02,zz,x,zz+.2,.65,.69,'#d8ceb1');
  L.box(x,z,x+w,z+d,1.9,2.45,'#a88663');
  L.use('stove',x-.65,z+.65,'Kitchen cooker — cook a meal');
  L.use('sink',x-.65,z+1.9,'Kitchen sink — wash hands');
  L.use('cupboard',x-.65,z-.5,'Kitchen storage — store ingredients');
}
function cupboard(L, x, z, w = 0.6, d = 0.9) {
  return; // Storage is now built into the permanent kitchen.
  L.box(x, z, x + w, z + d, 0, 1.8, '#9c6b3f', true);
  L.box(x - 0.01, z + d / 2 - 0.01, x, z + d / 2 + 0.01, 0.2, 1.7, DARK);
  L.use('cupboard', x - 0.55, z + d / 2, 'Cupboard — store things');
}
function chair(L, x, z) {
  if(L.unfurnished)return; L.box(x, z, x + 0.45, z + 0.45, 0, 0.45, '#5b3a22', true); L.box(x, z, x + 0.45, z + 0.06, 0.45, 0.95, '#5b3a22'); }
function table(L, x, z, w = 0.9, d = 0.7) {
  if(L.unfurnished)return; L.box(x, z, x + w, z + d, 0.7, 0.76, WOOD, true); for (const [a, b] of [[x, z], [x + w - 0.06, z], [x, z + d - 0.06], [x + w - 0.06, z + d - 0.06]]) L.box(a, b, a + 0.06, b + 0.06, 0, 0.7, WOOD); }
function sofa(L, x, z, w = 2.0) {
  if(L.unfurnished)return;
  L.box(x, z, x + w, z + 0.85, 0, 0.42, '#6b2737', true); L.box(x, z, x + w, z + 0.2, 0.42, 0.9, '#5a1f2d');
  L.box(x, z, x + 0.18, z + 0.85, 0.42, 0.65, '#5a1f2d'); L.box(x + w - 0.18, z, x + w, z + 0.85, 0.42, 0.65, '#5a1f2d');
  L.use('sofa', x + w / 2, z + 1.35, 'Sofa — rest a while');
}
function tvStand(L, x, z) {
  if(L.unfurnished)return;
  L.box(x, z, x + 1.2, z + 0.4, 0, 0.5, DARK, true);
  L.box(x + 0.1, z + 0.12, x + 1.1, z + 0.18, 0.5, 1.12, '#111');
  L.plane('tv', x + 0.6, 0.81, z + 0.11, 0.96, 0.58, Math.PI); // the stand is against the front wall: the screen faces into the room
}
function lamp(L, x, z, sx, sz, rot, withSwitch=true) {
  L.box(x-.13,z-.13,x+.13,z+.13,H-.1,H,'#d5cec1');
  L.box(x-.035,z-.035,x+.035,z+.035,H-.29,H-.1,'#696d71');
  const geo=new THREE.SphereGeometry(.115,12,8);geo.translate(L.ox+x,H-.34,L.oz+z);L.planes.push(['bulb',geo]);
  L.lights.push({x:L.ox+x,z:L.oz+z});
  if(!withSwitch)return;
  L.box(sx-.09,sz-.035,sx+.09,sz+.035,1.2,1.45,'#efefe7');
  L.box(sx-.035,sz-.045,sx+.035,sz+.045,1.25,1.39,'#b1b7b3');
  L.use('switch',sx+Math.sin(rot)*.6,sz+Math.cos(rot)*.6,'Light switch — on / off',{radius:.9});
}
function exitDoor(L, x, z) {
  L.box(x - 0.5, z - 0.1, x + 0.5, z - 0.02, 0, 2.1, '#5e3b22');
  L.box(x + 0.3, z - 0.16, x + 0.36, z - 0.1, 1.0, 1.06, '#d4af37');
  L.use('door', x, z - 0.75, 'Door — go outside', { radius: 1.3 });
}

// ---------------------------------------------------------------- layouts (front wall at z = D, door there)
/**
 * Room sizes: each layout fits the house it's in (its footprint's width along the front wall and its depth,
 * less the walls), within these limits so the furniture always fits and the room never feels like a hall.
 */
export const LAYOUT_SIZE = {
  duplex: { W: [13, 17], D: [9, 12], base: [14, 10] },
  duplexUp: { W: [12.6, 16], D: [8, 11], base: [14, 9] },
  selfcon: { W: [6.2, 8.0], D: [8.0, 10.0], base: [6.2, 8.0] },
  roomparlour: { W: [8.4, 11.0], D: [7.5, 9.5], base: [8.4, 7.5] },
  flat: { W: [12.6, 16.0], D: [8.0, 10.5], base: [12.6, 8.0] },
};

export const BATHROOM_SIZE = {width:2.5,depth:2.8,door:1.15};
function bathroom(L,W,D) {
  const w=2.5,z=D-2.8;
  L.wall(0,z,w,z,[.75,1.9]);L.wall(w,z,w,D);
  L.box(.08,z+.08,w-.08,D-.08,.005,.015,'#b7cfd0');
  // Toilet at rear left, generous shower tray at rear right, basin against side wall.
  L.box(.16,D-.8,.72,D-.18,0,.43,'#f5f6f1',true);
  L.box(.16,D-.19,.72,D-.06,.4,.88,'#f5f6f1');
  L.box(1.35,D-1.15,2.35,D-.12,.02,.07,'#e2e9e6');
  L.box(2.29,D-.8,2.34,D-.75,.1,2.15,'#a7bec5');
  L.box(1.95,D-.8,2.34,D-.5,2.09,2.15,'#a7bec5');
  L.box(.12,z+.45,.53,z+1.1,.7,.88,'#e8ece6',true);
  L.box(.15,z+.49,.49,z+1.06,.88,.92,'#b1cbd0');
  L.box(.19,z+.74,.24,z+.79,.92,1.13,'#b9c4c3');
  L.use('bathroom',1.22,z+1.1,'Bathroom — toilet, shower & wash hands',{radius:1.05});
}
/** Walls, door, windows, bulbs and switches for a generated plan; NPC hosts' homes also get basic furniture. */
/**
 * The flight of stairs in a duplex's stairs room: try each corner and both directions and take the first placement
 * that keeps every doorway into the room (and the front door) clear, with room to stand at its foot.
 */
/** Keep-clear rectangles in a room: in front of every doorway into it, the front door and its light switch. */
function roomZones(plan, st) {
  const zones = [];
  for (const w of plan.walls) {
    const h = w.z0 === w.z1, c = (h ? w.x0 : w.z0) + (w.gap[0] + w.gap[1]) / 2, half = (w.gap[1] - w.gap[0]) / 2 + 0.25;
    if (h && (Math.abs(w.z0 - st.z0) < 0.01 || Math.abs(w.z0 - st.z1) < 0.01) && c > st.x0 && c < st.x1) zones.push([c - half, w.z0 - 1.3, c + half, w.z0 + 1.3]);
    if (!h && (Math.abs(w.x0 - st.x0) < 0.01 || Math.abs(w.x0 - st.x1) < 0.01) && c > st.z0 && c < st.z1) zones.push([w.x0 - 1.3, c - half, w.x0 + 1.3, c + half]);
  }
  if (Math.abs(st.z1 - plan.D) < 0.01 && plan.door.x > st.x0 && plan.door.x < st.x1) zones.push([plan.door.x - 0.9, plan.D - 1.5, plan.door.x + 0.9, plan.D]);
  for (const l of plan.lamps) if (plan.rooms[l.room] === st) zones.push([l.sx - 0.7, l.sz - 0.9, l.sx + 0.7, l.sz + 0.9]);
  return zones;
}
const overlaps = (zones, r) => zones.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
function stairFlight(L, plan, st) {
  const W = st.x1 - st.x0, Dp = st.z1 - st.z0, zones = roomZones(plan, st), n = 8;
  const hits = (r) => overlaps(zones, r);
  for (const alongX of [false, true]) for (const fx of [0, 1]) for (const fz of [0, 1]) {
    const len = Math.min((alongX ? W : Dp) - 1.5, 2.8), wid = Math.min(1.1, (alongX ? Dp : W) - 1.0); if (len < 1.6 || wid < 0.8) continue;
    // flight rect, hugging corner (fx, fz); it rises away from its foot, which is left clear to stand at
    const x0 = fx ? st.x1 - 0.3 - (alongX ? len : wid) : st.x0 + 0.3, z0 = fz ? st.z1 - 0.3 - (alongX ? wid : len) : st.z0 + 0.3;
    const x1 = x0 + (alongX ? len : wid), z1 = z0 + (alongX ? wid : len);
    const foot = alongX ? (fx ? [x0 - 1.0, z0, x0, z1] : [x1, z0, x1 + 1.0, z1]) : (fz ? [x0, z0 - 1.0, x1, z0] : [x0, z1, x1, z1 + 1.0]);
    if (hits([x0, z0, x1, z1]) || foot[0] < st.x0 || foot[2] > st.x1 || foot[1] < st.z0 || foot[3] > st.z1) continue;
    for (let i = 0; i < n; i++) { // the top step is furthest from the foot
      const k = i, footHigh = alongX ? !fx : !fz, y = 0.18 + (footHigh ? n - 1 - k : k) * 0.22, t0 = k / n, t1 = (k + 1) / n; // lowest step at the foot
      if (alongX) L.box(x0 + (x1 - x0) * t0, z0, x0 + (x1 - x0) * t1, z1, 0, y, '#b19a77', true); else L.box(x0, z0 + (z1 - z0) * t0, x1, z0 + (z1 - z0) * t1, 0, y, '#b19a77', true);
    }
    L.use('stairs', (foot[0] + foot[2]) / 2, (foot[1] + foot[3]) / 2, 'Stairs — upstairs', { radius: 1.3 });
    return;
  }
  L.use('stairs', (st.x0 + st.x1) / 2, (st.z0 + st.z1) / 2, 'Stairs — upstairs', { radius: 1.3 }); // no room for a flight: just the way up
}
function buildFromPlan(L, plan, removed) {
  const { W, D } = plan;
  L.room(W, D);
  for (const w of plan.walls) L.wall(w.x0, w.z0, w.x1, w.z1, w.gap);
  for (const w of plan.windows) L.plane('window', w.x, w.y, w.z, w.w, w.h, w.rot);
  exitDoor(L, plan.door.x, D);
  plan.lamps.forEach((l, i) => { if (!removed.has(i)) { lamp(L, l.x, l.z, l.sx, l.sz, l.rot); L.items.at(-1).lamp = i; L.items.at(-1).room = plan.rooms[l.room].label; } });
  const st = plan.rooms.find((r) => r.role === 'stairs');
  if (st) stairFlight(L, plan, st);
  if (plan.type === 'duplexUp') { const lg = plan.rooms.find((r) => r.role === 'lounge') ?? plan.rooms[0]; L.use('stairs', (lg.x0 + lg.x1) / 2, (lg.z0 + lg.z1) / 2, 'Stairs — downstairs'); }
  if (!L.unfurnished) for (const r of plan.rooms) { // an NPC host's own things, kept out of doorways and away from the switch
    const z = roomZones(plan, r), ok = (x0, z0, w, d) => !overlaps(z, [x0 - 0.35, z0 - 0.35, x0 + w + 0.35, z0 + d + 0.35]);
    if (['bedroom', 'master', 'guest', 'studio'].includes(r.role) && r.x1 - r.x0 > 2.2 && r.z1 - r.z0 > 2.6) { const bw = Math.min(1.6, r.x1 - r.x0 - 1.4); if (ok(r.x0 + 0.2, r.z0 + 0.2, bw, 2.05)) bed(L, r.x0 + 0.2, r.z0 + 0.2, bw); if (r.x1 - r.x0 > 3.2 && ok(r.x1 - 1.15, r.z0 + 0.12, 1.0, 0.6)) wardrobe(L, r.x1 - 1.15, r.z0 + 0.12); }
    if ((r.role === 'parlour' || r.role === 'lounge') && r.x1 - r.x0 > 3) { const sw = Math.min(2.2, r.x1 - r.x0 - 1); if (ok(r.x0 + 0.4, r.z0 + 0.25, sw, 0.9)) sofa(L, r.x0 + 0.4, r.z0 + 0.25, sw); if (r.z1 - r.z0 > 3.6 && ok(r.x0 + 0.8, r.z0 + 2.15, 0.9, 0.6)) table(L, r.x0 + 0.8, r.z0 + 2.15, 0.9, 0.6); /* clear of where you sit down */ }
    if (r.role === 'dining' && r.x1 - r.x0 > 2) { const tx = (r.x0 + r.x1) / 2 - 0.5, tz = (r.z0 + r.z1) / 2 - 0.4; if (ok(tx, tz, 1.0, 0.8)) table(L, tx, tz, 1.0, 0.8); }
  }
  L.start(plan.door.x, D - 0.9, Math.PI);
}
const LAYOUTS = {
  duplex(L, W = 14, D = 10) {
    L.room(W,D); sofa(L,2,.25,3); tvStand(L,2,D-0.55); table(L,4,D/2,1.2,.8); kitchen(L,W-.8,1.6); cupboard(L,W-.62,4);
    L.wall(W*.6,0,W*.6,D-2,[3.5,4.7]);
    for(let i=0;i<7;i++)L.box(W-2.4, D-3.7+i*.35, W-1.25, D-3.35+i*.35, 0, .12+i*.18, '#b19a77');
    L.use('stairs',W-2.8,D-2,'Stairs — upstairs', {radius:1.3});
    exitDoor(L,W/2,D);lamp(L,W/2,D/2,W/2+.8,D-.1,Math.PI);L.start(W/2,D-.9,Math.PI);
  },
  duplexUp(L,W=14,D=9) {
    L.room(W,D); const x=W/2;L.wall(x,0,x,D-2,[D/2-.6,D/2+.6]);bed(L,.25,.2,1.8);wardrobe(L,x-1.3,.15);bed(L,x+.35,.2,1.6);wardrobe(L,W-1.3,.15);sofa(L,x+1,D-2.6);
    L.use('stairs',W/2,D-.9,'Stairs — downstairs');lamp(L,W/2,D/2,W/2+.8,D-.1,Math.PI);L.start(W/2,D-.9,Math.PI);
  },
  selfcon(L, W = 4.6, D = 6.0) {
    L.room(W, D);
    bed(L, 0.12, 0.2);
    wardrobe(L, W - 1.15, 0.12);
    kitchen(L, W - .8, 2.0);
    cupboard(L, W - 0.62, Math.min(D - 2.0, 3.75 + (D - 6) * 0.5));
    table(L, 3.1, D - 3.3); chair(L, 3.3, D - 2.0);
    L.plane('rug', W / 2 - 0.2, 0.012, D / 2 + 0.3, 1.6, 1.1, 0, true);
    L.plane('window', 0.09, 1.55, 1.6, 1.1, 1.0, Math.PI / 2);
    L.plane('calendar', W / 2 + 0.3, 1.6, 0.09, 0.42, 0.52, 0);
    exitDoor(L, W - .85, D);
    lamp(L, W / 2, D / 2, W - .65, D - .1, Math.PI);
    L.start(W - .85, D - .9, Math.PI);
  },
  roomparlour(L, W = 8.4, D = 6.0) {
    const xp = Math.round(W * 0.5 * 10) / 10;       // partition: bedroom | parlour
    L.room(W, D);
    L.wall(xp, 0, xp, D, [D / 2 - 0.5, D / 2 + 0.5]);
    bed(L, 0.15, 0.2); wardrobe(L, xp - 1.2, 0.12);
    L.plane('window', 0.09, 1.55, D * 0.6, 1.1, 1.0, Math.PI / 2);
    // parlour
    sofa(L, xp + 0.8, 0.2); tvStand(L, xp + 1.2, D - 0.55);
    table(L, xp + 1.4, D / 2 - 0.7, 0.8, 0.6);
    L.plane('rug', xp + 2.0, 0.012, D / 2 - 0.4, 2.2, 1.6, 0, true);
    kitchen(L, W - .8, 2.2); cupboard(L, W - 0.62, Math.min(D - 2.0, 3.9));
    L.plane('window', W - 0.09, 1.55, 1.2, 1.1, 1.0, -Math.PI / 2);
    L.plane('calendar', xp + 0.12, 1.6, D * 0.77, 0.42, 0.52, Math.PI / 2);
    exitDoor(L, W - 1.4, D);
    lamp(L, xp + 2.1, D / 2, W - 0.6, D - 0.1, Math.PI);
    L.start(W - 1.4, D - 0.9, Math.PI);
  },
  flat(L, W = 12.6, D = 7.0) {
    const x1 = Math.round(W / 3 * 10) / 10, x2 = Math.round(W * 2 / 3 * 10) / 10;
    L.room(W, D);
    L.wall(x1, 0, x1, D, [D / 2 - 0.5, D / 2 + 0.5]); L.wall(x2, 0, x2, D, [D / 2 - 0.5, D / 2 + 0.5]);
    bed(L, 0.2, 0.2, 1.4); wardrobe(L, x1 - 1.2, 0.12);                  // second bedroom
    L.plane('window', 0.09, 1.55, D * 0.6, 1.1, 1.0, Math.PI / 2);
    bed(L, x1 + 0.3, 0.2, 1.7, 2.1); wardrobe(L, x2 - 1.2, 0.12);        // main bedroom
    L.plane('calendar', x1 + 1.8, 1.6, 0.09, 0.42, 0.52, 0);
    sofa(L, x2 + 0.6, 0.2, 2.4); tvStand(L, x2 + 1.2, D - 0.55); table(L, x2 + 1.5, D / 2 - 0.9, 0.9, 0.6);
    L.plane('rug', x2 + 2.0, 0.012, D / 2 - 0.5, 2.6, 1.8, 0, true);
    kitchen(L, W - .8, 2.6); cupboard(L, W - 0.62, Math.min(D - 2.0, 4.3));
    L.plane('window', W - 0.09, 1.55, 1.4, 1.1, 1.0, -Math.PI / 2);
    exitDoor(L, W - 1.6, D);
    lamp(L, x2 + 2.0, D / 2, W - 0.8, D - 0.1, Math.PI);
    L.start(W - 1.6, D - 0.9, Math.PI);
  },
};
