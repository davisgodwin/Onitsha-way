# v0.46.0 test results

Linux sandbox, Node 22, headless Chromium with software rendering (SwiftShader), 2 CPUs. **No real phone, no XAMPP
on Windows.**

## Unit, server and integration tests
`node --test --test-concurrency=1 tests/*.test.mjs`: **352 tests: 351 pass, 1 skipped, 0 fail**.
(One earlier run, made while the browser suites were running at the same time, had `cloudsave33` "two browsers, one
account" fail on timing; it passes alone and in the clean full run above.)

New: `tests/stage7-46.test.mjs` (5 tests): a degree (enrol, one lecture a day, graduate; unknown degrees cleaned from a
save); the professions need their degree, skill and a clean record, and children can't apply (any degree counts for a
lecturer); every case has exactly one right answer per step; which side of the car you're on; save version 22 (older
saves convert, money and freelance history kept).

Updated for the intended change: the save-version checks (21 → 22) in the unit and browser tests that check it.

## In the real game (browser)
- `tests/e2e/buildings46.mjs`: **14 of 14**.
  - The five landmark buildings stand in the city, and no rentable home is inside their grounds.
  - For each one, the door is outside on open ground ("go in") and leads into its room: church, church, palace,
    school, university.
  - Metadav: the door says "go in", and jobs and training are at the desks inside.
  - The motors workshop has its own room.
  - A hotel has four rooms, each dearer than the last. Booking the standard room for a rest: you pay, you lie on its
    bed, you're rested.
  - Mama Blessing's Kitchen.
  - Getting into a car opens only the door on your side.
  - No page errors.
- `tests/e2e/stage7-46.mjs`: **8 of 8**.
  - Admissions at Shanahan University lists the six programmes.
  - Enrol in Education, attend lectures and graduate.
  - In the CKC staff room you're hired as a teacher; a shift is a class, and you're paid.
  - The hospital's staff door won't make you a doctor without a medical degree.
  - A Courier assignment: refused from far away; report at the place, file, get paid, and the story is in the paper.
  - A DJ set at the club: paid, and you're now known as a DJ.
  - No page errors.
- Screenshots in `qa/v46/`:
  - outside the five buildings: `site-*`;
  - inside them: `inside-*`;
  - `metadav-outside`, `inside-metadav`, `inside-workshop`, `hotel-suite`, `inside-university`, `phone-courier`.

## Regressions (browser), on the v0.46 build
- **v0.45 suites:** `interiors45` 15/15 · `politics45` 16/16 · `posture45` 14/14.
- **Earlier suites:**
  - `vehicles25` pass · `interiors44` 12/12 · `buildings43` 5/5 · `justice42` 26/26;
  - `business41` 18/18 · `life40` 19/19 · `furniture37` 26/26 · `nightlife27` 19/19;
  - `phone18` 20/20 · `smoke` 8/8 · `entry` 15/15.
- **Two players on the real server:** `together44` 10/10.

## Not tested
- The real buildings' likeness: I couldn't see photos of them from here. The designs follow what I could read: Holy
  Trinity is a 1930s church on raised ground; All Saints has a rectangular bell tower, concrete arches and coloured
  glass.
- A full programme in real-time mode: the tests move the game clock. Medicine is 14 lecture days.
- On a real phone, between two machines, or on XAMPP on Windows.
- `cloudsave33` in the browser on MySQL was not re-run; nothing in cloud saves changed.
