/**
 * v0.55: the city plan, worked out once and replayed on every phone.
 *
 * Laying out Onitsha (where every house, kiosk, filling station and wall goes) asks the same questions millions of
 * times while loading: "is this spot free?", "does this plot touch a road?", "is this point in the river?". The
 * layout is seeded, so the answers are the same on every device, every time. A plan file holds the answers, in the
 * order they are asked, recorded once from a full load (scripts/bake-plan.mjs). On a phone, the questions are then
 * answered from the file instead of being worked out, and the city comes out identical.
 *
 * Safety: the file is keyed to the exact game code + map (a hash made at build time) and the graphics setting. A
 * sample of the answers is still worked out for real and compared, and the finished city is compared with the
 * recorded one (walls, shapes, props). On any difference the page reloads once without the plan file and works
 * everything out itself, so a stale or broken file can only cost time, never change the city.
 */
import { gzipSync, gunzipSync } from 'three/examples/jsm/libs/fflate.module.js';

const CHECK_EVERY = 89; // replay: work out one answer in this many for real, as a check

export const PlanLog = {
  mode: 'off', // 'off' | 'record' | 'replay'
  depth: 0, // answers asked inside another planned question are not logged (the outer answer covers them)
  streams: new Map(), // name -> { type: 'u'|'f', vals: number[] | typed array, pos }
  calls: 0, checked: 0, failed: null, header: null, stats: null, gen: 0,
};

function stream(name, type) {
  let s = PlanLog.streams.get(name);
  if (!s) { s = { type, vals: [], pos: 0 }; PlanLog.streams.set(name, s); }
  return s;
}
function fail(why) { if (!PlanLog.failed) { PlanLog.failed = why; console.warn('[plan] replay stopped:', why); } PlanLog.mode = 'off'; }

/**
 * Wrap a pure question. enc(result, put, args) logs the answer; dec(get, args) rebuilds it.
 * Defaults: a true/false answer.
 */
export function planned(name, fn, { enc = (r, put) => put(r ? 1 : 0), dec = (get) => get() === 1 } = {}) {
  const L = PlanLog, nameF = name + '.f';
  let gen = -1, sa = null, sf = null; // this question's two streams (whole numbers, decimals) for the current file
  const refs = () => { if (gen !== L.gen) { gen = L.gen; sa = L.streams.get(name) ?? null; sf = L.streams.get(nameF) ?? null; } };
  const put = (v, t) => { if (t === 'f') (sf ??= stream(nameF, 'f')).vals.push(v); else (sa ??= stream(name, 'u')).vals.push(v); };
  const take = (t) => { const s = t === 'f' ? sf : sa; if (s === null || s.pos >= s.vals.length) throw MISS; return s.vals[s.pos++]; };
  const w = function () {
    if (L.mode === 'off' || L.depth > 0) return fn.apply(this, arguments);
    const args = arguments; refs(); L.depth++;
    try {
      if (L.mode === 'record') { const r = fn.apply(this, args); enc.call(this, r, put, args); return r; }
      // replay
      const pa = sa ? sa.pos : 0, pf = sf ? sf.pos : 0;
      let r;
      try { r = dec.call(this, take, args); } catch (e) { if (e === MISS) { fail(`ran out of answers for ${name}`); L.depth--; try { return fn.apply(this, args); } finally { L.depth++; } } throw e; }
      if (++L.calls % CHECK_EVERY === 0) { // check: work it out and compare with what was recorded at this place
        const real = fn.apply(this, args); let ia = pa, ib = pf, same = true;
        enc.call(this, real, (v, t) => { const want = t === 'f' ? sf?.vals[ib++] : sa?.vals[ia++]; if (!Object.is(want, v)) same = false; }, args);
        if (ia !== (sa ? sa.pos : 0) || ib !== (sf ? sf.pos : 0)) same = false;
        L.checked++;
        if (!same) { fail(`${name} answered differently`); return real; }
      }
      return r;
    } finally { L.depth--; }
  };
  w.unplanned = fn;
  return w;
}
const MISS = new Error('plan: out of answers');

