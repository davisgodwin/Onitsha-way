/**
 * v0.48: homes that turned out to stand outside Onitsha (on the Niger island, which is Oshimili South, Delta State)
 * are no longer listed. A player who rents or owns one keeps everything: the tenancy or ownership, storage, the
 * furniture (same floor plan, so every piece stays where it was), lets and garages all move to a free home of the
 * same kind in Onitsha. Pure (unit-tested).
 */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every place the save mentions `from` (as a key, a value or inside a string) now says `to`. */
export function replaceId(obj, from, to) {
  const re = new RegExp(esc(from) + '(?![0-9A-Za-z_-])', 'g');
  const fix = (v) => {
    if (typeof v === 'string') return v.includes(from) ? v.replace(re, to) : v;
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = fix(v[i]); return v; }
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        const nk = k.includes(from) ? k.replace(re, to) : k, val = fix(v[k]);
        if (nk !== k) { delete v[k]; v[nk] = val; } else v[k] = val;
      }
      return v;
    }
    return v;
  };
  return fix(obj);
}
/** Whether the save mentions this id anywhere. */
export function mentions(save, id) { return new RegExp(esc(id) + '(?![0-9A-Za-z_-])').test(JSON.stringify(save ?? {})); }

/**
 * Move each locked home the save uses to a free open home of the same type and floor plan (nearest first).
 * Returns [{from, to, label}] for the notices.
 */
export function relocateHomes(save, locked, open) {
  const moved = [];
  for (const old of locked) {
    if (!mentions(save, old.id)) continue;
    const pick = open.filter((h) => h.type === old.type && (h.interior ?? h.type) === (old.interior ?? old.type) && !mentions(save, h.id))
      .sort((a, b) => Math.hypot(a.door.stand.x - old.door.stand.x, a.door.stand.z - old.door.stand.z) - Math.hypot(b.door.stand.x - old.door.stand.x, b.door.stand.z - old.door.stand.z))[0];
    if (!pick) continue;
    replaceId(save, old.id, pick.id);
    moved.push({ from: old.id, to: pick.id, label: pick.label, street: pick.street ?? null });
  }
  return moved;
}
