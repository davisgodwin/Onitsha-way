/** Minimum-area bounds shared by rendered roofs and placement clearance. */
export function obb(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
    const L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L, vx = -uz, vz = ux;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, z] of pts) { const a = x * ux + z * uz, b = x * vx + z * vz; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const area = (a1 - a0) * (b1 - b0);
    if (!best || area < best.area) {
      const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
      best = { area, ux, uz, vx, vz, w: a1 - a0, d: b1 - b0, cx: ca * ux + cb * vx, cz: ca * uz + cb * vz };
    }
  }
  if (best && best.d > best.w) {
    const { ux, uz, vx, vz, w, d } = best;
    Object.assign(best, { ux: vx, uz: vz, vx: -ux, vz: -uz, w: d, d: w });
  }
  return best;
}
