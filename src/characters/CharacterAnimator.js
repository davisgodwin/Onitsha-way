import { clamp, damp, lerp } from '../core/utils.js';

/*
  Procedural locomotion for HumanRig skeletons.
  Gait phase advances with distance travelled (no foot sliding at any speed),
  idle / walk / run / airborne poses are blended continuously.
  Rest pose = identity rotations, so every frame the pose is rebuilt from scratch.

  Bone axes: +X rotation swings a limb backward (and tips the spine forward),
  -X swings a limb forward / bends elbows forward, +Z on the left arm moves it outward.
*/

const WALK = { thigh: 0.42, kneeSwing: 0.95, kneeStance: 0.07, arm: 0.3, elbow: -0.2, elbowSwing: -0.12, lean: 0.035, bob: 0.022, hipYaw: 0.07, cycle: 1.45 };
/** Seated: height of the buttocks above the model origin (the hip joints are at 0.94). */
export const SEAT_HEIGHT = 0.87;
/** v0.45: sitting on the floor (the buttocks sit a little below the hip joints) and lying on the back (hips on the surface). */
export const GROUND_SIT = 0.84, LIE_DROP = 0.82;
const RUN = { thigh: 0.82, kneeSwing: 1.75, kneeStance: 0.28, arm: 0.72, elbow: -1.35, elbowSwing: -0.25, lean: 0.2, bob: 0.055, hipYaw: 0.11, cycle: 2.85 };

export class CharacterAnimator {
  constructor(human, { walkSpeed = 1.75, runSpeed = 5.4 } = {}) {
    this.h = human;
    this.b = human.bones;
    this.walkSpeed = walkSpeed;
    this.runSpeed = runSpeed;
    this.phase = 0;
    this.walkW = 0;
    this.runW = 0;
    this.airW = 0;
    this.turnLean = 0;
    this.t = Math.random() * 10;
    this.hipsRestY = this.b.hips.position.y;
    this.female = human.female;
  }

  /**
   * Seated pose (keke bench, bus seat): thighs forward, knees bent, hands on the lap, a little
   * sway with the road. Place the model origin SEAT_HEIGHT below the seat surface.
   */
  sit(dt, sway = 0) {
    const b = this.b;
    this.t += dt;
    this.walkW = this.runW = this.airW = 0;
    const breathe = Math.sin(this.t * 1.7), look = 0.25 * Math.sin(this.t * 0.31) * Math.sin(this.t * 0.17 + 2);
    b.hips.position.y = this.hipsRestY;
    b.hips.rotation.set(0, 0, sway * 0.04);
    b['thigh.L'].rotation.set(-1.5, 0, 0.06); b['thigh.R'].rotation.set(-1.5, 0, -0.06);
    b['shin.L'].rotation.set(1.45, 0, 0); b['shin.R'].rotation.set(1.45, 0, 0);
    b['foot.L'].rotation.set(0.05, 0, 0); b['foot.R'].rotation.set(0.05, 0, 0);
    b.spine.rotation.set(0.06, 0, -sway * 0.03); b.chest.rotation.set(0.01 * breathe, 0, 0);
    b.neck.rotation.set(-0.05, 0, 0); b.head.rotation.set(0.02 * breathe, look, 0);
    b['upperArm.L'].rotation.set(-0.42, 0, 0.16); b['upperArm.R'].rotation.set(-0.42, 0, -0.16);
    b['foreArm.L'].rotation.set(-0.95, 0.2, 0); b['foreArm.R'].rotation.set(-0.95, -0.2, 0);
    b['hand.L'].rotation.set(0, 0, 0.05); b['hand.R'].rotation.set(0, 0, -0.05);
  }

