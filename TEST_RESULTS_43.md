# v0.43.0 test results

Linux sandbox, Node 22, headless Chromium with software rendering (SwiftShader), 2 CPUs, MariaDB for the MySQL
checks. **No real phone, no XAMPP on Windows.**

## Unit and server tests
`node --test --test-concurrency=1 tests/*.test.mjs`: **333 tests: 332 pass, 1 skipped, 0 fail** (includes the 7 below).

New: `tests/authority43.test.mjs` (7 tests):
- the server keeps the balance: spending needs the money; the same transaction never counts twice; malformed
  transactions are refused;
- moving money between your own accounts (wallet ↔ bank, business ↔ wage escrow, a reversed transfer) is accepted
  and never capped; a credit with no matching debit is not a transfer;
- earnings must be possible: shift pay above what a shift can pay is refused; a day's limit holds and resets with
  the next day in Onitsha (WAT); unknown earnings are capped; starting funds only once;
- property: you can only sell a vehicle you paid for on this account, once, for no more than it cost; property the
  server has no record of is reported as unverified;
- the legal record is append-only (a deleted conviction comes back); convictions never go down; reputation moves at
  most 30 per dimension a day, and can move again the next day;
- a save sent to the server is corrected to its books before it's stored; nothing you own is removed;
- **the real account server with the browser's client**: offline nothing is sent; signing in opens the books;
  earnings and spending are counted; money edited into the save is corrected back; an impossible payment is
  refused, taken back out, and you're told; a tampered save uploaded to the cloud is stored with the server's figures.

## MySQL (MariaDB)
- **Upgrade from an older database**: a database set up by v0.42 (schema 1, no `authority` table) opens under
  v0.43: the table is added, the schema becomes 2, **existing users are kept**.
- The books round-trip through MySQL (written, server restarted, read back).
- `tests/e2e/cloudsave33.mjs` (real browser, real server on MySQL, laptop + phone): **16 of 16 checks pass**, including
  two new ones: the account server's row in MySQL matches the wallet, and money edited into the save is corrected.

## Buildings (browser)
`tests/e2e/buildings43.mjs`: **5 of 5 checks pass**:
1. both hospitals and both banks are purpose-built (not borrowed shop buildings);
2. none shares a spot with a home store (nearest store 216 m to 1.5 km away);
3. no city building stands inside their plots;
4. the hospital reception and the banking hall are at their doors;
5. no page errors.

Screenshots: `qa/v43/` (hospital-1, hospital-2, bank-1, bank-2, court).

## Regressions (browser), all on the v0.43 build
- `justice42` (crime, court, kingdoms, police/EFCC): 26/26
- `business41` (banks in their new buildings, shops, transport): 18/18
- `life40`: 19/19 · `phone18`: 20/20 · `smoke`: 8/8 · `entry`: 15/15

Not re-run this stage: the older browser suites for vehicles, nightlife, football, LAN and furniture.

## Not tested
- The account server over the LAN gateway (stage 5 is where players meet).
- A long play session online with hundreds of transactions; the queue (up to 3,000 waiting) and batches of 400
  were tested in the unit tests, not over hours in a browser.
- XAMPP on Windows: the MySQL upgrade was checked on MariaDB here.
