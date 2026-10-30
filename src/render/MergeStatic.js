import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Merge the static meshes inside `root` into one mesh per material (plus shadow flags and attribute
 * layout), baked into `root`'s own space. Each original mesh costs a draw call, and these groups are
 * built from dozens of small pieces (railings, letters, pillars, car parts) that never move again, so
 * merging cuts draw calls without changing what you see.
 *
 * Left alone: instanced/skinned/morphing meshes, multi-material meshes, anything under an object with
 * `userData.dynamic`, objects rejected by `skip(object)`, and invisible meshes. Named sub-groups stay in
 * place as empty markers (their transforms are kept), so code that looks them up still finds them.
 * Returns { before, after } mesh counts.
 */
export function mergeStatic(root, { skip = () => false, minGroup = 2 } = {}) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const blocked = new Set();
  root.traverse((o) => { if (o !== root && (o.userData?.dynamic || skip(o))) o.traverse((c) => blocked.add(c)); });
  let before = 0;
  root.traverse((o) => {
    if (!o.isMesh || blocked.has(o)) return;
    before++;
    if (o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.morphTargetInfluences || !o.visible || !o.geometry?.attributes?.position) return;
    let hidden = false; for (let p = o.parent; p && p !== root; p = p.parent) if (!p.visible) hidden = true;
    if (hidden) return;
    const g = o.geometry;
    const attrs = Object.keys(g.attributes).sort().join(',');
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${o.renderOrder}|${attrs}|${g.index ? 'i' : 'n'}`;
    (buckets.get(key) ?? buckets.set(key, []).get(key)).push(o);
  });
  let after = before;
  for (const list of buckets.values()) {
    if (list.length < minGroup) continue;
    const geos = list.map((o) => { const geo = o.geometry.clone(); geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, o.matrixWorld)); for (const k of Object.keys(geo.morphAttributes)) delete geo.morphAttributes[k]; return geo; });
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const first = list[0];
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.name = 'merged:' + (first.material.name || first.name || 'static');
    mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow; mesh.renderOrder = first.renderOrder;
    mesh.userData.mergedFrom = list.length;
    for (const o of list) o.parent.remove(o); // geometries may be shared (cached car parts), so they're not disposed
    root.add(mesh);
    after -= list.length - 1;
  }
  return { before, after };
}
