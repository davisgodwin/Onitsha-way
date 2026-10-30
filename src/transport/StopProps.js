import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/*
  Bus-stop furniture at every platform: a pole with a yellow "BUS STOP" plate, and at the named
  stops (markets, Upper Iweka, Bridgehead, the mall…) a simple zinc-roofed shelter with a bench.
  Everything is merged into two meshes (vertex-coloured frame + the sign plates).
*/

function colored(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv && !g.userData.keepUv) g.deleteAttribute('uv');
  return g;
}

function signTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f2c200'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#1b1b1b'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 116);
  g.fillStyle = '#1b1b1b'; g.font = '900 46px "Bricolage Grotesque", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('BUS STOP', 128, 50);
  g.font = '700 22px "DM Sans", system-ui, sans-serif';
  g.fillText('KEKE · BUS', 128, 96);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function buildStopProps(network, collision) {
  const frame = [], plates = [];
  const place = (geo, x, y, z, yaw) => { geo.rotateY(yaw); geo.translate(x, y, z); return geo; };
  let shelters = 0;
  for (const stop of network.stops) {
    for (const p of stop.platforms) {
      // sign faces traffic coming towards the platform; the shelter opens to the road
      const yaw = Math.atan2(p.dx, p.dz);
      const ox = p.poleX, oz = p.poleZ;
      frame.push(colored(place(new THREE.CylinderGeometry(0.045, 0.045, 2.6, 8), ox, 1.3, oz, 0), '#4b4f52'));
      for (const side of [1, -1]) {
        const plate = new THREE.PlaneGeometry(0.78, 0.39);
        plate.translate(0, 0, 0.022); // just proud of the 3 cm backing board
        plate.rotateY(side > 0 ? Math.PI : 0);
        place(plate, ox, 2.35, oz, yaw);
        plates.push(plate);
      }
      frame.push(colored(place(new THREE.BoxGeometry(0.82, 0.43, 0.03), ox, 2.35, oz, yaw), '#2a2a2a'));
      p.oldCi = [collision.addCircle(ox, oz, 0.14)]; // v0.48: the colliders stay exactly as before; StopShelters.js draws the stops
      // shelter 3 m back from the pole, set back from the kerb (only where there is room)
      const rx = -p.dz, rz = p.dx; // right of travel = away from the road at a right-side platform
      const sx = p.x + p.dx * -3 + rx * 1.1, sz = p.z + p.dz * -3 + rz * 1.1;
      if (stop.named && p.index === 0 && collision.isFree(sx, sz, 1.1)) {
        for (const k of [-1.3, 1.3]) for (const b of [-0.5, 0.5]) {
          frame.push(colored(place(new THREE.BoxGeometry(0.07, 2.4, 0.07), sx + p.dx * k + rx * b, 1.2, sz + p.dz * k + rz * b, 0), '#5a5f63'));
          p.oldCi.push(collision.addCircle(sx + p.dx * k + rx * b, sz + p.dz * k + rz * b, 0.08));
        }
        frame.push(colored(place(new THREE.BoxGeometry(1.5, 0.06, 3.0), sx, 2.43, sz, yaw), '#8a9298')); // zinc roof
        frame.push(colored(place(new THREE.BoxGeometry(0.4, 0.06, 2.4), sx + rx * 0.3, 0.46, sz + rz * 0.3, yaw), '#7b5a3a')); // bench seat
        frame.push(colored(place(new THREE.BoxGeometry(0.06, 0.4, 2.4), sx + rx * 0.5, 0.75, sz + rz * 0.5, yaw), '#7b5a3a')); // bench back
        shelters++;
      }
    }
  }
  const group = new THREE.Group(); group.name = 'BusStops';
  if (network.redrawn !== false) { group.userData.stats = { platforms: network.stops.reduce((a, s) => a + s.platforms.length, 0), shelters }; return group; } // drawn by StopShelters.js (v0.48)
  if (frame.length) {
    const m = new THREE.Mesh(mergeGeometries(frame, false), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.3 }));
    m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
  if (plates.length) {
    const tex = signTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0 });
    group.add(new THREE.Mesh(mergeGeometries(plates.map((g) => g.toNonIndexed()), false), mat));
    group.userData.nightMaterials = [{ mat, max: 0.35 }];
  }
  group.userData.stats = { platforms: network.stops.reduce((a, s) => a + s.platforms.length, 0), shelters };
  return group;
}
