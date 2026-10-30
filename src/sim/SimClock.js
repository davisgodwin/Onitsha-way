import { CONFIG } from '../config.js';
import { setRealCalendar } from './Calendar.js';
export function onitshaTime(now=Date.now()){const d=new Date(now+3600000);return {date:Math.floor((now+3600000)/86400000),minutes:d.getUTCHours()*60+d.getUTCMinutes()+d.getUTCSeconds()/60};}

/**
 * Authoritative in-game clock. Every time-driven system (lighting now; shop hours, NPC routines,
 * transport schedules, rent expiry later) reads from this single source.
 */
export class SimClock {
  constructor(bus, { day = 1, minutes = CONFIG.clock.startMinutes } = {}) {
    this.bus = bus;
    this.day = day;
    this.minutes = minutes;
    this.rate = CONFIG.clock.minutesPerSecond;
    this.paused = false;
    this._lastHour = Math.floor(minutes / 60);
  }
  setMode(mode,{now=Date.now(),realDate=null}={}) {
    if(this.mode===mode)return;
    this.mode=mode;
    if(mode==='real'){const t=onitshaTime(now);if(Number.isInteger(realDate))this.day+=Math.max(0,t.date-realDate);this.realDate=t.date;this.minutes=t.minutes;this.rate=1/60;setRealCalendar(this.day,t.date);}
    else setRealCalendar(null);
  }
  syncReal(now=Date.now()) {
    if(this.mode!=='real')return;
    const t=onitshaTime(now),old=this.day;
    if(t.date>this.realDate)this.day+=t.date-this.realDate;
    this.realDate=t.date;this.minutes=t.minutes;setRealCalendar(this.day,t.date);
    if(old!==this.day)this.bus?.emit('clock:day',this.day);
    const h=this.hour;if(h!==this._lastHour){this._lastHour=h;this.bus?.emit('clock:hour',h);}
  }
  update(dt) {
    if(this.mode==='real'){this.syncReal();return;}
    if (this.paused) return;
    this.minutes += dt * this.rate;
    if (this.minutes >= 1440) { this.minutes -= 1440; this.day++; this.bus?.emit('clock:day', this.day); }
    const h = Math.floor(this.minutes / 60);
    if (h !== this._lastHour) { this._lastHour = h; this.bus?.emit('clock:hour', h); }
  }
  /** Jump the clock forward (sleeping, skipping a ride or a drive). Day and hour events still fire. */
  advance(mins) {
    if (this.mode==='real' || !(mins > 0)) return;
    let left = mins;
    while (left > 0) {
      const step = Math.min(left, 30);
      left -= step;
      this.minutes += step;
      if (this.minutes >= 1440) { this.minutes -= 1440; this.day++; this.bus?.emit('clock:day', this.day); }
      const h = Math.floor(this.minutes / 60);
      if (h !== this._lastHour) { this._lastHour = h; this.bus?.emit('clock:hour', h); }
    }
  }
  get hour() { return Math.floor(this.minutes / 60); }
  label() {
    const h = Math.floor(this.minutes / 60), m = Math.floor(this.minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  period() {
    const h = this.minutes / 60;
    return h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 16 ? 'Afternoon' : h < 19 ? 'Evening' : 'Night';
  }
  serialize() { return { day: this.day, minutes: Math.round(this.minutes), ...(this.mode==='real'?{realDate:this.realDate}:{}) }; }
}
