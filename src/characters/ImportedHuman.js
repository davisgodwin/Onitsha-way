import * as THREE from "three";
import { MODELS } from "../render/ModelLibrary.js";

// Supplied face, hands and exposed limbs, fitted once to the game's canonical bind pose.
// Native FBX animation axes are NOT mixed with gameplay bones. Every style uses one skeleton.
const cache = new Map();
const aliases = {
  Body: "hips",
  Hips: "hips",
  Abdomen: "spine",
  Torso: "chest",
  Neck: "neck",
  Head: "head",
};
for (const s of ["L", "R"]) {
  Object.assign(aliases, {
    ["Shoulder" + s]: "chest",
    ["UpperArm" + s]: "upperArm." + s,
    ["LowerArm" + s]: "foreArm." + s,
    ["Palm" + s]: "hand." + s,
    ["UpperLeg" + s]: "thigh." + s,
    ["LowerLeg" + s]: "shin." + s,
    ["Foot" + s]: "foot." + s,
  });
  for (const n of ["Thumb1", "Thumb2", "MiddleHand", "Fingers"])
    aliases[n + s] = "hand." + s;
}
const ends = {
  UpperArm: "LowerArm",
  LowerArm: "Palm",
  UpperLeg: "LowerLeg",
  LowerLeg: "Foot",
};
const next = {
  "upperArm.L": "foreArm.L",
  "upperArm.R": "foreArm.R",
  "foreArm.L": "hand.L",
  "foreArm.R": "hand.R",
  "thigh.L": "shin.L",
  "thigh.R": "shin.R",
  "shin.L": "foot.L",
  "shin.R": "foot.R",
};
export function suppliedBody(female, J, boneIndex) {
  const id = "human-" + (female ? "female_tanktop" : "male_casual");
  if (cache.has(id)) return cache.get(id);
  const model = MODELS.get(id);
  if (!model) throw Error("Supplied character model missing: " + id);
  model.scene.updateMatrixWorld(true);
  const buckets = { skin: [], eyes: [], scalp: [] },
    v = new THREE.Vector3(),
    tmp = new THREE.Vector3();
  model.scene.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const mat = mesh.material;
    if (Array.isArray(mat) || !/^(Skin|Eyes|Hair|HairBase)$/i.test(mat.name))
      return;
    const geo = mesh.geometry,
      index = geo.index,
      p = geo.attributes.position,
      si = geo.attributes.skinIndex,
      sw = geo.attributes.skinWeight;
    const bind = mesh.skeleton.boneInverses.map((m) =>
      new THREE.Vector3()
        .setFromMatrixPosition(m.clone().invert())
        .applyMatrix4(mesh.matrixWorld),
    );
    const names = mesh.skeleton.bones.map((b) => b.name),
      byName = Object.fromEntries(names.map((n, i) => [n, bind[i]]));
    const warp = (point, name) => {
      const key = aliases[name] ?? "hips";
      if (key === "head") {
        const cy = female ? 1.638 : 1.635,
          rx = female ? 0.096 : 0.1,
          ry = female ? 0.108 : 0.113,
          rz = female ? 0.107 : 0.11;
        const p = point
          .clone()
          .sub(new THREE.Vector3(0, female ? 1.648 : 1.632, -0.012))
          .multiply(new THREE.Vector3(0.92, 1, 0.9))
          .add(new THREE.Vector3(0, cy, 0.012));
        // Keep the supplied forehead and scalp fitted together when reducing the native quiff.
        const line = cy + 0.022;
        if (p.y > line) p.y = line + (p.y - line) * 0.68;
        return p;
      }
      const sourceName = name.replace(
          /^(Thumb1|Thumb2|MiddleHand|Fingers)/,
          "Palm",
        ),
        origin = byName[sourceName] ?? byName.Body,
        target = new THREE.Vector3(...J[key].p);
      let end, tail;
      const side = name.slice(-1),
        stem = name.slice(0, -1);
      if (ends[stem]) {
        end = byName[ends[stem] + side];
        tail = new THREE.Vector3(...J[next[key]].p);
      } else if (key.startsWith("hand.")) {
        end = origin
          .clone()
          .add(new THREE.Vector3(side === "L" ? 0.21 : -0.21, 0, 0));
        tail = target
          .clone()
          .add(new THREE.Vector3(side === "L" ? 0.004 : -0.004, -0.105, 0.012));
      }
      if (!end || !tail) return point.clone().sub(origin).add(target);
      const axis = end.clone().sub(origin),
        length = axis.length(),
        to = tail.clone().sub(target),
        targetLen = to.length();
      axis.normalize();
      to.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(axis, to),
        d = point.clone().sub(origin),
        t = d.dot(axis);
      d.addScaledVector(axis, -t).applyQuaternion(q);
      d.addScaledVector(to, (t * targetLen) / length);
      return d.add(target);
    };
    for (let k = 0; k < (index?.count ?? p.count); k += 3) {
      const vertices = [];
      let category;
      for (let n = 0; n < 3; n++) {
        const i = index ? index.getX(k + n) : k + n;
        v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
        let max = -1,
          name = "";
        for (let a = 0; a < 4; a++)
          if (sw.array[i * 4 + a] > max) {
            max = sw.array[i * 4 + a];
            name = names[si.array[i * 4 + a]];
          }
        const alias = aliases[name] ?? "hips";
        if (/Hair/.test(mat.name) && alias !== "head") {
          category = "skip";
          break;
        }
        if (mat.name === "Eyes" && alias !== "head") {
          category = "skip";
          break;
        }
        if (
          mat.name === "Skin" &&
          !/^(head|upperArm|foreArm|hand|thigh|shin)/.test(alias)
        ) {
          category = "skip";
          break;
        }
        const mapped = new Map();
        tmp.set(0, 0, 0);
        let sum = 0;
        for (let a = 0; a < 4; a++) {
          const weight = sw.array[i * 4 + a];
          if (weight <= 0) continue;
          const nm = names[si.array[i * 4 + a]],
            key = aliases[nm] ?? alias;
          tmp.addScaledVector(warp(v, nm), weight);
          sum += weight;
          const bi = boneIndex[key];
          mapped.set(bi, (mapped.get(bi) ?? 0) + weight);
        }
        tmp.divideScalar(sum || 1);
        // Source hair includes bob/long-hair skirts, not a complete bare skull. Fold that lower
        // envelope into a closed scalp before recolouring/trimming, never into skin-coloured flaps.
        if (/Hair/.test(mat.name)) {
          const cy = female ? 1.638 : 1.635,
            rx = female ? 0.096 : 0.1,
            ry = female ? 0.108 : 0.113,
            rz = female ? 0.107 : 0.11;
          if (tmp.y < cy + 0.025) {
            const u = new THREE.Vector3(
                tmp.x / rx,
                (tmp.y - cy) / ry,
                (tmp.z - 0.012) / rz,
              ),
              L = u.length();
            if (L > 1) {
              u.multiplyScalar(1 / L);
              tmp.set(u.x * rx, cy + u.y * ry, 0.012 + u.z * rz);
            }
          }
        }
        const weights = [...mapped].sort((a, b) => b[1] - a[1]).slice(0, 4);
        vertices.push({ p: tmp.toArray(), weights });
        category = /Hair/.test(mat.name)
          ? "scalp"
          : mat.name === "Eyes"
            ? "eyes"
            : "skin";
      }
      if (category !== "skip") buckets[category].push(...vertices);
    }
  });
  const result = {};
  for (const [key, verts] of Object.entries(buckets)) {
    const pos = [],
      indices = [],
      weights = [],
      uv = [];
    for (const v of verts) {
      pos.push(...v.p);
      uv.push(0, 0);
      for (let a = 0; a < 4; a++) {
        indices.push(v.weights[a]?.[0] ?? 0);
        weights.push(v.weights[a]?.[1] ?? 0);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3),
    );
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
    geo.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(weights, 4),
    );
    geo.setIndex(verts.map((_, i) => i));
    geo.computeVertexNormals();
    result[key] = geo;
  }
  cache.set(id, result);
  return result;
}

