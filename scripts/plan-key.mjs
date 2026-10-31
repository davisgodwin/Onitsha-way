// v0.55: a fingerprint of the game code and the map. The city plan file (public/plan/<key>-<quality>.bin) is only
// used when it was recorded from exactly this code and map; anything else and the game works the city out itself.
import fs from 'node:fs'; import path from 'node:path'; import { createHash } from 'node:crypto'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function planKey() {
  const h = createHash('sha256'), files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.(js|mjs|json)$/.test(e.name)) files.push(f); } };
  walk(path.join(root, 'src')); files.sort(); files.push(path.join(root, 'public/data/onitsha_core.json'));
  // line endings don't matter (a Windows checkout gives the same key)
  for (const f of files) { h.update(path.relative(root, f).split(path.sep).join('/')); h.update('\0'); h.update(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')); h.update('\0'); }
  return h.digest('hex').slice(0, 16);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) console.log(planKey());
