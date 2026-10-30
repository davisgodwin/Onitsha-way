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

/** v0.54.2: functions newer Safari versions added (iOS 15.4–17.4): Object.groupBy (17.4) stopped iPhones loading. */
if (typeof Object.groupBy !== 'function') Object.defineProperty(Object, 'groupBy', { configurable: true, writable: true, value(items, fn) { const out = Object.create(null); let i = 0; for (const x of items) { const k = fn(x, i++); (out[k] ??= []).push(x); } return out; } });
if (typeof Map.groupBy !== 'function') Object.defineProperty(Map, 'groupBy', { configurable: true, writable: true, value(items, fn) { const out = new Map(); let i = 0; for (const x of items) { const k = fn(x, i++); if (!out.has(k)) out.set(k, []); out.get(k).push(x); } return out; } });
if (typeof Array.prototype.findLast !== 'function') Object.defineProperty(Array.prototype, 'findLast', { configurable: true, writable: true, value(fn, t) { for (let i = this.length - 1; i >= 0; i--) if (fn.call(t, this[i], i, this)) return this[i]; return undefined; } });
if (typeof Array.prototype.findLastIndex !== 'function') Object.defineProperty(Array.prototype, 'findLastIndex', { configurable: true, writable: true, value(fn, t) { for (let i = this.length - 1; i >= 0; i--) if (fn.call(t, this[i], i, this)) return i; return -1; } });
if (typeof Array.prototype.toSorted !== 'function') Object.defineProperty(Array.prototype, 'toSorted', { configurable: true, writable: true, value(fn) { return [...this].sort(fn); } });
if (typeof Promise.withResolvers !== 'function') Promise.withResolvers = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
if (typeof globalThis.structuredClone !== 'function') globalThis.structuredClone = (v) => JSON.parse(JSON.stringify(v));
