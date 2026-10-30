import * as THREE from 'three';
import { mulberry32 } from '../core/utils.js';

// All world textures are painted procedurally at load time — no external image assets,
// no licensing questions, tiny download. Atlases keep the city to a handful of draw calls.

function mk(w, h = w) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}
function noise(g, w, h, rng, n, colors, size = [1, 3]) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(rng() * colors.length)];
    const s = size[0] + rng() * (size[1] - size[0]);
    g.fillRect(rng() * w, rng() * h, s, s);
  }
}
function blotches(g, w, h, rng, n, color, rMin, rMax, alpha) {
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    g.fillStyle = color; g.beginPath();
    g.ellipse(rng() * w, rng() * h, rMin + rng() * (rMax - rMin), rMin + rng() * (rMax - rMin), rng() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

export function asphaltTexture() {
  const S = 512; const [c, g] = mk(S); const r = mulberry32(1);
  g.fillStyle = '#47474a'; g.fillRect(0, 0, S, S);
  noise(g, S, S, r, 26000, ['#3b3b3e', '#555559', '#4e4d50', '#2f2f31', '#5f5e60'], [1, 2.5]);
  blotches(g, S, S, r, 18, '#2c2b2c', 10, 45, 0.25);         // oil / patches
  blotches(g, S, S, r, 10, '#6b6258', 15, 50, 0.18);         // dust
  g.strokeStyle = 'rgba(20,20,20,0.55)'; g.lineWidth = 1.2;  // cracks
  for (let i = 0; i < 14; i++) {
    let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  // dusty edges (u = 0 and u = 1 are the road edges)
  const grd = g.createLinearGradient(0, 0, S, 0);
  grd.addColorStop(0, 'rgba(150,100,70,0.55)'); grd.addColorStop(0.08, 'rgba(150,100,70,0)');
  grd.addColorStop(0.92, 'rgba(150,100,70,0)'); grd.addColorStop(1, 'rgba(150,100,70,0.55)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return tex(c);
}

export function lateriteTexture(road = false) {
  const S = 512; const [c, g] = mk(S); const r = mulberry32(road ? 5 : 2);
  g.fillStyle = road ? '#956547' : '#9c7856'; g.fillRect(0, 0, S, S);
  noise(g, S, S, r, 30000, ['#8a4f33', '#a86a48', '#b47a55', '#7c4a32', '#c08a62'], [1, 3]);
  blotches(g, S, S, r, 30, '#6e3f29', 8, 40, 0.2);
  blotches(g, S, S, r, 20, '#c9a17a', 10, 50, 0.15);
  if (!road) {
    blotches(g, S, S, r, 26, '#6b6a3a', 6, 26, 0.22); // patchy dry grass
    noise(g, S, S, r, 2500, ['#5d6b2e', '#7a7a3a', '#4f5a28'], [1, 2]);
  } else {
    // Broken damp rut bands and irregular shallow mud patches, aligned with travel.
    for (let i=0;i<28;i++){const x=(i%2?.7:.3)*S+(r()-.5)*48,y=r()*S;g.fillStyle='rgba(60,48,34,.24)';g.beginPath();g.ellipse(x,y,6+r()*16,10+r()*32,(r()-.5)*.3,0,Math.PI*2);g.fill();g.strokeStyle='rgba(195,174,137,.3)';g.lineWidth=1;g.stroke();}
    g.strokeStyle = 'rgba(70,40,25,0.3)'; g.lineWidth = 14; // wheel ruts
    for (const x of [S * 0.3, S * 0.7]) { g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 20, S / 3, x - 20, S * 2 / 3, x, S); g.stroke(); }
  }
  noise(g, S, S, r, 900, ['#d6c3a8', '#5a4636', '#e0d0b8'], [2, 4]); // pebbles
  return tex(c);
}

export function concreteTexture() {
  const S = 256; const [c, g] = mk(S); const r = mulberry32(3);
  g.fillStyle = '#9d9a94'; g.fillRect(0, 0, S, S);
  noise(g, S, S, r, 9000, ['#8f8c86', '#aaa7a0', '#86827c', '#b3b0aa'], [1, 2]);
  blotches(g, S, S, r, 10, '#6b665f', 10, 30, 0.2);
  g.strokeStyle = 'rgba(60,60,60,0.5)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.stroke();
  return tex(c);
}

/** v0.52: GRA ground: smooth poured concrete in 3 m slabs with saw-cut joints (one slab per repeat). */
export function graConcreteTexture() {
  const S = 512; const [c, g] = mk(S); const r = mulberry32(52);
  g.fillStyle = '#b9b6ae'; g.fillRect(0, 0, S, S);
  noise(g, S, S, r, 22000, ['#b1aea6', '#c2bfb7', '#aca9a1', '#c7c4bc', '#b5b2aa'], [1, 2]);
  blotches(g, S, S, r, 8, '#9d9a92', 20, 70, 0.12);   // curing marks
  blotches(g, S, S, r, 5, '#d2cfc7', 25, 80, 0.12);
  noise(g, S, S, r, 500, ['#8e8b84', '#d8d5ce'], [1, 2]); // grit
  // saw-cut joints on the slab edges (the texture repeats every slab)
  g.fillStyle = 'rgba(70,68,64,0.75)'; g.fillRect(0, 0, S, 4); g.fillRect(0, 0, 4, S);
  g.fillStyle = 'rgba(230,228,222,0.5)'; g.fillRect(0, 4, S, 2); g.fillRect(4, 0, 2, S);
  return tex(c);
}

// ------------------------------------------------------------------ facade atlas
// 4 x 4 tiles. Each tile = one 3 m wide bay of one storey. Light neutral wall areas are tinted
// by per-vertex paint colours; goods / glass / metal keep their own colours.
export const FACADE = {
  cols: 4, rows: 5,
  UPPER: [[0, 0], [1, 0], [2, 0], [3, 0]],
  SHOP: [[0, 1], [1, 1], [2, 1], [3, 1]],
  RES_WINDOW: [0, 2], RES_DOOR: [1, 2], PLAIN: [2, 2], PLAIN2: [3, 2],
  BLOCK: [0, 3], SHUTTER: [1, 3], GATE: [2, 3], PARAPET: [3, 3],
  MALL_GLASS: [0, 4], MALL_PANEL: [1, 4], CHURCH: [2, 4], TILED: [3, 4],
};

/** @param {number} scale texel density multiplier (1 = 256 px per 3 m bay, 2 = 512 px) */
export function facadeAtlas(scale = 1) {
  // drawing code works in 256-unit tiles; the canvas is scaled for higher-resolution quality settings
  const T = 256, S = T * 4, SH = T * 5;
  const [c, g] = mk(S * scale, SH * scale); g.scale(scale, scale);
  const r = mulberry32(9);
  // night emissive mask drawn in parallel: lit glass and shop interiors
  const [ec, eg] = mk(S * scale, SH * scale); eg.scale(scale, scale); eg.fillStyle = '#000'; eg.fillRect(0, 0, S, SH);
  const glow = (x, y, w, h, col = '#ffc46b', a = 0.85) => { eg.globalAlpha = a; eg.fillStyle = col; eg.fillRect(x, y, w, h); eg.globalAlpha = 1; };
  const wall = (x, y, base = '#ece6da') => {
    g.fillStyle = base; g.fillRect(x, y, T, T);
    noise(g, T, T, r, 1800, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)'], [1, 3]);
    // rain / dust streaks — very characteristic of plastered walls in the rainy season
    g.globalAlpha = 0.12;
    for (let i = 0; i < 9; i++) { g.fillStyle = '#5a4a3a'; g.fillRect(x + r() * T, y + T * 0.55 + r() * 30, 2 + r() * 6, T * 0.45); }
    const grd = g.createLinearGradient(0, y + T * 0.8, 0, y + T);
    grd.addColorStop(0, 'rgba(120,70,40,0)'); grd.addColorStop(1, 'rgba(120,70,40,0.9)');
    g.fillStyle = grd; g.fillRect(x, y + T * 0.8, T, T * 0.2);
    g.globalAlpha = 1;
  };
  const tileXY = ([cx, cy]) => [cx * T, cy * T];
  const bars = (x, y, w, h) => { // burglary-proof bars
    g.strokeStyle = '#2b2b2b'; g.lineWidth = 3;
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x + (w * i) / 5, y); g.lineTo(x + (w * i) / 5, y + h); g.stroke(); }
    g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(x + w / 2, y + h / 2, h * 0.18, 0, Math.PI * 2); g.stroke();
  };
  const glass = (x, y, w, h, tint = '#2c3e4a') => {
    glow(x, y, w, h, r() < 0.5 ? '#ffc46b' : '#ffe1a8', 0.75);
    const grd = g.createLinearGradient(x, y, x + w, y + h);
    grd.addColorStop(0, tint); grd.addColorStop(0.5, '#5b7584'); grd.addColorStop(1, '#1e2a33');
    g.fillStyle = grd; g.fillRect(x, y, w, h);
  };
  // row 0: upper floors
  {
    let [x, y] = tileXY(FACADE.UPPER[0]); wall(x, y);           // casement + bars
    g.fillStyle = '#c9c1b0'; g.fillRect(x + 58, y + 64, 140, 112);
    glass(x + 66, y + 72, 124, 96); bars(x + 66, y + 72, 124, 96);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 54, y + 176, 148, 8);
  }
  {
    let [x, y] = tileXY(FACADE.UPPER[1]); wall(x, y, '#e9e2d4');  // glass louvre window
    g.fillStyle = '#c9c1b0'; g.fillRect(x + 50, y + 60, 156, 120);
    for (let i = 0; i < 9; i++) { glass(x + 58, y + 66 + i * 12, 140, 10, '#3a5160'); }
    g.fillStyle = '#7a8a90'; g.fillRect(x + 126, y + 66, 4, 108);
    bars(x + 58, y + 66, 140, 108);
  }
  {
    let [x, y] = tileXY(FACADE.UPPER[2]); wall(x, y, '#efe8dc');  // two small windows + AC unit
    for (const ox of [32, 140]) { g.fillStyle = '#c9c1b0'; g.fillRect(x + ox - 6, y + 70, 92, 92); glass(x + ox, y + 76, 80, 80); bars(x + ox, y + 76, 80, 80); }
    g.fillStyle = '#d8d8d4'; g.fillRect(x + 150, y + 180, 64, 40); g.fillStyle = '#9a9a96';
    for (let i = 0; i < 6; i++) g.fillRect(x + 154, y + 186 + i * 5, 56, 2);
  }
  {
    let [x, y] = tileXY(FACADE.UPPER[3]); wall(x, y, '#ebe4d6');  // balcony door + railing
    g.fillStyle = '#5a3a26'; g.fillRect(x + 70, y + 40, 116, 196);
    g.fillStyle = '#6d4a32'; g.fillRect(x + 78, y + 48, 48, 180); g.fillRect(x + 130, y + 48, 48, 180);
    g.fillStyle = '#c7c0b3'; g.fillRect(x, y + 236, T, 20);
    g.strokeStyle = '#1f1f1f'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, y + 160); g.lineTo(x + T, y + 160); g.stroke();
    for (let i = 0; i <= T; i += 16) { g.beginPath(); g.moveTo(x + i, y + 160); g.lineTo(x + i, y + 236); g.stroke(); }
  }
  // row 1: shopfronts — open rolled shutters with goods
  const shop = (cell, drawGoods) => {
    let [x, y] = tileXY(cell); wall(x, y, '#e7e0d2');
    g.fillStyle = '#1b1712'; g.fillRect(x + 8, y + 40, T - 16, T - 40);   // interior
    glow(x + 8, y + 40, T - 16, T - 40, '#ffd28a', 0.55);
    drawGoods(x + 8, y + 40, T - 16, T - 40);
    // depth: darker towards the back/top, lit tiled floor, display counter at the front
    const dg = g.createLinearGradient(0, y + 40, 0, y + T);
    dg.addColorStop(0, 'rgba(0,0,0,0.45)'); dg.addColorStop(0.55, 'rgba(0,0,0,0.05)'); dg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = dg; g.fillRect(x + 8, y + 40, T - 16, T - 40);
    g.fillStyle = '#cfc6b4'; g.fillRect(x + 8, y + T - 22, T - 16, 22);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k < 8; k++) g.fillRect(x + 8 + k * 30, y + T - 22, 1, 22);
    g.fillStyle = '#6b4f36'; g.fillRect(x + 22, y + T - 62, T - 44, 40);              // counter
    g.fillStyle = '#8a6a4a'; g.fillRect(x + 22, y + T - 66, T - 44, 6);
    const ccols = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#ffffff', '#457b9d', '#8338ec'];
    for (let k = 0; k < 9; k++) { g.fillStyle = ccols[Math.floor(r() * ccols.length)]; const w2 = 14 + r() * 10; g.fillRect(x + 28 + k * 22, y + T - 66 - 10 - r() * 10, w2, 12 + r() * 8); }
    g.strokeStyle = '#3a3a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 10, y + 52); g.lineTo(x + T - 10, y + 52); g.stroke();
    for (let k = 0; k < 7; k++) { // hanging goods (bags, fabrics, kettles…)
      const hx = x + 20 + k * 32 + r() * 6;
      g.beginPath(); g.moveTo(hx, y + 52); g.lineTo(hx, y + 60); g.stroke();
      g.fillStyle = ccols[Math.floor(r() * ccols.length)]; g.fillRect(hx - 9, y + 60, 18, 22 + r() * 18);
    }
    g.fillStyle = '#fff6c8'; g.fillRect(x + T - 70, y + T - 96, 40, 22); g.fillStyle = '#c00'; g.font = 'bold 13px sans-serif'; g.fillText('₦' + (200 + Math.floor(r() * 18) * 50), x + T - 66, y + T - 80);
    g.fillStyle = '#8f9496'; g.fillRect(x + 4, y + 20, T - 8, 24);       // rolled shutter drum
    g.fillStyle = '#6d7275'; for (let i = 0; i < 4; i++) g.fillRect(x + 4, y + 22 + i * 6, T - 8, 2);
    g.fillStyle = '#3a3a3a'; g.fillRect(x + 4, y + 40, 6, T - 40); g.fillRect(x + T - 10, y + 40, 6, T - 40);
  };
  shop(FACADE.SHOP[0], (x, y, w, h) => { // provisions: stacked cartons
    const cols = ['#d62828', '#f77f00', '#fcbf49', '#2a9d8f', '#e9c46a', '#1d3557', '#ffffff', '#6a994e'];
    for (let yy = y + h - 30; yy > y + 20; yy -= 28) for (let xx = x + 6; xx < x + w - 30; xx += 34) {
      g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(xx, yy, 30, 25);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(xx + 4, yy + 8, 20, 4);
    }
  });
  shop(FACADE.SHOP[1], (x, y, w, h) => { // fabrics: hanging bolts
    const cols = ['#b5179e', '#f72585', '#4361ee', '#4cc9f0', '#ffba08', '#d00000', '#2b9348', '#f4a261'];
    for (let xx = x + 4; xx < x + w - 16; xx += 20) {
      g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(xx, y + 6, 17, h - 20);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(xx + 8, y + 24 + k * 30, 4, 0, 7); g.fill(); }
    }
  });
  shop(FACADE.SHOP[2], (x, y, w, h) => { // electronics: dark boxes + lit screens
    for (let yy = y + 10; yy < y + h - 30; yy += 40) for (let xx = x + 8; xx < x + w - 40; xx += 46) {
      g.fillStyle = '#2a2a2a'; g.fillRect(xx, yy, 40, 32);
      g.fillStyle = r() > 0.5 ? '#4aa3df' : '#9ad1f5'; g.fillRect(xx + 4, yy + 4, 32, 20);
    }
    g.fillStyle = '#e0e0e0'; g.fillRect(x + 10, y + h - 26, w - 20, 22);
  });
  shop(FACADE.SHOP[3], (x, y, w, h) => { // shoes & bags on wall racks
    const cols = ['#5c3d2e', '#1a1a1a', '#b08968', '#c1121f', '#ffffff', '#264653', '#d4a373'];
    for (let yy = y + 14; yy < y + h - 10; yy += 30) {
      g.fillStyle = '#7a6a55'; g.fillRect(x + 2, yy + 20, w - 4, 3);
      for (let xx = x + 8; xx < x + w - 24; xx += 28) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(xx, yy + 6, 22, 14); }
    }
  });
  // row 2: residential ground floor
  {
    let [x, y] = tileXY(FACADE.RES_WINDOW); wall(x, y);
    g.fillStyle = '#c9c1b0'; g.fillRect(x + 58, y + 70, 140, 108);
    glass(x + 66, y + 78, 124, 92, '#33424c'); bars(x + 66, y + 78, 124, 92);
  }
  {
    let [x, y] = tileXY(FACADE.RES_DOOR); wall(x, y);
    g.fillStyle = '#c9c1b0'; g.fillRect(x + 72, y + 40, 112, 216);
    g.fillStyle = '#3e5c3a'; g.fillRect(x + 80, y + 48, 96, 208);       // painted steel door
    g.strokeStyle = '#2b4128'; g.lineWidth = 4; g.strokeRect(x + 90, y + 60, 76, 80); g.strokeRect(x + 90, y + 152, 76, 90);
    g.fillStyle = '#d9c27a'; g.fillRect(x + 160, y + 150, 8, 14);
  }
  { let [x, y] = tileXY(FACADE.PLAIN); wall(x, y); }
  {
    let [x, y] = tileXY(FACADE.PLAIN2); wall(x, y, '#e8e1d3');
    g.fillStyle = 'rgba(80,60,40,0.18)'; g.fillRect(x, y + 120, T, 6); // paint band
  }
  // row 3
  {
    let [x, y] = tileXY(FACADE.BLOCK);  // unplastered sandcrete blocks
    g.fillStyle = '#a8a39a'; g.fillRect(x, y, T, T);
    for (let row = 0; row < 12; row++) for (let k = -1; k < 6; k++) {
      const bx = x + k * 56 + (row % 2) * 28, by = y + row * 22;
      g.fillStyle = ['#b3aea4', '#a19b91', '#bab5ab', '#9d978c'][Math.floor(r() * 4)];
      g.fillRect(bx + 2, by + 2, 52, 18);
    }
    noise(g, T, T, r, 1, ['#000']);
  }
  {
    let [x, y] = tileXY(FACADE.SHUTTER); wall(x, y, '#e2dbcd'); // closed roller shutter
    g.fillStyle = '#7c8386'; g.fillRect(x + 8, y + 24, T - 16, T - 24);
    for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? '#6b7275' : '#90979a'; g.fillRect(x + 8, y + 24 + i * 6, T - 16, 3); }
    g.fillStyle = '#a33'; g.font = 'bold 22px sans-serif'; g.fillText('POST NO BILL', x + 50, y + 150);
  }
  {
    let [x, y] = tileXY(FACADE.GATE); wall(x, y, '#ddd6c8'); // black compound gate
    g.fillStyle = '#151515'; g.fillRect(x + 10, y + 30, T - 20, T - 30);
    g.strokeStyle = '#333'; g.lineWidth = 3;
    for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(x + 18 + i * 23, y + 36); g.lineTo(x + 18 + i * 23, y + T); g.stroke(); }
    g.fillStyle = '#8a1c1c'; g.fillRect(x + T / 2 - 2, y + 30, 4, T - 30);
  }
  { let [x, y] = tileXY(FACADE.PARAPET); wall(x, y, '#e4ddcf'); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x, y, T, 18); }
  // row 4: landmark & plaza tiles
  {
    let [x, y] = tileXY(FACADE.MALL_GLASS);           // shopping-mall curtain wall
    g.fillStyle = '#d9dde0'; g.fillRect(x, y, T, T);
    glass(x + 6, y + 8, T - 12, T - 16, '#3d5566');
    g.fillStyle = '#c6ccd0'; for (let i = 0; i <= 4; i++) g.fillRect(x + 4 + i * ((T - 12) / 4), y + 6, 4, T - 12);
    g.fillRect(x + 4, y + T / 2 - 2, T - 8, 5);
    g.globalAlpha = 0.25; g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x + 30, y + 10); g.lineTo(x + 90, y + 10); g.lineTo(x + 30, y + 120); g.fill(); g.globalAlpha = 1;
  }
  {
    let [x, y] = tileXY(FACADE.MALL_PANEL);           // aluminium composite cladding with a red band
    g.fillStyle = '#e9ebec'; g.fillRect(x, y, T, T);
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2;
    for (let i = 0; i <= T; i += 64) { g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i, y + T); g.stroke(); }
    for (let j = 0; j <= T; j += 64) { g.beginPath(); g.moveTo(x, y + j); g.lineTo(x + T, y + j); g.stroke(); }
    g.fillStyle = '#c8102e'; g.fillRect(x, y + 20, T, 46);
  }
  {
    let [x, y] = tileXY(FACADE.CHURCH);               // tall arched stained-glass window
    wall(x, y, '#f4f1ea');
    const ax = x + 78, aw = 100, top = y + 40;
    g.fillStyle = '#d8d1c3'; g.beginPath(); g.moveTo(ax - 8, y + 220); g.lineTo(ax - 8, top + 50); g.arc(ax + aw / 2, top + 50, aw / 2 + 8, Math.PI, 0); g.lineTo(ax + aw + 8, y + 220); g.fill();
    const cols = ['#1d4e89', '#c1121f', '#f2a20c', '#2b9348', '#6a0572'];
    g.save(); g.beginPath(); g.moveTo(ax, y + 214); g.lineTo(ax, top + 50); g.arc(ax + aw / 2, top + 50, aw / 2, Math.PI, 0); g.lineTo(ax + aw, y + 214); g.clip();
    for (let yy = top; yy < y + 214; yy += 16) for (let xx = ax; xx < ax + aw; xx += 16) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(xx, yy, 15, 15); }
    g.restore();
    glow(ax, top, aw, 214 - 40, '#ffd28a', 0.5);
    g.strokeStyle = '#3a3a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(ax + aw / 2, top); g.lineTo(ax + aw / 2, y + 214); g.stroke();
  }
  {
    let [x, y] = tileXY(FACADE.TILED);                // ceramic-tiled plaza front (very common on shop plazas)
    g.fillStyle = '#e8e2d6'; g.fillRect(x, y, T, T);
    for (let yy = 0; yy < T; yy += 21) for (let xx = 0; xx < T; xx += 32) {
      g.fillStyle = ['#d9cdb8', '#e7dcc8', '#cfc2ab'][Math.floor(r() * 3)]; g.fillRect(x + xx + 1, y + yy + 1, 30, 19);
    }
    g.fillStyle = '#1b1712'; g.fillRect(x + 20, y + 70, T - 40, T - 70);
    glow(x + 20, y + 70, T - 40, T - 70, '#ffd28a', 0.5);
    for (let k = 0; k < 18; k++) { g.fillStyle = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#457b9d', '#ffffff'][k % 6]; g.fillRect(x + 28 + (k % 6) * 34, y + 90 + Math.floor(k / 6) * 52, 28, 40); }
    g.fillStyle = '#8f9496'; g.fillRect(x + 16, y + 52, T - 32, 20);
  }
  const t = tex(c, { repeat: false });
  t.generateMipmaps = true;
  facadeAtlas.emissive = tex(ec, { repeat: false });
  return t;
}