// Remove skin under clothing rather than inflating garments or allowing poke-through.
export function coveredSkin(source, { shorts, long, outfit }) {
  const geo = source.clone(),
    p = geo.attributes.position,
    si = geo.attributes.skinIndex,
    sw = geo.attributes.skinWeight,
    kept = [];
  const threshold =
    outfit === "ankara_gown"
      ? 0.91
      : outfit === "blouse_skirt"
        ? 0.37
        : shorts
          ? 0.695
          : -Infinity;
  for (let i = 0; i < p.count; i += 3) {
    let y = 0;
    for (let k = 0; k < 3; k++) y += p.getY(i + k) / 3;
    let dominant = 0,
      w = -1;
    for (let k = 0; k < 4; k++)
      if (sw.array[i * 4 + k] > w) {
        w = sw.array[i * 4 + k];
        dominant = si.array[i * 4 + k];
      }
    // Canonical bone indices: head5, arms6..11, legs12..17.
    const leg = dominant >= 12,
      arm = dominant >= 6 && dominant <= 11;
    if (leg && y > threshold) continue;
    if (arm && y > (long ? 0.942 : 1.283)) continue;
    kept.push(i, i + 1, i + 2);
  }
  geo.setIndex(kept);
  return geo;
}
// Clip a fitted scalp at the hairstyle's hairline; do not paint entire forehead triangles.
export function suppliedScalp(
  source,
  center,
  rx,
  ry,
  rz,
  thickness,
  frontLine,
  backLine,
) {
  const p = source.attributes.position,
    si = source.attributes.skinIndex,
    sw = source.attributes.skinWeight,
    positions = [],
    uv = [];
  const signed = (v) => {
    const z = Math.max(-1, Math.min(1, (v.z - center.z) / rz)),
      t = Math.max(0, Math.min(1, (z + 0.6) / 1.45)),
      smooth = t * t * (3 - 2 * t),
      line =
        backLine + (frontLine - backLine) * smooth - (1 - Math.abs(z)) * 0.18;
    return v.y - center.y - line * ry;
  };
  for (let i = 0; i < p.count; i += 3) {
    const poly = [];
    let head = 0;
    for (let j = 0; j < 3; j++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i + j);
      poly.push(v);
      for (let k = 0; k < 4; k++)
        if (si.array[(i + j) * 4 + k] === 5)
          head += sw.array[(i + j) * 4 + k] / 3;
    }
    if (head < 0.85) continue;
    const clipped = [];
    for (let j = 0; j < poly.length; j++) {
      const a = poly[j],
        b = poly[(j + 1) % poly.length],
        da = signed(a),
        db = signed(b);
      if (da >= 0) clipped.push(a);
      if (da >= 0 !== db >= 0) clipped.push(a.clone().lerp(b, da / (da - db)));
    }
    for (let j = 1; j + 1 < clipped.length; j++)
      for (const v of [clipped[0], clipped[j], clipped[j + 1]]) {
        const d = v.clone().sub(center),
          n = d.clone().normalize(),
          q = v.clone().addScaledVector(n, Math.max(0.0015, thickness * 0.55));
        positions.push(q.x, q.y, q.z);
        uv.push(
          0.5 + Math.atan2(d.x, d.z) / (2 * Math.PI),
          0.5 +
            Math.asin(Math.max(-1, Math.min(1, d.y / d.length()))) / Math.PI,
        );
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(Array.from({ length: positions.length / 3 }, (_, i) => i));
  g.computeVertexNormals();
  return g;
}
