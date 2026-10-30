# Real-time correction — v0.10.1

This hotfix supersedes the time/weather defaults and clock controls described in MILESTONE_10.md.

- Normal play always follows the device clock in Africa/Lagos (WAT, UTC+1), including when paused. Real 4:22 pm is displayed as **16:22 WAT**, not the old simulated 09:22.
- Previous saved Game time / Fast preferences are overridden and corrected settings persisted. The accelerated-time selector has been removed from Settings so it cannot accidentally take over normal play.
- The pause screen and HUD show the actual date. Fictional “day 1” / “mid October” progression labels have been removed from the user interface. Internal day counters still exist for rent, jobs and daily rewards; they are not displayed as a fictional calendar.
- Pause-screen time refreshes while paused. Sleeping/travel still apply gameplay effects without advancing the real wall clock.
- Simulated weather is now the default, including on first upgrade from M10. It makes no weather API requests and needs no subscription. Optional live weather remains an explicit Settings opt-in with the original provider restrictions.
- Save format remains 9. Export your existing save before upgrading; no new game is required. Continue your game after loading the replacement build.
- A new service-worker cache version and hashed assets distinguish this build from the old one. On a hosted site, replace the old website files with this package and reload online. Never clear site data without exporting your save first.

## Installation
Extract the website ZIP and follow START-HERE.txt. Do not open index.html as file://.
For development, use npm ci and npm run check. Source ZIP includes the production files in public/, not a node_modules folder.

## Device clock
No API, internet time service or paid provider is used for time. The device's automatic date/time must be correct. WAT is always UTC+1; players outside Nigeria may see a different time from their own local clock.

## Verified
131 unit/regression tests, 39 browser checks, production build and static validation passed. Browser coverage includes legacy accelerated settings, an exact 16:22 WAT case, minute-by-minute progression while paused, offline weather defaults and Continue from an existing save. Weather opt-in tests use controlled provider responses. Real-device browser certification is not included.
