# v0.29.0 — Garages, patrols, stadium and 200 billboards

## Included

1. **Power lines:** wire ends follow the real crossarm orientation, with matching conductor positions and sag between poles.
2. **Road clearance:** utility poles and ground-level street lamps are kept off carriageways and home-access paths.
3. **Police patrols:** two marked Hilux patrol vehicles use the existing traffic/lane simulation, with roof lights and distance-based sirens. Browser audio begins after a player gesture and follows pause/master volume.
4. **Homes and secure garages:** homes now offer permanent purchase as well as existing rental access. Use the home-door menu for Secure garage, storing/retrieving vehicles, marking the collection bay and choosing your respawn home. Owned vehicles are stored in the saved snapshot and recovered from the garage after restart/sign-out. Fuel, paint, mileage and damage are preserved. Police-impounded vehicles remain impounded. If a collection bay is occupied, move the vehicle before retrieving another. Where a safe physical bay cannot be found, secure storage remains available but retrieval waits for a clear bay.
5. **Residential infill:** 800 decorative house structures occupy clear roadside plots without blocking existing homes, roads or the stadium. These are scenery, not 800 additional purchasable interiors.
6. **Community stadium:** an original game venue on a clear 150 × 112 m site about 486 m from Shoprite, with a marked football pitch, goals, covered stands, seats and a map listing. It is a walkable location, not a new football-match mini-game or a claim about a real stadium.
7. **200 distinct ad spaces:** 50 numbered billboards in each of Upper Iweka, Shoprite, Main Market and Bridgehead. Server-side reservations prevent two players booking the same board while it is held or active. Expired holds/campaigns release it. Existing campaigns receive individual board assignments.
   - Portrait and landscape PNG/JPEG/WebP flyers are fitted without cropping.
   - Nearby displays use 2048 × 1024 canvases; original flyer resolution still affects sharpness.
   - Add an HTTP(S) business URL for a floating clickable link near the billboard. Links open in a new tab; browser pop-up/link policies still apply.
   - Shared frames, distance culling, lower-resolution distant displays and bounded artwork caches limit memory use.
8. **Car paint selection:** ten visible colour swatches before purchase. Paint is retained through saves, storage and retrieval.

## Important advertising limit

The supplied backend still uses **test payments only** when test activation is enabled. No live payment provider is connected and no real money is charged. Do not treat this build as production paid-ad infrastructure. Individual billboard reservations are enforced by the included shared server; separate server instances do not share a booking database.

## Install / update safely

1. Export/back up your browser save and your own `server/data` folder. Do not clear browser storage.
2. Extract this full source into a fresh folder; copy your own `server/data` into its `server` folder if upgrading.
3. Run `npm ci`, then `npm run dev` from the project folder. This starts the account server and Vite together.
4. Use the same browser profile, account and localhost address/port as before. Hard-refresh the page and select **Continue**. The loading footer should read **Milestone 29 build · v0.29.0**.
5. Home respawn requires an accessible owned/rented home. Without one, the normal spawn remains. Existing saves are migrated; no new character is required.

The archive excludes dependencies, compiled output, personal server data and environment secrets. Build deployment output with `npm run build`.

## Verification

See `qa/release29-tests.txt` and `qa/release29-browser.json` for the final automated results included with this release. Browser verification uses Chromium software rendering and low quality; it is not a performance certification for every phone/GPU.
