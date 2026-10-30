/**
 * The 🎙 Voice button in the city HUD (online play only).
 * - Voice off: tap to choose who to talk to (players nearby, or your crew). The browser then asks for the microphone.
 * - Voice on: press and HOLD the button to talk (phones), or hold V on a keyboard. A quick tap opens the voice menu
 *   (switch mode, open mic, mute, turn off).
 * Audio goes straight between players' browsers (WebRTC); the game server only passes on the connection setup.
 */
const TAP_MS = 280;

export function voiceErrorText(e) {
  if (!window.isSecureContext || /HTTPS|localhost/i.test(e?.message ?? '')) return 'Voice needs a secure page. On phones, open the https:// address shown in the host computer\'s terminal (npm run lan).';
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return 'The microphone is blocked for this site. Allow the microphone in your browser\'s site settings, then try again.';
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return 'No microphone was found on this device.';
  if (e?.name === 'NotReadableError') return 'Another app is using the microphone. Close it and try again.';
  return `Voice could not start: ${e?.message ?? e}`;
}

export class VoiceButton {
  constructor(online) {
    this.o = online; this.g = online.g; this.voice = online.voice; this.pressAt = 0; this.pressing = false; this.shown = '';
    const b = this.el = document.createElement('button');
    b.type = 'button'; b.className = 'hud-chip hud-voice'; b.hidden = true; b.setAttribute('aria-label', 'Voice chat');
    b.innerHTML = '<span class="hud-voice-ico" aria-hidden="true">🎙</span><span class="hud-voice-label">Voice</span>';
    this.label = b.querySelector('.hud-voice-label');
    const down = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (this.voice.mode === 'off') return;
      this.pressing = true; this.pressAt = performance.now(); try { b.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
      this.voice.hold(true); this.resumeAudio();
    };
    const up = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (this.voice.mode === 'off') { if (e.type === 'pointerup') this.openMenu(); return; }
      if (!this.pressing) return;
      this.pressing = false; this.voice.hold(false);
      if (e.type === 'pointerup' && performance.now() - this.pressAt < TAP_MS) this.openMenu();
    };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', (e) => { if (this.pressing) up(e); });
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (e.detail === 0) this.openMenu(); }); // keyboard Enter/Space
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    this.g.ui.el.hud.append(b);
  }
  resumeAudio() { for (const p of this.voice.peers.values()) if (p.audio.paused && p.audio.srcObject) p.audio.play().catch(() => {}); }

  /** Called every frame and on voice changes: cheap, only touches the DOM when something changed. */
  update() {
    const g = this.g, v = this.voice;
    const visible = !!this.o.connected && !!g.saveData && ['playing', 'paused', 'overlay', 'map', 'activity', 'chase'].includes(g.state) && g.state !== 'activity';
    const talking = v.mode !== 'off' && (v.held || v.openMic);
    const peers = [...v.peers.values()].filter((p) => p.pc.connectionState === 'connected').length;
    const touch = !!g.touch || matchMedia('(pointer: coarse)').matches;
    const text = v.mode === 'off' ? 'Voice' : talking ? (v.openMic ? 'Mic open' : 'Talking…') : touch ? 'Hold to talk' : 'Hold V to talk';
    const key = `${visible}|${v.mode}|${talking}|${text}|${peers}`;
    if (key === this.shown) return; this.shown = key;
    this.el.hidden = !visible;
    this.el.dataset.state = v.mode === 'off' ? 'off' : talking ? 'talking' : 'on';
    this.label.textContent = text;
    this.el.title = v.mode === 'off' ? 'Voice chat — tap to start' : `Voice: ${v.mode === 'team' ? 'crew' : 'nearby'} · ${peers} connected · tap for options`;
    this.el.setAttribute('aria-pressed', String(talking));
  }

  openMenu() {
    const g = this.g; this.resumeAudio();
    g.openChoice(() => this.view());
  }
  async start(mode) {
    try { await this.voice.enable(mode); this.error = ''; this.g.ui.toast(mode === 'team' ? 'Crew voice on — hold the 🎙 button to talk' : 'Nearby voice on — hold the 🎙 button to talk', 4000); this.g.closeChoice(); }
    catch (e) { this.error = voiceErrorText(e); this.voice.stop(); this.g.renderChoice(); }
    this.update();
  }
  view() {
    const v = this.voice, o = this.o, secure = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
    const crew = !!o.data?.team, names = [...v.peers.entries()].filter(([, p]) => p.pc.connectionState === 'connected').map(([id]) => o.players.find((p) => p.id === id)?.name).filter(Boolean);
    const touch = !!this.g.touch || matchMedia('(pointer: coarse)').matches;
    const how = touch ? 'Press and hold the 🎙 button while you speak.' : 'Hold V (or hold the 🎙 button) while you speak.';
    const status = v.mode === 'off' ? 'Voice is off.' : `Voice is on (${v.mode === 'team' ? 'crew only' : 'players within 60 m'}). ${names.length ? `Connected to ${names.join(', ')}.` : 'No one in range has voice on yet.'}`;
    const options = v.mode === 'off' ? [
      { label: 'Talk to players nearby', sub: 'Anyone within 60 m who also turns on Nearby voice. Voices get quieter with distance.', primary: true, disabled: !secure, why: 'Needs a secure (https) page', act: () => this.start('nearby') },
      { label: 'Talk to my crew', sub: crew ? 'Only your crew members, anywhere in the city' : 'Join or make a crew first (Messages → Crew)', disabled: !secure || !crew, why: !secure ? 'Needs a secure (https) page' : 'You are not in a crew', act: () => this.start('team') },
    ] : [
      { label: v.mode === 'team' ? 'Switch to players nearby' : 'Switch to my crew', disabled: v.mode === 'nearby' && !crew, why: 'You are not in a crew', act: () => this.start(v.mode === 'team' ? 'nearby' : 'team') },
      { label: v.openMic ? 'Open mic: ON — tap to switch to hold-to-talk' : 'Open mic: off — tap to talk without holding', sub: 'Open mic sends everything your microphone hears', act: () => { v.openMic = !v.openMic; v.hold(v.held); this.update(); this.g.renderChoice(); } },
      { label: v.deaf ? 'Hear players: OFF — tap to hear again' : 'Hear players: on — tap to mute everyone', act: () => { v.deaf = !v.deaf; v.update?.(); this.g.renderChoice(); } },
      { label: 'Turn voice off', sub: 'Stops the microphone', act: () => { v.stop(); this.update(); this.g.closeChoice(); } },
    ];
    options.push({ label: 'Done', ghost: true, act: () => this.g.closeChoice() });
    return { title: 'Voice chat', kicker: v.mode === 'off' ? 'TALK TO OTHER PLAYERS' : `VOICE ON · ${v.mode === 'team' ? 'CREW' : 'NEARBY'}`,
      text: `${status} ${how}`,
      note: this.error || (!secure ? 'Voice needs a secure page. On phones, open the https:// address shown in the host computer\'s terminal (npm run lan).' : 'Your browser will ask to use the microphone the first time. Audio goes directly between players\' devices.'),
      options };
  }
}
