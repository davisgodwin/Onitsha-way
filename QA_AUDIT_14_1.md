# v0.14.1 audit verification

- 234 unit/rule regression tests passed.
- Production build, source syntax checks and asset/map validation passed.
- 247 browser assertions passed, plus six smoke-test milestones.

| Browser suite | Passed assertions |
| --- | ---: |
| m9 | 13 |
| m10 | 26 |
| wardrobe | 18 |
| lifestart | 22 |
| navigation | 16 |
| careers | 52 |
| city-polish | 23 |
| story | 30 |
| story-outcomes | 7 |
| audit | 30 |
| audit-services | 10 |

## Scope and method

Local headless Chromium with SwiftShader software rendering; desktop/mobile viewport checks and real pointer/keyboard/button events where stated in the tests. Qualified career fixtures supply test-only resources and positions; production play does not receive those grants. Weather is mocked for the live-weather branch. The clock fixture changes the test page's time only.

All twelve legal careers were completed through their staged public interaction/menu handlers. Checks also cover purchase and training requirements, hotel services, filling-station refuelling, save/Continue, starting-home charges, wardrobe, story pursuits/custody/outcomes, furniture, phone apps, direction marker and overlays. New defect-specific checks cover repeat repairs, fuel conservation, touch capture loss and malformed-import preservation.

Source review and tests cover confirmed defects, not every possible gameplay combination or device. Existing historical v14/older reports in qa/ are not counted again. Some browser suites ran earlier in patch development; the final real-clock HUD refinement was specifically rechecked in the final clock/weather/interior suite. The final audit save/Continue also loads the last production build.

## Test failures resolved during the audit

- A short M/Esc tap exposed a real map-dismissal bug, now fixed with queued input.
- A stale life-start test expected save version 11; the game already uses 12. Updated the assertion, then reran successfully.
- The new audit's reload predicate referenced the game before initialization; corrected the test wait and reran successfully.
- Software rendering exposed delayed paused-clock HUD refresh under capped simulation dt. The real minute/date key now refreshes on the next frame. The final clock suite passes. Browser screenshot/frame waits allow slow software rendering without altering normal gameplay speed.
- The optional smoke harness previously missed this machine's installed Chromium and skipped. Corrected executable discovery; the smoke test then actually ran and passed.

No browser/page or recovered frame errors were recorded in the completed reports. Zero reported errors is not a promise that all future sessions are bug-free.

## Packaging

Source archive includes the regression tests and v14.1 reports. Website archive contains the built static site at its root, including .htaccess, assets, map data, icons, manifest and updated service worker. Save format remains 12; export your save before updating, keep the same site address and do not clear browser storage. Read AUDIT_FIXES.md and START-HERE.txt.
