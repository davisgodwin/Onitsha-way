import { PITCH } from './FootballMatch.js';

/**
 * Broadcast-style top-down drawing of a FootballMatch on a 2D canvas: used for the gaming-centre console game
 * and the viewing-centre screen. x → right, z → down.
 */
export function drawPitch2D(ctx, match, { w, h, colors = ['#2f8a4a', '#8e2732'], keeper = ['#c9a227', '#3b3b3b'], names = ['Home', 'Away'], userId = null, banner = null, scoreboard = true } = {}) {
  const pad = Math.round(Math.min(w, h) * 0.05), top = scoreboard ? Math.round(h * 0.11) : 0;
  const sx = (w - pad * 2) / (PITCH.L + 3), sz = (h - top - pad * 2) / (PITCH.W + 2), s = Math.min(sx, sz);
  const ox = w / 2, oz = top + (h - top) / 2;
  const X = (x) => ox + x * s, Z = (z) => oz + z * s;
  // grass with mowing stripes
  ctx.fillStyle = '#1f5d33'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? '#2a7040' : '#2f7a46'; ctx.fillRect(X(-PITCH.L / 2 + i * PITCH.L / 10), Z(-PITCH.W / 2), PITCH.L / 10 * s + 1, PITCH.W * s); }
  ctx.strokeStyle = '#f2f6ee'; ctx.lineWidth = Math.max(1.5, s * 0.12);
  ctx.strokeRect(X(-PITCH.L / 2), Z(-PITCH.W / 2), PITCH.L * s, PITCH.W * s);
  ctx.beginPath(); ctx.moveTo(X(0), Z(-PITCH.W / 2)); ctx.lineTo(X(0), Z(PITCH.W / 2)); ctx.stroke();
  ctx.beginPath(); ctx.arc(X(0), Z(0), 3 * s, 0, Math.PI * 2); ctx.stroke();
  for (const e of [-1, 1]) {
    const gx = e * PITCH.L / 2; ctx.strokeRect(Math.min(X(gx), X(gx - e * PITCH.boxDepth)), Z(-PITCH.boxHalf), PITCH.boxDepth * s, PITCH.boxHalf * 2 * s);
    ctx.fillStyle = '#e9ece6'; ctx.fillRect(Math.min(X(gx), X(gx + e * 1.2)), Z(-PITCH.goalW / 2), 1.2 * s, PITCH.goalW * s);
    ctx.strokeStyle = '#9aa29b'; ctx.lineWidth = 1; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(X(gx), Z(-PITCH.goalW / 2 + k * PITCH.goalW / 4)); ctx.lineTo(X(gx + e * 1.2), Z(-PITCH.goalW / 2 + k * PITCH.goalW / 4)); ctx.stroke(); }
    ctx.strokeStyle = '#f2f6ee'; ctx.lineWidth = Math.max(1.5, s * 0.12);
  }
  // players
  const r = Math.max(5, s * 0.55);
  for (const p of match.players) {
    const col = p.role === 'gk' ? keeper[p.team] : colors[p.team];
    ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.ellipse(X(p.x) + r * 0.25, Z(p.z) + r * 0.35, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(p.x), Z(p.z), r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.id === userId ? '#ffe680' : '#0008'; ctx.lineWidth = p.id === userId ? Math.max(2, r * 0.35) : 1.5; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, r * 0.18); ctx.beginPath(); ctx.moveTo(X(p.x), Z(p.z)); ctx.lineTo(X(p.x + Math.cos(p.heading) * 0.9), Z(p.z + Math.sin(p.heading) * 0.9)); ctx.stroke();
    if (p.id === userId) { ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.moveTo(X(p.x), Z(p.z) - r - 3); ctx.lineTo(X(p.x) - r * 0.6, Z(p.z) - r * 2); ctx.lineTo(X(p.x) + r * 0.6, Z(p.z) - r * 2); ctx.fill(); }
  }
  // ball with height shadow
  const b = match.ball, br = Math.max(3, s * 0.25) * (1 + b.y * 0.12);
  ctx.fillStyle = '#0007'; ctx.beginPath(); ctx.arc(X(b.x), Z(b.z), Math.max(2.5, s * 0.22), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(X(b.x) - b.y * s * 0.3, Z(b.z) - b.y * s * 0.6, br, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  if (scoreboard) {
    const st = match.status, fmt = (t) => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
    ctx.fillStyle = '#101512e6'; ctx.fillRect(0, 0, w, top);
    const fs = Math.round(top * 0.42); ctx.font = `700 ${fs}px system-ui, Arial`; ctx.textBaseline = 'middle';
    ctx.fillStyle = colors[0]; ctx.fillRect(pad, top * 0.25, fs * 0.35, top * 0.5); ctx.fillStyle = colors[1]; ctx.fillRect(w - pad - fs * 0.35, top * 0.25, fs * 0.35, top * 0.5);
    ctx.fillStyle = '#f2f6ee'; ctx.textAlign = 'left'; ctx.fillText(names[0], pad + fs * 0.6, top / 2, w * 0.33); ctx.textAlign = 'right'; ctx.fillText(names[1], w - pad - fs * 0.6, top / 2, w * 0.33);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffd35a'; ctx.font = `800 ${Math.round(top * 0.55)}px system-ui, Arial`; ctx.fillText(`${st.score[0]} – ${st.score[1]}`, w / 2, top / 2 - top * 0.08);
    ctx.font = `600 ${Math.round(top * 0.24)}px system-ui, Arial`; ctx.fillStyle = '#9fe3b0'; ctx.fillText(`${st.half === 1 ? '1ST' : '2ND'} HALF · ${fmt(st.remaining)}`, w / 2, top * 0.86);
  }
  if (banner) { ctx.fillStyle = '#000a'; ctx.fillRect(0, h * 0.42, w, h * 0.16); ctx.fillStyle = '#ffd35a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(h * 0.08)}px system-ui, Arial`; ctx.fillText(banner, w / 2, h / 2, w * 0.9); }
}
