import * as THREE from 'three';

/**
 * Falling rain around the camera: streaks drawn as line segments in a box that follows the view.
 * Procedural (no textures). Intensity 0..1 sets how many streaks are drawn and how visible they are.
 */
export class Rain {
  constructor(scene, { count = 2600, box = 46, height = 26 } = {}) {
    this.count = count; this.box = box; this.height = height;
    this.pos = new Float32Array(count * 6);
    this.drops = new Float32Array(count * 4); // x, y, z, speed
    for (let i = 0; i < count; i++) {
      this.drops[i * 4] = (Math.random() - 0.5) * box;
      this.drops[i * 4 + 1] = Math.random() * height;
      this.drops[i * 4 + 2] = (Math.random() - 0.5) * box;
      this.drops[i * 4 + 3] = 17 + Math.random() * 7;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.LineBasicMaterial({ color: '#c8d4e0', transparent: true, opacity: 0, depthWrite: false });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false; this.lines.name = 'Rain'; this.lines.visible = false;
    scene.add(this.lines);
    this.wind = { x: 1.2, z: 0.6 };
  }

  /** center: camera position; intensity 0..1; indoor hides it. */
  update(dt, center, intensity, indoor = false) {
    const on = intensity > 0.02 && !indoor;
    this.lines.visible = on;
    if (!on) return;
    const n = Math.floor(this.count * Math.min(1, 0.15 + intensity));
    const d = this.drops, p = this.pos, half = this.box / 2, len = 0.55 + intensity * 0.5;
    const wx = this.wind.x * (0.5 + intensity), wz = this.wind.z * (0.5 + intensity);
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      d[k + 1] -= d[k + 3] * dt; d[k] += wx * dt; d[k + 2] += wz * dt;
      if (d[k + 1] < 0) { d[k + 1] += this.height; d[k] = (Math.random() - 0.5) * this.box; d[k + 2] = (Math.random() - 0.5) * this.box; }
      // keep the box centred on the camera (wrap horizontally)
      let x = d[k], z = d[k + 2];
      if (x > half) d[k] = x -= this.box; else if (x < -half) d[k] = x += this.box;
      if (z > half) d[k + 2] = z -= this.box; else if (z < -half) d[k + 2] = z += this.box;
      const y = d[k + 1] + center.y - this.height * 0.45;
      const j = i * 6;
      p[j] = center.x + x; p[j + 1] = y; p[j + 2] = center.z + z;
      p[j + 3] = center.x + x - wx * 0.03; p[j + 4] = y + len; p[j + 5] = center.z + z - wz * 0.03;
    }
    const attr = this.lines.geometry.attributes.position;
    attr.needsUpdate = true;
    this.lines.geometry.setDrawRange(0, n * 2);
    this.mat.opacity = 0.18 + 0.32 * intensity;
  }
}
