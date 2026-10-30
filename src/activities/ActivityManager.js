import './activities.css';
import { beginActivity, abandonActivity, settleAbandoned, ensureActivities } from './ActivityRecords.js';

/**
 * One shared way to run a city activity (football now; pool, board games, basketball… later).
 *
 * The manager owns everything every activity needs and must get right the same way:
 *  - only starts from normal walking play (not driving, riding, indoors, in custody or a chase);
 *  - a unique match id in the save, so a result is rewarded once and a closed tab counts as abandoned;
 *  - the 'activity' game state: world keeps living, walking controls and menus are off, pointer lock off;
 *  - its own HUD screen (#screen-activity): score bar, status line, power meter, hints, touch buttons,
 *    and one panel for pause / half-time / results;
 *  - pause (Esc, P, the ‖ button, leaving the tab), and leaving at any time without a result;
 *  - putting the player back exactly where they stood, camera, controls and HUD restored.
 *
 * An activity object implements:
 *   kind, title, begin(mgr), update(dt), end(), focus() → {x,z}, controls: {desktop: string, touch: [{act,label,hold?}]}
 * and calls mgr.finish(panel) when it has a result, mgr.panel({...}) for in-activity panels.
 */
export class ActivityManager {
  constructor(g) {
    this.g = g; this.current = null; this.paused = false; this.hold = {}; this.matchId = null;
    this.el = document.getElementById('screen-activity');
    const $ = (k) => this.el.querySelector(`[data-act=${k}]`);
    this.slots = { score: $('score'), status: $('status'), meter: $('meter'), stamina: $('stamina'), hint: $('hint'), touch: $('touch'), panel: $('panel') };
    this.el.querySelector('[data-act-action=pause]').addEventListener('click', () => this.togglePause());
    document.addEventListener('visibilitychange', () => { if (!document.hidden || !this.current) return; if (!this.paused && !this.panelOpen) this.setPause(true); this.g.saveGameNow(); });
  }
  get active() { return !!this.current; }

  /** Why an activity cannot start right now (null when it can). */
  blocked() {
    const g = this.g;
    if (!g.saveData) return 'Enter the city first.';
    if (this.current) return 'Finish your current activity first.';
    if (g.state !== 'playing' && g.state !== 'overlay') return 'Not available right now.';
    if (g.vehicles?.driving) return 'Park and get out of your car first.';
    if (g.transport?.riding) return 'Finish your trip first.';
    if (g.homes?.inside || g.club?.inside || g.civic?.inside || g.story?.inside) return 'Go outside first.';
    if (g.story?.s?.arrest || g.story?.s?.pending) return 'Sort out the police matter first.';
    return null;
  }

  start(activity) {
    const g = this.g, why = this.blocked();
    if (why) { g.ui.toast(why); return false; }
    g.closeChoice?.();
    const pos = g.player.serialize();
    this.returnPos = { x: pos.x, z: pos.z, heading: pos.heading };
    this.matchId = beginActivity(g.saveData, activity.kind);
    this.current = activity; this.paused = false; this.panelOpen = false; this.hold = {};
    this.slots.panel.hidden = true; this.slots.panel.replaceChildren(); this.slots.status.textContent = ''; this.slots.score.replaceChildren(); this.setMeter(0); this.setStamina(null);
    try { activity.begin(this); }
    catch (err) { this.current = null; abandonActivity(g.saveData, this.matchId); this.matchId = null; g.reportError?.(err, 'activity-start'); g.ui.toast('Could not start that activity.'); return false; }
    this.renderControls();
    g.ui.setPrompt(null); g.touchControls?.setInteract(null);
    g.ui.only('activity'); g.setState('activity');
    g.input.pointerLockAllowed = false; g.input.releasePointer(); g.input.reset();
    g.touchControls?.setActivityMode(true);
    g.saveGameNow();
    return true;
  }

  renderControls() {
    const a = this.current, touch = !!this.g.touch;
    this.slots.hint.textContent = touch ? (a.controls?.touchHint ?? '') : (a.controls?.desktop ?? '');
    const box = this.slots.touch; box.replaceChildren(); box.hidden = !touch;
    if (!touch) return;
    for (const b of a.controls?.touch ?? []) {
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'act-btn act-btn-' + b.act; btn.textContent = b.label; btn.dataset.act = b.act;
      const down = (e) => { e.preventDefault(); e.stopPropagation(); if (b.toggle) { this.hold[b.act] = !this.hold[b.act]; btn.setAttribute('aria-pressed', String(!!this.hold[b.act])); return; } this.hold[b.act] = true; btn.classList.add('down'); this.g.input.press('act:' + b.act); };
      const up = (e) => { if (b.toggle) return; e?.preventDefault?.(); this.hold[b.act] = false; btn.classList.remove('down'); };
      btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
      if (b.toggle) btn.setAttribute('aria-pressed', 'false');
      box.appendChild(btn);
    }
  }

  /** Read by activities: was this action pressed since last frame? (keyboard intent or touch button) */
  pressed(...names) { let hit = false; for (const n of names) if (this.g.input.consumePress(n)) hit = true; return hit; }
  held(act, ...codes) { return !!this.hold[act] || codes.some((c) => this.g.input.keys.has(c)); }

