# v0.37.0 test results

Linux sandbox, Node 22, MariaDB 10.11, headless Chromium with software rendering (SwiftShader). The "phone" is a
390×844 touch Chromium. **No real phone.**

## Unit, layout, build
| Command | Result |
|---|---|
| `npm run check` | **Pass**: 283 tests, layout, build, build validation (now also checks all 116 furniture models + licence, and that no building-pack model ships) |
| `node --test tests/*.test.mjs` | **Pass, 292/292**, 0 skipped (MySQL test ran against MariaDB) |

New unit tests (`tests/buy.test.mjs`, rewritten, and `tests/stores37.test.mjs`):
- catalogue: 184 unique items, all 57 old ids kept, every item has section, store, tier (matches its price), resale
  (40%), model, footprint, valid colour palette; every section has ≥5 items, each tier ≥15, each store ≥20.
- buying makes one stored piece charged exactly once; a second of the same item is a separate piece and charge;
  failed purchases (no money, unknown item, wrong colour, no rental) charge nothing and add nothing; delivery fee is
  in the same transaction.
- selling pays 40% once; selling again pays nothing; another home's piece can't be sold; sold ids are never reused.
- place / store / re-place / recolour keep the same piece; invalid positions rejected; outdoor items install
  themselves; cap of 12 of one item.
- stored power units don't power the home, installed ones do; solar charges only in daylight.
- v16 → v17: positions, rotations, colours, storage, outdoor generators, paint, fuel and money kept; migrating
  twice changes nothing; corrupt pieces are dropped or stored, never crash.
- placement rules: room edges, walls, other furniture, doors; rugs and table-top items never block; 45° footprint;
  wall items snap to the nearest wall, face into the room and won't hang across a door gap; two pictures can't
  overlap; ceiling fittings can't share a spot.
- every one of the 184 items builds a real model (Kenney GLBs parsed from disk) inside its footprint, and every
  colour option changes at least one material.
- the four stores each take over a different existing commercial building with a road-facing door, deterministically.

Updated older unit tests to the new rules (they asserted the old one-of-each behaviour): `m9`, `shoprite`,
`roads-power291` (place pieces instead of writing `placements` directly), and the save-version checks in
`football31` / `place-names301` (16 → 17).

## Browser end-to-end
| Suite | Result |
|---|---|
| `furniture37.mjs` (new) | **26/26** (see below) |
| `mobile36.mjs` | **29/29** (2 new): **a friend visiting your home sees your furniture** (same pieces), and **when the host rotates a chair the guest sees it turn**; plus all earlier phone checks. The first two runs timed out waiting for the guest to walk in on this slow 2-CPU machine; with a longer wait it passed |
| `roads-power291.cjs` | Pass, 23 (its setup now marks pieces as never-placed instead of deleting `placements`; the game lays them out as before — this found a real case where a radio no longer fitted a self-contain, fixed by searching more positions) |
| `nightlife27.mjs` | Pass, 19 (setup updated to pieces) |
| `m10.mjs` | Pass, 26 (found that the old one-of-each `place`/`store` calls were gone; kept for compatibility) |
| `shoprite.mjs` | Pass, 88 (the TV is now "Flat-screen TV on stand"; a second TV is now allowed and charged once) |
| `smoke.mjs` | Pass, 8 |
| `models24.mjs` | Pass (13 supplied models; **0 imported buildings**) |
| `entry.mjs` | Pass, 15 |
| `phone18.mjs` | Pass, 20 |
| `fixes26.mjs` | Pass, 22 |
| `activities32.mjs` | Pass, 44 |
| `cloudsave33.mjs` | Pass, 14 |
| `lan35.mjs` | Pass, 17 |
| `vehicles25.mjs` | Pass |
| `place-names301.cjs` | Pass, 12 |
| `m9.mjs` | 7 checks pass, then stops at a car-stand lookup (`model==='sedan'`). **Not caused by this update:** the v0.36 build fails at the same line |
| `buy20.mjs`, `buy21.mjs` | Fail at the sign-up screen. **Not caused by this update:** old suites from v0.30.1 that fail the same way on the v0.36 build |

`furniture37` checks: rent and enter a flat; Buy mode shows the 11 sections + Paint & floor + My items and the
price-tier chips; Premium filter shows only premium items; **Place…** shows a preview and charges nothing;
**Cancel** charges nothing and adds nothing; dragging on the room and **R** rotates by 45°; confirming pays item +
delivery exactly once and places the piece with the chosen colour; two armchairs are separate pieces both in the
room; cancelling a move leaves the piece where it was; rotate a placed piece 45°; a painting hangs on a wall at
picture height; a ceiling fan is under the ceiling; a fruit bowl stands on the centre table; a duvet goes on the bed;
selling pays exactly 40% once; outdoor items appear by the front door; the four stores have signs and map pins
(names only); a store counter opens its own catalogue; buying in a store is delivered free to storage; **after a
full reload (Continue) every piece's position, rotation and colour is identical** and every placed piece is drawn;
a v16 home converts to pieces keeping position/rotation/storage/money; on the phone the room stays visible while
placing and Confirm is on screen, tap Place → Confirm buys and places; no page errors.

Screenshots: `qa/v37/` (furnished room, Buy mode, phone Buy mode, the furniture showroom, and contact sheets of all
184 models: `sheet-0.png` … `sheet-144.png`).

## Not verified
- A real phone (touch feel of dragging furniture).
- Two real people visiting each other's furnished homes: the server forwards and re-checks the furniture list and
  the client draws it (code path covered by reading and by the unit-level pieces), but no two-browser visit test
  was run for furniture in this round.
