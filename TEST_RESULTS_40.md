# v0.40.0 test results

Linux sandbox, Node 22, headless Chromium with software rendering (SwiftShader), 2 CPUs. **No real phone.**
Built and tested single-player, as agreed for stages 1–3.

## Unit tests
`node --test --test-concurrency=1 tests/*.test.mjs`: **301 tests: 300 pass, 1 skipped, 0 fail** (includes the 12 new below).

New: `tests/life40.test.mjs` (12 tests):
- a new life has no job, an empty record and no career; save version 18;
- every job has a rank ladder, pay, a skill and a real dilemma; children only get child roles; crime is not a career;
- applying needs the skill, the tools and a clean police record; taking a new job resigns the old one; resigning works;
- shifts only in opening hours, at most two a day, not when exhausted or hungry;
- pay rises with rank and quality; promotion needs shifts, days in the job, skill and professional standing (none of
  these alone is enough);
- the dilemma: honesty builds integrity, the shortcut pays more when unnoticed, three caught shortcuts mean
  dismissal, the same employer refuses you for 7 days, other employers still hire;
- self-employment: you become known for work you do, and rise by doing it;
- reputation: each event counts once; a rumour moves public opinion by half and nothing else; bad feeling fades
  after quiet days; values stay within their ranges;
- reputation words (Feared vs Disliked, Controversial, Corrupt, Infamous; wealth tiers); integrity and notoriety are
  not in what others see;
- legal record: entries recorded once; status separates custody, wanted, fines, open cases and a clean record;
- old saves: the career becomes the current job, money unchanged, past trader jobs / keke trips / wholesale count,
  story trust/heat seed reputation, fines and wanted go on the record, the story contract and mission tracker are
  cleared, migrating twice changes nothing, an old "illegal career" becomes no job;
- shift pay goes through the wallet's unique keys, so it can never be paid twice.

Updated: the save-version checks in `buy`, `football31`, `place-names301` (17 → 18).
Retired (in `tests/retired/`, with a README): `missions30` (Find Your Friend), `story.mjs`, `story-outcomes.mjs`,
`careers.mjs` (the removed story chapters and career boards).

## Browser end-to-end
| Suite | Result |
|---|---|
| `life40.mjs` (new) | **19/19**: no career field in creation, a new life has no job; the welcome message no longer mentions Find Your Friend; the phone has Profile and no "Story & careers"; Profile shows work, 7 reputation dimensions, record and history; the workplace offers jobs with their pay; applying hires you at the starting rank; a shift pays once and builds professional standing; the third shift brings the dilemma with the real choices; honesty raises integrity; the workplace shows what the next promotion needs; resigning works and is recorded; a trader job makes you an errand runner (counted once); a fine and custody go on the record and the status reads "In custody"; employers refuse you while in custody; bail releases you and stays on the record; Profile lists all of it; Profile fits a 390 px phone with no sideways scroll; an old v17 save keeps its career as a job and its money and loses the old contract; no page errors |
| `entry.mjs` | Pass, 15 (character creation without the career pick) |
| `smoke.mjs` | Pass, 8 |
| `fixes26.mjs` (dev) | Pass, 22 (chases and custody still work) |
| `nightlife27.mjs` (dev) | Pass, 19 |
| `place-names301.cjs` | Pass, 12 (mission check updated: the mission state stays in the save) |
| `football31.mjs` | Pass, 26 |
| `furniture37.mjs` | Pass, 26 |
| `m10.mjs` | Pass, 26 |
| `shoprite.mjs` | Pass, 88 |
| `phone18.mjs` | Pass, 20 |
| `skills272.cjs` | **Fails, already broken before this update**: it waits for a `#preview-tools` element that no longer exists anywhere in the game; it was not part of the v0.37–v0.39 runs either. |

Not re-run this time (nothing they test changed): buildings38, update39, activities32, lan35, cloudsave33, mobile36,
vehicles25, models24, roads-power291.

## Screenshots
`qa/v40/`: Profile for a new life, the workplace menu, the on-the-job dilemma, Profile after work and custody,
Profile on a phone-sized screen.

## Not verified
- A real phone.
- Long play: how fast promotions feel over real days (shifts use the real Onitsha clock), and pay balance against
  trader jobs and the keke; stage 8 is set aside for balancing.
