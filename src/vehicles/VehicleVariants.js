import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clipVehicleGeometry, completeCoach } from "./VehicleGeometry.js";
import { modelGeometry } from "../render/ModelLibrary.js";
import { CATALOGUE_BY_ID } from "../data/VehicleCatalogue.js";
import { buildKekeGeometry } from "./KekeModel.js";
import { buildMinibusGeometry } from "./MinibusModel.js";
import { commercialBus, lorry, coasterBus } from "./CarModels.js";
const cache = new Map();
function colored(g, color) {
  g = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(color),
    a = [];
  for (let i = 0; i < g.attributes.position.count; i++) a.push(c.r, c.g, c.b);
  g.setAttribute("color", new THREE.Float32BufferAttribute(a, 3));
  g.deleteAttribute("uv");
  return g;
}
function box(w, h, d, x, y, z, c = "#ffffff") {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return colored(g, c);
}
function keep(g, predicate) {
  g = g.index ? g.toNonIndexed() : g;
  const a = { position: [], normal: [], color: [] };
  for (let t = 0; t < g.attributes.position.count; t += 3) {
    const p = [0, 1, 2].map((k) =>
      new THREE.Vector3().fromBufferAttribute(g.attributes.position, t + k),
    );
    if (!predicate(p, t)) continue;
    for (let k = 0; k < 3; k++)
      for (const key of Object.keys(a)) {
        const att = g.attributes[key];
        a[key].push(att.getX(t + k), att.getY(t + k), att.getZ(t + k));
      }
  }
  const out = new THREE.BufferGeometry();
  for (const k of Object.keys(a))
    out.setAttribute(k, new THREE.Float32BufferAttribute(a[k], 3));
  return out;
}
function fit(g, L, W, H) {
  g = g.index ? g.toNonIndexed() : g;
  g.deleteAttribute("uv");
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.scale(
    W / (b.max.x - b.min.x),
    H / (b.max.y - b.min.y),
    L / (b.max.z - b.min.z),
  );
  return g;
}
function bike(M) {
  const src = modelGeometry("car-sedan"),
    c = src.attributes.color;
  let wheel = keep(
    src,
    (ps, t) =>
      ps.every((v) => v.x > 0.6 && v.y < 0.67 && v.z > 0.85 && v.z < 1.75) &&
      c.getX(t) + c.getY(t) + c.getZ(t) < 2.3,
  );
  if (wheel.attributes.position.count === 0)
    throw Error("Donor wheel extraction failed");
  wheel = fit(wheel, 0.64, 0.13, 0.64);
  wheel.translate(0, -0.32, 0);
  // Keep the donor hub detail, with a continuous rubber tyre rather than disconnected spokes.
  const tyre = new THREE.TorusGeometry(0.265, 0.055, 8, 24);
  tyre.rotateY(Math.PI / 2);
  wheel = mergeGeometries([wheel, colored(tyre, "#171b1d")], false);
  const beam = (a, b, r, color) => {
    const v = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),
      g = new THREE.CylinderGeometry(r, r, v.length(), 8);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        v.normalize(),
      ),
    );
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    return colored(g, color);
  };
  const tank = new THREE.SphereGeometry(1, 12, 8);
  tank.scale(0.22, 0.17, 0.32);
  tank.translate(0, 0.82, 0.17);
  const parts = [
    wheel.clone().translate(0, 0.32, 0.68),
    wheel.clone().translate(0, 0.32, -0.68),
    colored(tank, "#ffffff"),
    box(0.37, 0.1, 0.85, 0, 0.94, -0.32, "#202628"),
    box(0.26, 0.29, 0.36, 0, 0.51, 0.05, "#626d70"),
  ];
  for (const side of [-1, 1]) {
    parts.push(
      beam(
        [side * 0.09, 0.33, -0.68],
        [side * 0.14, 0.72, -0.2],
        0.035,
        "#323c3e",
      ),
      beam(
        [side * 0.14, 0.72, -0.2],
        [side * 0.11, 0.37, 0.67],
        0.04,
        "#323c3e",
      ),
      beam(
        [side * 0.11, 0.37, 0.67],
        [side * 0.17, 1.05, 0.57],
        0.035,
        "#aab4b7",
      ),
    );
  }
  parts.push(
    beam([-0.35, 1.13, 0.56], [0.35, 1.13, 0.56], 0.035, "#242a2c"),
    box(0.4, 0.04, 0.2, 0, 0.91, -0.83, "#ffffff"),
    box(0.24, 0.09, 0.06, 0, 0.86, -0.94, "#9e0b0b"),
    box(0.54, 0.05, 0.13, 0, 0.43, -0.08, "#343d40"),
  );
  const lamp = new THREE.CylinderGeometry(0.13, 0.13, 0.11, 14);
  lamp.rotateX(Math.PI / 2);
  lamp.translate(0, 1, 0.78);
  parts.push(colored(lamp, "#f4f1e2"));
  for (const z of [-0.68, 0.68]) {
    const f = new THREE.TorusGeometry(0.34, 0.045, 6, 16, Math.PI);
    f.rotateY(Math.PI / 2);
    f.translate(0, 0.32, z);
    parts.push(colored(f, "#ffffff"));
  }
  return mergeGeometries(parts, false);
}
/** One cached, instancing-friendly exterior per catalogue entry, derived from the supplied models. */
export function variantGeometry(id) {
  if (cache.has(id)) return cache.get(id);
  const M = CATALOGUE_BY_ID[id];
  if (!M) throw Error("Unknown catalogue vehicle " + id);
  let g;
  if (M.body === "keke") g = buildKekeGeometry();
  else if (M.body === "motorcycle") g = bike(M);
  else if (M.body === "minibus") g = buildMinibusGeometry();
  else if (M.body === "cbus") g = commercialBus();
  else if (M.body === "bus") g = coasterBus(); // v0.48: our own coach model
  else if (M.body === "lorry") g = lorry();
  else g = modelGeometry("car-" + (M.body === "pickup" ? "suv" : M.body));
  g = fit(g, M.len, M.wid, M.height);

  const p = g.attributes.position;
  // Profile-specific roof/bonnet treatment; these are stylised interpretations, not exact replicas.
  if (["coupe", "rear_coupe", "muscle"].includes(M.style)) {
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      if (y > 0.7) {
        const t = Math.min(1, (y - 0.7) / 0.55);
        z += t * (M.style === "rear_coupe" ? 0.25 : -0.25);
        x *= 1 - t * 0.1;
      }
      p.setXYZ(i, x, y, z);
    }
  }
  if (M.style === "boxy") {
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > M.height * 0.56)
        p.setX(i, Math.max(-M.wid / 2, Math.min(M.wid / 2, p.getX(i) * 1.08)));
    }
  }
  // v0.48 premium shapes: slab sides, flat roofs, blunt noses and sloping tails (stylised, no badges)
  const H = M.height, W2 = M.wid / 2, L2 = M.len / 2;
  const reshape = (fn) => { for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, v[0], v[1], v[2]); } };
  const slab = (x, k, y0, y, lim = 0.97) => (y > H * y0 ? Math.sign(x) * Math.min(Math.abs(x) * k, W2 * lim) : x);
  if (M.style === "gclass") reshape((x, y, z) => [slab(x, 1.16, 0.4, y), y > H * 0.8 ? H * 0.995 : y, Math.abs(z) > L2 * 0.68 && y > H * 0.28 ? Math.sign(z) * Math.min(Math.abs(z) * 1.07, L2) : z]);
  if (M.style === "escalade") reshape((x, y, z) => [slab(x, 1.12, 0.45, y), y > H * 0.86 ? H * 0.99 : y, z > L2 * 0.7 && y > H * 0.3 ? Math.min(z * 1.05, L2) : z]);
  if (M.style === "cruiser") reshape((x, y, z) => [slab(x, 1.1, 0.5, y), y > H * 0.88 ? H * 0.99 : y, z]);
  if (M.style === "floating") reshape((x, y, z) => [slab(x, 1.07, 0.56, y), y > H * 0.9 ? H * 0.985 : y, z]);
  if (["sportsuv", "fastback"].includes(M.style)) reshape((x, y, z) => { if (y > H * 0.6 && z < 0) { const t = Math.min(1, (y - H * 0.6) / (H * 0.4)); z += t * (M.style === "fastback" ? 0.55 : 0.35); y -= t * (M.style === "fastback" ? 0.04 : 0.06) * (-z / L2); } return [x, y, z]; });
  const parts = [];
  const cyl = (r, h, x, y, z, c, axis = "z", seg = 14) => { const g = new THREE.CylinderGeometry(r, r, h, seg); if (axis === "z") g.rotateX(Math.PI / 2); if (axis === "x") g.rotateZ(Math.PI / 2); g.translate(x, y, z); return colored(g, c); };
  if (M.style === "gclass") {
    const tyre = new THREE.TorusGeometry(0.3, 0.11, 8, 20); tyre.translate(0, H * 0.5, -L2 - 0.12); parts.push(colored(tyre, "#151719"), cyl(0.24, 0.16, 0, H * 0.5, -L2 - 0.09, M.id === "mercedes_g63" ? "#1b1b1b" : "#c9ccce"));
    for (const x of [-W2 * 0.68, W2 * 0.68]) { parts.push(cyl(0.12, 0.06, x, H * 0.52, L2 + 0.02, "#f4f6f2"), cyl(0.15, 0.04, x, H * 0.52, L2 + 0.005, "#30363a")); parts.push(box(0.16, 0.07, 0.12, x, H * 0.6 + 0.02, L2 - 0.25, "#f2a20c")); parts.push(box(0.16, 0.06, M.len * 0.58, Math.sign(x) * (W2 + 0.05), 0.32, 0, "#202426")); }
    const bars = M.id === "mercedes_g63" ? 11 : 3; for (let i = 0; i < bars; i++) parts.push(M.id === "mercedes_g63" ? box(0.025, 0.3, 0.03, -0.3 + i * 0.06, H * 0.5, L2 + 0.03, "#c9ccce") : box(0.62, 0.03, 0.03, 0, H * 0.43 + i * 0.09, L2 + 0.03, "#c9ccce"));
    parts.push(box(M.wid * 0.94, 0.22, 0.12, 0, 0.42, L2 + 0.04, "#1c1f21"));
  }
  if (M.style === "floating") { parts.push(box(M.wid * 0.84, 0.035, M.len * 0.52, 0, H * 0.985 + 0.02, -0.15, "#101214")); for (const x of [-W2 * 0.62, W2 * 0.62]) parts.push(box(0.36, 0.05, 0.03, x, H * 0.58, L2 + 0.02, "#e9f1f5")); parts.push(box(M.wid * 0.7, 0.04, 0.03, 0, H * 0.6, -L2 - 0.02, "#a31010")); }
  if (M.style === "cruiser") { parts.push(box(M.wid * 0.6, 0.34, 0.04, 0, H * 0.45, L2 + 0.03, "#b9bdc0")); for (const x of [-W2 * 0.7, W2 * 0.7]) parts.push(box(0.05, 0.05, M.len * 0.55, x, H + 0.04, -0.2, "#2b2f31")); }
  if (M.style === "escalade") { parts.push(box(M.wid * 0.62, 0.5, 0.04, 0, H * 0.46, L2 + 0.03, "#15181a"), box(M.wid * 0.66, 0.05, 0.05, 0, H * 0.73, L2 + 0.03, "#c9ccce")); for (const x of [-W2 * 0.86, W2 * 0.86]) { parts.push(box(0.07, 0.55, 0.04, x, H * 0.52, L2 + 0.02, "#f4f6f2"), box(0.07, 0.75, 0.04, x, H * 0.62, -L2 - 0.02, "#b3120f")); } }
  if (M.style === "luxury") for (let i = 0; i < 3; i++) parts.push(box(M.wid * 0.36, 0.025, 0.03, 0, M.height * 0.31 + i * 0.07, L2 + 0.04, "#d4d7da"));
  if (M.style === "singleframe") { const g6 = new THREE.CylinderGeometry(0.3, 0.26, 0.5, 6); g6.rotateY(Math.PI / 6); g6.scale(1.1, 0.95, 0.12); g6.translate(0, M.height * 0.33, L2 + 0.01); parts.push(colored(g6, "#16191b")); parts.push(box(M.wid * 0.8, 0.035, 0.03, 0, M.height * 0.5, -L2 - 0.02, "#a31010")); }
  if (["sportsuv", "fastback", "twin_m"].includes(M.style)) { for (const x of [-0.55, -0.42, 0.42, 0.55]) parts.push(cyl(0.045, 0.12, x * M.wid / 1.9, 0.3, -L2 - 0.02, "#2a2d2f", "z", 10)); parts.push(box(M.wid * 0.84, 0.04, 0.03, 0, M.height * 0.56, -L2 - 0.01, "#a31010")); }
  if (M.style === "twin_m") for (const x of [-0.23, 0.23]) parts.push(box(0.34, 0.25, 0.045, x, M.height * 0.35, L2 + 0.015, "#121517"));
  if (M.body === "pickup") {
    const rear = -0.35, belt = 0.85;
    // Cut crossing triangles at the exact planes instead of discarding entire roof/side faces.
    const lower = clipVehicleGeometry(g, 1, belt, false);
    const upper = clipVehicleGeometry(clipVehicleGeometry(g, 1, belt), 2, rear);
    g = mergeGeometries([lower, upper], false);
    // Close the newly cut cab, including a framed opaque rear window. An open bed is intentional;
    // a view through the cab or through the bed floor is not.
    const top = M.height * .967, halfBottom = M.wid * .45, halfTop = M.wid * .37;
    const wall = new THREE.Shape([
      new THREE.Vector2(-halfBottom, .63), new THREE.Vector2(halfBottom, .63),
      new THREE.Vector2(halfBottom, 1.08), new THREE.Vector2(halfTop, top),
      new THREE.Vector2(-halfTop, top), new THREE.Vector2(-halfBottom, 1.08),
    ]);
    const window = new THREE.Path();window.moveTo(-.59,1.21);window.lineTo(-.59,1.61);window.lineTo(.59,1.61);window.lineTo(.59,1.21);window.closePath();wall.holes.push(window);
    const bulkhead = new THREE.ExtrudeGeometry(wall,{depth:.075,bevelEnabled:false});bulkhead.translate(0,0,rear-.075);
    const bedRear = -M.len/2+.12, bedFront = rear-.12, bedLength = bedFront-bedRear, bedCenter = (bedRear+bedFront)/2;
    parts.push(colored(bulkhead,'#ffffff'),
      box(1.20,.42,.035,0,1.41,rear-.038,'#1d2730'),
      box(M.wid-.12,.12,bedLength,0,.81,bedCenter,'#30393a'),
      box(.09,.53,bedLength,M.wid/2-.065,1.08,bedCenter),
      box(.09,.53,bedLength,-M.wid/2+.065,1.08,bedCenter),
      box(M.wid-.1,.53,.1,0,1.08,bedRear),
      box(M.wid-.12,.40,.08,0,1.02,bedFront),
      box(.13,.045,bedLength,M.wid/2-.065,1.365,bedCenter,'#30393a'),
      box(.13,.045,bedLength,-M.wid/2+.065,1.365,bedCenter,'#30393a'),
    );
  }
  if(!['keke','motorcycle'].includes(M.body)) {
    const passenger=['bus','cbus','minibus'].includes(M.body);
    const floor=passenger?.77:Math.max(.28,M.height-.99)-.16;
    const cabW=M.wid*.84,cabL=passenger?M.len*.87:M.body==='lorry'?1.7:M.body==='pickup'?1.8:M.len*.5;
    const center=M.body==='lorry'?M.len*.32:M.body==='pickup'?.35:-.12;
    parts.push(box(cabW,.12,cabL,0,floor,center,'#292d30'));
    const seatY=passenger?1.02:Math.max(.35,M.height-.98);
    const rows=passenger?Math.max(2,Math.floor((M.len-1.4)/.85)):M.body==='pickup'||M.body==='lorry'?1:2;
    for(let row=0;row<rows;row++)for(const side of[-1,1]){
      const z=passenger?M.len*.32-row*.85:center+.2-row*.85;
      parts.push(box(cabW*.36,.14,.5,side*cabW*.25,seatY-.07,z,'#4c5153'),box(cabW*.36,.49,.13,side*cabW*.25,seatY+.24,z-.27,'#4c5153'));
    }
    parts.push(box(cabW,.2,.32,0,seatY+.26,passenger?M.len*.4:center+.85,'#353b3f'));
    // Opaque inner lining below windows prevents looking through the far body from reverse faces.
    for(const side of[-1,1])parts.push(box(.05,.3,cabL,side*cabW*.5,floor+.2,center,'#32383b'));
  }
  parts.push(g);
  if (
    !["keke", "motorcycle", "bus", "lorry", "cbus", "minibus"].includes(M.body)
  ) {
    const z = M.len / 2 + 0.015,
      y = M.height * 0.35;
    if (M.style === "twin") {
      for (const x of [-0.23, 0.23])
        parts.push(box(0.34, 0.25, 0.045, x, y, z, "#20282c"));
    } else if (M.style === "spindle") {
      const grille = new THREE.CylinderGeometry(0.24, 0.39, 0.36, 4);
      grille.rotateY(Math.PI / 4);
      grille.scale(1, 0.9, 0.15);
      grille.translate(0, y, z);
      parts.push(colored(grille, "#222a2e"));
    } else {
      const width = M.style === "sport" || M.style === "wide" ? 0.9 : 0.72;
      parts.push(box(width, 0.18, 0.045, 0, y, z, "#222a2e"));
    }

    if (M.style === "muscle")
      for (const x of [-0.16, 0.16])
        parts.push(
          box(0.12, 0.012, 0.9, x, M.height * 0.46, M.len * 0.25, "#30363c"),
        );
  }
  const out = mergeGeometries(parts, false);
  out.computeVertexNormals();
  out.computeBoundingBox();
  out.computeBoundingSphere();
  out.userData = { catalogueId: id, suppliedBase: true, solidCabin: !["keke","motorcycle"].includes(M.body) };
  cache.set(id, out);
  return out;
}
