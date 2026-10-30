/**
 * Contextual interaction ("Talk", "Enter house", "Board keke", …).
 * Systems register interactables; the nearest valid one within range drives a single prompt.
 * Milestone 1 registers nothing yet — NPCs (M3), shops (M4), transport stops (M5) and house doors (M6)
 * plug into this without touching the player controller or the UI.
 */
export class InteractionSystem {
  constructor() { this.items = new Set(); this.current = null; }

  /** @param {{x:number,z:number,radius:number,label:string|function,enabled?:function,onInteract:function}} item */
  register(item) { this.items.add(item); return () => this.items.delete(item); }

  update(px, pz) {
    let best = null, bestD = Infinity, bestPriority=-Infinity;
    for (const it of this.items) {
      if (it.enabled && !it.enabled()) continue;
      if (this.locked?.(it.x, it.z)) continue; // v0.48: COMING SOON places (Asaba, the Delta island)
      const d = Math.hypot(it.x - px, it.z - pz);
      const priority=Number.isFinite(it.priority)?it.priority:0;
      if (d < it.radius && (priority>bestPriority||(priority===bestPriority&&d<bestD))) { best = it; bestD = d; bestPriority=priority; }
    }
    this.current = best;
    return best ? (typeof best.label === 'function' ? best.label() : best.label) : null;
  }

  trigger() { if (this.current) { this.current.onInteract(); return true; } return false; }
}
