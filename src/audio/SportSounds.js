/**
 * Procedural sports sounds (Web Audio, original, nothing to license): referee whistle, ball kicks and
 * bounces, post/crossbar clang, crowd bed with cheers and groans. Uses the game's AudioManager context
 * and master gain, so the volume setting and pause ducking apply. Silent until audio is unlocked.
 */
export class SportSounds {
  constructor(audio) { this.a = audio; this.bedGain = null; }
  get ok() { return !!this.a?.ctx && this.a.ctx.state === 'running'; }

  whistle(long = false) {
    if (!this.ok) return;
    const ctx = this.a.ctx, at = ctx.currentTime + 0.01;
    const blasts = long ? [[0, 0.35], [0.45, 0.35], [0.9, 0.9]] : [[0, 0.32]];
    for (const [off, len] of blasts) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 2650;
      const trill = ctx.createOscillator(); trill.frequency.value = 38; const tg = ctx.createGain(); tg.gain.value = 140; trill.connect(tg).connect(o.frequency);
      const g = ctx.createGain(); const t = at + off;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02); g.gain.setValueAtTime(0.09, t + len - 0.05); g.gain.linearRampToValueAtTime(0, t + len);
      o.connect(g).connect(this.a.master); o.start(t); o.stop(t + len + 0.02); trill.start(t); trill.stop(t + len + 0.02);
    }
  }

  /** A boot on the ball (strength 0..1) or a bounce on grass. */
  kick(strength = 0.5, distance = 10) {
    if (!this.ok) return;
    const ctx = this.a.ctx, at = ctx.currentTime, vol = (0.06 + 0.22 * strength) / (1 + distance / 30);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(170 + 90 * strength, at); o.frequency.exponentialRampToValueAtTime(60, at + 0.09);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0008, at + 0.12);
    o.connect(g).connect(this.a.master); o.start(at); o.stop(at + 0.14);
    const src = ctx.createBufferSource(); src.buffer = this.a.noise; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(vol * 0.7, at); ng.gain.exponentialRampToValueAtTime(0.0006, at + 0.05);
    src.connect(bp).connect(ng).connect(this.a.master); src.start(at, Math.random() * 2, 0.06);
  }
  bounce(strength = 0.3, distance = 10) { this.kick(strength * 0.35, distance); }

  /** Pool balls touching (strength 0..1). */
  click(strength = 0.5) {
    if (!this.ok) return;
    const ctx = this.a.ctx, at = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(3200 + Math.random() * 600, at); o.frequency.exponentialRampToValueAtTime(1800, at + 0.03);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.03 + 0.14 * strength, at); g.gain.exponentialRampToValueAtTime(0.0005, at + 0.05);
    o.connect(g).connect(this.a.master); o.start(at); o.stop(at + 0.06);
  }
  /** A ball dropping into a pocket and rolling down the return. */
  pocket() {
    if (!this.ok) return;
    const ctx = this.a.ctx, at = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, at); o.frequency.exponentialRampToValueAtTime(70, at + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.16, at); g.gain.exponentialRampToValueAtTime(0.0008, at + 0.18);
    o.connect(g).connect(this.a.master); o.start(at); o.stop(at + 0.2);
    for (let i = 0; i < 4; i++) { const t = at + 0.15 + i * 0.07, r = ctx.createOscillator(); r.type = 'triangle'; r.frequency.value = 900 + Math.random() * 300; const rg = ctx.createGain(); rg.gain.setValueAtTime(0.02, t); rg.gain.exponentialRampToValueAtTime(0.0004, t + 0.04); r.connect(rg).connect(this.a.master); r.start(t); r.stop(t + 0.05); }
  }
  /** A short arcade blip (gaming centre). */
  blip(freq = 660, len = 0.08, vol = 0.05) {
    if (!this.ok) return;
    const ctx = this.a.ctx, at = ctx.currentTime, o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0005, at + len);
    o.connect(g).connect(this.a.master); o.start(at); o.stop(at + len + 0.01);
  }
  /** Ball against the goal frame. */
  post(strength = 0.6) {
    if (!this.ok) return;
    const ctx = this.a.ctx, at = ctx.currentTime;
    for (const [f, a] of [[520, 1], [1190, 0.5], [2310, 0.25]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.12 * strength * a, at); g.gain.exponentialRampToValueAtTime(0.0005, at + 0.7);
      o.connect(g).connect(this.a.master); o.start(at); o.stop(at + 0.75);
    }
  }

  /** Continuous crowd murmur while a match is on (level 0..1). */
  crowd(level) {
    if (!this.a?.ctx) return;
    const ctx = this.a.ctx;
    if (!this.bedGain) {
      const src = ctx.createBufferSource(); src.buffer = this.a.noise; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.5;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      this.bedGain = ctx.createGain(); this.bedGain.gain.value = 0;
      src.connect(bp).connect(lp).connect(this.bedGain).connect(this.a.master); src.start(); this.bedSrc = src;
    }
    this.bedGain.gain.setTargetAtTime(Math.max(0, level) * 0.06, ctx.currentTime, 0.6);
  }
  stopCrowd() { if (this.bedGain && this.a?.ctx) this.bedGain.gain.setTargetAtTime(0, this.a.ctx.currentTime, 0.3); }
  dispose() { try { this.bedSrc?.stop(); } catch { /* already stopped */ } this.bedSrc = null; this.bedGain = null; }

  /** A swell of cheering (goal) or a groan (near miss). */
  cheer(intensity = 1, groan = false) {
    if (!this.ok) return;
    const ctx = this.a.ctx, at = ctx.currentTime + 0.03, dur = groan ? 1.4 : 3.2;
    const src = ctx.createBufferSource(); src.buffer = this.a.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(groan ? 520 : 900, at); bp.frequency.linearRampToValueAtTime(groan ? 300 : 1300, at + dur * 0.4);
    const g = ctx.createGain(); const v = (groan ? 0.07 : 0.16) * intensity;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v, at + (groan ? 0.15 : 0.3)); g.gain.setValueAtTime(v, at + dur * 0.45); g.gain.linearRampToValueAtTime(0, at + dur);
    src.connect(bp).connect(g).connect(this.a.master); src.start(at, Math.random() * 1.5, dur + 0.1);
    if (!groan) { // a few voices on top
      for (let i = 0; i < 6; i++) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; const f = 220 + Math.random() * 260, t = at + Math.random() * 0.6;
        o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.25, t + 0.5);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200;
        const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(0.012 * intensity, t + 0.08); vg.gain.linearRampToValueAtTime(0, t + 1.2 + Math.random());
        o.connect(lp).connect(vg).connect(this.a.master); o.start(t); o.stop(t + 2.4);
      }
    }
  }
}
