# v0.30.1 — verification record

## Executed checks

- **236 automated tests passed, 0 failed, 0 skipped** with `node --test tests/*.test.mjs`.
- **6 new naming/sign-clearance tests passed** as part of that suite. They verify the six dealer names and unchanged IDs/36 model assignments, stadium identity, presentation-only label cleanup, full-envelope building clearance, other exclusion areas, and unchanged mission/wallet schema.
- **12 place-name browser checks passed** using `tests/e2e/place-names301.cjs`: correct stadium name; stadium/Shoprite stands; coverage of all current named destinations; full-envelope collision audit; no blocked home doors; all new signs square to adjacent roads; six dealers with 36 listings each; name-only map/picker/phone labels; 390px layout; dealer-menu title; mission state preserved; no captured page/game exceptions.
- **23 retained-feature browser checks passed** using `tests/e2e/roads-power291.cjs`: all 200 billboards still face roads and avoid buildings/venues; 800 decorative houses remain; entrances remain clear; working inverter outage lighting, battery discharge/recharge, TV/fan/radio, washer, generator, mobile controls and save/load checks remain passing.
- **24 first-mission browser checks passed** using `tests/e2e/missions30.cjs`: real nearby NPC interaction/dialogue, acceptance, objective validation, once-only payment, save/load, desktop controls, touch journal and touch acceptance/completion.
- **Production build passed** with `npm run build`; the existing Vite large-chunk advisory remains, not a build error.
- **Output/asset validation passed** with `node scripts/validate.mjs`: JS 1478 KB, CSS 89 KB, map/reference checks and 34 GLB models within existing project budgets.
- Syntax/import checks passed for changed modules. Focused diff reviewed against the delivered v0.30.0 source.

## Sign coverage audit

- 36 new two-pillar stands.
- 5 existing gateway signs retained.
- 6 existing dealership structures/sign sets renamed/restyled without moving their forecourts or stock.
- No unplaced named destinations in the current world inventory.
- No detected new stand-envelope intersection with building/collision polygons or billboard sites; no blocked home doors; no diagonally canted new stands.
- Closest safe sign positions are used. Shoprite's new roadside stand is about 90 m from its location anchor. The Niger Bridge sign is at the nearest found safe approach about 404 m from the bridge anchor; it was not forced onto the river, bridge deck or into buildings. Existing landmark coordinates and navigation destinations remain unchanged.

## Test development notes

The first regression run found three reported failures: two test-file failures from the same old Shoprite display-string expectation (the transport test is also imported by economy tests), and one test expecting opening hours/resolution words inside an encounter marker label. Those expectations were intentionally updated for the requested clean names. Transport connectivity assertions remain. Encounter opening/resolution checks now inspect the retained structured `open`/`resolved` values, while asserting a name-only label. The full 236-test rerun passed.

An initial browser run stopped at an ambiguous text selector matching both a visible dealer heading and a hidden map option of the same new name. The harness now selects the heading specifically; all 12 checks then passed. Game code was not changed to hide this test failure.

## Environment and limits

Browser checks ran on Linux headless Chromium with software WebGL; desktop at 1280×800 and mobile-width/touch-emulated checks at 390×844. The browser mission tests use QA teleports to shorten travel, followed by actual NPC spawning, prompts, input, dialogue and save/load logic. They are not a proof of continuous manual travel along every city route. Physical Android/iOS, Safari, extended driving/soak tests and installed-PWA upgrade testing were not executed.

New signs were visually inspected in screenshots at the stadium, Shoprite and All Saints' Cathedral; desktop/mobile name-only Places lists were inspected. Physical-device readability at every lighting condition and every roadside viewpoint remains a manual check.

The naming change does not introduce server-authoritative missions or cloud save transfer. Existing local-save and account/backend limitations remain. Real dealership names do not imply affiliation, real inventory, or accurate business addresses in the game.

Raw logs and JSON reports are in `release-tests/`.

## Re-run

```sh
npm ci
npm run test:all
npm run test:place-names
npm run build
npm run validate
```

With Playwright and a supported Chromium already available for QA:

```sh
npm run e2e:place-names
npm run e2e:missions
npm run e2e:roads-power291
```

Harnesses accept `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`. In the execution environment, `PLAYWRIGHT_MODULE=/vercel/sandbox/node_modules/playwright` was supplied. This QA package was not added as a game dependency. The scripts start/stop isolated preview servers at ports 4301, 4300 and 4291 and use temporary browser profiles, not your normal account saves.

## Suggested manual check after upgrading

1. Continue under your existing account/address and inspect wallet, cars, housing and mission state.
2. Check Phone → Places, M map labels, the stadium gate, Shoprite, other landmark stands and each dealer name.
3. Browse/buy a vehicle on a disposable backed-up save, collect it and drive away; verify prices/stock/payment rules are unchanged.
4. Check normal keyboard/touch travel near the sign posts, home doors and mission contacts.
5. Try the Places list on a physical phone in portrait and landscape.
6. Close/reopen your browser and verify that existing progress persists without any reset.