/** UV rectangle [u0, v0, u1, v1] for an atlas cell (with a small inset to avoid bleeding). */
export function atlasUV([cx, cy], cols = FACADE.cols, rows = FACADE.rows) {
  const e = 0.004;
  const u0 = cx / cols + e, u1 = (cx + 1) / cols - e;
  const v1 = 1 - cy / rows - e, v0 = 1 - (cy + 1) / rows + e;
  return [u0, v0, u1, v1];
}

// ------------------------------------------------------------------ roofs: 4 tiles horizontally
export const ROOF = { ZINC: 0, RUST: 1, SLAB: 2, LONGSPAN: 3 };
export function roofAtlas() {
  const T = 256; const [c, g] = mk(T * 4, T); const r = mulberry32(4);
  // zinc (galvanised corrugated sheets)
  const corr = (x, base, light, dark) => {
    g.fillStyle = base; g.fillRect(x, 0, T, T);
    for (let i = 0; i < T; i += 8) { g.fillStyle = light; g.fillRect(x + i, 0, 3, T); g.fillStyle = dark; g.fillRect(x + i + 5, 0, 2, T); }
    for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, (k * T) / 3, T, 2); } // sheet overlaps
  };
  corr(0, '#9ea3a6', '#c4c8ca', '#787d80');
  blotches(g, T, T, r, 10, '#8a6b52', 8, 30, 0.25);
  corr(T, '#8c5a3c', '#a8714f', '#6b4029');                 // rusted zinc
  g.save(); g.translate(T, 0); blotches(g, T, T, r, 30, '#5e3622', 6, 30, 0.35); blotches(g, T, T, r, 12, '#a3a7a8', 6, 20, 0.35); g.restore();
  // concrete slab with stains
  g.fillStyle = '#8f8b85'; g.fillRect(T * 2, 0, T, T);
  g.save(); g.translate(T * 2, 0); noise(g, T, T, r, 6000, ['#827e78', '#9a968f', '#77736c'], [1, 3]); blotches(g, T, T, r, 14, '#5d5a55', 10, 40, 0.3); g.restore();
  // long-span aluminium (painted, tinted per building)
  g.fillStyle = '#e8e8e8'; g.fillRect(T * 3, 0, T, T);
  for (let i = 0; i < T; i += 21) { g.fillStyle = '#ffffff'; g.fillRect(T * 3 + i, 0, 6, T); g.fillStyle = '#b8b8b8'; g.fillRect(T * 3 + i + 8, 0, 3, T); }
  return tex(c, { repeat: false });
}

