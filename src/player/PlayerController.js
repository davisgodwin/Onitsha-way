import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildHuman, normalizeAppearance } from '../characters/HumanRig.js';
import { CharacterAnimator, SEAT_HEIGHT, GROUND_SIT, LIE_DROP } from '../characters/CharacterAnimator.js';
import { dampAngle, damp } from '../core/utils.js';

/**
 * Player control states: exactly one state owns the player at any time.
 *   ON_FOOT   — walking/running under player control (this class moves the player)
 *   PASSENGER — seated in public transport (Milestone 5): TransportController puts the player in the
 *               seat every frame; this class does not move them and they never steer the vehicle
 *   DRIVER    — personal vehicles (Milestone 6)
 */
export const ControlState = Object.freeze({ ON_FOOT: 'onFoot', PASSENGER: 'passenger', DRIVER: 'driver', FROZEN: 'frozen' });

export class PlayerController {
  constructor(scene, collision) {
    this.scene = scene;
    this.collision = collision;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = 0;           // radians, 0 = facing +Z
    this.vy = 0;
    this.grounded = true;
    this.speed = 0;
    this.state = ControlState.FROZEN;
    this.human = null;
    this.animator = null;
    this.appearance = null;
    this._prev = new THREE.Vector3();
    this.posture = null; // v0.45: { kind: 'sit' | 'ground' | 'lie', x, z, y (surface height), heading, from: {x, z, heading}, since }
  }

  /**
   * v0.45 sit and lie down. kind 'sit' (a seat at height y), 'ground' (sit on the floor here), 'lie' (on a bed at height
   * y, or on the floor). Moving, jumping or calling stand() gets up again, back where you were standing.
   */
  setPosture(kind, at = null) {
    if (this.state !== ControlState.ON_FOOT || !this.grounded) return false;
    const x = at?.x ?? this.position.x, z = at?.z ?? this.position.z;
    this.posture = { kind, x, z, y: at?.y ?? this.position.y, heading: at?.heading ?? this.heading, from: { x: this.position.x, z: this.position.z, y: this.position.y, heading: this.heading }, since: performance.now() };
    this.position.set(x, this.posture.from.y, z); this.heading = this.posture.heading; this.velocity.set(0, 0, 0); this.speed = 0;
    this.syncModel(); return true;
  }
  stand() {
    const p = this.posture; if (!p) return;
    this.posture = null;
    if (p.kind !== 'ground') this.teleport(p.from.x, p.from.z, this.heading, p.from.y); else this.syncModel();
  }
  /** Where the body's origin goes for the current posture. */
  postureY() { const p = this.posture; return p.kind === 'sit' ? p.y - SEAT_HEIGHT : p.kind === 'ground' ? p.y - GROUND_SIT : p.y - LIE_DROP; }

  setAppearance(app) {
    if (this.human) { this.scene.remove(this.human.group); this.human.dispose(); }
    this.appearance = normalizeAppearance(app);
    this.human = buildHuman(this.appearance);
    this.animator = new CharacterAnimator(this.human, CONFIG.player);
    this.scene.add(this.human.group);
    this.syncModel();
  }

  teleport(x, z, heading = this.heading, y = 0) {
    this.posture = null; // being moved anywhere (a door, an ambulance, a fade) gets you up first
    this.position.set(x, 0, z);
    const W = this.walkways; // v0.39: back onto a deck or stair if that's where you were (or would be stuck inside one)
    if (W) { const g = y > 0.3 ? W.groundAt(x, z, y) : 0, st = W.stuck(x, z, 0); this.position.y = g > 0.3 && Math.abs(g - y) < 0.8 ? g : st ?? 0; }
    if (this.position.y < 0.7) this.collision.resolveCircle(this.position, CONFIG.player.radius);
    this.heading = heading;
    this.velocity.set(0, 0, 0); this.vy = 0; this.grounded = true;
    this.syncModel();
  }

  setState(s) { this.state = s; }

