# v0.31.0 test results

All checks below were run in a headless Chromium browser with software rendering (SwiftShader) on Node 22. No real phone or GPU was used.

## Unit, layout and build

| Command | Result |
|---|---|
| `npm run check` | **Pass**: 283 tests, 7/7 layout tests, build, build validation |
| `npm run test:all` | **Pass**: 249/249, including the 13 new football tests |
| `npm run test:football` | **Pass**: 13/13 |

The new football tests (`tests/football31.test.mjs`) cover:
- **Ball and goals:**
  - the pass-speed model lands the ball at the aimed distance;
  - a goal counts only when the whole ball is over the line between the posts and under the bar;
  - balls over the bar or wide give a goal kick or corner, decided by the last touch;
  - a ball over the touchline gives a kick-in.
- **Keepers:** a keeper in the path saves most central shots.
- **Full matches:**
  - a full AI match finishes with a valid result, both halves and plausible stats;
  - the same seed gives the same match;
  - the scoring rate stays sensible across 10 matches.
- **Controls:** the human input contract (kick-off pass, charging and releasing a shot), stamina, and pausing freezing the clock and ball.
- **Records:** a match is recorded and rewarded once; leaving or closing the page gives no result.
- **Saves:** save v16 migration adds the record, and damaged records are repaired or rejected.

## Browser end-to-end (all pass)

| Suite | Result |
|---|---|
| `football31.mjs` (new) | **26/26**: one stadium only; map place; prompt; menu; kick-off with real Space; walking shortcuts off; Esc pause freezes the clock; half-time stats; ends switch; full time records once with Fitness XP and tiredness and no money; achievement; a duplicate full-time call does nothing; rematch gets a new ID; leaving returns you to the exact spot and counts as left early; evening floodlights; closed after 10pm; phone touch buttons, Pass at kick-off, HUD fits, leaving restores walking controls; no page errors |
| `smoke.mjs` | Pass, 8 steps |
| `fixes26.mjs` | Pass, 22 |
| `nightlife27.mjs` | Pass, 19 |
| `models24.mjs` | Pass |
| `vehicles25.mjs` | **Pass** (failed on v0.30.1) |
| `place-names301.cjs` | Pass, 12 |
| `roads-power291.cjs` | Pass, 23 |
| `city23.mjs` | Pass |
| `missions30.cjs` | Pass, 24 |
| `checkpoint261.mjs` | Pass, 5 |
| `audit.mjs` | **Pass, 30** (failed on v0.30.1) |
| `city-polish.mjs` | **Pass, 23** (failed on v0.30.1) |
| `phone18.mjs` | **Pass, 20** (failed on v0.30.1) |
| `shoprite.mjs` | **Pass, 88** (failed on v0.30.1) |

### What was stale in the five old suites, and how it was fixed

None of these was a game bug. Each test assumed behaviour that later milestones changed on purpose:

- **Startup screen:** `audit`, `city-polish` and `shoprite` expected the old menu screen after a reload. Since v0.27.3, reloading shows the signup splash. The tests now open the offline save from the splash and press Continue.
- **Signup step:** `phone18` clicked a "Create an account →" step that no longer exists. The click is now made only if that step is shown.
- **Dealership names:** `vehicles25` counted map pins labelled "Car stand:". Dealerships have local names since v0.30.1, so the test now counts dealership pins by kind.
- **Police cars:** `vehicles25` also expected every traffic car with an owner to belong to a resident. Since v0.29, police patrol cars carry their own owner IDs, so they are excluded from that check.
- **Changes since v29 that `shoprite` didn't know about:**
  - **Collection bay:** a car in a dealership's collection bay blocks the next delivery at that dealership. The test now moves each bought car away first.
  - **Catalogue:** it is wider, so each model is bought once rather than every listing.
  - **Starting money:** new lives start with less, so the test first adds QA-only funds in the 100M-per-transaction amounts the economy allows.
  - **Vehicles without doors:** motorcycles have none, so a rendered vehicle counts without checking doors.
  - **Home respawn:** after Continue, the player may wake at their rented home instead of inside Shoprite.
  - **TV placement:** a delivered TV is placed through Buy mode, so the test checks that the TV is owned.

## Engine balance (simulation)

These are AI-vs-AI averages over 8 matches on Normal, 2 × 150 s:
- about 5–6 goals and 21 shots per match;
- about 11 keeper saves per match;
- possession is close to 50/50.

A scripted user who always chases the ball and presses usually wins on Normal. Real players are less precise. Hard is noticeably tougher.

## Not verified

- **Real devices:** frame rate on real phones or GPUs, touch feel on a real phone, and audio on real speakers.
  - The sounds are synthesised with the existing Web Audio code. They play only after the browser allows audio, which headless tests can't hear.
- **Long real-time play:** software-rendered frames take seconds, so the browser tests drive the match engine forward between real-input steps. The full matches themselves are covered by the unit tests.
