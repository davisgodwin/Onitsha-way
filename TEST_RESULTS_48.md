# v0.48.0 test results

Linux sandbox, Node 22, headless Chromium with software rendering (SwiftShader), MariaDB 10.11. **No real phone, no
second machine and no Windows/XAMPP**: LAUNCH_CHECKLIST.md lists those checks, which you have to do yourself.

## Unit, server and integration tests
`node --test --test-concurrency=1 tests/*.test.mjs`, with MariaDB running so the MySQL half also runs:
**405 tests: 405 pass, 0 fail, 0 skipped.**

New:
- `tests/v48.test.mjs`: the play area (river line, LGA lines, COMING SOON places), edge-sign naming, moving a save off a
  Delta State home, stop tiers, the vehicle catalogue (premium, showroom-only), district classes.
- `tests/decor48.test.mjs`: decorating-job costs and the server's rules (adults only, budget, owner only, six pieces).

Updated for intended changes:
- **Map size** (the map is bigger now):
  - `street-layout`: 20,397 buildings surveyed;
  - `m6`: the v0.48 buildings are appended outside the earlier map;
  - `v48`: no GRA sign, because GRA is in the map.
- **Vehicles:**
  - `vehicles25`: 54 models;
  - `buildings38`: villa/mansion only in GRA;
  - `m6`/`shoprite`: the premium cars are at the showroom.
- **Database:** `database33`, the authority block in the MySQL save.
- **Bus model:** the removed bus model (licence unclear) is out of `loadModels24`.

## In the real game (browser), on the final v0.48 build
| Suite | Result | What it checks |
|---|---|---|
| `mapext48` | 13/13 | Loads the **old map and the new map** and compares them (details below) |
| `soon48` | 10/10 | Niger Bridge barrier; edge boards; Asaba, the island and outside the LGA lines (Okpoko, Nkpor, Obosi) COMING SOON; GPS refuses; car stops at the barrier; Asaba save moves to Bridgehead; GRA open |
| `districts48` | 9/9 | Trees, drains, kerbs; the real GRA Phase I and II: villas/mansions/duplexes, never tenements; palms, lawns, lamps; premium cars about 1 in 5 in GRA traffic vs about 1 in 23 in Fegge; the player can be there |
| `terminals48` | 7/7 | Upper Iweka and Bridgehead parks: yards, bays, ticket office, buses in and out, staff |
| `stops48` | 4/4 | Built stops in four sizes with their names |
| `vehicles48` | 8/8 | The 18 new models, Prestige Autos, prices, premium cars rare in traffic |
| `football48` | 5/5 | 11-a-side league match on the full pitch, 22 players; friendlies stay 5-a-side |
| `decor48` | 7/7 | Two players on the real server: hire, arrive, choose, accept (owner's money), see it appear, fee paid |

`mapext48` in detail: every home to let (90), resident (3,390), shop, branch, hospital, car lot, landmark, bus stop (89),
unfinished building (133) and house on empty land keeps its id and spot.
- **The exceptions:** 8 invented houses at the old edge now under real OSM buildings or roads are taken out, with
  their numbers kept. One family who lived in one of them has no home now.

### Regressions, on the final build
- `smoke` 8/8 · `mobile36` 29/29 · `vehicles25` pass.
- `together44` 10/10 (two players, real server) · `nightlife27` 19/19 · `ventures47` 16/16 · `entry` 15/15.
- `interiors44` 12/12 · `furniture37` 26/26 · `fixes262` 14/14.
- `fixes262` checked the map pin's label for "settled today", but map labels are names only (your rule). Its two
  expectations were out of date (that label, and the model count 36 → 54); the game itself was right.

### Performance (test browser, 390 × 844 phone size, low quality)
| | old map | new map |
|---|---|---|
| Triangles drawn at the start | 367,000 | 391,000 |
| Triangles drawn in the main market | 240,000 | 300,000 |
| Triangles drawn in GRA | n/a | 307,000 |
| JS memory | about 415 MB | about 510 MB |
| Load time (software rendering, so slow) | 63 s | 75 s |

Before the road and dressing split, the new map drew 836,000 triangles at the start and 762,000 in the market. Frame rates
from software rendering mean nothing for a phone, so they are not given here.

## Found and fixed during testing
- **Interactions inside homes:** once the map had LGA lines, interactions inside homes (which sit off the map) counted
  as COMING SOON. The decorator's "choose furniture" spot didn't show. Interiors are now always open.
- **Houses at the old edge:** a street lamp on a new road shifted the houses planned on empty land at the old edge.
  Lamps and places from the extension no longer affect the earlier map's planning.
- **Encounters at the edge:** two area boys at the east edge had moved 10 m; they are back in their spot.
- **Warnings:** 18 "color undefined" warnings at start-up came from display cars without paint. Fixed.
- **First runs:** `mobile36` failed once while two other browser jobs loaded the machine. The visit ended on a
  reconnect. In the final round, without that extra load, it passed 29/29.

## Not tested
- A real phone, two real machines, XAMPP on Windows (see LAUNCH_CHECKLIST.md).
- Weeks of real-time play.
