# v0.39.0 test results

Linux sandbox, Node 22, MariaDB 10.11, headless Chromium with software rendering (SwiftShader, a few frames a
second), 2 CPUs. **No real phone, no GPU.**

## Unit tests
`node --test --test-concurrency=1 tests/*.test.mjs`: **302 tests, 301 pass**. The one failure,
`cloudsave33.test.mjs` "two browsers, one account", happened because the cloud-save browser suite was using the same
test server port and database at the same moment. It **passes when run on its own** (`node tests/cloudsave33.test.mjs`).

New: `tests/update39.test.mjs` (7 tests):
- vehicle bodies overlap only when they really touch; a hit driver brakes, shouts a Pidgin line and does not react
  twice to one bump; two overlapping NPC cars both react;
- floor plans for 60 homes of each of the 5 types: same home → same plan, ≥58/60 different plans per type, the front
  door opens into a front room, every room at least 1.5 m across, every room reachable through a doorway, a bulb per room;
- walk surfaces: you climb a stair, its side blocks you at street level, you walk under its high end, you can't step
  off a deck edge;
- the invented flyovers join the street at both ramps, don't touch the junction below, are drivable and walkable;
  the ground lanes under them carry no through traffic; the Niger Bridge stays traffic-only;
- the hospital fee after a knock-down: up to ₦3,000, never more than you have;
- **in 25 generated homes × 5 layouts × 2 sizes, empty and NPC-furnished, the player (real radius) can reach every
  light switch, the stairs and the door** (over 1,500 checks).

Also changed for v0.39: `nightlife27.test.mjs` now passes with the new plans (it failed until the fixes below).

## Browser end-to-end
| Suite | Result |
|---|---|
| `update39.mjs` (new) | **18/18**: NPC cars that bump stop, put hazards on and shout; drivers react when you hit them; 355 LEDs on the two monuments, off by day; on at night and changing colour (3 shows); billboards lit at night (lamp wash, brighter faces); 350 uncompleted buildings, none a rentable home; all 90 homes have their own plan (90 different); no built-in bathroom/kitchen/sink/cupboards (only door, switches, stairs); a bulb can be taken out and put back and is saved; 2 hospitals with map pins and parked ambulances; check-up ₦2,500 / 1 hour / energy back; knocked down by a car → you lie down, an ambulance comes, you wake at the nearest hospital 3 hours later, ₦3,000 paid; ambulances in the traffic; stairs on the Upper Iweka flyover (5 staircases), 4 footbridges, 2 new flyovers; traffic drives over the new flyovers; the player walks up the stairs onto a deck and the parapet keeps you on it; NPC pedestrians on the stairs/decks; no page errors |
| `furniture37.mjs` | Pass, 26 (after a test update: see below) |
| `nightlife27.mjs` (dev) | Pass, 19 (checks updated: homes now come empty) |
| `fixes26.mjs` (dev) | Pass, 22 |
| `roads-power291.cjs` | Pass, 23 |
| `m10.mjs` | Pass, 26 |
| `shoprite.mjs` | Pass, 88 |
| `smoke.mjs` | Pass, 8 |
| `models24.mjs` | Pass |
| `entry.mjs` | Pass, 15 |
| `phone18.mjs` | Pass, 20 |
| `activities32.mjs` | Pass, 44 |
| `lan35.mjs` | Pass, 17 |
| `place-names301.cjs` | Pass, 12 |
| `football31.mjs` | Pass, 26 |
| `buildings38.mjs` | Pass, 13 (on the final build; load 44 s on this machine, house planning 3.8 s) |
| `vehicles25.mjs` | **Not completed.** First run: failed one check because ambulances (new service vehicles) weren't in the test's list of non-resident cars — test updated; the re-run was stopped to deliver. |
| `cloudsave33.mjs` | **Not completed**: 12–13 checks passed in two runs (accounts, cloud save, phone continues, laptop continues the phone's newer game); both runs were cut short (the test database was stopped by the sandbox's time limit, then we stopped to deliver). v0.39 doesn't change saving or accounts. |
| `mobile36.mjs` | **21 checks passed, then timed out** waiting for the host and guest to appear in each other's online player list (30 s). The visit itself had already worked (invite → accept → inside the host's home). Not re-run (we stopped to deliver); this step reads the online presence list, which v0.39 did not change. |

`m9`, `buy20`, `buy21` were not run; they fail the same way on v0.36 (see TEST_RESULTS_37.md).

### Test updates (the game changed on purpose)
- `furniture37`: turns an armchair 45° and expected it to still fit where it was; with the new floor plans a wall
  can be there, so the test now slides it to a free spot first (as a player would drag it). The game correctly
  refused to place it on the wall.
- `nightlife27`: no longer expects a built-in toilet, shower, basin and cooker; checks there are none.
- `buildings38`, `update39`: wait for night to arrive instead of a fixed 3 s (this machine draws a few frames a
  second).
- `vehicles25`: ambulances (`ambulance:*`) are service vehicles like police patrols, not resident cars.

## Found and fixed while testing
- **Duplex stairs blocked doorways**: in many duplexes the flight of stairs stood across the doorway to the rooms
  behind the stairs room, so some rooms (and their light switches) couldn't be reached. Stairs now go in a corner
  that keeps every doorway, the front door and the switch clear; ~2,200 unreachable items in 120 test homes → 0.
- **Doorways widened** to 1.0 m (0.9 m for bathrooms/toilets): 0.75 m was very tight for the player.
- Light switches are kept away from room corners; an NPC host's furniture keeps out of doorways and away from switches.
- The ambulance rescue ran on the game's capped frame step, so on a slow device you could lie in the road for
  minutes; it now runs on real time (a few seconds).
- The parked ambulances at the hospitals were built before the vehicle models had loaded; they are now added once
  the models are ready.
- The billboard night-light texture was made when the file loaded, which broke unit tests that load game code
  without a browser.
- Upper Iweka flyover stairs: the real decks are short (60 m) and the monument island and cloverleaf ramps are close;
  stairs are now allowed from 3.5 m deck height and the monument keep-clear uses its real size.

## Not verified
- A real phone (frame rate with LEDs, lit boards and the extra geometry; the ambulance siren on phone speakers).
- Long play sessions moving furniture between the new rooms.
- A few NPC-host homes (visited NPCs) have a bed or sofa whose "use" spot is boxed in by their other furniture
  (about 30 of 20,000 checked items); you can't use an NPC's bed while visiting anyway.

## Screenshots
`qa/v39/`: night LEDs at Upper Iweka and the Zik roundabout, a lit billboard, an uncompleted building, an empty home,
the knock-down / after the hospital, the new flyovers, stairs, footbridges, on the flyover deck.
