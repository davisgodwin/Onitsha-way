# v0.30.2 test results

These checks were run in a headless Chromium browser using software rendering (SwiftShader), on Node 22. No real phone and no GPU were used.

## Unit, layout and build checks

| Command | Result |
|---|---|
| `npm run check` (tests, layout tests, build, `scripts/validate.mjs`) | **Pass.** 283 tests passed and 7/7 layout tests passed. The build succeeded and build validation passed, with the app JS, the `three-*` vendor chunk and the CSS all within budget. |
| `npm run test:all` | **Pass.** 236/236. |

## Browser end-to-end suites

| Suite | Result |
|---|---|
| `smoke.mjs` (rewritten for the signup splash) | Pass, 8/8 steps |
| `fixes26.mjs` | Pass, 22 checks (after the ad-form check was updated, see below) |
| `nightlife27.mjs` (street lighting, uses the dev server) | Pass, 19 checks |
| `models24.mjs` (monuments and models) | Pass |
| `place-names301.cjs` | Pass, 12 |
| `roads-power291.cjs` | Pass, 23 |
| `city23.mjs` | Pass |
| `missions30.cjs` | Pass, 24 |
| `checkpoint261.mjs` | Pass, 5 |

### Suites that fail the same way on the untouched v0.30.1

Five older suites fail. To check whether this build caused it, each one was also run on an unmodified copy of v0.30.1. **Every one fails there at the same step, with the same error and the same checks passing before it.** These are stale tests from earlier milestones, not regressions:

| Suite | Where it stops | Why |
|---|---|---|
| `vehicles25.mjs` | expects 6 map pins labelled "Car stand:", finds 0 | The dealerships were renamed with local names in v0.30.1 |
| `shoprite.mjs` | "all eight branded cars have buyable dealership spots" (12 checks pass first) | The branded stock changed in a later milestone |
| `phone18.mjs` | waits for a "Create an account →" button | That button came before the signup splash |
| `audit.mjs` | waits for the old `menu` state (27 checks pass first) | Same: it came before the signup splash |
| `city-polish.mjs` | waits for the old `menu` state after reload (19 checks pass first) | Same: it came before the signup splash |

Updating these to the current flow is worthwhile follow-up work. It was left out of this build so the fix stayed small.

## Test changes in this build

- `tests/e2e/smoke.mjs` was rewritten for the signup splash. It uses its own temporary data folder and never touches `server/data`.
- In `tests/e2e/fixes26.mjs`, the ad-form check now allows the one optional business-link field. It still requires that there is no headline, message or write-up text.

## Layout overlap audit

The HUD, phone/mail, weather and touch buttons were checked for overlaps at 844×390, 740×360, 915×412, 667×375, 390×844, 360×780, 1280×720 and 1100×640. No overlaps were found.

## Not verified

- Frame rate on real phones or real GPUs. The software-rendering numbers in UPDATE_30_2.md only compare before and after.
- The NPC distance culling and the vendor-chunk split were added after the last benchmark, so they aren't included in those numbers. Both are covered by the suites above.
