import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';

// Procedurally painted fabric textures (original designs — no third-party prints).
// Ankara-style wax-print motifs: bold concentric circles, diamonds, leaves and waves.

export const ANKARA_PALETTES = [
  ['#f2a20c', '#1b3a8c', '#c81d25', '#fff6e0'],
  ['#0b6e4f', '#f4d35e', '#ee964b', '#141414'],
  ['#6a0572', '#ffbe0b', '#fb5607', '#fff1e6'],
  ['#023e8a', '#ff8500', '#90e0ef', '#03045e'],
  ['#9b2226', '#e9d8a6', '#0a9396', '#001219'],
  ['#ffba08', '#3f88c5', '#d00000', '#032b43'],
  ['#2b9348', '#f8f9fa', '#e85d04', '#370617'],
];
const PATTERNS = ['circles', 'diamonds', 'leaves', 'waves'];

const cache = new Map();

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function finish(c, key, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

function weave(ctx, size, rng, alpha = 0.06) {
  // subtle cloth grain
  for (let i = 0; i < size * 6; i++) {
    ctx.fillStyle = rng() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    const x = rng() * size, y = rng() * size;
    ctx.fillRect(x, y, rng() > 0.5 ? 3 : 1, rng() > 0.5 ? 1 : 3);
  }
}

export function ankaraTexture(paletteIndex = 0, patternIndex = 0) {
  const key = `ankara:${paletteIndex}:${patternIndex}`;
  if (cache.has(key)) return cache.get(key);
  const pal = ANKARA_PALETTES[paletteIndex % ANKARA_PALETTES.length];
  const pattern = PATTERNS[patternIndex % PATTERNS.length];
  const S = 512;
  const [c, g] = canvas(S);
  const rng = mulberry32(paletteIndex * 97 + patternIndex * 13 + 7);
  g.fillStyle = pal[0]; g.fillRect(0, 0, S, S);
  const cell = 128;
  for (let gy = -1; gy <= S / cell; gy++) {
    for (let gx = -1; gx <= S / cell; gx++) {
      const ox = gx * cell + (gy % 2 ? cell / 2 : 0) + cell / 2;
      const oy = gy * cell + cell / 2;
      if (pattern === 'circles') {
        const rings = [52, 40, 28, 16, 7];
        rings.forEach((r, i) => { g.beginPath(); g.arc(ox, oy, r, 0, Math.PI * 2); g.fillStyle = pal[1 + (i % 3)]; g.fill(); });
        for (let k = 0; k < 12; k++) { // dotted halo
          const a = (k / 12) * Math.PI * 2;
          g.beginPath(); g.arc(ox + Math.cos(a) * 60, oy + Math.sin(a) * 60, 4, 0, Math.PI * 2); g.fillStyle = pal[3]; g.fill();
        }
      } else if (pattern === 'diamonds') {
        [56, 42, 26, 12].forEach((r, i) => {
          g.beginPath(); g.moveTo(ox, oy - r); g.lineTo(ox + r * 0.8, oy); g.lineTo(ox, oy + r); g.lineTo(ox - r * 0.8, oy); g.closePath();
          g.fillStyle = pal[1 + (i % 3)]; g.fill();
        });
        g.fillStyle = pal[3];
        g.fillRect(ox - cell / 2, oy - 2, 10, 4); g.fillRect(ox + cell / 2 - 10, oy - 2, 10, 4);
      } else if (pattern === 'leaves') {
        for (let k = 0; k < 5; k++) {
          g.save(); g.translate(ox, oy); g.rotate((k / 5) * Math.PI * 2 + 0.3);
          g.beginPath(); g.ellipse(0, -30, 13, 30, 0, 0, Math.PI * 2); g.fillStyle = pal[1 + (k % 2)]; g.fill();
          g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -56); g.strokeStyle = pal[3]; g.lineWidth = 3; g.stroke();
          g.restore();
        }
        g.beginPath(); g.arc(ox, oy, 11, 0, Math.PI * 2); g.fillStyle = pal[3]; g.fill();
      } else { // waves
        g.lineWidth = 11;
        for (let k = 0; k < 3; k++) {
          g.strokeStyle = pal[1 + k];
          g.beginPath();
          for (let x = -cell / 2; x <= cell / 2; x += 4) {
            const y = oy - 30 + k * 26 + Math.sin((x / cell) * Math.PI * 2) * 12;
            x === -cell / 2 ? g.moveTo(ox + x, y) : g.lineTo(ox + x, y);
          }
          g.stroke();
        }
      }
    }
  }
  // wax-print crackle
  g.globalAlpha = 0.08; g.strokeStyle = '#000'; g.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    g.beginPath(); let x = rng() * S, y = rng() * S; g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rng() - 0.5) * 40; y += (rng() - 0.5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
  weave(g, S, rng, 0.05);
  return finish(c, key, [2, 2]);
}

