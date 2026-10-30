import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, damp, dampAngle } from '../core/utils.js';

/**
 * Third-person orbit camera with wall avoidance, plus 'showcase' (character creator) and
 * 'cinematic' (main menu fly-over) modes, and two passenger cameras for public transport:
 *   'passenger' — orbit around the vehicle you are riding in (wider, higher, follows its heading)
 *   'seat'      — your own view from the seat (keke only: their open sides make it worth it)
 */
export class CameraRig {
  constructor(camera, collision) {
    this.camera = camera;
    this.collision = collision;
    this.mode = 'cinematic';
    this.yaw = Math.PI;      // camera sits at target + (sin yaw, ., cos yaw) * dist
    this.pitch = 0.28;
    this.distance = CONFIG.camera.distance;
    this.currentDist = this.distance;
    this.target = new THREE.Vector3();
    this.smoothTarget = new THREE.Vector3();
    this.sensitivity = CONFIG.camera.sensitivity;
    this.invertY = false;
    this.t = 0;
    this.cine = { center: new THREE.Vector3(), radius: 60 };
    this.showcaseShift = 0.55; // shifts the character right of centre so the creator panel fits on the left
  }

  /** Over-the-shoulder framing for conversations: a = player, b = NPC (Vector3s, feet positions). */
  setDialogue(a, b) {
    this.mode = 'dialogue';
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, fx = dx / L, fz = dz / L, rx = -fz, rz = fx;
    // camera behind the player's shoulder, aimed low so the NPC sits in the upper half (above the dialogue panel)
    let back = 2.6;
    const t = this.collision.raycast(a.x, a.z, a.x - fx * (back + 0.4) + rx * 0.8, a.z - fz * (back + 0.4) + rz * 0.8);
    if (t < 1) back = Math.max(0.6, t * (back + 0.4) - 0.4);
    this.dlgPos = new THREE.Vector3(a.x - fx * back + rx * 0.8, 2.15, a.z - fz * back + rz * 0.8);
    this.dlgLook = new THREE.Vector3(b.x + fx * 0.6, 0.55, b.z + fz * 0.6);
    this._look = null;
  }

  setMode(mode) { this.mode = mode; if (mode === 'follow') this.currentDist = this.distance; }

  /** Ride along: dist = orbit distance for this vehicle, height = look-at height above the floor. */
  setPassenger({ dist = 6, height = 1.6 } = {}) {
    this.mode = 'passenger'; this.passenger = { dist, height }; this.currentDist = dist;
    this.pitch = Math.max(this.pitch, 0.22);
  }
  /** First-person seat view: pos = eye position (Vector3), set every frame by the game. */
  setSeat(pos) { this.mode = 'seat'; this.seatPos = pos; }

