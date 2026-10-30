import * as THREE from 'three';
import { smoothstep, lerp } from '../core/utils.js';

/**
 * Day / night lighting driven by the SimClock. Onitsha sits ~6°N, so the sun rises in the east (+x),
 * passes almost overhead slightly to the south (+z) and sets in the west around 19:00.
 * The daytime horizon is kept hazy — dust and humidity soften the light.
 */
const SUNRISE = 6 * 60 + 45, SUNSET = 18 * 60 + 55;

const C = (h) => new THREE.Color(h);
const PAL = {
  night: { top: C('#0a1024'), hor: C('#1a2236'), sun: C('#7f95c8'), hemiSky: C('#33406a'), hemiGround: C('#1c1712') },
  dawn: { top: C('#45589a'), hor: C('#f0a565'), sun: C('#ffb26b'), hemiSky: C('#c9a58a'), hemiGround: C('#6a4a36') },
  day: { top: C('#4b87c6'), hor: C('#d8dcd8'), sun: C('#fff1dc'), hemiSky: C('#dfe8f0'), hemiGround: C('#8a6a52') },
};

const STORM = { top: C('#5d6670'), hor: C('#8c939a'), sun: C('#c9d0d8') };
const DUST = { top: C('#b8b4a6'), hor: C('#d6c19c'), sun: C('#ffe0b0') };

/** The quality setting's draw distance (what the fog goes back to in clear weather). */
function CONFIG_FAR(r) { return r.camera.far - 150; }

export class Atmosphere {
  /** nightMaterials: [{mat, max}] whose emissiveIntensity ramps up after dusk (signs, windows, lamps). */
  constructor(renderer, { nightMaterials = [] } = {}) {
    this.r = renderer;
    this.nightMaterials = nightMaterials;
    this.tmp = { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), c: new THREE.Color() };
    /** Set by the game (Milestone 7): {rain, harmattan, cloud} 0..1, and whether there is grid power. */
    this.weather = { rain: 0, harmattan: 0, cloud: 0 };
    this.power = true;
    this.wetMaterials = [];
  }

  update(minutes) {
    const a = ((minutes - SUNRISE) / (SUNSET - SUNRISE)) * Math.PI;
    const elev = Math.sin(a); // <0 at night
    const dayK = smoothstep(-0.12, 0.28, elev);
    const warm = elev > -0.15 ? 1 - smoothstep(0.08, 0.42, elev) : smoothstep(-0.35, -0.15, elev);
    const t = this.tmp;
    const mix3 = (key, out) => out.copy(PAL.night[key]).lerp(PAL.day[key], dayK).lerp(PAL.dawn[key], warm * 0.85);
    mix3('top', t.top); mix3('hor', t.hor); mix3('sun', t.sun); mix3('hemiSky', t.hs); mix3('hemiGround', t.hg);
    // weather: storm clouds grey the sky; harmattan dust turns the horizon beige and dims the sun
    const w = this.weather, cl = w.cloud ?? 0, hm = w.harmattan ?? 0, rn = w.rain ?? 0;
    const dim = 0.35 + 0.65 * dayK; // weather colours fade into the night palette
    if (cl > 0) { t.top.lerp(t.c.copy(STORM.top).multiplyScalar(dim), cl * 0.8); t.hor.lerp(t.c.copy(STORM.hor).multiplyScalar(dim), cl * 0.75); t.sun.lerp(STORM.sun, cl * 0.6); }
    if (hm > 0) { t.top.lerp(t.c.copy(DUST.top).multiplyScalar(dim), hm * 0.7); t.hor.lerp(t.c.copy(DUST.hor).multiplyScalar(dim), hm * 0.8); t.sun.lerp(DUST.sun, hm * 0.5); }

    const r = this.r;
    const dayLight = elev > 0;
    // sun direction; at night the "sun" light becomes soft moonlight from a fixed direction
    if (dayLight) r.sunDir.set(Math.cos(a), Math.max(0.08, elev), 0.22).normalize();
    else r.sunDir.set(-0.35, 0.75, -0.4).normalize();
    r.sun.color.copy(t.sun);
    r.sun.intensity = (dayLight ? lerp(0.6, 2.7, smoothstep(0, 0.45, elev)) : 0.45) * (1 - 0.7 * cl) * (1 - 0.45 * hm);
    r.hemi.color.copy(t.hs); r.hemi.groundColor.copy(t.hg);
    r.hemi.intensity = lerp(0.6, 1.05, dayK) * (1 - 0.2 * cl);
    r.scene.fog.color.copy(t.hor);
    // haze: dust or rain brings the fog in
    const base = CONFIG_FAR(r);
    const thick = Math.max(rn * 0.75, hm * 0.85);
    r.scene.fog.near = lerp(80, 12, thick);
    r.scene.fog.far = base * lerp(1, 0.32, thick);
    // wet roads: darker and shinier while it rains (and a little after)
    this.wet = Math.max(rn, (this.wet ?? 0) - 0.0005);
    for (const { mat, rough, color } of this.wetMaterials) { mat.roughness = lerp(rough, 0.38, this.wet); mat.color.copy(color).multiplyScalar(1 - 0.32 * this.wet); }
    const u = r.sky.material.uniforms;
    u.cloud.value = Math.max(.18, cl);
    u.skyTime.value = performance.now()/1000;
    u.top.value.copy(t.top); u.horizon.value.copy(t.hor);
    u.ground.value.copy(t.hor).multiplyScalar(0.55);
    u.sunDir.value.set(Math.cos(a), elev, 0.22);
    u.sunColor.value.copy(t.sun);
    u.sunVis.value = smoothstep(-0.05, 0.05, elev) * (1 - cl) * (1 - 0.6 * hm);
    r.renderer.toneMappingExposure = lerp(0.95, 1.0, dayK);
    const nightK = 1 - smoothstep(-0.05, 0.12, elev);
    // a power cut (NEPA took light): street lamps go out; homes and shops with generators stay dimly lit
    for (const { mat, max, grid } of this.nightMaterials) mat.emissiveIntensity = nightK * max * (this.power ? 1 : grid ? 0 : 0.4);
    this.nightK = nightK;
    this.isNight = dayK < 0.4;
    // indoors (a home interior): the city can't be seen, so the scene lights become the room's light —
    // the ceiling lamp when it's on, otherwise what daylight comes in through the windows
    const ind = this.indoor;
    if (ind) {
      const day = ind.daylight;
      r.hemi.color.set(ind.lamp ? '#fff1d8' : '#e8eef4'); r.hemi.groundColor.set('#7d6a58');
      r.hemi.intensity = ind.lamp ? 1.55 : 0.25 + 1.05 * day * (1 - 0.5 * cl);
      r.sun.color.set('#fff3e2'); r.sun.intensity = ind.lamp ? 0.7 : 0.15 + 0.9 * day;
      r.renderer.toneMappingExposure = 1.0;
    }
  }
}