  update(dt) {
    const g = this.g, a = this.current; if (!a) return;
    if (g.input.consumePress('pause')) { if (!this.panelOpen) this.togglePause(); else if (this.paused) this.setPause(false); }
    if (!this.paused) a.update(dt);
    else a.idle?.(dt);
    // walking-mode shortcuts (map, bag, phone…) are not active during an activity
    g.input.clearPresses();
    g.input.consumeLook(); g.input.consumeZoom();
  }

  togglePause() { this.setPause(!this.paused); }
  setPause(on) {
    if (!this.current || this.panelOpen && !this.paused) return;
    this.paused = on; this.current.onPause?.(on);
    if (on) this.panel({ title: 'Paused', text: this.current.pauseText?.() ?? '', buttons: [
      { label: 'Resume', primary: true, act: () => this.setPause(false) },
      { label: 'How to play', act: () => this.panel({ title: 'Controls', text: this.g.touch ? this.current.controls?.touchHelp ?? '' : this.current.controls?.desktopHelp ?? '', buttons: [{ label: 'Back', primary: true, act: () => this.setPause(true) }] }) },
      { label: 'Leave (no result)', danger: true, act: () => this.confirmLeave() },
    ] });
    else this.closePanel();
  }
  confirmLeave() {
    this.panel({ title: 'Leave now?', text: 'Leaving before the end records no result and no reward. Your wallet and progress are not affected.', buttons: [
      { label: 'Keep playing', primary: true, act: () => this.setPause(true) },
      { label: 'Leave', danger: true, act: () => this.end({ abandon: true }) },
    ] });
  }

  /** Show the shared panel. lines: [{label, value}] ; buttons: [{label, act, primary?, danger?}] */
  panel({ title, kicker = '', text = '', lines = [], list = [], buttons = [] }) {
    const p = this.slots.panel; p.replaceChildren(); this.panelOpen = true;
    const card = document.createElement('div'); card.className = 'act-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', title);
    if (kicker) { const k = document.createElement('div'); k.className = 'act-kicker'; k.textContent = kicker; card.appendChild(k); }
    const h = document.createElement('h2'); h.textContent = title; card.appendChild(h);
    if (text) { const t = document.createElement('p'); t.textContent = text; card.appendChild(t); }
    if (lines.length) { const dl = document.createElement('dl'); for (const l of lines) { const dt = document.createElement('dt'); dt.textContent = l.label; const dd = document.createElement('dd'); dd.textContent = l.value; dl.append(dt, dd); } card.appendChild(dl); }
    if (list.length) { const ul = document.createElement('ul'); for (const x of list) { const li = document.createElement('li'); li.textContent = x; ul.appendChild(li); } card.appendChild(ul); }
    const row = document.createElement('div'); row.className = 'act-buttons';
    for (const b of buttons) { const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = b.label; if (b.primary) btn.className = 'primary'; if (b.danger) btn.className = 'danger'; btn.addEventListener('click', () => b.act()); row.appendChild(btn); }
    card.appendChild(row); p.appendChild(card); p.hidden = false;
    requestAnimationFrame(() => row.querySelector('button')?.focus({ preventScroll: true }));
  }
  closePanel() { this.slots.panel.hidden = true; this.slots.panel.replaceChildren(); this.panelOpen = false; }

  /** HUD helpers for activities. */
  setScore(html) { this.slots.score.replaceChildren(...html); }
  setStatus(text) { if (this.slots.status.textContent !== text) this.slots.status.textContent = text; }
  setMeter(v) { const m = this.slots.meter; m.hidden = !(v > 0); if (v > 0) m.firstElementChild.style.width = `${Math.round(v * 100)}%`; }
  setStamina(v) { const s = this.slots.stamina; if (v == null) { s.hidden = true; return; } s.hidden = false; s.firstElementChild.style.width = `${Math.round(v * 100)}%`; s.classList.toggle('low', v < 0.25); }

  /** The activity has its result. Activities record it via ActivityRecords before calling this. */
  finished() { this.matchId = null; }

  /** Leave the activity and return to the city exactly where the player was. */
  end({ abandon = false } = {}) {
    const g = this.g, a = this.current; if (!a) return;
    if (abandon && this.matchId) abandonActivity(g.saveData, this.matchId);
    this.matchId = null; this.current = null; this.paused = false; this.hold = {};
    try { a.end(); } catch (err) { g.reportError?.(err, 'activity-end'); }
    this.closePanel(); this.slots.touch.replaceChildren(); this.slots.score.replaceChildren(); this.slots.status.textContent = ''; this.setMeter(0); this.setStamina(null);
    const p = this.returnPos ?? g.player.serialize();
    g.player.human.group.visible = true;
    g.player.teleport(p.x, p.z, p.heading);
    g.cameraRig.setMode('follow'); g.cameraRig.snapTo(g.player.position);
    g.input.pointerLockAllowed = true; g.input.reset();
    g.touchControls?.setActivityMode(false);
    g.ui.only('hud'); g.setState('playing');
    g.saveGameNow();
  }

  /** While an activity runs the city stays loaded around it. */
  focus() { return this.current?.focus?.() ?? null; }
  /** Saved position mid-activity: where the player will stand if the page closes. */
  savePosition() { return this.current && this.returnPos ? { ...this.returnPos } : null; }
  /** On loading a save: an activity left running when the page closed is recorded as abandoned. */
  onLoad(save) { ensureActivities(save); const was = settleAbandoned(save); if (was) this.g.ui.toast('Your last match was not finished, so no result was recorded.'); }
}
