# v0.28.0 — Road edges, Upper Iweka & roadside billboards

## Road and curb repairs
- Ground roads use constant-width segment ribbons and bounded round joins/caps, replacing stretched acute corners and oversized junction fills.
- Offset calculations handle duplicate points, U-turns and closed seams without unbounded mitres.
- Low curbs, covered drains and 2.3 m paved shoulders are clipped against crossing ground roads, map bounds and saved-home access corridors. Folded corner bands are rejected.
- The road graph, building identifiers, home identifiers and save structure are unchanged.
- Existing elevated bridge geometry is retained; this release does not rebuild the bridge system.

## Upper Iweka Gateway Monument
An original green-and-gold gateway sculpture sits on a clear landscaped island near the Upper Iweka interchange, with a stone plinth, plaques, planting and night-time glow. A collider protects the structure and a safe off-road viewpoint is available. The existing Zik/DMGS monument remains separate and unchanged.

This is an **original game landmark, not a verified real-world monument replica**. Its plaque and landmark description identify that distinction. Placement checks include roads, flyovers, buildings and water; no roads were moved to make room.

## Roadside advertising
All four existing ad zones—Upper Iweka, Shoprite, Main Market and Bridgehead—now have 14 × 7 m double-sided advertising faces with a 6 m lower-edge clearance, steel supports, concrete pads and framed structures. Placement checks use the full footprint and avoid roads, home access and gateway signs. Both sides are readable; uploaded images retain their proportions. Existing upload, campaign rotation and expiry behavior are retained. Payments remain test simulations.

## Run and upgrade
1. Export your save and back up your own `server/data` folder.
2. Extract the source into a fresh folder. Restore your own `server/data` when upgrading.
3. Run `npm ci`, then `npm run dev` in the folder containing `package.json`.
4. Open `http://localhost:5173`. Keep the terminal open.
5. Continue using the same browser profile, account and address. Do not clear browser storage.

`npm run dev` starts both the local account server and Vite. The original signup/login loading splash, mobile HD/Ultra options, HUD minimize/restore, skill progression, home improvements and music remain included. Private account data and installed dependencies are not distributed in this ZIP.

## Verification
- 195 automated tests passed, including eight new road/monument/billboard tests.
- Production build and asset-budget validation passed.
- In-game checks passed for all four billboard placements, saved-home entrances, the separate Upper Iweka and Zik monuments, safe monument viewpoint, flyer rendering/expiry, mobile landscape overflow and absence of page/frame errors.
- Day, night, roadside billboard, street-curb and mobile landscape captures were visually inspected.

Local browser testing is not a substitute for testing performance on your actual phone. The production database/cloud-save migration is not included in this release.
