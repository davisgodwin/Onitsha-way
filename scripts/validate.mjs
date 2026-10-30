// Build validation: run after `vite build`. Checks that the output is complete and within budget, the
// map data is sound, and every file the page references exists. Exits non-zero on any problem.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const problems = [], notes = [];
const fail = (m) => problems.push(m);
const kb = (p) => Math.round(statSync(p).size / 1024);

if (!existsSync(join(dist, 'index.html'))) { console.error('dist/index.html missing — run `npm run build` first'); process.exit(1); }
const html = readFileSync(join(dist, 'index.html'), 'utf8');

// every local file the page references
const refs = [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map((m) => m[1]);
for (const r of refs) if (!existsSync(join(dist, r))) fail(`index.html references missing file: ${r}`);
notes.push(`${refs.length} local references in index.html, all present`);

// size budgets (uncompressed)
const assets = readdirSync(join(dist, 'assets'));
const js = assets.filter((f) => f.endsWith('.js')), css = assets.filter((f) => f.endsWith('.css'));
// v0.30.2: three.js is its own chunk (it rarely changes, so browsers keep it cached across game updates)
const vendor = js.filter((f) => f.startsWith('three-')), app = js.filter((f) => !f.startsWith('three-'));
if (app.length !== 1 || vendor.length !== 1 || css.length !== 1) fail(`expected one game JS, one three.js chunk and one CSS bundle, found ${app.length}, ${vendor.length} and ${css.length}`);
for (const f of vendor) if (!html.includes(`assets/${f}`)) fail(`index.html doesn't preload the three.js chunk ${f}`);
// Buy mode adds a standalone responsive catalogue (~7 KB CSS); other budgets stay unchanged.
// v26 adds bar activities, full dealership stock, routine checkpoint/chase and flyer validation UI.
// v29 adds garages, stadium, safe infill, patrols and a 200-board reservation system.
// v0.36: CSS 100 → 110 KB for the voice button, invitation card, quick-action card and dashboard pill (~22 KB gzipped in total).
const budget = { js: 1500, vendor: 800, css: 110, map: 4096 };
for (const f of js) { const s = kb(join(dist, 'assets', f)); const limit = f.startsWith('three-') ? budget.vendor : budget.js; notes.push(`JS ${f}: ${s} KB`); if (s > limit) fail(`JS bundle ${f} is ${s} KB, over the ${limit} KB budget`); }
for (const f of css) { const s = kb(join(dist, 'assets', f)); notes.push(`CSS ${f}: ${s} KB`); if (s > budget.css) fail(`CSS ${s} KB over budget`); }

// map data
const mapPath = join(dist, 'data', 'onitsha_core.json');
if (!existsSync(mapPath)) fail('map data missing'); else {
  const s = kb(mapPath); notes.push(`map data: ${s} KB`); if (s > budget.map) fail(`map data ${s} KB over budget`);
  const m = JSON.parse(readFileSync(mapPath, 'utf8'));
  for (const k of ['meta', 'graph', 'roads', 'buildings', 'water', 'pois']) if (!m[k]) fail(`map data has no "${k}"`);
  const nodes = m.graph.nodes ?? [];
  if (m.roads.some((r) => r.nodes.some((i) => !nodes[i]))) fail('a road points at a missing node');
  if (!m.meta.playBounds || !m.meta.origin) fail('map meta lacks playBounds/origin');
  notes.push(`map: ${m.roads.length} roads, ${m.buildings.length} buildings, ${nodes.length} nodes`);
}

// installable app
for (const f of ['manifest.webmanifest', 'sw.js', 'icons/icon-192.png', 'icons/icon-512.png', '.htaccess']) if (!existsSync(join(dist, f))) fail(`missing ${f}`);
const man = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
for (const ic of man.icons) if (!existsSync(join(dist, ic.src))) fail(`manifest icon missing: ${ic.src}`);
if (!/milestone \d+ build · v[\d.]+/i.test(html)) fail('menu footer lacks the build/version label');

for (const n of notes) console.log('  ·', n);
if (problems.length) { console.error('\nBuild validation FAILED:'); for (const p of problems) console.error('  ✗', p); process.exit(1); }
console.log('\nBuild validation passed.');

// v24 runtime models are required assets, not optional editor-only files.
const cataloguePath=join(dist,'models/v24/catalogue.json');
if(!existsSync(cataloguePath))throw Error('Missing v24 model catalogue');
const models=JSON.parse(readFileSync(cataloguePath,'utf8'));
if(models.length!==13||models.some(m=>m.type==='building')||new Set(models.map(m=>m.id)).size!==models.length||models.some(m=>/taxi/i.test(m.id)))throw Error('Invalid v24 model catalogue');
for(const m of models){const p=join(dist,'models/v24',m.id+'.glb');if(!existsSync(p)||readFileSync(p).subarray(0,4).toString()!=='glTF')throw Error('Missing or invalid model: '+m.id);}
console.log('  · 13 GLB models validated (vehicles and characters; the building pack was removed in v0.37); no taxi assets');
// v0.37: Kenney Furniture Kit (CC0) — every model the catalogue can draw must ship, with its licence.
const furnitureBounds=JSON.parse(readFileSync(new URL('../src/data/furnitureBounds.json',import.meta.url),'utf8'));
for(const name of Object.keys(furnitureBounds)){const p=join(dist,'models/furniture',name+'.glb');if(!existsSync(p)||readFileSync(p).subarray(0,4).toString()!=='glTF')throw Error('Missing or invalid furniture model: '+name);}
if(!existsSync(join(dist,'models/furniture/LICENSE-Kenney-Furniture-Kit-CC0.txt')))throw Error('Missing furniture licence');
console.log(`  · ${Object.keys(furnitureBounds).length} furniture GLB models validated (Kenney Furniture Kit, CC0) with licence`);
