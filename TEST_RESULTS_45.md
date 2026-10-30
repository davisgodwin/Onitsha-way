# v0.45.0 test results

Linux sandbox, Node 22, headless Chromium with software rendering (SwiftShader), 2 CPUs. **No real phone, no XAMPP
on Windows.**

## Unit, server and integration tests
`node --test --test-concurrency=1 tests/*.test.mjs`: **347 tests: 346 pass, 1 skipped, 0 fail**.

New: `tests/politics45.test.mjs` (10 tests):
- the season calendar (nominations, campaign, election day, results);
- who can stand: adults only, registered, in a party, during nominations, enough public standing, the
  chairmanship's experience rule, the governorship only after a win, the nomination fee, barred after a conviction;
- NPC candidates: fictional, from the other parties, fixed for a season;
- an election: deterministic, counted from the polling-unit record, **one ballot per voter** (a second is refused),
  the ballot is in the count, **a recount from the stored record gives the same result**; campaigning (and vote
  buying) makes a candidate stronger;
- **a tie is re-run** between the tied candidates;
- diverting public money leaves more evidence the more (and the more often) you take;
- saves: version 21; an older save converts (money kept, unregistered, no party); a save naming a party, office or
  project that doesn't exist in the game is cleaned;
- dates: the outcome follows the conversation; three eateries with menus;
- **the players' elections** (server rules): weekly phases in Onitsha time, adults only, one candidacy a week, voting
  only on Saturday, **one vote per account per office**, not for a non-candidate, a tie has no winner, results from
  the vote record (recount matches);
- **on the real server** (two players over WebSocket, the clock moved through a week): both stand, voting refused
  before Saturday, one vote each, a second refused, the vote record stored, Sunday's result; then friends, a
  **date at an eatery** (the request carries the eatery, the meeting place is the eatery door), both inside the
  eatery, both check in, and **the server completes the date** after the 30 seconds.

Updated for the intended change: the save-version checks in `business41`, `football31`, `justice42`, `life40`,
`buy`, `place-names301` (20 → 21).

## In the real game (browser)
- `tests/e2e/posture45.mjs`: **14 of 14**. X sits you on the ground (others see the pose), moving gets you up, Z
  lies you down, Z again gets you up; in the courtroom a bench offers "Sit down", E sits you, E again "Stand up"; a
  hospital ward bed offers "Lie down" and E lies you on it; your sofa at home; your bed's menu starts with "Lie down".
- `tests/e2e/interiors45.mjs`: **15 of 15**. The palace, both churches, the school, the ICT hub, a hotel and the
  three eateries each have a proper room with seats and their counters; the eateries are on the map; ordering at the
  counter costs money and fills you up; inviting someone you know (they appear seated at a table for two), sitting
  with them, ordering for two, three rounds of talk, goodnight: the relationship grows.
- `tests/e2e/politics45.mjs`: **16 of 16**. The Electoral Offices and rally grounds are in the city and on the map;
  inside: the INEC and ANSIEC desks, results board, debate stage; a child can't register; register, join the OPP,
  stand for councillor (the governorship refused); a rally at the Main Market (stronger, the stage is there) and
  posters; donations the next day; the debate; on election day the polling unit is set out, you vote once and a
  second vote is refused; results day: every race declared, the count matches the polling-unit record, you win and
  take office; the weekly salary; a borehole commissioned where you stand, out of the budget; two days later it's
  finished and visible; diverting money pays you and opens an EFCC case; a conviction removes you and bars you; the
  phone's Politics app.
- Screenshots `qa/v45/`: palace, church-basilica, church-all-saints, school, ict, hotel, eatery-1..3, date,
  sit-ground, lie-ground, sit-court-bench, lie-hospital-bed, sit-home-sofa, lie-home-bed, electoral-office, rally,
  polling-unit, project-borehole, phone-politics.

## Regressions (browser), on the v0.45 build
- `interiors44` 12/12 · `buildings43` 5/5 · `justice42` 26/26 · `business41` 18/18 · `life40` 19/19 ·
  `furniture37` 26/26 · `nightlife27` 19/19 (+1) · `phone18` 20/20 · `smoke` 8/8 · `entry` 15/15 · `together44`
  (two players, real server) 10/10
- Updated for intended changes: the save-version checks in `justice42`, `business41`, `life40`, `furniture37`.
- Not re-run this time: `cloudsave33` (MySQL), `vehicles25`, `football31`, `lan35` (nothing they cover changed).

## Not tested
- Two players on two different real machines (the date at an eatery and the players' elections were tested on the
  real server with two connected clients on one machine).
- A full 28-day season played in real time (the tests move the game clock; real-time mode makes a season 28 real
  days).
- The new rooms and the Sit/Lie buttons on a real phone's GPU and screen.
- XAMPP on Windows (the players' elections are stored as one more JSON value in the server's data; no new table).
