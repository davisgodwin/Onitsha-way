# v0.26.1 — Checkpoint NPC frame-error hotfix

## Fixed error
`Cannot read properties of undefined (reading 'some')` in `NPCSystem.updateNPC`.

The v0.26.0 checkpoint signalling animation expected a nearby-vehicles array, but the normal `Game.updateLife` caller did not supply one. The error appeared when a checkpoint officer entered the active NPC pool. Earlier feature tests explicitly supplied an empty array, so they did not expose the missing connection.

## Changes
- The normal game loop now passes its real nearby-traffic list into the NPC system.
- Both NPC update entry points accept an omitted vehicle list; checkpoint animation also tolerates a null list.
- A nearby player-owned car is considered separately, so an officer still signals even when ambient traffic is empty.
- No save-format, balance, inventory, vehicle-ownership, dealership, advertising or character changes.
- Menu version and offline cache are updated to v0.26.1.

## Apply the small patch to v0.26.0
1. Export a save backup in Settings if available. Back up your own `server/data` folder.
2. Stop the running game/server terminal.
3. Extract the patch ZIP. Copy the **contents** of its `onitsha-way` folder into your existing v0.26.0 project folder and allow the included files to be overwritten. Keep all the other project files; this patch is not a standalone game.
4. Restart using the same command and port you used before (`npm run local`, or your existing dev/server commands).
5. Refresh the game tab; use **Ctrl+Shift+R** if the old page remains. Check the menu footer says **v0.26.1**.
6. **Continue** your existing save. Do not clear browser storage or start a new character.

The small patch includes only the affected code, version/cache files, focused regression tests and this note. It does not contain or replace `server/data` or `node_modules`. Dependency versions are unchanged.

## Full-source alternative
If using the full-source v0.26.1 ZIP instead, extract into a fresh folder, copy in your own backed-up `server/data`, run `npm ci`, then restart at the same address/port and Continue. See `CITY_FIXES_26.md` for the seven v0.26 gameplay fixes, all retained here.

## Regression tests
- `npm run test:checkpoint261`: missing/null/empty traffic, nearby and distant traffic, and player-only car signalling. The missing-list cases reproduced the reported exception before the fix.
- `npm run e2e:checkpoint261`: uses the production build and the real `Game.frameInner → Game.updateLife → NPCSystem.update` path at all six police posts, followed by Save/Continue near a post. It does not inject a fake traffic list into the normal-loop checks.
- `npm run check` and `npm run test:fixes26`: existing economy/save/layout/build and v0.26 feature regressions.

The browser regression requires separately installed Playwright/Chromium and runs after `npm run build`.
