import { SaveSystem } from '../save/SaveSystem.js';
import './drive-dash.css';
/**
 * The driving dashboard can be minimised to a small pill (speed, fuel, Get out) so it doesn't cover the road on a
 * phone. The choice is remembered. The radio keeps playing while minimised.
 */
export class DriveDash {
  constructor(g) {
    this.g = g; const el = this.el = g.ui.el.hud.querySelector('.hud-drive');
    const b = this.button = document.createElement('button'); b.type = 'button'; b.className = 'drive-min-btn';
    b.addEventListener('click', (e) => { e.stopPropagation(); this.set(!this.min); });
    el.prepend(b);
    this.set(g.settings.driveMinimized === true, false);
  }
  set(min, save = true) {
    this.min = !!min; this.g.settings.driveMinimized = this.min;
    document.body.classList.toggle('drive-minimized', this.min);
    this.button.textContent = this.min ? '▴' : '▾';
    const label = this.min ? 'Show the full dashboard' : 'Minimise the dashboard';
    this.button.setAttribute('aria-label', label); this.button.title = label; this.button.setAttribute('aria-expanded', String(!this.min));
    if (save) SaveSystem.saveSettings(this.g.settings);
  }
}
