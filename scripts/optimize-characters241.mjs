// Offline one-time cleanup of supplied v24 GLBs: collapse tiny material primitives.
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
globalThis.FileReader = class {
  readAsArrayBuffer(b) {
    b.arrayBuffer().then((a) => {
      this.result = a;
      this.onloadend?.();
    });
  }
  readAsDataURL(b) {
    b.arrayBuffer().then((a) => {
      this.result =
        "data:" + b.type + ";base64," + Buffer.from(a).toString("base64");
      this.onloadend?.();
    });
  }
};
const dir = "public/models/v24",
  catalogue = JSON.parse(fs.readFileSync(dir + "/catalogue.json"));
for (const e of catalogue.filter(
  (e) => e.type === "human" && !e.optimizedPrimitives,
)) {
  const file = dir + "/" + e.id + ".glb",
    b = fs.readFileSync(file),
    g = await new GLTFLoader().parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      "",
    );
  const meshes = [];
  g.scene.traverse((o) => {
    if (o.isSkinnedMesh) meshes.push(o);
  });
  if (meshes.length <= 8) continue;
  const groups = new Map();
  for (const m of meshes) {
    if (Array.isArray(m.material)) throw Error("Unexpected grouped input");
    const key = m.material.name;
    if (!groups.has(key)) groups.set(key, { mat: m.material, parts: [] });
    const geo = m.geometry.index
      ? m.geometry.toNonIndexed()
      : m.geometry.clone();
    geo.clearGroups();
    groups.get(key).parts.push(geo);
  }
  const materials = [],
    geometries = [];
  for (const a of groups.values()) {
    materials.push(a.mat);
    geometries.push(mergeGeometries(a.parts, false));
  }
  const geo = mergeGeometries(geometries, true),
    first = meshes[0],
    merged = new T.SkinnedMesh(geo, materials);
  merged.name = "SuppliedCharacter";
  merged.bind(first.skeleton, first.bindMatrix);
  first.parent.add(merged);
  for (const m of meshes) m.removeFromParent();
  const out = await new GLTFExporter().parseAsync(g.scene, {
    binary: true,
    animations: g.animations,
  });
  fs.writeFileSync(file, Buffer.from(out));
  e.bytes = out.byteLength;
  e.optimizedPrimitives = materials.length;
  console.log(
    e.id,
    meshes.length + " → " + materials.length,
    b.length + " → " + out.byteLength,
  );
}
fs.writeFileSync(dir + "/catalogue.json", JSON.stringify(catalogue, null, 2));