  /**
   * @param {number} dt
   * @param {{move:{x,y,mag}, run:boolean, jump:boolean}} intent
   * @param {{fx,fz,rx,rz}} basis camera-relative basis
   */
  update(dt, intent, basis) {
    const P = CONFIG.player;
    let turnRate = 0;
    if (this.posture) {
      if (this.state !== ControlState.ON_FOOT || (performance.now() - this.posture.since > 350 && ((intent.move?.mag ?? 0) > 0.3 || intent.jump))) this.stand();
      else { this.animator?.pose(this.posture.kind, dt); this.syncModel(); return; }
    }
    if (this.state === ControlState.ON_FOOT) {
      const m = intent.move;
      const dirX = basis.fx * m.y + basis.rx * m.x;
      const dirZ = basis.fz * m.y + basis.rz * m.x;
      // tired players can't run at full speed (Needs.runFactor: 1 = full, lower when hungry)
      const run = P.walkSpeed + (P.runSpeed - P.walkSpeed) * (intent.runFactor ?? 1);
      const target = (intent.run ? run : P.walkSpeed) * m.mag;
      const tvx = dirX * target, tvz = dirZ * target;
      const accel = this.grounded ? P.accel : P.accel * 0.25;
      this.velocity.x = damp(this.velocity.x, tvx, accel, dt);
      this.velocity.z = damp(this.velocity.z, tvz, accel, dt);
      if (m.mag > 0.05) {
        const prev = this.heading;
        this.heading = dampAngle(this.heading, Math.atan2(dirX, dirZ), P.turnRate, dt);
        let d = this.heading - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        turnRate = d / Math.max(dt, 1e-4);
      }
      if (intent.jump && this.grounded) { this.vy = P.jumpVelocity; this.grounded = false; }
    } else {
      this.velocity.multiplyScalar(0);
    }

    // integrate + collide
    this._prev.copy(this.position);
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    // v0.39: stairs, ramps, flyover decks and footbridges (Walkways): blocked by their sides and edges, else stand on them
    const W = this.walkways;
    if (W && !W.canMove(this.position.x, this.position.z, this.position.y)) { this.position.x = this._prev.x; this.position.z = this._prev.z; }
    const ground = W ? W.groundAt(this.position.x, this.position.z, this.position.y) : 0;
    if (this.grounded && this.position.y > ground + 0.02) { if (this.position.y - ground > 0.75) { this.grounded = false; this.vy = 0; } else this.position.y = ground; }
    else if (this.grounded && this.position.y < ground) this.position.y = ground;
    if (!this.grounded) {
      this.vy -= P.gravity * dt;
      this.position.y += this.vy * dt;
      if (this.position.y <= ground) { this.position.y = ground; this.vy = 0; this.grounded = true; }
    }
    if (this.position.y < 0.7) this.collision.resolveCircle(this.position, P.radius);
    const moved = Math.hypot(this.position.x - this._prev.x, this.position.z - this._prev.z);
    this.speed = damp(this.speed, moved / Math.max(dt, 1e-4), 12, dt);
    // stop pushing into walls so the walk cycle doesn't run in place
    if (moved < 0.2 * Math.hypot(this.velocity.x, this.velocity.z) * dt) { this.velocity.x *= 0.5; this.velocity.z *= 0.5; }

    this.animator?.update(dt, { speed: this.speed, grounded: this.grounded, turnRate });
    this.syncModel();
  }

  /** Idle animation only (creator / menus). */
  idle(dt) { this.animator?.update(dt, { speed: 0, grounded: true, turnRate: 0 }); this.syncModel(); }

  syncModel() {
    if (!this.human) return;
    this.human.group.position.copy(this.position);
    this.human.group.rotation.y = this.heading;
    if (this.posture) this.human.group.position.y = this.postureY();
  }

  serialize() {
    const h = Math.atan2(Math.sin(this.heading), Math.cos(this.heading));
    return { x: +this.position.x.toFixed(2), z: +this.position.z.toFixed(2), heading: +h.toFixed(3), ...(this.position.y > 0.3 ? { y: +this.position.y.toFixed(2) } : {}) };
  }
}
