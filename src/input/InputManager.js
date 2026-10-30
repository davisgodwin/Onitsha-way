/**
 * Unified input: keyboard + mouse (pointer lock, with drag-to-look fallback where pointer lock is
 * unavailable, e.g. inside an iframe) + touch (fed in by TouchControls).
 * Gameplay code only asks for intents: move vector, run, look delta, zoom, button presses.
 */
const MOVE_KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
const ACTION_KEYS = { Space: 'jump', KeyE: 'interact', KeyM: 'map', Escape: 'pause', KeyP: 'pause', KeyC: 'camera', KeyI: 'bag', KeyJ: 'jobs', KeyN: 'nextstop', KeyH: 'drophere', KeyF: 'fuel', KeyK: 'skip', KeyL: 'homes', KeyO: 'phone', KeyX: 'sit', KeyZ: 'lie' };

export class InputManager {
  constructor(canvas, bus) {
    this.canvas = canvas;
    this.bus = bus;
    this.keys = new Set();
    this.presses = new Set();
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.enabled = false;
    this.dragging = false;
    this.locked = false;
    this.touch = { x: 0, y: 0, active: false, run: false };
    this.lastLookTime = 0;
    this.pointerLockAllowed = true; // off during activities: the mouse button is a game action there

    window.addEventListener('keydown', (e) => {
      if ((e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement)) return;
      if (MOVE_KEYS[e.code] || e.code === 'Space') e.preventDefault();
      if (!this.keys.has(e.code) && ACTION_KEYS[e.code]) this.presses.add(ACTION_KEYS[e.code]);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if(document.hidden)this.reset(); });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.pointerLockAllowed) { if (e.button === 0) this.presses.add('primary'); this.dragging = true; return; } // activities: click = action, drag = aim
      this.dragging = true;
      if (!this.locked && e.button === 0 && canvas.requestPointerLock) {
        try { const p = canvas.requestPointerLock(); if (p?.catch) p.catch(() => {}); } catch { /* not allowed here; drag-look still works */ }
      }
    });
    window.addEventListener('mouseup', () => (this.dragging = false));
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || this.dragging) { this.addLook(e.movementX, e.movementY); }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { if (this.enabled) { this.zoom += Math.sign(e.deltaY); e.preventDefault(); } }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      // A lock requested just before a menu opened can resolve after setEnabled(false).
      if (this.locked && !this.enabled) { this.releasePointer(); return; }
      // only a release the player caused (Esc, leaving the window) counts as "lost"; releases the game
      // asked for itself (opening a menu or overlay) are expected
      if (was && !this.locked && !this.releasing) this.bus.emit('input:pointerlock-lost');
      this.releasing = false;
    });
  }

  addLook(dx, dy) {
    this.look.dx += dx; this.look.dy += dy;
    if (dx || dy) this.lastLookTime = performance.now();
  }

  reset() {
    this.keys.clear();this.presses.clear();this.look.dx=this.look.dy=0;this.zoom=0;this.dragging=false;
    Object.assign(this.touch,{x:0,y:0,active:false,run:false});
  }
  setEnabled(v) {
    this.reset();this.enabled = v;
    if (!v) this.releasePointer();
  }
  releasePointer() { if (document.pointerLockElement) { this.releasing = true; document.exitPointerLock?.(); } }

  /** {x: strafe, y: forward, mag 0..1} */
  getMove() {
    let x = 0, y = 0;
    for (const k of this.keys) { const m = MOVE_KEYS[k]; if (m) { x += m[0]; y += m[1]; } }
    if (this.touch.active) { x += this.touch.x; y += this.touch.y; }
    const mag = Math.min(1, Math.hypot(x, y));
    if (mag > 0) { const l = Math.hypot(x, y); x /= l; y /= l; }
    return { x, y, mag };
  }
  isRunning() {
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) return true;
    if (this.touch.run) return true;
    return this.touch.active && Math.hypot(this.touch.x, this.touch.y) > 0.92;
  }
  consumeLook() { const l = { ...this.look }; this.look.dx = this.look.dy = 0; return l; }
  consumeZoom() { const z = this.zoom; this.zoom = 0; return z; }
  consumePress(name) { const h = this.presses.has(name); this.presses.delete(name); return h; }
  press(name) { this.presses.add(name); }
  clearPresses() { this.presses.clear(); }
}
