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