  applyLook(dx, dy, touch = false) {
    const s = touch ? CONFIG.camera.touchSensitivity : this.sensitivity;
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch + dy * s * (this.invertY ? -1 : 1), CONFIG.camera.minPitch, CONFIG.camera.maxPitch);
  }
  applyZoom(steps) { this.distance = clamp(this.distance + steps * 0.6, CONFIG.camera.minDistance, CONFIG.camera.maxDistance); }

  /** Smoothly swing behind the player while they move without touching the camera. */
  autoFollow(heading, dt, strength = 1.2) {
    this.yaw = dampAngle(this.yaw, heading + Math.PI, strength, dt);
  }

  snapTo(pos) { this.smoothTarget.copy(pos); }

  update(dt, focus) {
    this.t += dt;
    const cam = this.camera;
    if (this.mode === 'fixed') return; // externally positioned (debug / cutscenes)
    if (this.mode === 'dialogue') {
      const k = 1 - Math.exp(-5 * dt);
      cam.position.lerp(this.dlgPos, k);
      this._look ??= this.dlgLook.clone(); this._look.lerp(this.dlgLook, k);
      cam.lookAt(this._look);
      return;
    }
    if (this.mode === 'cinematic') {
      const c = this.cine.center, a = this.t * 0.05;
      cam.position.set(c.x + Math.sin(a) * this.cine.radius, (this.cineHeight ?? 26) + Math.sin(this.t * 0.11) * 5, c.z + Math.cos(a) * this.cine.radius);
      cam.lookAt(c.x, 4, c.z);
      return;
    }
    if (this.mode === 'showcase') {
      // character creator: close orbit around the character, head-to-toe framing
      this.smoothTarget.copy(focus).add(new THREE.Vector3(0, 1.0, 0));
      const d = this.showcaseShift === 0 ? 4.1 : 2.7; // portrait phones need a wider shot
      cam.position.set(this.smoothTarget.x + Math.sin(this.yaw) * d, this.smoothTarget.y + 0.35, this.smoothTarget.z + Math.cos(this.yaw) * d);
      const k = this.showcaseShift;
      cam.lookAt(this.smoothTarget.x - Math.cos(this.yaw) * k, this.smoothTarget.y - 0.05 - (k === 0 ? 1.30 : 0), this.smoothTarget.z + Math.sin(this.yaw) * k);
      return;
    }
    if (this.mode === 'seat') {
      cam.position.copy(this.seatPos);
      const cp = Math.cos(this.pitch * 0.8), sp = Math.sin(this.pitch * 0.8);
      cam.lookAt(this.seatPos.x - Math.sin(this.yaw) * cp, this.seatPos.y - sp, this.seatPos.z - Math.cos(this.yaw) * cp);
      return;
    }
    // follow (on foot) and passenger (orbiting the vehicle you ride in)
    const pass = this.mode === 'passenger' ? this.passenger : null;
    this.target.set(focus.x, focus.y + (pass ? pass.height : this.indoor ? this.indoor.height : CONFIG.camera.height), focus.z);
    this.smoothTarget.x = damp(this.smoothTarget.x, this.target.x, 18, dt);
    this.smoothTarget.z = damp(this.smoothTarget.z, this.target.z, 18, dt);
    this.smoothTarget.y = damp(this.smoothTarget.y, this.target.y, 8, dt);
    // indoors: if a wall is right behind the player, swing round to where the room has space
    if (this.indoor) {
      const need = this.indoor.distance * 0.85, clear = (yaw) => this.collision.raycast(this.smoothTarget.x, this.smoothTarget.z, this.smoothTarget.x + Math.sin(yaw) * (need + 0.4), this.smoothTarget.z + Math.cos(yaw) * (need + 0.4));
      if (clear(this.yaw) < 0.95) {
        let best = null;
        for (let k = 1; k <= 9 && best === null; k++) for (const sgn of [1, -1]) { const y = this.yaw + sgn * k * 0.33; if (clear(y) >= 0.95) { best = y; break; } }
        if (best !== null) this.yaw = dampAngle(this.yaw, best, 4, dt);
      }
      this.pitch = Math.max(this.pitch, 0.3);
    }
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dirX = Math.sin(this.yaw) * cp, dirZ = Math.cos(this.yaw) * cp;
    // wall avoidance in 2D (buildings are vertical extrusions)
    let want = pass ? pass.dist * (this.distance / CONFIG.camera.distance) : this.indoor ? Math.min(this.distance, this.indoor.distance) : this.distance;
    const t = this.collision.raycast(this.smoothTarget.x, this.smoothTarget.z,
      this.smoothTarget.x + dirX * (want + 0.4), this.smoothTarget.z + dirZ * (want + 0.4));
    if (t < 1) want = Math.max(0.6, t * (want + 0.4) - 0.4);
    this.currentDist = want < this.currentDist ? damp(this.currentDist, want, 25, dt) : damp(this.currentDist, want, 3, dt);
    const d = this.currentDist;
    cam.position.set(this.smoothTarget.x + dirX * d, Math.max(0.35, this.smoothTarget.y + sp * d), this.smoothTarget.z + dirZ * d);
    if (this.indoor) cam.position.y = Math.min(cam.position.y, this.indoor.ceiling); // indoors: stay under the ceiling
    cam.lookAt(this.smoothTarget);
  }

  /** Planar forward / right vectors for camera-relative movement. */
  basis() {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    return { fx, fz, rx: -fz, rz: fx };
  }
}
