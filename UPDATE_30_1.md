# Onitsha Way v0.30.1 — local names and landmark sign stands

## Changes

- Renamed the existing stadium to **Chuba Ikpeazu Memorial Stadium**, in its entrance sign, map pin, phone list and world-location labels. The existing footprint, pitch, seating, saved navigation ID (`community-stadium`) and gameplay remain; this is a game representation, not a surveyed replica at the real stadium's address.
- Added **36 freestanding name stands** at the named places, including Shoprite, stadium, churches, schools, workplaces, hotels, fuel stations, waterfront/district destinations and nightlife venues. The five existing gateway arches remain, including Upper Iweka. There are no unplaced destinations in the current sign audit.
- Stands use cream twin pillars, deep-green name panels and gold caps/trim in the existing Upper Iweka gateway style. Both faces read correctly. Full sign envelopes are checked against buildings, roofs/collision polygons, stadium playing area, roads, water, billboard reservations, dealership forecourts, home access and NPC interaction clearances. There is no unsafe forced-placement fallback.
- Added supports to the stadium's existing entrance name panel with an open walk-through centre.
- Reused and restyled the car stands' existing name signs. The six car stands are now:

| Existing stable lot ID | New display name |
| --- | --- |
| `lot-iweka` | Amalu David Automobile Company |
| `lot-oldmarket` | Kokan Investment |
| `lot-bridgehead` | Shopcar Nigeria |
| `lot-ochanja` | Akuma Motors Limited |
| `lot-mall` | Unlimited Zion Motors |
| `lot-fegge` | Onwurah Autos |

All 36 vehicle listings remain at every stand. Purchase IDs, collection bays, already-sold state, paints, owned cars and prices are unchanged. These are local-name adaptations of the existing game forecourts, not claims of affiliation, exact real-world addresses, or real dealers' stock/prices.

- Cleaned map/phone Places names: removed `(approx.)`, approximate entrance/location, OSM/published-area suffixes, venue visiting-hour ranges, and car-stand stock-count text from place-name labels. The Shoprite destination is **Shoprite Onitsha Mall**.
- Names remain separate from functional information. Actual clocks, NPC/venue schedules, closed-state checks, mission deadlines, activity prices/durations and other gameplay rules remain. Source/confidence data remains in the code/research notes; the place-name labels no longer display it.
- Preserved the first mission, existing save schema 15, billboard fixes and working home appliances. No new runtime dependency and no save reset.

## Upgrade and launch

1. Export a save backup from Settings. Stop the old server and back up your own `server/data`.
2. Extract the full source. Keep/copy **your own** `server/data`; no accounts or player saves are bundled here.
3. In the project folder run `npm ci`, then `npm run dev`.
4. Open the same `http://localhost:5173` (or your existing URL/port), browser profile and account/offline mode, then Continue. Do not clear browser storage.

`dist/` is also included for static deployment after applying your existing hosting/backend configuration. Rebuild using `npm run build` after source changes. Existing mission instructions remain in `MISSIONS_30.md`.

## What to inspect in game

- Open Phone → Places: each destination row shows its name without the old qualifiers/hours. The phone's normal status clock remains.
- Open M: the stadium pin has the new name, and destination dropdown labels no longer include approximation or opening-time suffixes.
- Visit Shoprite and the stadium: check the road-facing green/cream/gold stands. The stadium entrance also has its supported name panel.
- Visit each car stand: signs and the sales menu show the new name; browse the same 36 listings as before.
- Load your existing save and check that owned vehicles, rentals and mission progress remain unchanged.

## Relevant files changed

| File | Responsibility |
| --- | --- |
| `src/world/PlaceNameSigns.js` (new) | Reusable twin-pillar name stand, full-envelope safe roadside placement, coverage records. |
| `src/core/Game.js` | Place sign initialization after finished-world construction; clean dealership/friend place labels. |
| `src/world/CityStadium.js` | Stadium name, supported entrance panel, unchanged world/save identity. |
| `src/world/LandmarkDressing.js`, `src/render/WorldTextures.js` | Existing green/gold gateway/mall panels display clean name-only text. |
| `src/data/VehicleCatalogue.js`, `src/vehicles/Dealership.js` | Six display names and restyled existing car-stand signs; IDs/stock unchanged. |
| `src/data/landmarks.js`, `src/ui/Minimap.js` | Clean Shoprite name and name-only map text. Underlying provenance remains. |
| `src/story/CareerCity.js`, `src/life/CityLife.js`, `src/phone/PhoneController.js` | Name-only Places rows/markers and removal of approximation text from service descriptions; gameplay hours retained. |
| `tests/place-names301.test.mjs`, `tests/e2e/place-names301.cjs` (new) | Name consistency, stable save IDs, geometric safety, runtime coverage, clean lists and mobile width. |
| `tests/transport.test.mjs`, `tests/fixes262.test.mjs` | Intentional display-name expectations updated; connectivity and structured opening/resolution assertions retained. |
| `package.json`, `package-lock.json`, `public/sw.js`, `index.html` | v0.30.1 labels/cache and QA scripts; no dependency changes. |
| Release documentation and `release-tests/` | Current instructions, public-name source notes and actual test output. |

## Public name sources

Sources establish names, not the exact in-game placement, stock, licensing or an affiliation. No business phone numbers or logos were added.

- Stadium: https://en.wikipedia.org/wiki/Ikpeazu_Memorial_Stadium and https://anambrafc.sitesng.com/en_Stadium.html — Chuba Ikpeazu Memorial Stadium, Onitsha. Capacity claims differ; no capacity claim was added.
- Kokan Investment and Unlimited Zion Motors: https://www.finelib.com/cities/onitsha/automotive/car-dealers — Onitsha car-dealer listings.
- Akuma Motors Limited and Onwurah Autos: https://www.cybo.com/NG-biz/akuma-motors-limited_1E — Akuma at Oguta Road; nearby-business listing gives Onwurah Autos at Ziks Avenue, Fegge, Onitsha.
- Amalu David Automobile Company: Suzuki Nigeria dealer directory https://www.suzuki.ng/en/dealership/suzuki-nigeria-cfao-motors/amalu-david-automobile-compagny-anambra (also linked/addressed from https://www.suzuki.ng/en/dealership/suzuki-nigeria-cfao-motors/challengers-autos-ibadan). Source spelling uses “Compagny”; game display normalizes this to “Company”. Onitsha address listed as 7 Enugu–Onitsha Express.
- Shopcar Nigeria: https://www.nigeriabusinessweb.com/view-onitsha-car_dealers-1-146-13.html — Achina Street, Awada, Onitsha. Spare-parts-only businesses and a listing with an Awka address were not selected.

See `TEST_RESULTS_30_1.md` for executed checks and remaining verification.
