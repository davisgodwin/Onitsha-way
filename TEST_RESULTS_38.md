# v0.38.0 test results

Linux sandbox, Node 22, MariaDB 10.11, headless Chromium with software rendering (SwiftShader), 2 CPUs.
**No real phone.**

## Unit, layout, build
| Command | Result |
|---|---|
| `npm run check` | **Pass**: 283 tests, layout, build, build validation |
| `node --test tests/*.test.mjs` | **Pass, 295/295**, 0 skipped |

New: `tests/buildings38.test.mjs` — every residential footprint on the real map gets one of the eight types,
deterministically (same building, same type), all eight appear, none takes over the city (each 2–50%); older bungalows
are clearly more common in the old trading districts than in the newer north-east; verandas/porches/balconies are
only planned where the ground is clear, and their pillars stand outside the house.

## Browser end-to-end (all on the built game unless marked dev)
| Suite | Result |
|---|---|
| `buildings38.mjs` (new) | **13/13**: all eight types present (each >100 buildings); 3,447 houses on empty land, 1,982 in compounds; no supplied-pack buildings; 496 neighbours at gates; **no new house in markets, parks, schools, churches, monuments, the mall or the stadium, none on a road**; every door of all 90 homes still clear; 300/300 sampled compound gates open to walk through and 300/300 back walls solid; 90 homes (46 + 44 flats); a flat in a block rents and opens; draw calls/triangles in the earlier range (see below); windows and security lights glow at night; no page errors |
| `furniture37.mjs` | Pass, 26 |
| `mobile36.mjs` | Pass, 29 (includes the guest seeing the host's furniture) |
| `roads-power291.cjs` | Pass, 23 |
| `m10.mjs` | Pass, 26 |
| `shoprite.mjs` | Pass, 88 |
| `smoke.mjs` | Pass, 8 |
| `models24.mjs` | Pass |
| `entry.mjs` | Pass, 15 |
| `phone18.mjs` | Pass, 20 |
| `fixes26.mjs` (dev) | Pass, 22 |
| `nightlife27.mjs` (dev) | Pass, 19 |
| `activities32.mjs` | Pass, 44 |
| `cloudsave33.mjs` | Pass, 14 |
| `lan35.mjs` | Pass, 17 |
| `vehicles25.mjs` | Pass |
| `place-names301.cjs` | Pass, 12 |

`m9`, `buy20`, `buy21` were not re-run; they fail the same way on v0.36 (see TEST_RESULTS_37.md).

## Performance (this machine, medium quality)
| View | Draw calls | Triangles |
|---|---|---|
| Street, old district | 316 | 0.57 M |
| Street, new compounds | 219–270 | 0.41–0.51 M |
| Street, storey buildings | 173–233 | 0.36–0.42 M |
| Aerial views | 82–270 | 0.33–0.51 M |
| v0.36 audit (for comparison) | 130–320 | 0.26–0.72 M |

Loading: planning the houses on empty land took 3.6 s here in the built game (included in the 46 s total load on
this slow software-graphics machine). Not measured on a phone.

Found and fixed while testing: a loop mix-up put the first plots at "not a number" positions, which turned the screen
black when you stood near them; a check now skips any such plot. Plot planning was 38 s at first and was brought down
to under 4 s.

Screenshots: `qa/v38/` (each building type, streets, aerials, compounds, night).

## Not verified
- A real phone (loading time and frame rate with the extra houses).
