# v0.41.0 test results

Linux sandbox, Node 22, headless Chromium with software rendering (SwiftShader), 2 CPUs. **No real phone.**
Built and tested single-player, as agreed for stages 1–3.

## Unit tests
`node --test --test-concurrency=1 tests/*.test.mjs`: **313 tests: 312 pass, 1 skipped, 0 fail** (includes the 12 new below).

New: `tests/business41.test.mjs` (12 tests):
- opening an account costs the fee once; deposit and withdraw move money without creating any;
- interest is small, daily, capped and never paid twice for the same day;
- loan offers depend on income, record, score and collateral; one of each kind; a pledged asset can't back two loans;
- instalments come out daily; paying in full frees the collateral and lifts the score;
- three missed instalments are a default: a secured loan loses its asset; an unsecured debt is collected from cash;
- a loan is never free money: borrowing then repaying costs exactly the interest;
- contracts: escrow is funded on acceptance, wages come out once per day, the rest is refunded at the end;
- a shop sells only when open, served and stocked; customers who are turned away hurt satisfaction;
- an untrustworthy attendant skims when you're away, never when you're there;
- fleets: a day's takings less fuel; broken-down vehicles earn nothing; dishonest drivers bring back less;
- hiring candidates are deterministic and their wages follow skill;
- save v19: new lives have an empty bank and no businesses; old saves gain them without other changes.

## In the real game (browser)
`tests/e2e/business41.mjs` (preview build): **18 of 18 checks pass**:
1. two banks and 8 shops to let are placed in town, with map pins;
2. opening an account and depositing at the branch;
3. the bank offers a personal loan based on recent income;
4. taking a loan pays it into the account and sets a repayment schedule;
5. the next day an instalment is taken from the account;
6. renting premises registers a business with its own sign;
7. stock bought and an attendant hired from the business account (3 days of wages set aside);
8. with the attendant serving, customers buy every hour and the takings go into the business account;
9. the day closes with a report: sales and the wage paid from escrow;
10. a minibus bought at a car stand;
11. the hired driver brings back the day's takings after fuel; the vehicle wears;
12. a minibus carries 14 passengers on a chosen route (M1), with bus fares;
13. a vehicle pledged for a loan cannot be sold until the loan is repaid;
14. the phone shows the bank account, loans, and the businesses with their latest day;
15. Profile counts the new work: business owner and transport operator;
16. banks, loans, businesses and contracts survive a reload (save version 19);
17. a v18 save migrates: cash kept, an empty bank and no businesses;
18. no page errors.

Screenshots: `qa/v41/` (bank, shop-manage, fleet, phone-bank, phone-business).

**Bug found and fixed by this test:** when the day rolled over, the new day's first trading hour wiped the previous
day's sales before the daily report was written, so reports showed ₦0 sales. The previous day's totals are now kept
until the report reads them.

## Regressions (browser)
All pass on the v0.41 build:
- `life40` (open life, jobs, profile, v17 migration): 19/19
- `phone18` (phone and HUD): 20/20
- `smoke` (browser smoke test): 8/8
- `entry` (sign-in / offline entry): 15/15
- `furniture37` (homes and furniture): 26/26

Not re-run this stage (to keep the wait short): the other older browser suites (vehicles, nightlife, football,
cloud save, LAN, etc.). The code they touch didn't change except the keke/bus fare code, which `business41` and the
unit tests cover.

## Not tested
- Driving a bus with passengers boarding and paying along a route was checked through the fare and route rules,
  not by driving the whole route in the browser (the software renderer runs at a few frames a second).
- A real default ending in repossession was tested in the unit tests, not played through in the browser.
- No real phone; no LAN or multiplayer test (businesses are single-player in this stage).
- `tests/e2e/skills272.mjs` is still broken from before (it waits for a `#preview-tools` element that no longer
  exists); not run.
