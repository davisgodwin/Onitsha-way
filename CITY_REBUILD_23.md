# v0.23.0 — Road-fronting Onitsha markets & River Niger

## What changed
- Replaced v22's freestanding shed-like market shops with connected, multi-storey trading bays: concrete upper floors, balconies, open ground-floor displays, fabric canopies, umbrellas, garment rails, mannequins, sacks, cartons and goods. Main Market, Ochanja and Bridgehead have distinct height profiles. No random rows are scattered inside vacant blocks.
- Removed the generic miniature city kiosks from these market districts. Existing street hawkers, shoppers, traders and the buying/dialogue systems remain.
- Venue plots are now generated from road segments, not random interior points. Footpaths, dirt tracks and streets narrower than 4.5 m are excluded. Their fronts are parallel to the road, with a 2.1 m plot setback and a broad road-connected apron. Named-road sites prefer their stated road where a safe plot fits. Public-business entrances remain approximate gameplay locations.
- Rechecked full building edges and shop roof/umbrella extents against road setbacks. Non-rental building fronts are reselected to face nearby roads. Existing irregular OSM blocks are retained instead of rotating whole buildings into traffic.
- River Niger uses the bundled OSM shoreline. Water is more visually distinct; two signed viewing areas and scenic timber jetties lead the eye towards moored canoes, cargo boats and covered passenger launches. Boats bob gently; one launch moves along a checked in-water course.
- Removed decorative trees that the old edge-only collision grid had allowed inside the river; retained the legacy random sequence for other props.
- The full map's destination picker includes **River Niger & boats**, **Markets**, and **Bars & clubs**. Select a river destination to set a waypoint to safe land beside the water and center the map on that shoreline (desktop and mobile).

## Find the river
Press **M** / tap **Map**, open the destination picker, and choose:
- **River Niger · Main Market waterfront**, or
- **River Niger · Bridgehead boat landing**.

Follow the waypoint to the viewing area. Boats and the over-water jetty are scenery, not drivable vehicles or swimming access. Landings are fictional scenic additions, not surveyed real-world docks.

## Reference review
Real market-street photographs were used as visual references, not redistributed textures. Proposed architectural renders and unrelated shopping-mall images in the same gallery were excluded.
- https://getoccupi.com/malls/onitsha-main-market — actual dense market street photographs, shop blocks, canopies and goods.
- https://en.wikipedia.org/wiki/Main_Market%2C_Onitsha — market sections and the Niger relationship.
- https://en.wikivoyage.org/wiki/Onitsha — local market context.
- https://www.hotfrog.com.ng/company/AFc1fC78c9Cory9bmDWTAw/totalenergies-oguta-road-service-station/onitsha/automotive-services — Oguta Road station address reference; not a surveyed architectural model.
- https://ng.worldorgs.com/catalog/onitsha/gas-station/planetoilnigltd — Onitsha roadside-station reference. Station photo downloads were unavailable.
- https://amightytree.org/otu-onicha-onitsha-waterside-1960-62 — historical waterside trade/boat context, not today's exact waterfront appearance.

This is an original, simplified game interpretation, not a photoreal or building-by-building reconstruction of present-day Onitsha.

## Preserve your progress
1. Export a backup of your save and back up your own `server/data` directory.
2. Stop the old server and extract this ZIP into a fresh folder.
3. Copy your own `server/data` into the new release; never share that directory.
4. Run `npm ci`, then `npm run local`.
5. Keep the same browser profile, account and `http://localhost:5173` address. Do not clear browser storage or start a new character.

Rental identities, home types and purchased furnishings are retained. A previously parked owned vehicle may need to be driven/recovered if a redesigned frontage occupies its old location.

## Verification
- `npm run check` — economy, full street-layout tests, build, asset validation.
- `node --test tests/buy.test.mjs tests/radio.test.mjs` — retained Buy/radio behavior.
- `npm run test:startup` — normal local launch and occupied-port rejection; stop other local game servers first.
- `npm run e2e:city23` — direct road frontage, market and river content, animated boats, rental-door clearance, entry/exit checks, river map navigation and mobile overflow. Requires Playwright/Chromium, like the other browser suites.
- Working-copy `qa/v23` contains scene captures and audit summaries. Large PNGs are excluded from the source ZIP.

## Final QA results
- Production build and asset validation: passed.
- Street-layout regression suite: 7 passed; retained Buy/radio/account/entry/mail tests: 51 passed.
- Local startup and occupied-port safety: 2 passed.
- Browser gameplay audit: 23 special venues directly face usable roads with clear entrances; 3 market districts, 747 shop bays; two safe-land waterfront destinations; 13 boats on water, with animation checked.
- Full runtime geometry audit: zero retained mapped-building road overlaps and zero market-canopy-envelope road overlaps. Rental IDs/types and all rental door standing areas remained intact.
- Scene inspection: Main Market, Ochanja, Bridgehead, fuel station, hotel, police, EFCC, bar, club, both waterfronts, desktop and 390px mobile maps. Corrections included moving the hotel off a track, removing river trees, and centering river selections clear of the map toolbar.

These checks confirm the bundled gameplay layout, not real-world survey accuracy or a guarantee about every possible imported save.
