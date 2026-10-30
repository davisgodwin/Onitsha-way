/**
 * Browsers only offer crypto.randomUUID on https:// or localhost. Phones joining LAN play open the game on a plain
 * http://192.168… address, so provide the same function from crypto.getRandomValues (available everywhere).
 */
if (globalThis.crypto && typeof globalThis.crypto.randomUUID !== 'function') {
  globalThis.crypto.randomUUID = function randomUUID() {
    const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
}

/** v0.54: iPhone / older Safari (iOS 15): small things the game uses that Safari only added later. */
if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout !== 'function') {
  AbortSignal.timeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(new DOMException('TimeoutError', 'TimeoutError')), ms); return c.signal; };
}
for (const C of [Array, String, Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array]) {
  if (C?.prototype && typeof C.prototype.at !== 'function') Object.defineProperty(C.prototype, 'at', { configurable: true, writable: true, value(i) { i = Math.trunc(i) || 0; if (i < 0) i += this.length; return i < 0 || i >= this.length ? undefined : this[i]; } });
}
if (typeof Object.hasOwn !== 'function') Object.defineProperty(Object, 'hasOwn', { configurable: true, writable: true, value: (o, k) => Object.prototype.hasOwnProperty.call(o, k) });
