/**
 * Cloud saves: one game save per account, with a revision number so two browsers can't silently
 * overwrite each other. Older copies are kept as backups (never deleted on overwrite).
 */
export const MAX_SAVE_BYTES = 4 * 1024 * 1024;
export const BACKUPS_KEPT = 8;
const HOUR = 3600000;

/** Check a save the browser sent. Returns its summary fields; throws a readable message if it isn't a save. */
export function inspectSave(raw) {
  if (typeof raw !== 'string' || !raw) throw Error('No save data was sent.');
  if (Buffer.byteLength(raw) > MAX_SAVE_BYTES) throw Error('This save is larger than 4 MB and cannot be stored.');
  let d; try { d = JSON.parse(raw); } catch { throw Error('The save data is not readable.'); }
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw Error('The save data is not a game save.');
  if (!Number.isInteger(d.version) || d.version < 1 || d.version > 999) throw Error('The save has no valid version.');
  if (!d.character || typeof d.character !== 'object' || !d.character.gender) throw Error('The save has no character.');
  if (!d.clock || typeof d.clock !== 'object') throw Error('The save has no game clock.');
  return {
    saveVersion: d.version,
    character: String(d.character.name ?? '').slice(0, 64),
    day: Number.isInteger(d.clock.day) ? d.clock.day : null,
    savedAt: Date.parse(d.updatedAt) || null,
    lifeId: String(d.createdAt ?? ''),
    size: Buffer.byteLength(raw),
  };
}

/**
 * Decide what a PUT does, given the stored record (or null).
 * → { conflict: current } when the browser's copy was based on an older revision (unless force),
 * → { next, backup } otherwise; backup=true means keep the replaced copy.
 */
export function planPut(current, { raw, baseRev, force }, now) {
  const info = inspectSave(raw);
  const rev = current?.rev ?? 0;
  if (!force && Number(baseRev ?? 0) !== rev) return { conflict: current };
  const otherLife = current && current.lifeId !== info.lifeId;
  const backup = !!current && (force || otherLife || !current.lastBackupAt || now - current.lastBackupAt >= HOUR);
  const next = { rev: rev + 1, updatedAt: now, ...info, lastBackupAt: backup ? now : current?.lastBackupAt ?? null, raw };
  return { next, backup };
}

/** What the API returns about a stored save (with or without the save itself). */
export const publicSave = (s, withData = true) => s && ({
  rev: s.rev, updatedAt: s.updatedAt, saveVersion: s.saveVersion, character: s.character, day: s.day, size: s.size, savedAt: s.savedAt,
  ...(withData ? { raw: s.raw } : {}),
});
