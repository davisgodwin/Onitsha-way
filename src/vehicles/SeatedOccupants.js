import * as THREE from "three";
import { buildHuman, defaultAppearance } from "../characters/HumanRig.js";
import { SEAT_HEIGHT } from "../characters/CharacterAnimator.js";
const baked = [];
export function poseMotorcycle(h) {
  const b = h.bones;
  for (const [side, sign] of [
    ["L", 1],
    ["R", -1],
  ]) {
    b["thigh." + side].rotation.set(-1.05, 0, sign * 0.32);
    b["shin." + side].rotation.set(1.6, 0, 0);
    b["foot." + side].rotation.set(-0.35, 0, 0);
    b["upperArm." + side].rotation.set(-0.95, 0, sign * 0.12);
    b["foreArm." + side].rotation.set(-0.35, 0, 0);
  }
  b.spine.rotation.x = 0.12;
}

/** Bake the supplied skinned body in a true seated pose once, then instance it for the fleet.
 * No per-rider skeletons, per-frame skinning or old box-head fallback. */
export function occupantTemplates() {
  if (baked.length) return baked;
  const looks = [
    ["male", "tee_shorts", "lowcut", 7],
    ["female", "ankara_shirt", "bun", 3],
    ["male", "shirt_trousers", "waves", 2],
    ["female", "shirt_trousers", "bob", 4],
    ["male", "shirt_trousers", "lowcut", 7, true],
    ["female", "shirt_trousers", "bob", 4, true],
  ];
  for (const [gender, outfit, hair, color, bike] of looks) {
    const h = buildHuman({ ...defaultAppearance(gender), outfit, hair, color });
    h.animate(0, { speed: 0, grounded: true, seated: true });
    if (bike) poseMotorcycle(h);
    h.group.updateMatrixWorld(true);
    h.skeleton.update();
    const parts = [];
    for (const mesh of h.meshes) {
      const g = mesh.geometry.clone(),
        p = g.attributes.position,
        v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        mesh.applyBoneTransform(i, v);
        v.applyMatrix4(mesh.matrixWorld);
        v.y -= SEAT_HEIGHT;
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.deleteAttribute("skinIndex");
      g.deleteAttribute("skinWeight");
      // Vertex clustering collapses sub-centimetre tessellation, preserving the supplied face and garment UVs.
      const index = [],
        ids = new Map(),
        pos = [],
        uv = [],
        src = g.index?.array ?? Array.from({ length: p.count }, (_, i) => i);
      const u = g.attributes.uv;
      for (let t = 0; t < src.length; t += 3) {
        const tri = [];
        for (let k = 0; k < 3; k++) {
          const j = src[t + k],
            x = Math.round(p.getX(j) / 0.021) * 0.021,
            y = Math.round(p.getY(j) / 0.021) * 0.021,
            z = Math.round(p.getZ(j) / 0.021) * 0.021,
            key = [
              x,
              y,
              z,
              u ? Math.round(u.getX(j) * 12) : 0,
              u ? Math.round(u.getY(j) * 12) : 0,
            ].join(",");
          let n = ids.get(key);
          if (n === undefined) {
            n = pos.length / 3;
            ids.set(key, n);
            pos.push(x, y, z);
            if (u) uv.push(u.getX(j), u.getY(j));
          }
          tri.push(n);
        }
        if (new Set(tri).size === 3) index.push(...tri);
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      if (u) out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      out.setIndex(index);
      out.computeVertexNormals();
      out.computeBoundingSphere();
      parts.push({ geometry: out, material: mesh.material });
      g.dispose();
    }
    baked.push({
      parts,
      suppliedModel: true,
      appearance: { gender, outfit, hair },
    });
  }
  return baked;
}
export class SeatedOccupants {
  constructor(parent, capacity = 180) {
    this.group = new THREE.Group();
    this.group.name = "SuppliedTransportOccupants";
    parent.add(this.group);
    this.templates = occupantTemplates();
    this.capacity = capacity;
    this.counts = this.templates.map(() => 0);
    this.meshes = this.templates.map((t, i) =>
      t.parts.map((p) => {
        const m = new THREE.InstancedMesh(p.geometry, p.material, capacity);
        m.count = 0;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.frustumCulled = false;
        m.castShadow = false;
        m.name = "SuppliedSeated:" + i;
        this.group.add(m);
        return m;
      }),
    );
    this.matrix = new THREE.Matrix4();
    this.local = new THREE.Matrix4();
    this.scale = new THREE.Matrix4();
  }
  begin() {
    this.counts.fill(0);
  }
  add(vehicleMatrix, seat, key, { bike = false } = {}) {
    const t = bike ? 4 + (Math.abs(key) % 2) : Math.abs(key) % 4,
      n = this.counts[t];
    if (n >= this.capacity) return;
    this.local.makeTranslation(...seat);
    this.matrix.multiplyMatrices(vehicleMatrix, this.local);
    for (const m of this.meshes[t]) m.setMatrixAt(n, this.matrix);
    this.counts[t]++;
  }
  end() {
    for (let i = 0; i < this.meshes.length; i++)
      for (const m of this.meshes[i]) {
        m.count = this.counts[i];
        if (m.count) m.instanceMatrix.needsUpdate = true;
      }
  }
}
