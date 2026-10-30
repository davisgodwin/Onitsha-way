import {suppliedBody,coveredSkin,suppliedScalp} from './ImportedHuman.js';
import {CharacterAnimator} from './CharacterAnimator.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OUTFITS, OUTFIT_COLORS, SHOE_COLORS, outfitInfo } from './Wardrobe.js';
export { OUTFITS, OUTFIT_COLORS, SHOE_COLORS, OUTFIT_CATEGORIES } from './Wardrobe.js';
import { smoothstep, lerp } from '../core/utils.js';
import {
  ankaraTexture, denimTexture, plainFabricTexture, senatorTexture, skinDetailTexture, hairTexture,
} from './ClothingTextures.js';

/*
  Procedural, properly skinned human.
  - One skeleton (hips → spine → chest → neck → head, arms, legs, feet).
  - Body, face, hair and clothing are swept / ellipsoid surfaces generated in bind pose.
  - Skin weights are computed from distance to bone segments, so elbows, knees and the torso
    bend smoothly instead of looking like a jointed mannequin.
  - Parts that share a material are merged → ~8 draw calls per character.
  The same builder will be reused for NPCs (Milestone 3) with different appearance parameters.
*/

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const BONE_ORDER = ['hips', 'spine', 'chest', 'neck', 'head',
  'upperArm.L', 'foreArm.L', 'hand.L', 'upperArm.R', 'foreArm.R', 'hand.R',
  'thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R'];

function jointLayout(female) {
  const sh = female ? 0.168 : 0.186;   // shoulder joint x
  const hp = female ? 0.1 : 0.094;     // hip joint x
  const J = {
    hips: { p: [0, 0.98, 0], parent: null, tail: 'spine' },
    spine: { p: [0, 1.1, -0.005], parent: 'hips', tail: 'chest' },
    chest: { p: [0, 1.3, -0.012], parent: 'spine', tail: 'neck' },
    neck: { p: [0, 1.49, -0.014], parent: 'chest', tail: 'head' },
    head: { p: [0, 1.585, 0], parent: 'neck', tailP: [0, 1.76, 0.01] },
  };
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    J[`upperArm.${k}`] = { p: [s * sh, 1.425, -0.016], parent: 'chest', tail: `foreArm.${k}` };
    J[`foreArm.${k}`] = { p: [s * (sh + 0.028), 1.15, -0.026], parent: `upperArm.${k}`, tail: `hand.${k}` };
    J[`hand.${k}`] = { p: [s * (sh + 0.04), 0.905, -0.012], parent: `foreArm.${k}`, tailP: [s * (sh + 0.044), 0.8, 0] };
    J[`thigh.${k}`] = { p: [s * hp, 0.94, 0], parent: 'hips', tail: `shin.${k}` };
    J[`shin.${k}`] = { p: [s * (hp + 0.006), 0.52, 0.004], parent: `thigh.${k}`, tail: `foot.${k}` };
    J[`foot.${k}`] = { p: [s * (hp + 0.009), 0.085, -0.02], parent: `shin.${k}`, tailP: [s * (hp + 0.009), 0.03, 0.15] };
  }
  return J;
}

// ---------------------------------------------------------------- geometry helpers
function frame(axis) {
  const side = V3(1, 0, 0).addScaledVector(axis, -axis.x);
  if (side.lengthSq() < 1e-4) side.set(0, 0, 1).addScaledVector(axis, -axis.z);
  side.normalize();
  const front = new THREE.Vector3().crossVectors(axis, side).normalize();
  if (front.z < -1e-3 || (Math.abs(front.z) < 0.3 && front.y < 0)) front.negate();
  return { side, front };
}

/** Swept tube with elliptical cross-section and rounded caps. rfn(t) radius, sxf/szf(t) ellipse scale. */
function sweep(a, b, rfn, o = {}) {
  const { radial = 12, segs = 8, capA = true, capB = true, capSegs = 2, vScale = 0.35, minY = -Infinity, maxY = Infinity } = o;
  const sxf = typeof o.sx === 'function' ? o.sx : () => o.sx ?? 1;
  const szf = typeof o.sz === 'function' ? o.sz : () => o.sz ?? 1;
  const axis = b.clone().sub(a); const len = axis.length(); axis.normalize();
  const { side, front } = frame(axis);
  const sign = new THREE.Vector3().crossVectors(side, front).dot(axis);
  const rings = [];
  const rA = rfn(0), rB = rfn(1);
  if (capA) for (let k = capSegs; k >= 1; k--) {
    const ph = (k / capSegs) * Math.PI / 2;
    rings.push({ c: a.clone().addScaledVector(axis, -rA * Math.sin(ph) * 0.9), r: rA * Math.cos(ph), nr: Math.cos(ph), na: -Math.sin(ph), t: 0 });
  }
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const t0 = Math.max(0, t - 0.02), t1 = Math.min(1, t + 0.02);
    const slope = (rfn(t1) - rfn(t0)) / ((t1 - t0) * len);
    const n = Math.hypot(1, slope);
    rings.push({ c: a.clone().lerp(b, t), r: rfn(t), nr: 1 / n, na: -slope / n, t });
  }
  if (capB) for (let k = 1; k <= capSegs; k++) {
    const ph = (k / capSegs) * Math.PI / 2;
    rings.push({ c: b.clone().addScaledVector(axis, rB * Math.sin(ph) * 0.9), r: rB * Math.cos(ph), nr: Math.cos(ph), na: Math.sin(ph), t: 1 });
  }
  const pos = [], nor = [], uv = [], idx = [];
  let s = 0;
  const tmp = new THREE.Vector3(), dn = new THREE.Vector3(), nn = new THREE.Vector3();
  rings.forEach((rg, i) => {
    if (i > 0) s += rg.c.distanceTo(rings[i - 1].c) + Math.abs(rg.r - rings[i - 1].r);
    const sx = sxf(rg.t), sz = szf(rg.t);
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * Math.PI * 2;
      const cx = Math.cos(th), cz = Math.sin(th);
      tmp.copy(rg.c).addScaledVector(side, cx * rg.r * sx).addScaledVector(front, cz * rg.r * sz);
      tmp.y = Math.min(maxY, Math.max(minY, tmp.y));
      dn.copy(side).multiplyScalar(cx / sx).addScaledVector(front, cz / sz).normalize();
      nn.copy(dn).multiplyScalar(rg.nr).addScaledVector(axis, rg.na).normalize();
      pos.push(tmp.x, tmp.y, tmp.z); nor.push(nn.x, nn.y, nn.z); uv.push(j / radial, s / vScale);
    }
  });
  const R = radial + 1;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const p00 = i * R + j, p01 = i * R + j + 1, p10 = (i + 1) * R + j, p11 = (i + 1) * R + j + 1;
      if (sign > 0) idx.push(p00, p01, p10, p01, p11, p10);
      else idx.push(p00, p10, p01, p01, p10, p11);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Ellipsoid with analytic normals and optional deformation of the unit sphere. */
