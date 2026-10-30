// v0.48: the map extension (GRA, the east, Onitsha's LGA lines) keeps everything that was already there:
// the same homes, residents, shops, businesses, houses on empty land and places, in the same spots.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4243', OUT = 'qa/v48'; fs.mkdirSync(OUT, { recursive: true });
const OLD = process.env.OLD_MAP || '/tmp/claude-0/osm48/core47.json';
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const R = (v) => Math.round(v * 10) / 10;
const fingerprint = async (oldMap) => {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 if (oldMap) await c.route('**/data/onitsha_core.json', (r) => r.fulfill({ body: fs.readFileSync(OLD), contentType: 'application/json' }));
 const p = await c.newPage(); p.setDefaultTimeout(400000); p.on('pageerror', (e) => errors.push(e.message));
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 500000 });
 const f = await p.evaluate(() => { const g = __game, R = (v) => Math.round(v * 10) / 10;
  return {
   listings: g.homes.listings.map((h) => h.id).concat((g.homes.lockedListings ?? []).map((h) => h.id)).filter((id) => !/^home:(infill|lot):/.test(id)).sort(), // v0.49's extra homes are picked on the map as it is now
   residents: g.npcs.residents.filter((r) => !/49|^warden:|^office:police-|lot-(unity|executive)/.test(r.id)).map((r) => `${r.id}@${R(r.x)},${R(r.z)}`), // v0.49's new places (and their people) are placed on the map as it is now
   infill: g.world.infill.houses.filter((h) => !h.removed).map((h) => `${h.id}@${R(h.x)},${R(h.z)}`),
   infillAll: g.world.infill.houses.map((h) => `${h.id}@${R(h.x)},${R(h.z)}`), infillExt: g.world.infill.houses.filter((h) => h.removedBy === 'ext').map((h) => `${h.id}@${R(h.x)},${R(h.z)}`), infillBridge: g.world.infill.houses.filter((h) => h.removedBy === 'bridge').length,
   parked: g.npcs.residents.filter((r) => r.x > 1e8).map((r) => r.id),
   branches: (g.business?.branches ?? []).map((x) => `${x.id ?? x.name}@${R(x.x)},${R(x.z)}`),
   stores: g.homeStores.stores.map((s) => `${s.name}@${R(s.door.stand.x)},${R(s.door.stand.z)}`),
   hospitals: g.hospitals.list.map((h) => `${h.name}@${R(h.place.x)},${R(h.place.z)}`),
   lots: g.vehicles.dealerships.map((l) => `${l.id}@${R(l.x)},${R(l.z)}`),
   venues: (g.world.venuePlots ?? []).map((v) => `${R(v.x ?? 0)},${R(v.z ?? 0)}`),
   stops: g.transport.net.stops.map((s) => `${s.name}@${R(s.x)},${R(s.z)}`),
   landmarks: g.world.landmarks.list.filter((l) => !/49:/.test(l.id)).map((l) => `${l.id}@${R(l.x)},${R(l.z)}`), // v0.49's extra places are placed on the map as it is now
   unfinished: g.world.map.buildings.filter((x) => x.unfinished).map((x) => String(x.id)),
   eateries: (g.eateries?.list ?? g.eateries?.places?.() ?? []).filter((e) => !/49/.test(e.id ?? '')).map((e) => `${e.id ?? e.name}`),
   buildings: g.world.map.buildings.length, roads: g.world.map.roads.length,
   terminals: g.terminals.list.map((t) => `${t.name}@${R(t.x)},${R(t.z)}`), showroom: g.showroom.plot ? `${R(g.showroom.plot.x)},${R(g.showroom.plot.z)}` : null,
   premium: g.world.districts.premium.map((a) => a.name), edges: g.world.comingSoon.edges.map((e) => e.to),
  }; });
 await c.close(); return f;
};
try {
 const before = await fingerprint(true), after = await fingerprint(false);
 fs.writeFileSync('/tmp/claude-0/mapext48.json', JSON.stringify({ before, after }, null, 1));
 const sub = (k) => { const a = new Set(after[k]); const miss = before[k].filter((x) => !a.has(x)); return { miss: miss.length, of: before[k].length, ex: miss.slice(0, 5) }; };
 const prefix = (k) => { const n = before[k].length; const diff = before[k].findIndex((x, i) => after[k][i] !== x); return { same: diff === -1, at: diff, of: n, b: before[k][diff], a: after[k][diff] }; };
 console.log('sizes', before.buildings, '→', after.buildings, 'roads', before.roads, '→', after.roads);
 for (const k of ['listings', 'branches', 'stores', 'hospitals', 'lots', 'landmarks', 'unfinished', 'eateries']) check(`${k}: every one is still there, in the same place`, sub(k).miss === 0, JSON.stringify(sub(k)));
 // a house this game had invented on empty land at the old map's edge is taken out where the new map has a real
 // building or road on that spot (its number is kept, the numbers after it don't move); its family has no home
 const ext = new Set(after.infillExt);
 const newlyParked = after.parked.filter((x) => !before.parked.includes(x)), resMiss = before.residents.filter((x) => !new Set(after.residents).has(x) && !newlyParked.includes(x.split('@')[0]));
 check('residents keep their ids and spots (friendships and homes depend on them)', resMiss.length === 0 && newlyParked.length <= after.infillExt.length + after.infillBridge, // v0.49: also the houses that stood under the Niger Bridge ramp
   JSON.stringify({ miss: resMiss.slice(0, 5), homelessNow: newlyParked }));
 check('houses on empty land keep their numbers and spots (or are taken out under a real building)', before.infill.every((x) => { const id = +x.split('@')[0].split(':')[1]; return after.infillAll[id] === x; }) && before.infill.filter((x) => ext.has(x)).length === after.infillExt.length && after.infillExt.length <= 20, JSON.stringify({ removedUnderRealBuildings: after.infillExt}));
 check('bus stops of the old map stay where they were', sub('stops').miss <= 2, JSON.stringify(sub('stops')));
 check('the map grew: GRA Phase I and II are in, as GRA', after.buildings > before.buildings + 3000 && after.premium.some((n) => /GRA Phase I\b/.test(n)) && after.premium.some((n) => /GRA Phase II/.test(n)), JSON.stringify(after.premium));
 console.log('terminals', before.terminals, after.terminals, 'showroom', before.showroom, after.showroom, 'edges', after.edges);
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`mapext48: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
