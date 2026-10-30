import * as THREE from 'three';

/** Accumulates triangles (position / normal / uv / colour) and produces one BufferGeometry. */
export class GeoBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  get vertexCount() { return this.p.length / 3; }

  vert(x, y, z, nx, ny, nz, u, v, col) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v);
    this.c.push(col ? col.r : 1, col ? col.g : 1, col ? col.b : 1);
    return this.p.length / 3 - 1;
  }

  /**
   * Quad from 4 corners (any winding) facing `normal`.
   * corners: [[x,y,z]x4] in order around the quad; uvs: [[u,v]x4].
   */
  quad(corners, uvs, normal, col) {
    const [a, b, c] = corners;
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    const flip = cx * normal[0] + cy * normal[1] + cz * normal[2] < 0;
    const base = this.vertexCount;
    for (let k = 0; k < 4; k++) this.vert(...corners[k], ...normal, ...uvs[k], col);
    if (flip) this.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  tri(a, b, c, uva, uvb, uvc, normal, col) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    const flip = cx * normal[0] + cy * normal[1] + cz * normal[2] < 0;
    const base = this.vertexCount;
    this.vert(...a, ...normal, ...uva, col); this.vert(...b, ...normal, ...uvb, col); this.vert(...c, ...normal, ...uvc, col);
    if (flip) this.i.push(base, base + 2, base + 1); else this.i.push(base, base + 1, base + 2);
  }

  /**
   * Oriented box. (cx, cz) centre on the ground plane, y0..y1 vertical extent, w along `yaw`
   * direction's right axis, d along forward. uvRect optional [u0,v0,u1,v1] applied to every face.
   */
  box(cx, cz, y0, y1, w, d, yaw, col, uvRect = [0, 0, 1, 1], faces = 'all') {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const fx = s, fz = c, rx = c, rz = -s; // forward (+Z rotated), right
    const hw = w / 2, hd = d / 2;
    const P = (a, b, y) => [cx + rx * a + fx * b, y, cz + rz * a + fz * b];
    const [u0, v0, u1, v1] = uvRect;
    const UV = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const sides = [
      [[-hw, hd], [hw, hd], [fx, 0, fz]], [[hw, -hd], [-hw, -hd], [-fx, 0, -fz]],
      [[hw, hd], [hw, -hd], [rx, 0, rz]], [[-hw, -hd], [-hw, hd], [-rx, 0, -rz]],
    ];
    for (const [a, b, n] of sides) this.quad([P(a[0], a[1], y0), P(b[0], b[1], y0), P(b[0], b[1], y1), P(a[0], a[1], y1)], UV, n, col);
    if (faces === 'all') this.quad([P(-hw, -hd, y1), P(hw, -hd, y1), P(hw, hd, y1), P(-hw, hd, y1)], UV, [0, 1, 0], col);
  }

  /** Square-section beam between two 3D points (truss members, rails). */
  beam(a, b, t, col) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const L = Math.hypot(dx, dy, dz) || 1;
    const ax = [dx / L, dy / L, dz / L];
    let up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let s1 = [ax[1] * up[2] - ax[2] * up[1], ax[2] * up[0] - ax[0] * up[2], ax[0] * up[1] - ax[1] * up[0]];
    let l = Math.hypot(...s1); s1 = s1.map((v) => (v / l) * t / 2);
    let s2 = [ax[1] * s1[2] - ax[2] * s1[1], ax[2] * s1[0] - ax[0] * s1[2], ax[0] * s1[1] - ax[1] * s1[0]];
    l = Math.hypot(...s2); s2 = s2.map((v) => (v / l) * t / 2);
    const corner = (p, i, j) => [p[0] + s1[0] * i + s2[0] * j, p[1] + s1[1] * i + s2[1] * j, p[2] + s1[2] * i + s2[2] * j];
    const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const [i0, j0, i1, j1] of [[1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1], [-1, 1, 1, 1]]) {
      const n = [s1[0] * (i0 + i1) + s2[0] * (j0 + j1), s1[1] * (i0 + i1) + s2[1] * (j0 + j1), s1[2] * (i0 + i1) + s2[2] * (j0 + j1)];
      const nl = Math.hypot(...n) || 1;
      this.quad([corner(a, i0, j0), corner(a, i1, j1), corner(b, i1, j1), corner(b, i0, j0)], UV, n.map((v) => v / nl), col);
    }
  }

  /** Upright cylinder (tanks, pillars). */
  cylinder(cx, cz, y0, y1, r, col, seg = 12, cap = true) {
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
      const p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
      this.quad([[p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]]], [[0, 0], [1, 0], [1, 1], [0, 1]], [Math.cos(am), 0, Math.sin(am)], col);
      if (cap) this.tri([cx, y1, cz], [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], [0.5, 0.5], [0, 0], [1, 0], [0, 1, 0], col);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.vertexCount > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