function ellipsoid(c, rx, ry, rz, o = {}) {
  const g = new THREE.SphereGeometry(1, o.w ?? 20, o.h ?? 14);
  const p = g.attributes.position, n = g.attributes.normal;
  const u = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    u.set(p.getX(i), p.getY(i), p.getZ(i));
    if (o.deform) o.deform(u);
    p.setXYZ(i, c.x + u.x * rx, c.y + u.y * ry, c.z + u.z * rz);
    const nx = u.x / rx, ny = u.y / ry, nz = u.z / rz, l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(i, nx / l, ny / l, nz / l);
  }
  return g;
}

/** Piecewise-linear profile from [[t, r], ...]. */
const profile = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, r0] = pts[i - 1], [t1, r1] = pts[i];
      const k = smoothstep(0, 1, (t - t0) / (t1 - t0));
      return lerp(r0, r1, k);
    }
  }
  return pts[pts.length - 1][1];
};
/** Profile defined over absolute Y for a vertical sweep from y0 → y1. */
const yProfile = (y0, y1, pts) => { const f = profile(pts.map(([y, r]) => [(y - y0) / (y1 - y0), r])); return f; };

// ---------------------------------------------------------------- skinning
function segDist(p, a, b) {
  // allocation-free point-to-segment distance (this runs for every vertex × candidate bone)
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
  const L = abx * abx + aby * aby + abz * abz;
  let t = L > 0 ? (apx * abx + apy * aby + apz * abz) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function applyWeights(geo, weightFn) {
  const p = geo.attributes.position; const n = p.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    let ws = weightFn(v);
    if (ws.length > 1) ws = ws.sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = ws.reduce((s, w) => s + w[1], 0) || 1;
    ws.forEach(([bi, w], k) => { si[i * 4 + k] = bi; sw[i * 4 + k] = w / tot; });
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return geo;
}

// ---------------------------------------------------------------- appearance presets
export const SKIN_TONES = ['#8a5a3c', '#6f4329', '#5b351f', '#4a2a18', '#3a2114', '#9c6a45'];
export const HAIR_STYLES = {
  male: [{ id: 'lowcut', label: 'Low cut' }, { id: 'waves', label: '360 waves' }, { id: 'twists', label: 'Short twists' }, { id: 'fade', label: 'Taper fade' }, { id: 'short_afro', label: 'Rounded afro' }, { id: 'cornrows', label: 'Cornrows' }],
  female: [{ id: 'braids', label: 'Box braids' }, { id: 'bun', label: 'Bun' }, { id: 'afro', label: 'Afro puff' }, { id: 'gele', label: 'Gele (head-tie)' }, { id: 'bob', label: 'Braided bob' }, { id: 'ponytail', label: 'High ponytail' }, { id: 'fade', label: 'Taper fade' }, { id: 'cornrows', label: 'Cornrows' }],
};
// extra looks used by NPCs (older traders, chiefs)
export const NPC_HAIR = { male: ['lowcut', 'waves', 'twists', 'redcap'], female: ['braids', 'bun', 'afro', 'gele'] };

export function defaultAppearance(gender = 'male') {
  return {
    gender, ageGroup: 'adult', bodyType: 'average',
    skin: 1,
    hair: HAIR_STYLES[gender][0].id,
    outfit: OUTFITS[gender][0].id,
    palette: gender === 'male' ? 0 : 2,
    color: 0,
  };
}

/** Sanitise imported/older looks without changing their identity or losing extra character fields. */
export function normalizeAppearance(app = {}) {
  const gender = app.gender === 'female' ? 'female' : 'male';
  const index = (v,n,def=0) => Number.isInteger(v) && v >= 0 ? v % n : def;
  const hair = [...HAIR_STYLES[gender].map(h=>h.id),...(NPC_HAIR[gender]??[])].includes(app.hair) ? app.hair : HAIR_STYLES[gender][0].id;
  return { ...app, gender, hair, ageGroup:['child','young','adult','elder'].includes(app.ageGroup)?app.ageGroup:'adult', bodyType:['slim','average','full'].includes(app.bodyType)?app.bodyType:'average', outfit:outfitInfo(gender,app.outfit).id,
    skin:index(app.skin,SKIN_TONES.length,1),palette:index(app.palette,7),color:index(app.color,OUTFIT_COLORS.length),
    bottomColor:Number.isInteger(app.bottomColor)&&app.bottomColor>=0?app.bottomColor%OUTFIT_COLORS.length:null,
    shoeColor:Number.isInteger(app.shoeColor)&&app.shoeColor>=0?app.shoeColor%SHOE_COLORS.length:null };
}

// ---------------------------------------------------------------- builder
export function buildHuman(app) {
  app = normalizeAppearance(app);
  // All appearances use the supplied body, including existing saves and NPC identities.
  const requestedOutfit=app.outfit;
  const aliases=app.gender==='female'?{model_casual:'tee_chinos',model_alt:'shirt_trousers',model_dress:'ankara_gown',model_tank:'tee_shorts'}:{model_casual:'tee_shorts',model_shirt:'shirt_trousers',model_longsleeve:'shirt_trousers',model_suit:'suit'};
  app={...app,outfit:aliases[app.outfit]??app.outfit};
  const look = {...outfitInfo(app.gender, app.outfit),...(app.outfit==='tee_chinos'?{kind:'tee',print:false}: {})};
  const female = app.gender === 'female';
  const J = jointLayout(female);
  const skinHex = SKIN_TONES[app.skin % SKIN_TONES.length];
  const skinColor = new THREE.Color(skinHex);

  // ---- skeleton
  const rootBone = new THREE.Bone(); rootBone.name = 'root';
  const bones = { root: rootBone }; const list = [rootBone];
  const world = {};
  for (const name of BONE_ORDER) {
    const j = J[name];
    const b = new THREE.Bone(); b.name = name;
    world[name] = V3(...j.p);
    const parentWorld = j.parent ? world[j.parent] : V3(0, 0, 0);
    b.position.copy(world[name]).sub(parentWorld);
    (j.parent ? bones[j.parent] : rootBone).add(b);
    bones[name] = b; list.push(b);
  }
  rootBone.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  const boneIndex = Object.fromEntries(list.map((b, i) => [b.name, i]));
  const native=suppliedBody(female,J,boneIndex);
  const seg = {};
  for (const name of BONE_ORDER) {
    const j = J[name];
    seg[name] = [world[name], j.tail ? world[j.tail] : V3(...j.tailP)];
  }
  const near = (names, power = 4) => (v) => names.map((nm) => {
    const d = segDist(v, seg[nm][0], seg[nm][1]);
    return [boneIndex[nm], 1 / (Math.pow(d, power) + 1e-9)];
  });
  const rigid = (nm) => () => [[boneIndex[nm], 1]];
  // skirt / kaftan hem: upper part follows the pelvis, hem partially follows each thigh
  const skirt = (upper, yTop, yBottom, follow = 0.65) => (v) => {
    if (v.y > yTop + 0.04) return near(upper)(v);
    const w = smoothstep(yTop, yBottom, v.y) * follow;
    const sL = smoothstep(-0.07, 0.07, v.x);
    return [[boneIndex.hips, 1 - w], [boneIndex['thigh.L'], w * sL], [boneIndex['thigh.R'], w * (1 - sL)]];
  };

  // ---- materials
  const mats = {};
  const mat = (key, make) => (mats[key] ??= make());
  const skinMat = () => mat('skin', () => new THREE.MeshStandardMaterial({ color: skinColor, map: skinDetailTexture(), roughness: 0.68, metalness: 0 }));
  const hairColor = new THREE.Color(app.ageGroup==='elder'?'#9c9990':'#15100c');
  const hairMat = (pattern = 'short') => mat('hair:' + pattern, () => new THREE.MeshStandardMaterial({ color: hairColor, map: hairTexture(pattern), roughness: 0.85 }));
  const lipMat = () => mat('lip', () => new THREE.MeshStandardMaterial({ color: skinColor.clone().multiplyScalar(0.72).lerp(new THREE.Color('#5a2a2a'), 0.35), roughness: 0.45 }));
  const eyeWhite = () => mat('eyeW', () => new THREE.MeshStandardMaterial({ color: '#efe9e1', roughness: 0.25 }));
  const iris = () => mat('iris', () => new THREE.MeshStandardMaterial({ color: '#1c120c', roughness: 0.15 }));
  const fabric = (key, tex, color = '#ffffff', rough = 0.85) => mat(key, () => new THREE.MeshStandardMaterial({ map: tex, color, roughness: rough }));

  const parts = []; // {geo, mat, w}
  const neckParts = [];
  const ankleParts = [];
  const add = (geo, m, w) => parts.push({ geo, mat: m, w });

  // Supplied low-poly face replaces the old procedural face in every appearance.
  const HC = V3(0, female ? 1.638 : 1.635, 0.012);
  const rx = female ? 0.096 : 0.100, ry = female ? 0.108 : 0.113, rz = female ? 0.107 : 0.110;
  // ---- neck
  const neckStart=parts.length;
  add(sweep(V3(0, 1.44, -0.014), V3(0, 1.63, -0.004), () => (female ? 0.038 : 0.044), { capA: false, capB: false, segs: 5, sz: 0.95 }),
    skinMat(), near(['chest', 'neck', 'head']));

  neckParts.push(...parts.slice(neckStart));
  // ---- hair
  const hairStart=parts.length;
  const geleMat = () => mat('gele', () => new THREE.MeshStandardMaterial({ map: ankaraTexture((app.palette ?? 0) + 3, (app.palette ?? 0) + 2), roughness: 0.8 }));
  const capMat = () => mat('cap', () => new THREE.MeshStandardMaterial({ color: '#a3122a', roughness: 0.85, map: hairTexture('braid') }));
  buildHair(app.hair, { add, HC, rx, ry, rz, hairMat, rigid, near, female, geleMat, capMat, scalp:(thick,front,back)=>suppliedScalp(native.scalp,HC,rx,ry,rz,thick,front,back) });

  // ---- clothing + exposed limbs
  const pal = app.palette ?? 0, pat = (app.palette ?? 0) + 1;
  const solid = OUTFIT_COLORS[(app.color ?? 0) % OUTFIT_COLORS.length];
  const bottomShade = app.bottomColor == null ? (look.kind==='suit'||look.kind==='track'?solid:look.shorts&&app.outfit==='tee_shorts'?'#3b5570':app.outfit.includes('jeans')?'#293f59':'#8c806d') : OUTFIT_COLORS[app.bottomColor];
  let top, bottom, sleeves = look.long ? 'long' : 'short', legs = look.shorts ? 'shorts' : 'covered', shoeStyle = look.kind==='suit'?'loafer':look.kind==='shirt'||look.kind==='polo'?'shoe':'sneaker';
  top = fabric('top',plainFabricTexture(solid));
  bottom = fabric('bottom',app.outfit.includes('jeans')||app.outfit==='tee_shorts'?denimTexture(bottomShade):plainFabricTexture(bottomShade));
  switch (app.outfit) {
    case 'senator': top=fabric('kaftan',senatorTexture(solid,solid==='#f1ead8'?'#7a5c1f':'#d4af37'));bottom=app.bottomColor==null?top:bottom;shoeStyle='loafer';break;
    case 'ankara_gown':top=requestedOutfit==='model_dress'?fabric('top',plainFabricTexture(solid)):fabric('print',ankaraTexture(pal,pat));bottom=null;legs='skin-knee';shoeStyle='flat';break;
    case 'blouse_skirt':bottom=fabric('print',ankaraTexture(pal,pat));legs='skin-shin';shoeStyle='flat';break;
    case 'ankara_jeans':case 'ankara_top_jeans':top=fabric('print',ankaraTexture(pal,pat));break;
  }
  const upperNames = ['hips', 'spine', 'chest', 'neck'];

  // torso / top garment
  if (app.outfit === 'senator') {
    const y0 = 0.6, y1 = 1.53;
    add(sweep(V3(0, y0, 0), V3(0, y1, -0.012), yProfile(y0, y1, [[0.6, 0.2], [0.9, 0.172], [1.08, 0.158], [1.26, 0.168], [1.38, 0.178], [1.46, 0.168], [1.51, 0.11], [1.53, 0.06]]),
      { capA: false, segs: 20, radial: 22, sx: 1.12, sz: (t) => lerp(0.82, 0.64, smoothstep(0, 0.4, t)), vScale: 1.0 }), top, skirt(upperNames, 0.95, 0.6, 0.75));
  } else if (app.outfit === 'ankara_gown') {
    const y0 = 0.42, y1 = 1.52;
    add(sweep(V3(0, y0, 0.01), V3(0, y1, -0.012), yProfile(y0, y1, [[0.42, 0.29], [0.7, 0.23], [0.96, 0.18], [1.1, 0.13], [1.24, 0.15], [1.36, 0.158], [1.45, 0.15], [1.5, 0.1], [1.52, 0.055]]),
      { capA: false, segs: 22, radial: 24, sx: 1.08, sz: (t) => lerp(0.86, 0.64, smoothstep(0.2, 0.55, t)), vScale: 0.45 }), top, skirt(upperNames, 1.0, 0.45, 0.7));
  } else {
    const fitted = female;
    const y0 = look.kind==='suit' ? 0.93 : 0.97, y1 = 1.49;
    const prof = fitted
      ? [[0.93, 0.173], [1.0, 0.171], [1.1, 0.137], [1.24, 0.15], [1.36, 0.16], [1.42, 0.16], [1.46, 0.10], [1.49, 0.044]]
      : [[0.93, 0.177], [1.0, 0.172], [1.08, 0.157], [1.25, 0.168], [1.38, 0.18], [1.42, 0.18], [1.46, 0.11], [1.49, 0.05]];
    add(sweep(V3(0, y0, 0), V3(0, y1, -0.012), yProfile(y0, y1, prof),
      { capA: false, capB:false, segs: 20, radial: 24, sx: fitted ? 1.08 : 1.12, sz: t=>lerp(.64,.95,smoothstep(.86,1,t)), vScale: app.outfit === 'tee_chinos' ? 0.35 : 0.45 }), top, near(upperNames));
  }
  if (female && look.kind!=='suit') for (const s of [1, -1]) {
    add(ellipsoid(V3(s * 0.052, 1.295, 0.05), 0.048, 0.042, 0.031, { w: 16, h: 12 }), top, rigid('chest'));
  }
  // Tailoring follows the actual torso surface, rather than floating badges or printed-on suits.
  const trim = fabric('trim',plainFabricTexture(new THREE.Color(solid).multiplyScalar(.77).getStyle()));
  const white = fabric('shirt',plainFabricTexture('#eeeae2'));
  const metal = mat('buttons',()=>new THREE.MeshStandardMaterial({color:'#b8b3a5',metalness:.55,roughness:.38}));
  const torsoProf = female ? [[.93,.173],[1,.171],[1.1,.137],[1.24,.15],[1.36,.16],[1.42,.16],[1.46,.10],[1.49,.044]] : [[.93,.177],[1,.172],[1.08,.157],[1.25,.168],[1.38,.18],[1.42,.18],[1.46,.11],[1.49,.05]];
  const front = (x,y,d=.004) => {
    const r=yProfile(.93,1.49,torsoProf)((y-.93)/.56), sx=female?1.08:1.12;
    return -.012*Math.max(0,Math.min(1,(y-.97)/.52))+r*lerp(.64,.95,smoothstep(.86,1,(y-.97)/.52))*Math.sqrt(Math.max(0,1-(x/(r*sx))**2))+d;
  };
  const panel = (points,m=trim,weight=near(upperNames),offset=.006) => {
    const pos=points.map(([x,y,z])=>[x,y,z??front(x,y,offset)]).flat();
    let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];}
    const idx=[];for(let i=1;i<points.length-1;i++)idx.push(...(area>0?[0,i,i+1]:[0,i+1,i]));
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(points.map(([x,y])=>[x*3,y*3]).flat(),2));g.setIndex(idx);g.computeVertexNormals();add(g,m,weight);
  };
  const seam=(pts,m=trim,r=.0018,w=near(upperNames))=>{
    for(let i=1;i<pts.length;i++){
      const p=pts[i-1],q=pts[i],steps=p[2]==null&&q[2]==null?Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/.025)):1;
      const v=t=>{const x=lerp(p[0],q[0],t),y=lerp(p[1],q[1],t);return V3(x,y,p[2]==null?front(x,y,.006):lerp(p[2],q[2],t));};
      for(let k=0;k<steps;k++)add(sweep(v(k/steps),v((k+1)/steps),()=>r,{radial:5,segs:2,capSegs:1}),m,w);
    }
  };
  const button=(x,y,m=metal)=>add(ellipsoid(V3(x,y,front(x,y,.010)),.0036,.0036,.0018,{w:8,h:6}),m,near(upperNames));
  if(!['kaftan','gown'].includes(look.kind)) {
    // Ribbed crew neck; an actual opening leaves the neck visible.
    if(['tee','hoodie','track'].includes(look.kind)) {
      const ring=new THREE.TorusGeometry(.049,.004,6,28);ring.rotateX(Math.PI/2);ring.scale(female?.94:1,1,.91);ring.translate(0,1.491,-.012);add(ring,trim,near(['chest','neck']));
    }
    if(['shirt','polo','suit'].includes(look.kind)) {
      const shirt=look.kind==='suit'?white:trim;
      if(look.kind==='suit') {
        // Shirt insert, lapels, jacket opening and welt pockets.
        for(let y=1.14;y<1.48;y+=.025){const a=.038*(y-1.14)/.35,b=.038*(Math.min(1.49,y+.026)-1.14)/.35;panel([[-a,y],[a,y],[b,Math.min(1.49,y+.026)],[-b,Math.min(1.49,y+.026)]],white,near(upperNames),.008);}
        for(const side of[-1,1]) {
          panel([[side*.039,1.48],[side*.105,1.418],[side*.079,1.385],[side*.119,1.365],[side*.032,1.13]],trim,near(upperNames),.013);
          seam([[side*.10,1.075],[side*.165,1.075]],trim,.0045);
        }
        seam([[.105,1.329],[.153,1.329]],white,.003);
        button(.012,1.115);button(.012,1.045);
        if(look.tie) {
          const tie=fabric('tie',plainFabricTexture('#803d43'));
          panel([[-.012,1.455],[.012,1.455],[.008,1.427],[-.008,1.427]],tie,near(upperNames),.019);
          for(let y=1.20;y<1.43;y+=.023)panel([[-.010,y],[.010,y],[.008,y+.024],[-.008,y+.024]],tie,near(upperNames),.020);
          panel([[-.010,1.20],[.010,1.20],[0,1.18]],tie,near(upperNames),.020);
        }
      } else {
        const end=look.kind==='polo'?1.345:1.01;
        for(let y=end;y<1.475;y+=.025)panel([[-.007,y],[.007,y],[.007,y+.025],[-.007,y+.025]],trim);
        for(let y=end+.035;y<1.45;y+=.065)button(0,y);
        if(look.kind==='shirt')seam([[.075,1.31],[.13,1.31],[.127,1.252],[.102,1.237],[.077,1.252],[.075,1.31]],trim,.0018);
      }
      for(const side of[-1,1])panel([[side*.009,1.489],[side*.044,1.496],[side*.066,1.449],[side*.029,1.428]],shirt,near(['chest','neck']),look.kind==='suit'?.024:.013);
    }
    if(look.kind==='hoodie') {
      // Folded hood sits behind the neck, not a second head-sized sphere.
      add(ellipsoid(V3(0,1.432,-.089),.086,.067,.045,{w:18,h:12}),top,near(['chest','neck']));
      seam([[-.065,1.13],[-.092,1.075],[-.083,1.03],[.083,1.03],[.092,1.075],[.065,1.13]],trim,.0025);
      for(const side of[-1,1])seam([[side*.028,1.475],[side*.032,1.37]],white,.002);
    }
    if(look.kind==='track') {
      seam([[0,1.005],[0,1.47]],white,.0033);
      for(const side of[-1,1]){seam([[side*.08,1.09],[side*.14,1.03]],trim,.003);}
    }
    // Hem uses a sampled curve, so stitching hugs the shirt instead of crossing through it.
    if(look.kind!=='suit'){const pts=[];for(let x=-.16;x<=.1601;x+=.02)pts.push([x,.99]);seam(pts,trim,.002);}
  }

  // shoulders + sleeves
  for (const [s, k] of [[1, 'L'], [-1, 'R']]) {
    const sh = world[`upperArm.${k}`], el = world[`foreArm.${k}`], wr = world[`hand.${k}`];
    const armR = female ? 0.85 : 1;
    if (sleeves === 'long') {
      add(sweep(sh.clone().add(V3(0, -0.012, 0)), wr.clone().add(V3(0, 0.03, 0)), (t) => lerp(0.052, 0.034, t) * armR, { segs: 12, capA: true, capB: false }),
        top, near([`upperArm.${k}`, `foreArm.${k}`, `hand.${k}`]));
    } else {
      add(sweep(sh.clone().add(V3(0, -0.012, 0)), sh.clone().lerp(el, 0.62), (t) => lerp(0.052, 0.046, t) * armR, { segs: 6, capA:true, capB: false }),
        top, near([`upperArm.${k}`, `foreArm.${k}`]));
      add(sweep(sh.clone().lerp(el, 0.25), el, (t) => lerp(0.042, 0.036, t) * armR, { segs: 6, capA: false, capB: false }),
        skinMat(), near([`upperArm.${k}`, `foreArm.${k}`]));
      add(sweep(el, wr, (t) => lerp(0.037, 0.027, t) * armR + 0.004 * Math.sin(t * Math.PI), { segs: 8, capA: true, capB: false }),
        skinMat(), near([`upperArm.${k}`, `foreArm.${k}`, `hand.${k}`]));
    }
    add(ellipsoid(wr.clone().add(V3(0,-.006,0)),.027*armR,.035,.027*armR,{w:12,h:8}),skinMat(),near([`upperArm.${k}`,`foreArm.${k}`,`hand.${k}`]));
    if(sleeves==='long') {
      add(sweep(wr.clone().add(V3(0,.008,0)),wr.clone().add(V3(0,.033,0)),()=>.031*armR,{radial:12,segs:2,capA:false,capB:false}),look.kind==='suit'?white:trim,near([`foreArm.${k}`,`hand.${k}`]));
    }
    if(look.kind==='track') {
      const x=s*(Math.abs(sh.x)+.049*armR);
      seam([[x,sh.y,sh.z],[x,el.y,el.z],[s*(Math.abs(wr.x)+.030*armR),wr.y+.05,wr.z]],white,.003,near([`upperArm.${k}`,`foreArm.${k}`,`hand.${k}`]));
    }
    // hand + thumb
    add(ellipsoid(wr.clone().add(V3(s * 0.002, -0.058, 0.004)), 0.025 * armR, 0.052 * armR, 0.024 * armR, { w: 12, h: 10 }), skinMat(), near([`foreArm.${k}`, `hand.${k}`]));
    add(sweep(wr.clone().add(V3(-s * 0.004, -0.02, 0.028)), wr.clone().add(V3(-s * 0.01, -0.07, 0.042)), () => 0.0105 * armR, { segs: 3, radial: 8 }), skinMat(), rigid(`hand.${k}`));
  }

  // pelvis + legs
  const hipR = female ? 0.168 : 0.152;
  if (bottom && app.outfit !== 'blouse_skirt') {
    add(sweep(V3(0,.845,0),V3(0,1.015,-.005),t=>lerp(hipR*.94,hipR*1.07,t),{radial:24,segs:8,capA:false,capB:false,sz:t=>lerp(.48,.54,t)}),bottom,near(['hips','spine']));
    for (const k of ['L', 'R']) {
      const top3 = world[`thigh.${k}`].clone().add(V3(0, .012, 0));
      const ank = look.shorts ? world[`thigh.${k}`].clone().lerp(world[`shin.${k}`],.68) : world[`foot.${k}`].clone().add(V3(0, 0.02, 0.01));
      const loose = app.outfit === 'senator' ? 1.06 : 1;
      add(sweep(top3, ank, (t) => profile((look.shorts ? [[0,.082],[.5,.078],[1,.070]] : [[0,.082],[.25,.074],[.5,.056],[.7,.049],[1,.041]]))(t) * loose * (female ? 0.97 : 1),
        { segs: 12, capA: true, capB: false, sz: 1.02, vScale: 0.35 }), bottom, near(['hips', `thigh.${k}`, `shin.${k}`, `foot.${k}`]));
    }
  }
  if (app.outfit === 'blouse_skirt') {
    const y0 = 0.36, y1 = 1.01;
    add(sweep(V3(0, y0, 0.005), V3(0, y1, -0.004), yProfile(y0, y1, [[0.36, 0.22], [0.7, 0.2], [0.95, 0.178], [1.01, 0.154]]),
      { capA: false, segs: 14, radial: 22, sx: 1.08, sz: (t) => lerp(0.9, 0.61, t), vScale: 0.45 }), bottom, skirt(['hips', 'spine'], 0.98, 0.36, 0.75));
  }
  if(look.shorts)for(const [side,k]of[[1,'L'],[-1,'R']]) {
    const hem=world[`thigh.${k}`].clone().lerp(world[`shin.${k}`],.68);
    add(sweep(hem.clone().add(V3(0,.012,0)),hem.clone().add(V3(0,-.002,0)),()=>.071*(female?.97:1),{radial:16,segs:2,capA:false,capB:false}),bottom,near([`thigh.${k}`,`shin.${k}`]));
    if(look.cargo){const x=side*.125;panel([[x-.025,.81,.071],[x+.025,.81,.071],[x+.025,.73,.072],[x-.025,.73,.072]],trim,rigid(`thigh.${k}`));seam([[x-.025,.79,.075],[x+.025,.79,.075]],bottom,.003,rigid(`thigh.${k}`));}
  }
  if (legs !== 'covered') {
    for (const k of ['L', 'R']) {
      const top3 = world[`thigh.${k}`].clone().lerp(world[`shin.${k}`], look.shorts ? .55 : .45);
      const ank = world[`foot.${k}`].clone().add(V3(0, 0.02, 0.01));
      add(sweep(top3, ank, profile([[0, 0.066], [0.3, 0.05], [0.5, 0.054], [0.75, 0.043], [1, 0.033]]), { segs: 14, capA: false, capB: false }),
        skinMat(), near([`thigh.${k}`, `shin.${k}`, `foot.${k}`]));
      add(sweep(V3(ank.x,.065,ank.z),V3(ank.x,.18,ank.z),t=>lerp(.030,.037,t),{radial:10,segs:3,capA:false,capB:false}),skinMat(),near([`shin.${k}`,`foot.${k}`],6));
      ankleParts.push(parts.at(-1));
    }
  }
  // shoes
  const shoeCol = app.shoeColor == null ? { sneaker: '#f2f2f2', shoe: '#3a2a1e', loafer: '#151515', flat: female ? '#8a2a3a' : '#222' }[shoeStyle] : SHOE_COLORS[app.shoeColor];
  const shoeMat = mat('shoe', () => new THREE.MeshStandardMaterial({ color: shoeCol, roughness: shoeStyle === 'loafer' ? 0.35 : 0.7 }));
  const soleMat = mat('sole', () => new THREE.MeshStandardMaterial({ color: shoeStyle === 'sneaker' ? '#ffffff' : '#2a2018', roughness: 0.9 }));
  for (const k of ['L', 'R']) {
    const f = world[`foot.${k}`];
    const low = shoeStyle === 'flat';
    const h = low ? 0.7 : 0.9;
    add(sweep(V3(f.x, 0.052, -0.045), V3(f.x, 0.046, 0.125), (t) => lerp(0.046, 0.04, t) * (female ? 0.9 : 1), { segs: 8, sx: 0.95, sz: h, minY: 0.012 }),
      shoeMat, near([`foot.${k}`, `shin.${k}`], 6));
    if (!low) add(ellipsoid(V3(f.x, 0.095, -0.03), 0.048 * (female ? 0.9 : 1), 0.045, 0.055, { w: 12, h: 8 }), shoeMat, near([`foot.${k}`, `shin.${k}`], 6));
    add(sweep(V3(f.x, 0.05, -0.05), V3(f.x, 0.045, 0.132), (t) => lerp(0.05, 0.044, t) * (female ? 0.9 : 1), { segs: 8, sx: 0.98, sz: 1, minY: 0, maxY: shoeStyle === 'sneaker' ? 0.026 : 0.014 }),
      soleMat, rigid(`foot.${k}`));
  }

  // Sneaker tongue, eyelets and laces; formal shoes keep a clean leather vamp.
  if(shoeStyle==='sneaker')for(const k of['L','R']) {
    const f=world[`foot.${k}`],w=rigid(`foot.${k}`);
    add(ellipsoid(V3(f.x,.102,.024),.022,.012,.039,{w:10,h:8}),shoeMat,w);
    for(let i=0;i<3;i++)seam([[f.x-.020,.102-i*.009,.026+i*.017],[f.x+.020,.102-i*.009,.036+i*.017]],soleMat,.0022,w);
  }

  // ---- merge per material and create skinned meshes
  const group = new THREE.Group();
  group.name = 'Human';
  group.add(rootBone);
  const byMat = new Map();
  const skinMaterial=skinMat(),eyeMaterial=iris();
  // Keep neckline and ankle connectors from the old body; face/limbs are supplied topology.
  const keep=parts.filter((p,i)=>i>=hairStart&&p.mat!==mats.skin||neckParts.includes(p)||ankleParts.includes(p));
  for(const p of parts)if(!keep.includes(p))p.geo.dispose();
  keep.push({geo:native.scalp.clone(),mat:skinMaterial,w:null},{geo:coveredSkin(native.skin,{shorts:look.shorts,long:look.long,outfit:app.outfit}),mat:skinMaterial,w:null},{geo:native.eyes.clone(),mat:eyeMaterial,w:null});
  for (const p of keep) {
    if(p.w)applyWeights(p.geo, p.w);
    if (!byMat.has(p.mat)) byMat.set(p.mat, []);
    byMat.get(p.mat).push(p.geo);
  }
  const meshes = [];
  for (const [m, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    const pos=merged.attributes.position;
    for(let i=0;i<pos.count;i++){
      let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      // Continuous deformation across body and clothing avoids clothing intersections.
      const torso=Math.max(0,1-Math.abs(y-1.15)/.32);
      if(app.bodyType==='full'){x*=1+.18*torso;z*=1+.65*torso;}
      if(app.ageGroup==='child'&&y>1.53){const t=Math.min(1,(y-1.53)/.08);x*=1+.14*t;z*=1+.14*t;}
      pos.setXYZ(i,x,y,z);
    }
    merged.computeVertexNormals();
    geos.forEach((g) => g.dispose());
    const sm = new THREE.SkinnedMesh(merged, m);
    sm.bind(skeleton, new THREE.Matrix4());
    sm.castShadow = true;
    sm.receiveShadow = false;
    // Conservative animation envelope: includes gait, sitting, braids and head-ties.
    sm.boundingSphere=new THREE.Sphere(V3(0,.95,.08),1.35);
    sm.frustumCulled = true;
    group.add(sm);
    meshes.push(sm);
  }
  const scale = (female ? 0.94 : 1)*({child:.72,young:.97,adult:1,elder:.94}[app.ageGroup]);
  const width={slim:.87,average:1,full:1.22}[app.bodyType];
  group.scale.set(scale*width,scale,scale*(app.bodyType==='full'?1.12:1));

  const headAttachment=new THREE.Group();headAttachment.position.y=HC.y+ry-J.head.p[1]+.014;bones.head.add(headAttachment);
  const human={
    group, bones, skeleton, meshes, female, materials: mats,
    imported:true, suppliedModel:true, sourceModel:'human-'+(female?'female_tanktop':'male_casual'), headAttachment, actions:{},
    height: 1.79 * scale, appearance: {...app,outfit:requestedOutfit}, outfit: requestedOutfit,
    dispose() {
      skeleton.dispose();
      meshes.forEach((m) => m.geometry.dispose());
      Object.values(mats).forEach((m) => m.dispose()); // textures are cached/shared and kept
    },
  };
  const animator=new CharacterAnimator(human);human.animate=(dt,s={})=>s.seated?animator.sit(dt,0):animator.update(dt,{speed:0,grounded:true,turnRate:0,...s});
  human.animate(0);return human;
}