// ------------------------------------------------------------------ business signboards (fictional businesses)
export const SIGN_TEXTS = [
  ['CHIDIEBERE & SONS NIG. LTD', 'Electronics • Wholesale & Retail', '#0d3b66', '#faf0ca'],
  ["GOD'S TIME PROVISIONS", 'Beverages • Toiletries • Cartons', '#c1121f', '#ffffff'],
  ['IFEOMA FABRICS & LACE', 'Ankara • George • Lace', '#6a0572', '#ffd166'],
  ['NNAMDI PHONES & ACCESSORIES', 'Repairs • Chargers • Screen guard', '#1b4332', '#d8f3dc'],
  ['MAMA NKECHI KITCHEN', 'Rice • Swallow • Pepper soup', '#e85d04', '#fff3b0'],
  ['ONYEKA AUTO SPARE PARTS', 'Genuine (Ote) & Tokunbo parts', '#212529', '#ffc300'],
  ['DIVINE FAVOUR SHOES & BAGS', 'Ladies & Gents Collection', '#9d0208', '#ffe5ec'],
  ['UCHE BROS. BUILDING MATERIALS', 'Cement • Rods • Roofing sheets', '#344e41', '#ffffff'],
  ['OBINNA BARBING SALON', 'Low cut • Waves • Shave', '#003049', '#fcbf49'],
  ['ADAEZE HAIR & BEAUTY', 'Braids • Wigs • Make-up', '#ff006e', '#ffffff'],
  ['NO CONDITION IS PERMANENT VENT.', 'General Merchandise', '#2b2d42', '#edf2f4'],
  ['AKUNNA PLASTICS & HOUSEHOLD', 'Buckets • Coolers • Chairs', '#0077b6', '#ffffff'],
  ['ONWA BOOKS & STATIONERY', 'Textbooks • Exercise books', '#5f0f40', '#fb8b24'],
  ['CHUKWUMA TAILORING', 'Senator • Kaftan • Native wear', '#283618', '#fefae0'],
  ['IKENNA ELECTRICALS', 'Cables • Bulbs • Switches', '#f77f00', '#003049'],
  ['ODOGWU BEST DRINKS', 'Cold drinks • Water • Malt', '#14213d', '#fca311'],
];
export function signAtlas() {
  const W = 512, H = 128, cols = 2, rows = 8;
  const [c, g] = mk(W * cols, H * rows); const r = mulberry32(8);
  SIGN_TEXTS.forEach(([title, sub, bg, fg], i) => {
    const x = (i % cols) * W, y = Math.floor(i / cols) * H;
    g.fillStyle = bg; g.fillRect(x, y, W, H);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(x + 6, y + 6, W - 12, H - 12);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 46; g.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    while (g.measureText(title).width > W - 40 && size > 20) { size -= 2; g.font = `900 ${size}px Impact, "Arial Black", sans-serif`; }
    g.fillText(title, x + W / 2, y + 50);
    g.font = '600 24px Arial, sans-serif'; g.fillText(sub, x + W / 2, y + 96);
    blotches(g, W, H, r, 0, '#000', 1, 1, 0);
    g.globalAlpha = 0.1; g.fillStyle = '#000'; g.fillRect(x, y + H - 20, W, 20); g.globalAlpha = 1;
  });
  return tex(c, { repeat: false });
}
export const SIGN_GRID = { cols: 2, rows: 8, count: 16 };