/** For questions answered with an object from a list: log its place in the list (record builds the index once). */
export function indexIn(getList) {
  return {
    enc(r, put, args) { if (!r) return put(0); const list = getList.call(this, args); let m = indexCache.get(list); if (!m) { m = new Map(); m.n = 0; indexCache.set(list, m); } for (; m.n < list.length; m.n++) if (!m.has(list[m.n])) m.set(list[m.n], m.n); let i = m.get(r); if (i != null && list[i] !== r) { m.clear(); m.n = 0; for (; m.n < list.length; m.n++) if (!m.has(list[m.n])) m.set(list[m.n], m.n); i = m.get(r); } if (i == null) throw Error('plan: answer not in its list'); put(i + 1); },
    dec(get, args) { const i = get(); return i ? getList.call(this, args)[i - 1] : null; },
  };
}
const indexCache = new WeakMap();

// ---- file format: gzip( u32 header length | header JSON | stream bytes ) ----
function varints(vals) {
  const out = new Uint8Array(vals.length * 5); let o = 0;
  for (let v of vals) { if (!(v >= 0 && v <= 0x7fffffff && Number.isInteger(v))) return null; do { let b = v & 127; v >>>= 7; if (v) b |= 128; out[o++] = b; } while (v); }
  return out.subarray(0, o);
}
function readVarints(bytes, n) {
  const vals = new Uint32Array(n); let o = 0;
  for (let i = 0; i < n; i++) { let v = 0, s = 0, b; do { b = bytes[o++]; v |= (b & 127) << s; s += 7; } while (b & 128); vals[i] = v >>> 0; }
  return vals;
}

export function startRecording() { PlanLog.mode = 'record'; PlanLog.streams.clear(); PlanLog.depth = 0; PlanLog.gen++; }

/** Record: pack everything into a file. check = the finished city's fingerprint. */
export function packRecording(meta, check) {
  const parts = [], streams = [];
  let off = 0;
  for (const [name, s] of PlanLog.streams) {
    let bytes = s.type === 'u' ? varints(s.vals) : null, enc = 'v';
    if (!bytes) { bytes = new Uint8Array(new Float64Array(s.vals).buffer); enc = 'f'; }
    streams.push({ name, n: s.vals.length, enc, off, len: bytes.length }); parts.push(bytes); off += bytes.length;
  }
  const head = new TextEncoder().encode(JSON.stringify({ ...meta, check, streams }));
  const all = new Uint8Array(4 + head.length + off), dv = new DataView(all.buffer);
  dv.setUint32(0, head.length, true); all.set(head, 4); let o = 4 + head.length; for (const p of parts) { all.set(p, o); o += p.length; }
  PlanLog.mode = 'off';
  return gzipSync(all, { level: 9 });
}

/** Replay: load a file. Returns false (and stays off) if it doesn't fit this build. */
export function startReplay(gz, { key, quality }) {
  try {
    const all = gunzipSync(new Uint8Array(gz)), dv = new DataView(all.buffer, all.byteOffset, all.byteLength), hl = dv.getUint32(0, true);
    const head = JSON.parse(new TextDecoder().decode(all.subarray(4, 4 + hl)));
    if (head.key !== key || head.quality !== quality) return false;
    PlanLog.streams.clear();
    const base = 4 + hl;
    for (const s of head.streams) {
      const bytes = all.subarray(base + s.off, base + s.off + s.len);
      const vals = s.enc === 'v' ? readVarints(bytes, s.n) : new Float64Array(bytes.slice().buffer);
      PlanLog.streams.set(s.name, { type: s.enc === 'v' ? 'u' : 'f', vals, pos: 0 });
    }
    PlanLog.header = head; PlanLog.gen++; PlanLog.mode = 'replay'; PlanLog.depth = 0; PlanLog.calls = 0; PlanLog.checked = 0; PlanLog.failed = null;
    return true;
  } catch (err) { console.warn('[plan] file not usable', err); PlanLog.mode = 'off'; return false; }
}

/** End of the planned part of loading. Replay: true if the city matches the recording. */
export function finishReplay(check) {
  const L = PlanLog; if (!L.header) return true;
  const left = [...L.streams].filter(([, s]) => s.pos !== s.vals.length).map(([n, s]) => `${n} ${s.pos}/${s.vals.length}`);
  const same = JSON.stringify(check) === JSON.stringify(L.header.check);
  L.stats = { used: !L.failed, checked: L.checked, calls: L.calls, failed: L.failed, left: left.slice(0, 5), same };
  L.mode = 'off'; for (const st of L.streams.values()) st.vals = []; L.streams.clear(); L.header = null; L.gen++; // the questions still hold their streams: empty them (~25 MB)
  if (L.failed || left.length || !same) { L.failed ??= left.length ? 'answers left over: ' + left[0] : 'city differs from the plan'; return false; }
  return true;
}
