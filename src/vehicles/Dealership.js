import * as THREE from "three";
import { mergeStatic } from '../render/MergeStatic.js';
import { buildHuman, defaultAppearance } from "../characters/HumanRig.js";
import { gateSignTexture } from '../render/WorldTextures.js';
const signTexture = name => gateSignTexture(name.toUpperCase(), '');
/** A small off-road, open-front forecourt; no public road is fenced or used for stock. */
export function buildDealership(plot, controller, collision) {
  const group = new THREE.Group();
  group.name = "CarStand:" + plot.id;
  group.position.set(plot.x, 0, plot.z);
  group.rotation.y = plot.heading;
  group.userData.plot = plot;
  const mat = (c) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });
  const paving = mat("#909c99"),
    white = mat("#eee8d8"),
    teal = mat("#205057"),
    yellow = mat("#f0c45b");
  const box = (w, h, d, x, y, z, m) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = h > 0.2;
    group.add(o);
    return o;
  };
  const solid = (u, v, w, d, h) => {
    const pts = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ].map(([x, z]) => {
      const q = plot.at(u + x, v + z);
      return [q.x, q.z];
    });
    collision.addPolygon(pts, h);
  };
  box(34, 0.06, 26, 0, 0.03, 0, paving);
  box(10,.055,2.2,0,.025,-14,paving);
  for(const x of [-14.8,14.8]) {
    box(.12,2.9,.12,x,1.45,-12,teal);
    const streetSign=new THREE.Mesh(new THREE.PlaneGeometry(4.1,1.03),new THREE.MeshBasicMaterial({map:signTexture(plot.name),side:THREE.DoubleSide}));
    streetSign.position.set(x,2.4,-12);streetSign.rotation.y=Math.PI;group.add(streetSign);
  }
  // Short boundary rails leave the full front open for entry and long vehicles.
  for (const x of [-16.6, 16.6]) {
    box(0.12, 0.1, 25, x, 0.9, 0, teal);
    for (let z = -12; z <= 12; z += 4) {
      box(0.13, 1.1, 0.13, x, 0.55, z, teal);
      const q = plot.at(x, z);
      collision.addCircle(q.x, q.z, 0.12);
    }
  }
  box(33, 0.18, 0.16, 0, 0.65, 12.5, teal);
  solid(0, 12.5, 33, 0.18, 0.8);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 3.25),
    new THREE.MeshBasicMaterial({
      map: signTexture(plot.name),
      side: THREE.DoubleSide,
    }),
  );
  screen.position.set(0, 4, 11.8);
  screen.rotation.y = Math.PI;
  group.add(screen);
  for (const x of [-6, 6]) box(0.15, 5, 0.15, x, 2.5, 11.8, teal);
  // Sales office, covered desk and dealer use the same supplied human builder as the player.
  box(6, 2.6, 3, -11, 1.3, 10, teal);
  solid(-11, 10, 6, 3, 2.6);
  box(6.5, 0.18, 5.3, -11, 2.9, 8.8, white);
  box(3, 0.9, 0.75, -11, 0.45, 7.25, white);
  solid(-11, 7.25, 3, 0.75, 0.9);
  const app = {
    ...defaultAppearance("male"),
    outfit: "shirt_trousers",
    hair: "lowcut",
    color: 7,
  };
  const dealer = buildHuman(app);
  dealer.animate(0, { speed: 0, grounded: true });
  dealer.group.position.set(-11, 0, 8.1);
  dealer.group.rotation.y = Math.PI;
  group.add(dealer.group);
  group.userData.dealer = dealer;
  const dq = plot.at(-11, 8.1);
  collision.addCircle(dq.x, dq.z, 0.27);
  // Three representative stock displays, not one car per listing.
  const lotIndex=controller.dealerships.length;
  const displayModels = plot.models.slice(lotIndex*6,lotIndex*6+6);
  displayModels.forEach((id, i) => {
    const x = i<3 ? ((i%3)-1)*10 : [-11,7,13][i-3];
    const rowZ=i<3?2.0:-7.0;
    const car = controller.makeMesh(id, ["#d6dbde", "#233539", "#a74130"][i]);
    car.position.set(x, 0.07, rowZ);
    car.rotation.y = Math.PI;
    car.name = "DealerDisplay:" + id;
    group.add(car);
    const M = controller.g.traffic.typeInfo(id);
    solid(x, rowZ, M.wid + 0.2, M.len + 0.2, 1.5);
    for (const dx of [-2.1, 2.1])
      box(0.09, 0.015, 8.4, x + dx, 0.075, rowZ, white);
  });
  // Centre-front bay is always reserved for the purchase, never a stock display.
  for (const x of [-2.3, 2.3]) box(0.13, 0.015, 8.3, x, 0.08, -6, yellow);
  box(4.7, 0.015, 0.13, 0, 0.08, -10.2, yellow);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#113f45";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#ffd05c";
  ctx.textAlign = "center";
  ctx.font = "bold 42px Arial";
  ctx.fillText("COLLECTION", 256, 78);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 0.85),
    new THREE.MeshBasicMaterial({ map: tex }),
  );
  label.rotation.x = -Math.PI / 2;
  label.rotation.z = Math.PI;
  label.position.set(0, 0.09, -11);
  group.add(label);
  // the display cars, bay markings and signs never move: one mesh per material (the dealer stays separate)
  group.userData.mergeStats = mergeStatic(group, { skip: (o) => o === dealer.group });
  return group;
}
