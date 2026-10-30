# v0.44.0 test results

Linux sandbox, Node 22, headless Chromium with software rendering (SwiftShader), 2 CPUs, MariaDB for the MySQL
checks. **No real phone, no XAMPP on Windows.**

## Unit, server and integration tests
`node --test --test-concurrency=1 tests/*.test.mjs`: **337 tests: 336 pass, 1 skipped, 0 fail**.

New:
- `tests/together44.test.mjs` (2 tests): the server moves money between two players' books once, and each browser
  records it as one ordinary entry; then, on the real server with three connected players: too far away, safe area,
  peace mode, a pickpocket that works (money moved on the server, the victim told who it was), the 10-minute wait,
  the 30-minute shield, no peace mode straight after targeting someone, a report reaching the robber, a report
  reaching a robber who was offline (on reconnect), three a day at most, payments (limits, nearby or friends, only
  what the server says you have), blocked players can't interact, the status for the phone.
- `tests/authority-lan44.test.mjs` (2 tests): **the account server through the LAN gateway** (https and secure
  WebSocket with the LAN certificate, as phones on the Wi-Fi use it): books opened, earnings counted, tampering
  corrected, a pickpocket and a payment between two players over wss, recorded in the browser as its own entries.
  **A long session**: 3,360 transactions over four days of play (wages, spending, bank deposits and withdrawals, shop
  takings, profit out), the network down five hours every day: every balance matches the server to the naira,
  nothing honest refused, nothing corrected.

## In the real game (browser)
- `tests/e2e/together44.mjs` (two players, real server, JSON storage): **10 of 10**. Both sign up and make
  characters; a quiet street that isn't a safe area; walking up to Obi shows "Obi Street — meet"; the meet menu (give
  money, message, the crime options, report); Ada gives Obi ₦1,000 and it arrives as "From Ada Street"; Ada's
  pickpocket is decided by the server and opens a police case against her; Obi is told who it was; Obi reports it and
  Ada's case gets stronger; Obi switches on peace mode from the phone and can't be targeted; near the police the crime
  options are off; no page errors.
- `tests/e2e/interiors44.mjs`: **12 of 12**: walk into the police station, EFCC office, hospital, both banks, the
  court, Shoprite and all four home stores; their counters are there; walk out; no page errors.
- Screenshots `qa/v44/`: police, efcc, hospital, bank, bank-2, court, shoprite, the four stores, meet-player, robbed,
  phone-peace.
- **Menus**, checked by screenshots on a 1280×800 screen and a 390×844 phone: main menu, pause, settings, account
  screen.

## Regressions (browser), all on the v0.44 build
- `buildings43`: 5/5 · `justice42`: 26/26 · `business41`: 18/18 · `life40`: 19/19 · `phone18`: 20/20 · `smoke`: 8/8
  · `entry`: 15/15
- **The older suites v0.43 didn't re-run**: `furniture37` 26/26 · `vehicles25` pass · `football31` 26/26 ·
  `lan35` 17/17 · `nightlife27` 19/19
- Two tests were updated for intended changes: `entry` looked for the old title text ("ONITSHAWAY"; it's now the
  signboard), and `buildings43` looked for the old door labels (doors now say "go in").
- `cloudsave33` (real browser, real server on MySQL, laptop + phone, the redesigned Settings): 16/16

## Not tested
- Two players on two different real machines over Wi-Fi (the gateway was tested on one machine, with its
  certificate, the way phones use it).
- The interiors on a real phone's GPU (the software renderer here is slow but draws the same scene).
- XAMPP on Windows (MySQL was checked on MariaDB).
