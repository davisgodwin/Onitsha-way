# v0.30.0 — executed tests and verification limits

## Actual results

| Check executed | Result |
| --- | --- |
| Unmodified v0.29.1 baseline: `node --test tests/*.test.mjs` | 217 tests passed, 0 failed. |
| v0.30.0 full regression suite: `node --test tests/*.test.mjs` | **230 tests passed, 0 failed**, including all 13 new mission tests. No skipped/cancelled tests. |
| New mission test alone: `node --test tests/missions30.test.mjs` | **13 passed, 0 failed**. |
| Mission browser playthrough: `node tests/e2e/missions30.cjs` | **24 checks passed**, desktop 1280×800 plus touch-enabled 390×844; no captured page/game-frame exceptions. |
| Existing v0.29.1 regression: `node tests/e2e/roads-power291.cjs` | **23 checks passed**, no captured page/game-frame exceptions. |
| `npm run build` | Passed. Vite emitted its large-chunk warning (bundle over its 1200 kB advisory threshold); no build error. No new dependency or code-splitting framework was added. |
| `node scripts/validate.mjs` | Passed: JS 1477 KB and CSS 89 KB within the project's budgets; map, referenced output and 34 GLB models validated. |
| `node --check` on modified core/jobs/save/UI modules | Passed; production bundling also resolved imports. |
| Focused diff against delivered v0.29.1 ZIP | Reviewed. No assets, map data, player controller, cameras, existing wallet/inventory transaction implementation or backend service files were replaced. |

An early new test expected housing defaults without the pre-existing `upgrades` migration field. That test expectation failed, was corrected to match existing migration behaviour, then all 13 new tests and the full 230-test suite passed. No housing code was changed to satisfy it.

Raw results are included in `release-tests/`. Browser runs used local Vite preview, Linux headless Chromium and software WebGL. In this environment the browser commands used `PLAYWRIGHT_MODULE=/vercel/sandbox/node_modules/playwright`; portable harnesses also accept `CHROMIUM_PATH`. Playwright is a QA prerequisite, not a new game dependency.

## What the new tests actually exercised

- Deterministic bindings to existing, reachable residents; no mission NPC clones; registering the interaction repeatedly does not add duplicates.
- AVAILABLE journal provides navigation but cannot remotely accept or claim.
- Actual source NPC prompt and E key open the real dialogue graph.
- Acceptance requires the correct source, live dialogue session/node, active NPC, city scene and proximity. No money on acceptance.
- Wrong NPC, closed hours, a remote player, an interior, generic greeting and mere arrival do not satisfy completion.
- A correct welcome branch advances the first objective; its acknowledged conversation completes the second.
- Exactly ₦500 is paid via the existing Economy transaction service; completion and claim remain saved.
- Continuing from saved ACTIVE and COMPLETED states preserves progress/bindings, prevents a fresh offer and does not pay again.
- A saved partial welcome needs a fresh in-world conversation session after restoration.
- Permanent receipt blocks another payout after 605 subsequent transactions prune the wallet's old processed-key history.
- Malformed progress, bindings, receipt/status consistency and tracking are rejected before load/import.
- Simulated localStorage quota failure leaves the prior persisted snapshot intact, prevents in-session replay and later persists wallet plus receipt together when storage succeeds.
- Existing daily-job slots remain separate. Existing insufficient-funds wallet rule still blocks overspending.
- Touch-enabled journal navigation, actual contextual touch interaction, offer/acceptance and welcome/completion all execute using the real mobile controls and dialogue responses.
- Desktop keyboard movement and camera turning still work. The responsive journal has no horizontal overflow at 390px.

## What the retained-feature playthrough actually exercised

All 200 billboard envelopes were checked against world buildings and later venues; all faced their associated road squarely. House access remained clear and decorative housing remained. Real home/inverter interactions, blackout lighting, backup disable/enable, TV light, fan rotor, radio audio, empty battery, washer electricity gating/activity, grid recharge, power-save restoration, mobile appliance controls, phone access and outdoor generator refuelling/start were exercised. The empty generator remained unable to start.

## Limits — not claimed as verified

- Browser tests use QA teleports to shorten travel, then the actual collision-safe approach, pooled NPC spawning, registered interaction, input and dialogue flow. They do not prove an uninterrupted player-driven walk along every route in the city.
- “Reload” in the automated mission playthrough uses the game's actual Continue/save-load path and storage restoration; a complete browser process restart should also be checked manually.
- Touch tests use browser touch emulation, not a physical Android/iOS device. Safari, Firefox, real phones, installed-PWA upgrades, accessibility audits and extended performance/soak testing were not executed.
- No claim that every existing feature has exhaustive browser coverage: the full automated regression suite and the focused mission/billboard/appliance playthroughs are the evidence provided.
- Local single-player mission/wallet state is not server-authoritative or protected against deliberate devtools/save editing.
- Missions 2–5 are not implemented and were not tested as new scripted missions. Existing underlying shop/job/housing tests passing does not imply those mission integrations exist.

## Manual acceptance checklist

- [ ] Export a real v0.29.1 save, update without clearing storage, Continue under the same account/address; inspect wallet, bag, rentals, cars and existing jobs.
- [ ] Use the normal J menu and phone journal (not QA tools) to find/accept the source offer.
- [ ] Walk/run or use existing transport to the correct friend; confirm controls, road guidance, marker and nearby NPC visuals remain natural. Try a wrong NPC first.
- [ ] Visit outside the friend's hours: no objective/reward; return during the displayed visiting hours.
- [ ] Stop after acceptance and after finding the friend; close/reopen the browser and verify progress at each point.
- [ ] Complete the welcome once. Confirm +₦500, COMPLETED, no mission marker, then try talking again and restarting the browser. No second payment.
- [ ] Place a manual map waypoint while following the mission; check it takes route priority. Explicitly follow the mission again to switch back. Follow a daily job to switch away without losing mission progress.
- [ ] On physical mobile, use joystick/look/run/jump, contextual talk, dialogue and phone journal in portrait/landscape; inspect long text and scrolling.
- [ ] Run existing shop, housing/rent, career, driving and NPC interactions from a real progressed save; verify no unexpected charge on loading.

## Re-run

```sh
npm ci
npm run test:all
npm run test:missions
npm run build
npm run validate
```

With a separately available Playwright/Chromium QA setup:

```sh
npm run e2e:missions
npm run e2e:roads-power291
```

The two browser scripts start/stop their own preview servers (ports 4300 and 4291), use fresh temporary browser profiles and write `.qa/` reports/screenshots. They do not operate on your regular browser saves or account database. Build first. Do not run them on an already occupied preview port.