export function denimTexture(shade = '#2d4a7a') {
  const key = `denim:${shade}`;
  if (cache.has(key)) return cache.get(key);
  const S = 256; const [c, g] = canvas(S); const rng = mulberry32(42);
  g.fillStyle = shade; g.fillRect(0, 0, S, S);
  g.globalAlpha = 0.18;
  for (let i = -S; i < S * 2; i += 3) {
    g.strokeStyle = rng() > 0.5 ? '#ffffff' : '#000000';
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke();
  }
  g.globalAlpha = 1;
  weave(g, S, rng, 0.08);
  return finish(c, key, [3, 3]);
}

export function plainFabricTexture(color = '#ffffff') {
  const key = `plain:${color}`;
  if (cache.has(key)) return cache.get(key);
  const S = 128; const [c, g] = canvas(S); const rng = mulberry32(7);
  g.fillStyle = color; g.fillRect(0, 0, S, S);
  weave(g, S, rng, 0.025);
  return finish(c, key, [3, 3]);
}

/** Plain kaftan fabric with a contrasting embroidered band painted along one edge (used on the chest placket). */
export function senatorTexture(color = '#1d2b4f', trim = '#d4af37') {
  const key = `senator:${color}:${trim}`;
  if (cache.has(key)) return cache.get(key);
  const S = 256; const [c, g] = canvas(S); const rng = mulberry32(11);
  g.fillStyle = color; g.fillRect(0, 0, S, S);
  weave(g, S, rng, 0.04);
  // vertical embroidery band at u≈0.25 (front of the sweep)
  g.strokeStyle = trim; g.lineWidth = 2;
  const x0 = S * 0.25;
  g.beginPath(); g.moveTo(x0 - 7, 0); g.lineTo(x0 - 7, S); g.moveTo(x0 + 7, 0); g.lineTo(x0 + 7, S); g.stroke();
  for (let y = 4; y < S; y += 16) {
    g.beginPath(); g.moveTo(x0 - 5, y); g.lineTo(x0, y + 6); g.lineTo(x0 + 5, y); g.stroke();
  }
  return finish(c, key, [1, 1]);
}

export function skinDetailTexture() {
  const key = 'skin';
  if (cache.has(key)) return cache.get(key);
  const S = 256; const [c, g] = canvas(S); const rng = mulberry32(3);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) {
    const v = 247 + Math.floor(rng() * 8);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rng() * S, rng() * S, 1, 1);
  }
  return finish(c, key, [2, 2]);
}

export function hairTexture(pattern = 'short') {
  const key = `hair:${pattern}`;
  if (cache.has(key)) return cache.get(key);
  const S = 256; const [c, g] = canvas(S); const rng = mulberry32(5);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  if (pattern === 'waves') {
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3;
    for (let y = 0; y < S; y += 10) {
      g.beginPath();
      for (let x = 0; x <= S; x += 4) { const yy = y + Math.sin(x * 0.12) * 3; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
      g.stroke();
    }
  } else if (pattern === 'braid') {
    for (let y = 0; y < S; y += 12) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(S / 2, y, S / 2, 4, 0.25, 0, Math.PI * 2); g.fill();
    }
  }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = rng() > 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.12)';
    g.fillRect(rng() * S, rng() * S, 1, 1 + rng() * 2);
  }
  return finish(c, key, [4, 4]);
}
