/**
 * Central audio manager — Web Audio, fully procedural (original sounds, nothing to license).
 *
 * Layers
 *  - market bed: band-passed crowd noise + scheduled "voice" formant blips (density follows the market level)
 *  - traffic bed: low rumble + engine drone near main roads
 *  - night bed: crickets after dark
 *  - river bed: soft wash near the Niger
 *  - rain (hiss + low patter) and thunder in storms; a generator's drone when the grid power is off (M7)
 *  - events: keke horns (panned to where they come from), footsteps synced to the walk cycle
 * Levels are pushed in by the game every few frames; everything is smoothed here.
 * The context is created on the first user gesture (browsers block audio before that).
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.duck = 0.4;           // menu / pause attenuation
    this.levels = { market: 0, traffic: 0, night: 0, river: 0, rain: 0, generator: 0, choir: 0 };
    this.nextThunder = 8;
    this.nextVoice = 0; this.nextHorn = 2;
    this.listenerYaw = 0;
  }

  get ready() { return !!this.ctx; }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch { return; }
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.noise = this.makeNoise(3, 'white');
    this.brown = this.makeNoise(4, 'brown');

    // market crowd bed
    this.market = this.bed(this.noise, [['bandpass', 700, 0.6], ['peaking', 1800, 1, -6]]);
    // traffic rumble + drone
    this.traffic = this.bed(this.brown, [['lowpass', 220, 0.7]]);
    const drone = ctx.createOscillator(); drone.type = 'sawtooth'; drone.frequency.value = 52;
    const droneF = ctx.createBiquadFilter(); droneF.type = 'lowpass'; droneF.frequency.value = 140;
    const droneLfo = ctx.createOscillator(); droneLfo.frequency.value = 0.13;
    const droneLfoG = ctx.createGain(); droneLfoG.gain.value = 9; droneLfo.connect(droneLfoG).connect(drone.frequency);
    drone.connect(droneF).connect(this.traffic.gain); drone.start(); droneLfo.start();
    // crickets
    const cr = ctx.createOscillator(); cr.type = 'sine'; cr.frequency.value = 4300;
    const crAmp = ctx.createGain(); crAmp.gain.value = 0;
    const chirp = ctx.createOscillator(); chirp.type = 'square'; chirp.frequency.value = 17;
    const chirpG = ctx.createGain(); chirpG.gain.value = 0.5; chirp.connect(chirpG).connect(crAmp.gain);
    const slow = ctx.createOscillator(); slow.frequency.value = 0.35; const slowG = ctx.createGain(); slowG.gain.value = 0.5;
    slow.connect(slowG).connect(crAmp.gain);
    this.night = { gain: ctx.createGain() }; this.night.gain.gain.value = 0;
    cr.connect(crAmp).connect(this.night.gain).connect(this.master); cr.start(); chirp.start(); slow.start();
    // river wash
    this.river = this.bed(this.noise, [['lowpass', 520, 0.5]]);
    // rain: bright hiss on the zinc roofs plus a low drumming
    this.rainHiss = this.bed(this.noise, [['highpass', 1200, 0.4], ['lowpass', 8000, 0.3]]);
    this.rainLow = this.bed(this.brown, [['lowpass', 380, 0.5]]);
    // generator: a small petrol engine — two detuned saws, muffled, with a lumpy idle
    this.gen = { gain: ctx.createGain() }; this.gen.gain.gain.value = 0;
    const gf = ctx.createBiquadFilter(); gf.type = 'lowpass'; gf.frequency.value = 320; gf.Q.value = 2;
    const gAmp = ctx.createGain(); gAmp.gain.value = 0.6;
    const lump = ctx.createOscillator(); lump.frequency.value = 7.5; const lumpG = ctx.createGain(); lumpG.gain.value = 0.35; lump.connect(lumpG).connect(gAmp.gain);
    for (const f of [49, 98.6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(gf); o.start(); }
    gf.connect(gAmp).connect(this.gen.gain).connect(this.master); lump.start();
    this.applyVolume(0.1);
  }

  makeNoise(seconds, type) {
    const ctx = this.ctx, n = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  bed(buffer, filters) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
    let node = src;
    for (const [type, f, q, gain] of filters) {
      const bq = ctx.createBiquadFilter(); bq.type = type; bq.frequency.value = f; bq.Q.value = q; if (gain !== undefined) bq.gain.value = gain;
      node.connect(bq); node = bq;
    }
    const g = ctx.createGain(); g.gain.value = 0;
    node.connect(g).connect(this.master);
    src.start(Math.random() * buffer.duration);
    return { gain: g };
  }

  setVolume(v) { this.volume = v; this.applyVolume(); }
  setDuck(d) { this.duck = d; this.applyVolume(); }
  applyVolume(t = 0.4) {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.volume * this.duck, this.ctx.currentTime, t);
  }

  /** levels: 0..1 each. */
  setLevels(l, listenerYaw = 0) {
    Object.assign(this.levels, l);
    this.listenerYaw = listenerYaw;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.market.gain.gain.setTargetAtTime(0.16 * this.levels.market, t, 0.8);
    this.traffic.gain.gain.setTargetAtTime(0.5 * this.levels.traffic, t, 0.8);
    this.night.gain.gain.setTargetAtTime(0.012 * this.levels.night, t, 1.5);
    this.river.gain.gain.setTargetAtTime(0.18 * this.levels.river, t, 1.0);
    this.rainHiss.gain.gain.setTargetAtTime(0.11 * this.levels.rain, t, 1.2);
    this.rainLow.gain.gain.setTargetAtTime(0.55 * this.levels.rain, t, 1.2);
    this.gen.gain.gain.setTargetAtTime(0.05 * this.levels.generator, t, 0.8);
    if (this.levels.choir > 0.01 && !this.choir) this.makeChoir();
    this.choir?.gain.gain.setTargetAtTime(0.05 * this.levels.choir, t, 1.5);
  }

  /** Call every frame while playing. hornSource(): {x, z, dist} or null for a nearby road point. */
  update(dt, hornSource) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // crowd voices
    if (this.levels.market > 0.05 && now > this.nextVoice) {
      const n = 1 + Math.floor(Math.random() * 3 * this.levels.market);
      for (let i = 0; i < n; i++) this.voice(now + Math.random() * 0.25, this.levels.market);
      this.nextVoice = now + 0.12 + Math.random() * (0.8 / (0.2 + this.levels.market));
    }
    // thunder in a proper storm
    if (this.levels.rain > 0.45 && now > this.nextThunder) {
      this.thunder(Math.random());
      this.nextThunder = now + 9 + Math.random() * 25;
    }
    // keke horns
    if (this.levels.traffic > 0.08 && now > this.nextHorn) {
      const src = hornSource?.();
      if (src) this.horn(src.angle, src.dist);
      this.nextHorn = now + 3 + Math.random() * (14 / (0.3 + this.levels.traffic));
    }
  }

  voice(at, level) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f0 = 110 + Math.random() * 160; o.frequency.setValueAtTime(f0, at);
    o.frequency.linearRampToValueAtTime(f0 * (0.85 + Math.random() * 0.4), at + 0.18);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 500 + Math.random() * 900; f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1300 + Math.random() * 1200; f2.Q.value = 8;
    const g = ctx.createGain(); g.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const dur = 0.08 + Math.random() * 0.22, peak = 0.02 + 0.03 * level * Math.random();
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + 0.03); g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g);
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan).connect(this.master); } else g.connect(this.master);
    o.start(at); o.stop(at + dur + 0.05);
  }

  /** Two-tone keke horn. angle: radians relative to the camera (0 = ahead), dist in metres. */
  horn(angle, dist) {
    if (!this.ctx || this.ctx.state !== 'running') return; // audio not unlocked yet (no user gesture)
    const ctx = this.ctx, at = ctx.currentTime + 0.02;
    const g = ctx.createGain(); g.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400 - Math.min(1800, dist * 12);
    const vol = 0.09 / (1 + dist / 25);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const beeps = Math.random() < 0.5 ? 2 : 3;
    for (let b = 0; b < beeps; b++) {
      const t = at + b * 0.2;
      for (const f of [480, 600]) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * (0.97 + Math.random() * 0.06);
        o.connect(lp); o.start(t); o.stop(t + 0.14);
      }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.setValueAtTime(vol, t + 0.12); g.gain.linearRampToValueAtTime(0, t + 0.14);
    }
    lp.connect(g);
    if (pan) { pan.pan.value = Math.max(-1, Math.min(1, Math.sin(angle))); g.connect(pan).connect(this.master); } else g.connect(this.master);
  }

  /**
   * Your own vehicle's engine: two detuned oscillators through a low-pass, pitch following a simple gearbox
   * (a keke's small two-stroke sits higher and buzzier), plus tyre hiss when sliding. on=false fades it out.
   */
  engine(on, { speed = 0, throttle = 0, model = 'sedan', slide = 0 } = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (!this.eng) {
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 3;
      const a = ctx.createOscillator(); a.type = 'sawtooth'; const b = ctx.createOscillator(); b.type = 'square';
      a.connect(lp); b.connect(lp); lp.connect(g).connect(this.master); a.start(); b.start();
      const tyre = this.bed(this.noise, [['bandpass', 1800, 1.2]]);
      this.eng = { g, lp, a, b, tyre };
    }
    const e = this.eng;
    if (!on) { e.g.gain.setTargetAtTime(0, t, 0.2); e.tyre.gain.gain.setTargetAtTime(0, t, 0.2); return; }
    const keke = model === 'keke', v = Math.abs(speed);
    const span = keke ? 4.5 : 7, gear = Math.min(4, Math.floor(v / span)), frac = (v - gear * span) / span;
    const base = keke ? 52 : 34, f = base * (1 + 0.55 * Math.min(1.4, frac + (gear ? 0.35 : 0)) + Math.max(0, throttle) * 0.15);
    e.a.frequency.setTargetAtTime(f, t, 0.08); e.b.frequency.setTargetAtTime(f * (keke ? 2.01 : 1.5), t, 0.08);
    e.lp.frequency.setTargetAtTime((keke ? 900 : 420) + 500 * Math.max(0, throttle), t, 0.1);
    e.g.gain.setTargetAtTime((keke ? 0.05 : 0.04) * (0.55 + 0.45 * Math.max(0, throttle)), t, 0.1);
    e.tyre.gain.gain.setTargetAtTime(Math.min(0.06, slide * 0.02), t, 0.1);
  }

  /** Sunday Mass heard from outside: a soft four-part hymn (sustained voices moving through I–IV–V–I). */
  makeChoir() {
    const ctx = this.ctx, out = ctx.createGain(); out.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    lp.connect(out).connect(this.master);
    const chords = [[196, 247, 294, 392], [175, 262, 349, 440], [196, 247, 294, 392], [147, 220, 294, 370], [196, 247, 294, 392]];
    const voices = [0, 1, 2, 3].map((k) => {
      const o = ctx.createOscillator(); o.type = k === 0 ? 'triangle' : 'sine';
      const vib = ctx.createOscillator(); vib.frequency.value = 4.6 + k * 0.4; const vg = ctx.createGain(); vg.gain.value = 2.2; vib.connect(vg).connect(o.frequency);
      const g = ctx.createGain(); g.gain.value = 0.22;
      o.connect(g).connect(lp); o.start(); vib.start();
      return o;
    });
    let i = 0;
    const step = () => {
      if (!this.ctx) return;
      const c = chords[i++ % chords.length], t = ctx.currentTime;
      voices.forEach((o, k) => o.frequency.setTargetAtTime(c[k], t, 0.25));
    };
    step(); this.choirTimer = setInterval(step, 3200);
    this.choir = { gain: out };
  }

  /** A church bell: a few strikes of a struck metal partial series. */
  bell(dist = 200) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, vol = 0.12 / (1 + dist / 150);
    for (let k = 0; k < 5; k++) {
      const at = ctx.currentTime + 0.05 + k * 1.6;
      for (const [f, a] of [[220, 1], [440, 0.5], [528, 0.35], [660, 0.25], [880, 0.15]]) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol * a, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, at + 2.8);
        o.connect(g).connect(this.master); o.start(at); o.stop(at + 3);
      }
    }
  }

  /** A roll of thunder: a brown-noise rumble swept down through a low-pass, near (0) or far (1). */
  thunder(far = 0.5) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, at = ctx.currentTime + 0.05;
    const src = ctx.createBufferSource(); src.buffer = this.brown;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(far > 0.6 ? 260 : 900, at); lp.frequency.exponentialRampToValueAtTime(90, at + 3.5);
    const g = ctx.createGain(); const v = 0.9 * (1 - far * 0.6);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v, at + (far > 0.6 ? 0.6 : 0.08));
    g.gain.exponentialRampToValueAtTime(v * 0.35, at + 1.2); g.gain.exponentialRampToValueAtTime(0.001, at + 4.5);
    src.connect(lp).connect(g).connect(this.master);
    src.start(at, Math.random() * 2, 4.6);
    this.onThunder?.(far);
  }

  footstep(surface = 'hard', strength = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx, at = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = surface === 'dirt' ? 500 : 1100;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const g = ctx.createGain();
    const v = 0.11 * strength * (surface === 'dirt' ? 0.8 : 1);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, at + 0.11);
    src.connect(lp).connect(hp).connect(g).connect(this.master);
    src.start(at, Math.random() * 2, 0.13);
  }
}
