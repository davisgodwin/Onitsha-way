import * as THREE from 'three';
import BOUNDS from '../data/furnitureBounds.json' with { type: 'json' };
/**
 * Kenney "Furniture Kit" (CC0, kenney.nl) models, loaded once and cloned per placed piece.
 * Geometry is shared between clones; materials are cloned only when a piece is recoloured.
 * The kit is modelled at half scale, so KIT_SCALE brings it to metres.
 */
export const KIT_SCALE = 2;
export const KIT_BOUNDS = BOUNDS;
const protos = new Map();
let ready = null;
export const kitLoaded = () => protos.size > 0;
export const hasKitModel = (name) => protos.has(name);
function prepare(name, scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    o.geometry.userData.shared = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      m.userData.shared = true; m.userData.kitName = m.name;
      // Calmer house colours than the kit's defaults (its fabric is a bright salmon pink).
      const base = { carpet: '#6f86a3', carpetDarker: '#556b88', carpetBlue: '#5d79a8', wood: '#c08a58', woodDark: '#8d6240' }[m.name];
      if (base && m.color) m.color.set(base);
      if ('metalness' in m) { m.metalness = /metal/i.test(m.name) ? 0.35 : 0.05; m.roughness = /glass/.test(m.name) ? 0.15 : /metal/i.test(m.name) ? 0.45 : 0.75; }
      if (/glass/.test(m.name)) { m.transparent = true; m.opacity = 0.45; }
      if (/^lamp$/.test(m.name)) { m.emissive = new THREE.Color('#ffe2a0'); m.emissiveIntensity = 0.35; }
    }
  });
  protos.set(name, scene);
}
/** Browser: fetch every GLB from public/models/furniture. Never throws; furniture falls back to code-drawn models. */
export function loadFurnitureLibrary(onProgress = () => {}) {
  return ready ??= (async () => {
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const base = (import.meta.env?.BASE_URL ?? '/') + 'models/furniture/', loader = new GLTFLoader(), names = Object.keys(BOUNDS);
      let n = 0, next = 0;
      // A few requests at a time: phones on the LAN stall when 100+ files are requested at once.
      const worker = async () => {
        while (next < names.length) {
          const name = names[next++];
          for (let attempt = 0; attempt < 3 && !protos.has(name); attempt++) {
            try { const g = await loader.loadAsync(base + name + '.glb'); prepare(name, g.scene); } catch (e) { if (attempt === 2) console.warn('Furniture model missing:', name, e.message); }
          }
          onProgress(++n / names.length);
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
    } catch (e) { console.warn('Furniture models unavailable:', e.message); }
    return protos;
  })();
}
/** Node tests: parse the GLB files from disk with the same loader. */
export async function loadFurnitureLibraryFromFiles(readFile, dir) {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  for (const name of Object.keys(BOUNDS)) {
    const b = await readFile(`${dir}/${name}.glb`), ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    const g = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
    prepare(name, g.scene);
  }
  ready = Promise.resolve(protos);
  return protos;
}
/** Size in metres of a kit model at a uniform scale (default KIT_SCALE), honouring a quarter-turn. */
export function kitSize(name, scale = KIT_SCALE, turn = 0) {
  const b = BOUNDS[name]; if (!b) return null;
  const [w, h, d] = b.s.map((v) => v * scale);
  return turn % 2 ? [d, h, w] : [w, h, d];
}
/** A centred clone (footprint centred on the origin, base on y=0). */
export function kitModel(name) {
  const p = protos.get(name), b = BOUNDS[name]; if (!p || !b) return null;
  const inner = p.clone(true);
  inner.position.set(-(b.m[0] + b.s[0] / 2), -b.m[1], -(b.m[2] + b.s[2] / 2));
  const g = new THREE.Group(); g.name = 'Kit:' + name; g.add(inner);
  return g;
}
