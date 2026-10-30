/**
 * v0.39: raised surfaces you can walk on — flyover decks and ramps, flyover stairs and footbridges.
 * The city is otherwise flat (ground = 0). Each surface is a strip along a way segment with a height at each end
 * (decks use the deck's own height curve). Rules for someone at height y:
 * - ground = the highest surface under you that is no more than STEP above your feet (else the street, 0);
 * - you can't walk into a surface that is between STEP and HEAD above your feet (the side of a stair or a ramp);
 *   anything higher you walk under;
 * - on a raised surface you can't walk off the edge (railings / parapets), only down the stairs or ramps.
 */
export const STEP = 0.7, HEAD = 2.2;
export class Walkways {
  constructor(map) {
    this.strips = []; this.grid = new Map(); this.cell = 20;
    for (const road of map.roads) {
      if (!road.walkDeck || !road.heightAt) continue;
      const P = road.points, hw = road.footbridge ? road.width / 2 : road.width / 2 - 0.3; let s0 = 0;
      for (let i = 0; i < P.length - 1; i++) {
        const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
        const st = { ax, az, bx, bz, L, dx: (bx - ax) / L, dz: (bz - az) / L, hw, s0, road, i: this.strips.length };
        this.strips.push(st); s0 += L;
        const c = this.cell;
        for (let gx = Math.floor((Math.min(ax, bx) - hw) / c); gx <= Math.floor((Math.max(ax, bx) + hw) / c); gx++)
          for (let gz = Math.floor((Math.min(az, bz) - hw) / c); gz <= Math.floor((Math.max(az, bz) + hw) / c); gz++) { const k = gx + ',' + gz; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(st); }
      }
    }
  }
  /** Heights of every surface under (x, z). Strips overlap a little at joins, which is what lets you pass from one to the next. */
  under(x, z, out = []) {
    out.length = 0;
    for (const st of this.grid.get(Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell)) ?? []) {
      const rx = x - st.ax, rz = z - st.az, t = rx * st.dx + rz * st.dz; if (t < -0.6 || t > st.L + 0.6) continue;
      if (Math.abs(rx * -st.dz + rz * st.dx) > st.hw) continue;
      out.push(st.road.heightAt(st.s0 + Math.max(0, Math.min(st.L, t))));
    }
    return out;
  }
  /** The surface you stand on at (x, z) with your feet at y (0 = street). */
  groundAt(x, z, y) { let g = 0; for (const h of this.under(x, z, this._u ??= [])) if (h <= y + STEP && h > g) g = h; return g; }
  /** Walking from prev to (x, z) with feet at y: false if a raised edge blocks the way. */
  canMove(x, z, y) {
    const hs = this.under(x, z, this._u ??= []);
    for (const h of hs) if (h > y + STEP && h < y + HEAD) return false; // the side of a stair or ramp
    if (y > STEP) { let g = 0; for (const h of hs) if (h <= y + STEP && h > g) g = h; if (y - g > STEP) return false; } // the edge of a deck
    return true;
  }
  /** Highest surface under (x, z) — to put someone back on a deck (load / teleport) if they'd otherwise be inside one. */
  stuck(x, z, y) { for (const h of this.under(x, z, this._u ??= [])) if (h > y + STEP && h < y + HEAD) return h; return null; }
  get count() { return this.strips.length; }
}
