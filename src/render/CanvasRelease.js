import * as THREE from 'three';
/**
 * v0.54: iPhones (Safari) allow only about 256–384 MB of <canvas> memory per page. The game paints hundreds of signs,
 * boards and atlases on canvases and keeps them as textures, which came to about 480 MB, so on iPhone the game
 * stopped on the loading screen. Once a canvas texture is on the graphics card and hasn't changed for a while, its
 * canvas is emptied (the picture stays on the card). Live screens that are redrawn (TV, club wall, scoreboards, news,
 * billboards) are marked keepCanvas and left alone.
 */
const QUIET_MS = 3000;
const tiny = (() => { try { const c = document.createElement('canvas'); c.width = c.height = 1; return c; } catch { return null; } })();
let installed = false;
export function installCanvasRelease(renderer) {
  if (installed || !tiny) return null; installed = true;
  let busy = false, api;
  const tracked = new Set(), desc = Object.getOwnPropertyDescriptor(THREE.Texture.prototype, 'needsUpdate');
  Object.defineProperty(THREE.Texture.prototype, 'needsUpdate', {
    configurable: true,
    get: desc.get,
    set(value) {
      if (value === true) {
        if (this.userData?.__released) return; // let go already (static picture): nothing to send again
        if (typeof HTMLCanvasElement !== 'undefined' && this.image instanceof HTMLCanvasElement && !this.isRenderTargetTexture) { this.userData.__touched = performance.now(); tracked.add(this); }
      }
      desc.set.call(this, value);
      // while the city loads (long stretches with no pause), don't wait: once the canvases waiting add up to ~48 MB,
      // send the earlier ones to the graphics card and let them go now (this one may still be being painted)
      if (value === true && api.loading && tracked.size > 8 && !busy) {
        let px = 0; for (const t of tracked) if (t.image instanceof HTMLCanvasElement) px += t.image.width * t.image.height;
        if (px * 4 > 48 * 1048576) { busy = true; try { api.sweep({ quiet: 0, except: this }); } finally { busy = false; } }
      }
    },
  });
  let freedPixels = 0, freed = 0;
  api = {
    loading: true, // Game turns this off once the city is ready
    /** call now and then: lets go of canvases that are uploaded and quiet */
    sweep({ quiet = null, except = null } = {}) {
      const now = performance.now(), props = renderer.properties;
      for (const t of tracked) {
        if (t === except) continue;
        if (!(t.image instanceof HTMLCanvasElement) || t.image === tiny) { tracked.delete(t); continue; }
        if (t.userData.keepCanvas || now - (t.userData.__touched ?? 0) < (quiet ?? (api.loading ? 250 : QUIET_MS))) continue;
        let p = props.get(t);
        // not on the graphics card yet (the city is still loading and nothing has been drawn): send it now
        if (!p || !p.__webglTexture || p.__version !== t.version) { try { renderer.initTexture(t); } catch { continue; } p = props.get(t); if (!p || !p.__webglTexture || p.__version !== t.version) continue; }
        const c = t.image; freedPixels += c.width * c.height; freed++;
        t.userData.__released = true; t.image = tiny; tracked.delete(t);
        try { c.width = 0; c.height = 0; } catch { /* frees the canvas memory now, not at the next garbage collection */ }
      }
      return { freed, freedMB: Math.round(freedPixels * 4 / 1048576), tracked: tracked.size };
    },
  };
  // also while the city loads (that's when most canvases are painted), between the loading steps
  setInterval(() => { try { api.sweep(); } catch { /* next time */ } }, 300);
  return api;
}
export const IS_IOS = typeof navigator !== 'undefined' && (/iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
/** a phone (iPhone or Android): touch screen and a small screen */
export const IS_PHONE = typeof navigator !== 'undefined' && (IS_IOS || /Android.+Mobile|Mobile Safari/.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 600));

/**
 * v0.54.3: three.js keeps a copy of every shape (vertex arrays) in memory after sending it to the graphics card. On
 * iPhones the card shares the same memory, so the city was stored twice and Safari reloaded the page. For the big
 * static parts of the city (market districts, street dressing, city blocks, roads, props, bus stops…), the copy is
 * dropped once it is on the card. Only shapes used by one object are dropped (shared models are kept, because other
 * code builds new things from them), and instanced meshes are left alone.
 */
let hooked = false;
/** v0.55: one geometry that nothing reads back on the CPU (no picking, no culling box needed): drop its arrays once uploaded. */
export function freeGeometryAfterUpload(g) {
  if (!g) return 0; hookUploads(); let n = 0;
  if (!g.boundingSphere) g.computeBoundingSphere(); if (!g.boundingBox) g.computeBoundingBox();
  for (const a of Object.values(g.attributes)) if (!a.isInterleavedBufferAttribute && a.usage === THREE.StaticDrawUsage && a.version === 0) { a.__freeAfterUpload = true; n++; }
  if (g.index && g.index.version === 0) g.index.__freeAfterUpload = true;
  return n;
}
function hookUploads() {
  if (!hooked) { hooked = true; const proto = THREE.BufferAttribute.prototype, orig = proto.onUploadCallback;
    proto.onUploadCallback = function () { orig?.call(this); if (this.__freeAfterUpload) this.array = null; };
    const desc = Object.getOwnPropertyDescriptor(proto, 'needsUpdate');
    if (desc?.set) Object.defineProperty(proto, 'needsUpdate', { configurable: true, get: desc.get, set(v) { if (this.array === null) return; desc.set.call(this, v); } });
  }
}
export function freeAfterUpload(root) {
  if (!root) return 0;
  hookUploads();
  const uses = new Map(); root.traverse((o) => { if (o.geometry) uses.set(o.geometry, (uses.get(o.geometry) ?? 0) + 1); });
  let n = 0;
  root.traverse((o) => {
    const g = o.geometry; if (!g || o.isInstancedMesh || o.isSkinnedMesh || o.userData?.sharedModel || o.userData?.dynamic || uses.get(g) !== 1 || g.userData?.keepArrays) return;
    if (!g.boundingSphere) g.computeBoundingSphere(); if (!g.boundingBox) g.computeBoundingBox(); // needed later for culling; computed now while the arrays are here
    for (const a of Object.values(g.attributes)) if (!a.isInterleavedBufferAttribute && a.usage === THREE.StaticDrawUsage && a.version === 0) { a.__freeAfterUpload = true; n++; }
    if (g.index && g.index.version === 0) g.index.__freeAfterUpload = true;
  });
  return n;
}