function buildHair(style, { add, HC, rx, ry, rz, hairMat, rigid, near, female, geleMat, capMat,scalp }) {
  // The original style definitions now sit on the supplied skull, not a second head.
  const shell=(thick,front,back)=>scalp(thick,front,back);
  const head = rigid('head');
  switch (style) {
    case 'fade':
      add(shell(.004,.40,-.16),hairMat('waves'),head);break;
    case 'short_afro':
      add(shell(.004,.40,-.30),hairMat(),head);
      add(ellipsoid(V3(0,HC.y+ry*1.05,HC.z-.018),rx*1.12,ry*.72,rz*1.09,{w:28,h:20,deform:u=>u.multiplyScalar(1+.025*Math.sin(u.x*35)*Math.sin(u.y*27)*Math.sin(u.z*31))}),hairMat(),head);break;
    case 'cornrows': {
      add(shell(.002,.38,-.40),hairMat(),head);
      for(let i=-3;i<=3;i++)for(let j=0;j<10;j++) {
        const x=i*.021,a=-1.65+j*.27,b=a+.27,rr=Math.sqrt(Math.max(.1,1-(x/(rx*1.03))**2));
        const v=t=>V3(x,HC.y+Math.cos(t)*ry*rr,HC.z+Math.sin(t)*rz*rr);
        add(sweep(v(a),v(b),()=>.0045,{radial:5,segs:2,capSegs:1}),hairMat('braid'),head);
      }break;
    }
    case 'ponytail':
      add(shell(.004,.38,-.5),hairMat('waves'),head);
      add(ellipsoid(V3(0,HC.y+.10,HC.z-.09),.037,.041,.04,{w:14,h:10}),hairMat('braid'),head);
      for(let i=0;i<9;i++){const x=(i%3-1)*.016,z=-.11-Math.floor(i/3)*.013;add(sweep(V3(x,HC.y+.10,z),V3(x,HC.y-.18,z-.055),t=>lerp(.013,.007,t),{radial:6,segs:7,capSegs:2}),hairMat('braid'),head);}break;
    case 'bob': {
      add(shell(.004,.36,-.48),hairMat('braid'),head);
      for(let i=0;i<26;i++){const a=-1.75+i*3.5/25,dir=V3(Math.sin(a),0,-Math.cos(a)),base=V3(dir.x*rx,HC.y+.025,HC.z+dir.z*rz),tip=base.clone().add(V3(dir.x*.017,-.15,dir.z*.021));add(sweep(base,tip,t=>lerp(.0075,.006,t),{radial:6,segs:5,capSegs:2}),hairMat('braid'),head);}break;
    }
    case 'waves':
      add(shell(0.007, 0.42, -0.5, 'waves'), hairMat('waves'), head); break;
    case 'twists': {
      add(shell(0.008, 0.42, -0.5), hairMat(), head);
      for (let i = 0; i < 70; i++) {
        const a = (i * 2.399) % (Math.PI * 2); const r = Math.sqrt(i / 70);
        const u = V3(Math.cos(a) * r * 0.85, 0, Math.sin(a) * r * 0.85); u.y = Math.sqrt(Math.max(0.05, 1 - u.x * u.x - u.z * u.z));
        if (u.y < 0.35) continue;
        const base = V3(HC.x + u.x * rx, HC.y + u.y * ry, HC.z + u.z * rz * 1.04);
        const tip = base.clone().add(V3(u.x * 0.03, 0.035 + u.y * 0.01, u.z * 0.03));
        add(sweep(base, tip, (t) => lerp(0.0085, 0.0065, t), { radial: 6, segs: 2, capSegs: 2 }), hairMat(), head);
      }
      break;
    }
    case 'braids': {
      add(shell(0.006, 0.32, -0.6, 'braid'), hairMat('braid'), head);
      const n = 34;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * 0.6 + (i / (n - 1)) * Math.PI * 1.2; // around sides & back
        const dir = V3(Math.sin(a), 0, -Math.cos(a));
        const base = V3(HC.x + dir.x * rx * 0.98, HC.y + 0.02 - Math.abs(Math.cos(a)) * 0.01, HC.z + dir.z * rz * 1.05);
        const len = 0.24 + ((i * 7) % 5) * 0.012;
        const tip = base.clone().add(V3(dir.x * 0.045, -len, dir.z * 0.065 - 0.02));
        add(sweep(base, tip, (t) => lerp(0.0088, 0.0068, t), { radial: 6, segs: 6, capSegs: 2, vScale: 0.08 }), hairMat('braid'), near(['head', 'neck'], 2));
      }
      break;
    }
    case 'bun':
      add(shell(0.006, 0.34, -0.55, 'waves'), hairMat('waves'), head);
      add(ellipsoid(V3(HC.x, HC.y + ry * 0.85, HC.z - rz * 0.55), 0.06, 0.05, 0.058, { w: 16, h: 12 }), hairMat('braid'), head);
      break;
    case 'afro':
      add(shell(0.01, 0.34, -0.55), hairMat(), head);
      add(ellipsoid(V3(HC.x, HC.y + ry * 0.9, HC.z - rz * 0.25), 0.085, 0.07, 0.08, {
        w: 22, h: 16, deform: (u) => { const k = 1 + 0.05 * Math.sin(u.x * 23) * Math.sin(u.y * 19) * Math.sin(u.z * 21); u.multiplyScalar(k); },
      }), hairMat(), head);
      break;
    case 'gele': {
      // stiff, sculpted head-tie: a wrapped band plus fanned pleats rising at the back
      add(shell(0.004, 0.38, -0.5), hairMat(), head);
      const m = geleMat();
      add(sweep(V3(HC.x, HC.y + 0.045, HC.z - 0.005), V3(HC.x, HC.y + ry + 0.035, HC.z - 0.02), (t) => lerp(rx + 0.022, rx * 0.75, t * t),
        { radial: 22, segs: 6, sx: 1.05, sz: 1.12, capA: false, capB: true }), m, head);
      for (let k = 0; k < 5; k++) {
        const a = -0.9 + k * 0.45;
        const base = V3(HC.x + Math.sin(a) * 0.05, HC.y + ry * 0.75, HC.z - 0.03 - Math.cos(a) * 0.02);
        const tip = base.clone().add(V3(Math.sin(a) * 0.09, 0.1 + (2 - Math.abs(k - 2)) * 0.025, -0.07));
        add(sweep(base, tip, (t) => lerp(0.035, 0.012, t), { radial: 10, segs: 3, sx: 1.6, sz: 0.35 }), m, head);
      }
      break;
    }
    case 'redcap':
      // traditional red cap worn by titled men
      add(shell(0.004, 0.44, -0.5), hairMat(), head);
      add(sweep(V3(HC.x, HC.y + ry * 0.45, HC.z - 0.008), V3(HC.x, HC.y + ry + 0.035, HC.z - 0.012), (t) => lerp(rx + 0.01, rx * 0.92, t),
        { radial: 22, segs: 3, sz: 1.12, capA: false, capB: true, capSegs: 2 }), capMat(), head);
      break;
    case 'lowcut':
    default:
      add(shell(0.005, 0.44, -0.5), hairMat(), head);
  }
}
