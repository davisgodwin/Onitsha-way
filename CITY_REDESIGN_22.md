# v0.22.0 — market streets & recognizable venues

## Markets
- Main Market, Ochanja and Bridgehead receive road-aligned shop rows and back-to-back arcades with pedestrian aisles.
- Zinc roofs, striped awnings, painted shop fronts, shelves, crates and stocked counters.
- Eight visible goods categories: vegetables, grains, textiles, shoes, phone accessories, household goods, fruit and spare parts.
- Male and female named traders use the existing NPC dialogue and trading system. Existing passers-by and hawkers remain active; market schedules and Sunday closures are preserved.
- A larger nearby character pool supports the busier market streets. Geometry is batched into 50 m chunks and distance-culled for lower quality settings.

## Buildings
- Filling stations: open drive-through forecourt, pump islands, hoses, protective bollards, canopy, fuel signs, mini-mart and painted lanes.
- Police: station building, reception canopy, guardhouse, perimeter railings and flagpole.
- EFCC: two-storey office, reception, guardhouse, railings and distinct burgundy identity.
- Hotels: multi-storey room windows, balconies, reception entrance, drop-off canopy and planters.
- Bars: covered serving counter, bottles, outdoor tables and chairs.
- Clubs: dark frontage, luminous trim, entrance canopy and queue rails.
- Full plot checks, road-facing orientation and clear street approaches replace the old kiosk placement. Game entrances are approximate, not surveyed real-world architecture.

## Street layout
- The bundled map's 13,823 building footprints are checked against complete road segments, not only their centers.
- Offending edges are set back from roads; tiny unusable fragments are hidden. Roof overhangs, roadside kiosks and compound-wall placement also receive setback checks.
- Original city blocks are retained rather than replacing Onitsha with a fictional rectangular street grid.
- Existing rental IDs and home types are retained from v0.21.0, with reserved entrance approaches. No save-format reset is required.

## Upgrade
1. Export your save and back up your own `server/data` folder.
2. Stop the old local server and extract this release into a fresh folder.
3. Copy your own `server/data` folder into the new release (never share it).
4. Run `npm ci`, then `npm run local`.
5. Use the same browser profile and `http://localhost:5173` address. Log in to the same account and continue.

Do not clear browser storage or start a new character to apply the redesign. Existing placement of player-owned vehicles is left unchanged; drive or recover a car if its old parking spot is now occupied by a redesigned market stall.

## Verification
- `npm run check`: economy suite, street-layout suite, production build and build validation.
- `node --test tests/street-layout.test.mjs tests/buy.test.mjs tests/radio.test.mjs`.
- Browser audit checks city/market/venue road clearance, free venue entrances, canonical rental identities and fuel-anchor consistency.
- Development-only scene captures are under `qa/v22` in the working copy; large PNGs are not included in the source download.

- Final local-startup tests pass (normal launch plus occupied-port rejection).
- Entry/exit browser checks pass for both clubs, both offices and all three hotels; club fallback save positions use the clear entrance.
