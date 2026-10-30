# v0.26.2 — Solid vehicle bodies & agbero map pins

## Vehicle repairs
- The Hilux conversion used to remove whole SUV triangles behind the cab. That left no rear cabin wall and uneven cut edges. It now clips crossing faces at the cut plane, adds a framed opaque rear window and closes the cab behind the occupants.
- The pickup bed has a solid floor, front headboard, side walls, tailgate and protective top rails. Its top is intentionally open, as on a pickup; it is not a hole through the cabin or ground.
- Shared geometry means the Hilux repair applies to player-owned cars, dealership displays and NPC traffic, including existing saves.
- The audit also found duplicate fixed-height interiors on catalogue cars: they could protrude through low coupe windscreens. Catalogue cars now use their own scaled cabin rather than adding that second dashboard.
- Coach end-window gaps/ribs have been covered by continuous opaque glazing and solid end panels. The shared coach builder adds a floor/chassis and tyres for both the catalogue Coaster and legacy public-transport bus.
- Non-interactive owned-vehicle bodies now use the same double-sided surface handling as traffic. Geometry closures, not this material setting alone, repair the Hilux.
- All 36 catalogue entries were rendered from front/rear; the Hilux was checked from four angles, plus the eight legacy traffic/fleet types. All 34 enclosed catalogue vehicles have front, side, rear-cabin, roof and floor ray checks. Keke sides and motorcycles are intentionally open.

## Finding agbero / area boys
1. Open **Map** (`M` or the Map button).
2. Look for brown-orange **A** pins. Nearby sites also appear on the circular minimap.
3. In **Find on map**, choose **Agbero / area encounters** and select a location to create a street route.

All **63 existing encounter sites** now have stable named pins at their actual trigger locations. Each site has two anchored street NPCs. These pins mark gameplay encounter areas, not moving NPC tracking. Their placements are fictional gameplay, not allegations about real locations or people.

### Encounter behavior
- Groups operate **06:00–23:00** game time. You must approach on foot, outside interiors/safe zones; driving and public-transport riding do not trigger them.
- Approaching within four metres opens the choice. Pressing E nearby uses the same guarded entry point.
- Options: **Keep walking**, **Talk calmly**, **Give ₦200 voluntarily**, or **Run from the group** into the existing thugs escape mini-game. Child characters cannot choose Run.
- There is **no automatic debit** for entering the area. The gift costs exactly ₦200 only when chosen, and its transaction cannot double-charge.
- A handled site is settled for the rest of that game day; a 90-second global cooldown prevents rapid back-to-back encounters. Manual interactions now obey these same limits.
- Map labels show **settled today** or **closed** where applicable. The resolution persists in your save; the site becomes available on a later day.
- Nearby street groups receive NPC-pool priority. Starting an encounter also ensures its two residents are embodied before the modal freezes the city, avoiding prompts with no visible group at busy markets.

## Install the small patch over v0.26.1
1. Back up your project, your own `server/data`, and export a save if available.
2. Stop the running game/server.
3. Extract the patch ZIP. Copy the **contents** of its `onitsha-way` folder into your existing v0.26.1 project folder. Overwrite the included files, but keep all other project files. The patch is not a standalone game.
4. Restart with your usual command and the same address/port (`npm run local`, or your existing dev/server setup).
5. Hard-refresh with **Ctrl+Shift+R** and check the menu footer says **v0.26.2**.
6. **Continue** your existing character. Do not clear browser storage or start a new save.

No dependency or save-schema changes. The patch does not contain or replace `server/data` or `node_modules`. All earlier v0.26 fixes, including the v0.26.1 police NPC crash repair, remain in place.

### Full-source alternative
Extract the full-source ZIP into a fresh folder, copy in your own backed-up `server/data`, run `npm ci`, then `npm run local`. Keep the same browser profile, account and localhost address/port and Continue. Never replace your own runtime data with an empty folder.

## Verification
- `npm run test:fixes262`: vehicle face clipping, all enclosed catalogue surface checks, pickup cab/bed closure, coach/fleet end windows, scaled coupe interiors, and agbero hours, states, choices, payment and chase routing.
- `npm run e2e:fixes262`: actual game meshes; all 63 map/picker entries; route selection; desktop/mobile map; visible encounter NPCs; voluntary gift; thugs chase and escape; saved-wallet/resolution continuity through Continue; frame-error checks.
- `npm run check`, `npm run test:vehicles`, `npm run test:fixes26`, `npm run test:checkpoint261`: existing economy/save, street layout, build, ownership, v0.26 features and checkpoint guard tests.
- `npm run e2e:checkpoint261`: production real-frame checkpoint regression retained from v0.26.1.

Browser tests require separately installed Playwright/Chromium. The v0.26.2 browser test uses a running Vite dev server at `http://127.0.0.1:4262` (override `GAME_URL`); the checkpoint suite starts a production preview after `npm run build`. The reproducible model audit page is `dev/vehicle-audit262.html` under Vite.
