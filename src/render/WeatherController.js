import { LiveWeather } from '../sim/LiveWeather.js';
import { Rain } from './Rain.js';
import { calendar, weatherAt, powerAt, trafficFactor } from '../sim/Calendar.js';
import { durationLabel } from '../jobs/JobSystem.js';

/*
  Milestone 7: brings the calendar, weather and power supply (pure functions in sim/Calendar.js) into the
  world each frame — sky, fog and wet roads (Atmosphere), falling rain, street lights in a power cut,
  sounds, how many people and cars are out, rain fares — and tells the player when things change.
  The weather seed lives in the save (world.weatherSeed), so a reload gives the same weather.
*/
export class WeatherController {
  constructor(game) { this.g = game; this.w = { rain: 0, harmattan: 0, cloud: 0, label: 'Clear' }; this.power = { on: true, until: null }; this.cal = calendar(1); this.live=new LiveWeather(); }

  setup() {
    const g = this.g;
    this.rain = new Rain(g.renderer.scene, { count: g.settings.quality === 'low' ? 1200 : 2600 });
    const wet = [];
    g.renderer.scene.traverse((o) => {
      if ((o.name === 'asphalt' || o.name === 'dirtRoads') && o.material && !wet.some((x) => x.mat === o.material)) wet.push({ mat: o.material, rough: o.material.roughness, color: o.material.color.clone() });
    });
    g.atmosphere.wetMaterials = wet;
  }

  start(saveData) {
    saveData.world.weatherSeed ??= (Math.random() * 1e9) | 0;
    this.seed = saveData.world.weatherSeed;
    this.prev = null;
    this.sample();
  }

  sample() {
    const g = this.g, day = g.clock.day, m = g.clock.minutes;
    this.cal = calendar(day);
    const live=g.settings.liveWeather!==false;
    if(live&&g.state==='playing'&&g.saveData&&performance.now()-g.stateAt>1000)void this.live.refresh();
    const fresh=this.live.current && Date.now()-this.live.current.fetchedAt<6*3600000;
    this.w = live&&fresh ? this.live.current : weatherAt(day, m, this.seed ?? 0);
    this.power = powerAt(day, m, this.seed ?? 0);
  }

  /** Every frame while the world runs. */
  update(dt) {
    const g = this.g;
    this.sample();
    const w = this.w, hour = g.clock.minutes / 60, indoor = !!g.homes?.inside || !!g.club?.inside || !!g.civic?.inside;
    g.atmosphere.weather = w;
    g.atmosphere.power = this.power.on;
    g.npcs.weather = w; g.npcs.power = this.power.on; g.npcs.weekday = this.cal.weekday;
    g.traffic.timeK = trafficFactor(this.cal.weekday, hour, w.rain);
    if (g.transport?.trips) g.transport.trips.surge = 1 + 0.3 * Math.max(0, Math.min(1, (w.rain - 0.2) / 0.5));
    const cam = g.renderer.camera.position;
    this.rain.update(dt, cam, g.state === 'menu' ? 0 : w.rain, indoor);
    this.announce();
  }

  /** Toasts when the weather turns or the power goes off / comes back. */
  announce() {
    const g = this.g, now = { raining: this.w.rain > 0.15, power: this.power.on, day: g.clock.day };
    const p = this.prev; this.prev = now;
    if (!p || g.state !== 'playing') return;
    if (now.raining && !p.raining) g.ui.toast(`Rain don start! Fewer people on the road; keke and bus drivers are charging more.`);
    else if (!now.raining && p.raining) g.ui.toast('The rain has stopped.');
    if (!now.power && p.power) g.ui.toast(`NEPA don take light! Power should be back in about ${durationLabel(this.power.until - g.clock.minutes)}.`);
    else if (now.power && !p.power) g.ui.toast('Up NEPA! The light is back.');
    if (now.day !== p.day) {
      const c = this.cal;
      g.ui.toast(`${c.weekdayName}, ${c.label.split(' · ')[1]} — ${c.season === 'harmattan' ? 'harmattan season' : c.season === 'rainy' ? 'rainy season' : 'dry season'}${c.weekday === 6 ? '. Markets are closed today.' : ''}`);
    }
  }

  /** Ambience levels for the audio manager. */
  audioLevels(market) {
    const indoor = !!this.g.homes?.inside;
    const off = !this.power.on;
    return {
      rain: this.w.rain * (indoor ? 0.75 : 1),
      generator: off ? Math.min(1, (indoor ? 0.25 : 0.45) + 0.5 * market) : 0,
    };
  }

  /** {day, weather, power} labels for the HUD. */
  hud() {
    const w = this.w, icon = w.rain > 0.15 ? '🌧' : w.cloud > 0.5 ? '☁' : w.harmattan > 0.3 ? '🌫' : (this.g.atmosphere.nightK ?? 0) > 0.5 ? '☾' : '☀';
    return { day: this.g.clock.mode==='real'?`${this.cal.label} · WAT`:'Preview time', weather: `${icon} ${w.label}${w.temperature!=null?` ${Math.round(w.temperature)}°C`:''} · ${this.g.settings.liveWeather===false?'simulated':this.live.current && Date.now()-this.live.current.fetchedAt<6*3600000?this.live.status:'offline fallback'}`, power: this.power.on ? null : 'No light' };
  }
}
