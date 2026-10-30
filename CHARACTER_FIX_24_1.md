# v0.24.1 — Supplied characters everywhere, fitted styles and lighter rendering

## What changed
- The supplied male/female face, hands and exposed-limb meshes now replace the old procedural body in **every** `buildHuman` path: saved/new players, the whole street-NPC pool, traders, police, club dancers, story staff and pursuers, and remote multiplayer avatars. This is no longer an optional model-pack wardrobe mode.
- Supplied geometry is fitted once into the game's canonical bind pose. Clothing, skin and hair share **one** skeleton; walking, running, jumping, sitting, dancing and NPC head/arm gestures no longer mix incompatible FBX and game bone axes. The supplied faces are retained; garment-covered skin is hidden to prevent trousers and sleeves intersecting exposed limbs.
- All existing outfit IDs and independent colours remain compatible with saves. Ankara shirts/gowns/skirts, senator clothing, suits/ties, casual shirts/shorts, hoodies and tracksuits use the supplied body. The four v0.24 wardrobe IDs per gender remain compatible as clothing variants on that same body, rather than alternate bodies.
- Original hairstyle choices are enabled for every outfit: 6 male styles and 8 female styles, plus the NPC red cap. Hairstyles use a fitted supplied scalp, with the game's existing braids, twists, afro, bun, ponytail, cornrows and head-tie definitions. There is no fixed-hairstyle lock anymore.
- Head/neck placement, sleeve coverage and seated alignment were revised. Keke canopy/front-screen supports have additional clearance for seated heads. No taxi was added. Zik Roundabout and the other v0.24 city changes are retained. Stadium identity remains pending from the previous release; no stadium is silently inserted.

## Performance work
- Offline consolidation reduces the original character GLBs from 136–194 tiny primitives to 5–10 material groups. Gameplay characters use merged meshes per material (the 32-look audit reports at most 11 meshes), instead of cloning an entire fragmented native FBX hierarchy for each person.
- One canonical skeleton drives each gameplay character. Conservative animation bounds enable off-screen character culling. Distant NPCs retain reduced animation update frequency and no longer cast individual character shadows beyond 35 m.
- Nearby buildings retain the full supplied meshes. More distant ordinary buildings use a shared low-detail box shell, retaining footprint, height and representative colour; nearby full-detail radii are 65 m (Low), 105 m (Medium), and 165 m (High). Detail partitions update after 8 m of player travel or a quality change, not every frame. Full building collision and landmark geometry are unchanged. Distant detail is intentionally simplified, rather than claiming full-detail city rendering is free.
- Reduced redundant clothing/hair tessellation, omitted construction of the old procedural face, and removed duplicate native animation-mixer updates.
- `qa/v241/performance-comparison.json` records a before/after low-quality spawn-view workload comparison. It is a local Chromium/software-GPU check, **not** a promised frame rate on every phone or a guarantee that all sources of lag are eliminated. Low quality and Adaptive resolution remain useful on weaker devices.

## Safe update — keep your current character
1. Export an in-game save backup and back up your own `server/data` folder. Stop the old local server.
2. Extract into a fresh folder; copy your own `server/data` into it.
3. Run `npm ci`, then `npm run local`.
4. Return to the same account, browser profile and `http://localhost:5173` address. Do **not** clear browser storage or start over.
5. Continue your existing character. Its body changes automatically; the saved outfit, haircut, colours and progress are kept. Use **Phone → Apps → Wardrobe** to change styles.

The updated service-worker cache is versioned separately so old model downloads do not stay pinned. On an already-open tab, close/reopen the game or reload after restarting the local server; do not clear saved site data.

## Verification and tools
- `npm run check`: 251 economy/wardrobe regressions, 7 street-layout tests, production build and build validation.
- `npm run e2e:characters241`: 32 gender/outfit combinations, 14 creator hairstyles, idle/walk/run/airborne/seated poses, shared skeletons, the 24-person Low NPC pool, character bounds, building LOD and browser errors. It starts a local development server on 4240 if needed. Set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` where required.
- `npm run e2e:wardrobe`: actual wardrobe selection, hair and independent colours, saved-character Continue, creator controls and mobile containment. Set `PLAYWRIGHT_MODULE` and `CHROME_PATH` where required.
- Retained `e2e:city23` and `e2e:models24` cover the city, monument, vehicles and mobile map. See the JSON audits under `qa`; large visual-QA PNGs are omitted from this source archive.
- `scripts/optimize-characters241.mjs` consolidates freshly converted v24 character assets. Run after the original converter if regenerating them. The runtime fitting/scalp code is in `src/characters/ImportedHuman.js`; the single public builder remains `buildHuman`.

## Asset rights
The previous asset provenance and license caveats still apply: CC0 notices from five packs are included in `public/models/v24/licenses`; building 3 and vehicle 2 did not include a license notice and need rights confirmation before public redistribution. No external reference photographs are bundled as textures. See the historical `MODEL_UPDATE_24.md` for the original pack inventory and monument references; its optional-body/fixed-hairstyle description is superseded by this release.
