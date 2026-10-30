/**
 * Mobile controls: floating joystick on the left half, drag-to-look on the right half,
 * and a few large contextual buttons. Writes intents into InputManager.
 */
export class TouchControls {
  constructor(root, input) {
    this.input = input;
    this.el = document.createElement('div');
    this.el.className = 'touch-layer';
    this.el.innerHTML = `
      <div class="touch-zone touch-move" data-zone="move"></div>
      <div class="touch-zone touch-look" data-zone="look"></div>
      <div class="joy" hidden><div class="joy-knob"></div></div>
      <div class="touch-buttons">
        <button class="tbtn tbtn-interact" data-act="interact" hidden>Use</button>
        <button class="tbtn tbtn-sit" data-act="sit" aria-label="Sit down or stand up">Sit</button>
        <button class="tbtn tbtn-lie" data-act="lie" aria-label="Lie down">Lie</button>
        <button class="tbtn tbtn-run" data-act="run" aria-pressed="false">Run</button>
        <button class="tbtn tbtn-jump" data-act="jump">Jump</button>
      </div>`;
    root.appendChild(this.el);
    this.joy = this.el.querySelector('.joy');
    this.knob = this.el.querySelector('.joy-knob');
    this.movePointer = null; this.lookPointer = null;
    this.origin = { x: 0, y: 0 }; this.lastLook = { x: 0, y: 0 };
    this.radius = 56;

    const move = this.el.querySelector('.touch-move');
    const look = this.el.querySelector('.touch-look');
    move.addEventListener('pointerdown', (e) => {
      if (this.movePointer !== null) return;
      this.movePointer = e.pointerId; move.setPointerCapture(e.pointerId);
      this.origin = { x: e.clientX, y: e.clientY };
      this.joy.hidden = false;
      this.joy.style.transform = `translate(${e.clientX - 64}px, ${e.clientY - 64}px)`;
      this.knob.style.transform = 'translate(0px, 0px)';
      input.touch.active = true; input.touch.x = input.touch.y = 0;
    });
    move.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.movePointer) return;
      let dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y;
      const d = Math.hypot(dx, dy), r = this.radius;
      if (d > r) { dx = (dx / d) * r; dy = (dy / d) * r; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = 0.12;
      const mx = dx / r, my = -dy / r, m = Math.hypot(mx, my);
      const k = m < dead ? 0 : (m - dead) / (1 - dead) / (m || 1);
      input.touch.x = mx * k; input.touch.y = my * k;
    });
    const endMove = (e) => {
      if (e.pointerId !== this.movePointer) return;
      this.movePointer = null; this.joy.hidden = true;
      input.touch.active = false; input.touch.x = input.touch.y = 0;
    };
    move.addEventListener('pointerup', endMove); move.addEventListener('pointercancel', endMove);move.addEventListener('lostpointercapture',endMove);

    look.addEventListener('pointerdown', (e) => {
      if (this.lookPointer !== null) return;
      this.lookPointer = e.pointerId; look.setPointerCapture(e.pointerId);
      this.lastLook = { x: e.clientX, y: e.clientY };
    });
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookPointer) return;
      const k = 2.1; // touch moves feel slow relative to mouse
      input.addLook((e.clientX - this.lastLook.x) * k, (e.clientY - this.lastLook.y) * k);
      this.lastLook = { x: e.clientX, y: e.clientY };
    });
    const endLook = (e) => { if (e.pointerId === this.lookPointer) this.lookPointer = null; };
    look.addEventListener('pointerup', endLook); look.addEventListener('pointercancel', endLook);look.addEventListener('lostpointercapture',endLook);
    window.addEventListener('blur',()=>this.reset());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.reset();});

    this.el.querySelectorAll('.tbtn').forEach((b) => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        const act = b.dataset.act;
        if (act === 'run') { input.touch.run = !input.touch.run; b.setAttribute('aria-pressed', String(input.touch.run)); }
        else input.press(act);
      });
    });
  }
  reset() {this.movePointer=this.lookPointer=null;this.joy.hidden=true;this.input.touch.active=false;this.input.touch.x=this.input.touch.y=0;this.input.touch.run=false;this.el.querySelector('.tbtn-run').setAttribute('aria-pressed','false');}
  setVisible(v) { this.el.hidden = !v;if(!v)this.reset(); }
  /** Activities (football…) show their own buttons; the joystick stays, walking buttons and drag-look hide. */
  setActivityMode(on) { this.el.classList.toggle('activity-mode', !!on); this.reset(); }
  setInteract(label) {
    const b = this.el.querySelector('.tbtn-interact');
    b.hidden = !label; if (label) b.textContent = label;
  }
}