  /**
   * v0.45 postures. 'sit' = on a chair, bench or sofa (place the origin SEAT_HEIGHT below the seat); 'ground' = sitting
   * on the floor, legs out, leaning back on the hands (origin GROUND_SIT below the floor); 'lie' = lying on the back,
   * arms by the sides (the body pivots at the hips: origin LIE_DROP below the surface, head towards -z of the facing).
   */
  pose(kind, dt) {
    if (kind === 'sit') return this.sit(dt);
    const b = this.b; this.t += dt; this.walkW = this.runW = this.airW = 0;
    const breathe = Math.sin(this.t * 1.5), look = 0.2 * Math.sin(this.t * 0.27) * Math.sin(this.t * 0.13 + 1);
    b.hips.position.y = this.hipsRestY;
    if (kind === 'ground') {
     b.hips.rotation.set(0, 0, 0);
     b['thigh.L'].rotation.set(-1.45, 0, 0.12); b['thigh.R'].rotation.set(-1.45, 0, -0.12);
     b['shin.L'].rotation.set(0.25, 0, 0); b['shin.R'].rotation.set(0.12, 0, 0);
     b['foot.L'].rotation.set(-0.35, 0, 0); b['foot.R'].rotation.set(-0.3, 0, 0);
     b.spine.rotation.set(-0.28, 0, 0); b.chest.rotation.set(0.01 * breathe, 0, 0); b.neck.rotation.set(0.12, 0, 0); b.head.rotation.set(0.05, look, 0);
     b['upperArm.L'].rotation.set(0.75, 0, 0.32); b['upperArm.R'].rotation.set(0.75, 0, -0.32);
     b['foreArm.L'].rotation.set(-0.1, 0, 0); b['foreArm.R'].rotation.set(-0.1, 0, 0);
     b['hand.L'].rotation.set(0.9, 0, 0.1); b['hand.R'].rotation.set(0.9, 0, -0.1);
     return;
    }
    // lie: on the back
    b.hips.rotation.set(-Math.PI / 2, 0, 0);
    b['thigh.L'].rotation.set(-0.04, 0, 0.05); b['thigh.R'].rotation.set(-0.12, 0, -0.05);
    b['shin.L'].rotation.set(0.06, 0, 0); b['shin.R'].rotation.set(0.25, 0, 0);
    b['foot.L'].rotation.set(-0.55, 0, 0.1); b['foot.R'].rotation.set(-0.5, 0, -0.1);
    b.spine.rotation.set(0.006 * breathe, 0, 0); b.chest.rotation.set(0.012 * breathe, 0, 0); b.neck.rotation.set(-0.12, 0, 0); b.head.rotation.set(-0.08, look * 0.6, 0);
    b['upperArm.L'].rotation.set(0.05, 0, 0.18); b['upperArm.R'].rotation.set(0.05, 0, -0.18);
    b['foreArm.L'].rotation.set(-0.35, 0, 0); b['foreArm.R'].rotation.set(-0.35, 0, 0);
    b['hand.L'].rotation.set(0, 0, 0.1); b['hand.R'].rotation.set(0, 0, -0.1);
  }

