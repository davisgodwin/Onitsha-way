# v0.47.0 test results

Linux sandbox, Node 22, headless Chromium with software rendering (SwiftShader), 2 CPUs. **No real phone, no XAMPP
on Windows.**

## Unit, server and integration tests
`node --test --test-concurrency=1 tests/*.test.mjs`: **360 tests: 359 pass, 1 skipped, 0 fail**.

New: `tests/ventures47.test.mjs` (8 tests):
- events: offers, supplier costs and the fee;
- decorating briefs and scoring;
- agency briefs, deadlines and capacity;
- tenants and rent, and building costs and sale;
- roadside faults;
- security nights;
- the crew (the levy is a crime);
- the football fixtures, matches and table;
- balance bands;
- the weekday fix (open Monday to Saturday, closed Sunday);
- save version 23.

Updated for the intended changes: the save-version checks (22 → 23), and the weekday check in `life40`.

## In the real game (browser)
- `tests/e2e/ventures47.mjs`: **16 of 16**.
  - Each venture from the Ventures phone app: an event planned, run on the day at its canopy and paid; a decorating
    job at the client's house; an agency brief delivered; a home let and rent paid; a building developed and sold;
    a roadside call-out fixed at the car.
  - Security guards on a night; crew jobs (the levy opens a police case); the football league and the U-17s.
  - The news screens and the Courier show real events.
  - Wanted posters go up while you have a warrant.
  - The phone apps at 390 × 844.
  - No page errors.
- Screenshots in `qa/v47/`.

## Balance (from the rules, checked by the unit test)
| Way of earning | About |
|---|---|
| Best employed job (doctor) | ₦6,400 an hour |
| Event planner (good choices) | ₦4,100 an hour |
| Decorator | ₦6,800 an hour |
| Security company | the fee per guard is above the guard's wage; break-ins can lose you clients |
| Crew loading fees | ₦3,000 an hour |
| Crew "levy" | ₦9,000 an hour: a crime, and the police open a case |

The agency and the developer earn money but also have costs: daily wages, late fees, and building costs paid
before the sale. Every honest rate stays under ₦8,000 an hour.

## Regressions (browser), on the v0.47 build
- **v0.46 suites:** `buildings46` 14/14 · `stage7-46` 8/8.
- **v0.45 suites:** `interiors45` 15/15 · `politics45` 16/16 · `posture45` 14/14.
- **Earlier suites:**
  - `mobile36` 29/29 · `justice42` 26/26 · `business41` 18/18 · `life40` 19/19;
  - `furniture37` 26/26 · `nightlife27` 19/19 · `vehicles25` pass · `phone18` 20/20;
  - `smoke` 8/8 · `entry` 15/15 · `interiors44` 12/12 · `buildings43` 5/5.
- **Two players on the real server:** `together44` 10/10.

The first time `posture45` ran, while other tests were loading the machine, it failed on timing. I made the test
wait properly, and it then passed 14/14.

## Not tested
- Weeks of play in real time: the tests move the game clock forward.
- On a real phone, between two machines, or on XAMPP on Windows.