export function umbrellaTexture() {
  const S = 256; const [c, g] = mk(S);
  const sets = [['#d62828', '#ffffff'], ['#1d4ed8', '#facc15'], ['#16a34a', '#ffffff'], ['#f97316', '#1e3a8a']];
  // 4 horizontal bands = 4 umbrella variants, each with 8 alternating segments along u
  sets.forEach(([a, b], k) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect((i * S) / 8, (k * S) / 4, S / 8, S / 4); }
  });
  return tex(c, { repeat: false });
}

// ------------------------------------------------------------------ rooftop billboards (fictional brands)
export const BILLBOARDS = [
  ['ONWA TELECOM', 'Talk more. Pay less.', '#0b6e4f', '#ffd166'],
  ['CHI-CHI TABLE WATER', 'Pure • Clean • Cold', '#1d4e89', '#ffffff'],
  ['NNEWI MOTORS', 'Tokunbo cars • Easy payment', '#9b2226', '#fff3b0'],
  ['AKWA PAINTS', 'Colour your house well well', '#f2a20c', '#14110f'],
];
export function billboardAtlas() {
  const W = 512, H = 256; const [c, g] = mk(W * 2, H * 2); const r = mulberry32(12);
  BILLBOARDS.forEach(([title, sub, bg, fg], i) => {
    const x = (i % 2) * W, y = Math.floor(i / 2) * H;
    g.fillStyle = bg; g.fillRect(x, y, W, H);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + W - 60 + r() * 40, y + 40 + r() * 170, 30 + r() * 70, 0, 7); g.fill(); }
    g.fillStyle = fg; g.textAlign = 'left'; g.textBaseline = 'middle';
    let size = 64; g.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    while (g.measureText(title).width > W - 60 && size > 28) { size -= 2; g.font = `900 ${size}px Impact, "Arial Black", sans-serif`; }
    g.fillText(title, x + 30, y + 100);
    g.font = '600 30px Arial, sans-serif'; g.fillText(sub, x + 30, y + 170);
    g.fillRect(x + 30, y + 132, 120, 6);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 10; g.strokeRect(x + 5, y + 5, W - 10, H - 10);
  });
  return tex(c, { repeat: false });
}