  /**
   * @param {number} dt
   * @param {{speed:number, grounded:boolean, turnRate:number}} s
   */
  update(dt, s) {
    const b = this.b;
    this.t += dt;
    const speed = s.speed;
    this.walkW = damp(this.walkW, clamp(speed / this.walkSpeed, 0, 1), 10, dt);
    this.runW = damp(this.runW, clamp((speed - this.walkSpeed) / (this.runSpeed - this.walkSpeed), 0, 1), 6, dt);
    this.airW = damp(this.airW, s.grounded ? 0 : 1, s.grounded ? 14 : 7, dt);
    this.turnLean = damp(this.turnLean, clamp(-s.turnRate * speed * 0.025, -0.18, 0.18), 6, dt);

    const r = this.runW, w = this.walkW, air = this.airW;
    const P = (k) => lerp(WALK[k], RUN[k], r);
    const cycle = P('cycle');
    if (s.grounded) this.phase += (Math.PI * 2 * speed * dt) / cycle;
    const pL = this.phase, pR = this.phase + Math.PI;
    const femaleArm = this.female ? 0.8 : 1;

    // ---- legs
    const leg = (p) => {
      const thigh = -P('thigh') * Math.sin(p) * w - 0.12 * r * w;
      const swing = Math.max(0, Math.cos(p + 0.35));
      const shin = (P('kneeStance') + P('kneeSwing') * Math.pow(swing, 1.6)) * w;
      const foot = -(thigh + shin) * 0.82 - 0.22 * Math.max(0, Math.sin(p)) * w + 0.28 * Math.max(0, -Math.sin(p + 0.3)) * w * (0.4 + r);
      return [thigh, shin, foot];
    };
    let [tL, sL, fL] = leg(pL);
    let [tR, sR, fR] = leg(pR);
    // airborne tuck
    tL = lerp(tL, -0.65, air); sL = lerp(sL, 1.0, air); fL = lerp(fL, 0.2, air);
    tR = lerp(tR, -0.15, air); sR = lerp(sR, 0.55, air); fR = lerp(fR, 0.15, air);

    const idle = 1 - w;
    const breathe = Math.sin(this.t * 1.7);
    const sway = Math.sin(this.t * 0.55);

    b['thigh.L'].rotation.set(tL, 0, 0.02 + 0.015 * idle * sway);
    b['thigh.R'].rotation.set(tR, 0, -0.02 + 0.015 * idle * sway);
    b['shin.L'].rotation.set(sL + 0.03 * idle, 0, 0);
    b['shin.R'].rotation.set(sR + 0.03 * idle, 0, 0);
    b['foot.L'].rotation.set(fL - 0.03 * idle, 0, 0);
    b['foot.R'].rotation.set(fR - 0.03 * idle, 0, 0);

    // ---- pelvis & spine
    const hipYaw = P('hipYaw') * w;
    const hipRoll = (this.female ? 0.06 : 0.03) * Math.cos(pL) * w * (1 - r * 0.6);
    b.hips.rotation.set(0.04 * r * w, -hipYaw * Math.sin(pL), hipRoll + 0.02 * idle * sway + this.turnLean);
    const bob = P('bob') * w * Math.cos(2 * pL) - 0.035 * r * w + lerp(0, 0.04, air) - 0.004 * idle * (1 - breathe);
    b.hips.position.y = this.hipsRestY + bob;
    b.spine.rotation.set(P('lean') * w + 0.02 * air, 0, -hipRoll * 0.6 - this.turnLean * 0.4);
    b.chest.rotation.set(0.012 * breathe * idle - 0.03 * air, hipYaw * 2.1 * Math.sin(pL), -hipRoll * 0.3);
    b.neck.rotation.set(-P('lean') * w * 0.5, -hipYaw * Math.sin(pL), 0);
    const look = idle * 0.22 * Math.sin(this.t * 0.23) * Math.sin(this.t * 0.37 + 1);
    b.head.rotation.set(-P('lean') * w * 0.4 + 0.02 * breathe * idle, look, -this.turnLean * 0.5);

    // ---- arms
    const arm = P('arm') * femaleArm * w;
    const elbowBase = lerp(-0.1, P('elbow'), w);
    const armOut = 0.07 + 0.05 * r;
    let aL = arm * Math.sin(pL) + 0.02 * idle * Math.sin(this.t * 1.1);
    let aR = arm * Math.sin(pR) + 0.02 * idle * Math.sin(this.t * 1.1 + 1);
    let eL = elbowBase + P('elbowSwing') * Math.max(0, -Math.sin(pL)) * w;
    let eR = elbowBase + P('elbowSwing') * Math.max(0, -Math.sin(pR)) * w;
    aL = lerp(aL, -0.55, air); aR = lerp(aR, -0.3, air); eL = lerp(eL, -0.9, air); eR = lerp(eR, -0.7, air);
    const outAir = 0.35 * air;
    b['upperArm.L'].rotation.set(aL, 0, armOut + outAir + 0.015 * breathe * idle);
    b['upperArm.R'].rotation.set(aR, 0, -armOut - outAir - 0.015 * breathe * idle);
    b['foreArm.L'].rotation.set(eL, 0.15 * w, 0);
    b['foreArm.R'].rotation.set(eR, -0.15 * w, 0);
    b['hand.L'].rotation.set(-0.1 * r, 0, 0.05);
    b['hand.R'].rotation.set(-0.1 * r, 0, -0.05);
  }
}
