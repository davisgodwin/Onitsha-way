import { GOOD_BY_ID } from '../buy/Goods.js';
/**
 * v0.45 sit down and lie down. Walk up to a chair, bench, sofa or bed and press E ("Sit down" / "Lie down"), or
 * anywhere press X to sit on the ground and Z to lie down (on the bed if you're next to one). Any movement gets you
 * up. Sitting and lying slowly rest you. Other players online see you sitting or lying.
 *
 * Seats come from the room you're in: every chair, bench and bed in the interiors kit, and the sofas, chairs and beds
 * you've placed in your home.
 */
export const SEAT_REACH = 1.5;
export class Posture {
 constructor(g) {
  this.g = g; this.cache = { t: -1, list: [] };
  const self = this;
  g.interactions.register({
   get x() { const p = g.player.posture; return p ? g.player.position.x : self.nearest()?.x ?? 1e9; },
   get z() { const p = g.player.posture; return p ? g.player.position.z : self.nearest()?.z ?? 1e9; },
   get priority() { return g.player.posture ? 60 : -1; }, radius: SEAT_REACH,
   enabled: () => this.can() && (!!g.player.posture || !!this.nearest()),
   label: () => g.player.posture ? 'Stand up' : this.nearest()?.kind === 'bed' ? 'Lie down' : 'Sit down',
   onInteract: () => { if (g.player.posture) g.player.stand(); else { const s = this.nearest(); if (s) this.use(s); } },
  });
 }
 can() { const g = this.g; return !!g.saveData && g.state === 'playing' && !g.vehicles?.driving && !g.transport?.riding && g.player.state === 'onFoot'; }
 /** Every seat and bed around you now: { x, z, y (surface), heading (facing when seated; for a bed, feet that way), kind }. */
 seats() {
  const g = this.g, now = performance.now(); if (now - this.cache.t < 400) return this.cache.list;
  const list = [];
  if (g.civic?.inside && g.civic.room) list.push(...g.civic.room.seats);
  if (g.story?.inside && g.story.interior) list.push(...g.story.interior.seats);
  if (g.club?.inside && g.club.seats) list.push(...g.club.seats);
  if (g.homes?.inside) for (const r of g.homes.decor?.records ?? []) { const good = GOOD_BY_ID[r.id]; if (!good || (good.action !== 'seat' && good.action !== 'bed')) continue; const bed = good.action === 'bed', rot = -(r.rotation ?? 0) * Math.PI / 180; // home pieces store degrees; the model turns by -rotation
   list.push({ x: r.x, z: r.z, y: bed ? Math.min(0.75, Math.max(0.4, (r.top ?? 0.6))) : 0.46, heading: rot, kind: bed ? 'bed' : 'seat' }); }
  this.cache = { t: now, list }; return list;
 }
 nearest(kind = null) { const p = this.g.player.position; let best = null, d = SEAT_REACH; for (const s of this.seats()) { if (kind && s.kind !== kind) continue; const e = Math.hypot(s.x - p.x, s.z - p.z); if (e < d) { d = e; best = s; } } return best; }
 use(s) { const g = this.g; if (!this.can()) return; if (s.kind === 'bed') g.player.setPosture('lie', s); else g.player.setPosture('sit', s); g.closeChoice?.(); }
 /** X: sit (on the seat next to you, or the ground). Z: lie down (on the bed next to you, or the ground). */
 sit() { const g = this.g; if (g.player.posture) return g.player.stand(); if (!this.can()) return; const s = this.nearest('seat'); if (s) this.use(s); else g.player.setPosture('ground'); }
 lie() { const g = this.g; if (g.player.posture?.kind === 'lie') return g.player.stand(); if (g.player.posture) g.player.stand(); if (!this.can()) return; const b = this.nearest('bed'); if (b) this.use(b); else g.player.setPosture('lie', { y: g.player.position.y }); }
 update(dt) {
  const g = this.g, input = g.input;
  if (input?.consumePress('sit')) this.sit();
  if (input?.consumePress('lie')) this.lie();
  const p = g.player.posture; if (!p || g.state !== 'playing') return;
  // resting: a little energy back while you sit, more lying on a bed
  const rate = p.kind === 'lie' ? (p.y > 0.3 ? 0.35 : 0.15) : 0.08; g.needs?.adjust?.({ energy: rate * dt });
 }
 /** For other players: the pose and where the body is. */
 presence() { const p = this.g.player.posture; return p ? { pose: p.kind, y: this.g.player.postureY() } : null; }
}