/** Text panel for gateway arches ("ONITSHA MAIN MARKET"). */
export function gateSignTexture(text, sub = 'Anambra State', bg = '#0f5132', fg = '#fff6e0') {
  const W = 1024, H = 192; const [c, g] = mk(W, H);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = '#f2a20c'; g.fillRect(0, 0, W, 14); g.fillRect(0, H - 14, W, 14);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 92; g.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  while (g.measureText(text).width > W - 80 && size > 40) { size -= 2; g.font = `900 ${size}px Impact, "Arial Black", sans-serif`; }
  g.fillText(text, W / 2, sub ? 84 : H / 2);
  g.font = '600 32px Arial, sans-serif'; g.fillText(sub, W / 2, 152);
  return tex(c, { repeat: false });
}

/** Gentle ripple normal map for the river. */
export function waterNormalTexture() {
  const S = 256; const [c, g] = mk(S); const r = mulberry32(21);
  const img = g.createImageData(S, S);
  const waves = Array.from({ length: 6 }, () => ({ kx: (r() - 0.5) * 0.25, kz: (r() - 0.5) * 0.25, p: r() * 6.28, a: 0.3 + r() * 0.5 }));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let dx = 0, dy = 0;
    for (const w of waves) {
      const kx = Math.round(w.kx * S / 6.283) * 6.283 / S, kz = Math.round(w.kz * S / 6.283) * 6.283 / S; // tileable
      const c2 = Math.cos(x * kx + y * kz + w.p) * w.a;
      dx += c2 * kx * 8; dy += c2 * kz * 8;
    }
    const i = (y * S + x) * 4;
    img.data[i] = 128 + dx * 127; img.data[i + 1] = 128 + dy * 127; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}
