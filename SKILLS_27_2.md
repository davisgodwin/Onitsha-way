# Skill progression audit — v0.27.2

## Fixed
- Phone practice now shares the existing saved, 20-second active-play training cooldown with workplace training. Menu time cannot advance the cooldown. Each successful phone exercise still applies 30 simulated minutes of needs effort, without skipping real WAT time.
- Comedy gigs now require Comedy level 2, not Charisma level 2; payouts and XP use Comedy consistently.
- Level crossings publish a skill:level-up event and show a HUD toast; phone practice also includes level-up feedback in the phone notice.
- Skills show total XP, the next threshold and remaining XP; level 10 displays Mastered instead of progress toward a nonexistent level 11.
- Skill awards reject inherited object names as well as invalid XP amounts. Last-session feedback reports the actual capped XP gain.

## Verified
- All nine skills: all 81 level boundaries (levels 2–10), one XP below and exactly at each threshold.
- Thresholds remain 0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500 XP for levels 1–10. No curve rebalance.
- All 12 legal career qualification rules, including tools and skill requirements.
- 187 automated regression tests passed, including ten new skill-focused cases. Some existing test files contain additional internal assertions.
- 20 mobile-layout browser checks passed: phone XP/feedback, cooldowns, low-energy restriction, mastery, correct/incorrect workshop answers, comedy gating/rewards, actual stove cooking and ingredient consumption, cancelled/completed dancing, save/Continue after full reload, cooldown persistence and no recovered frame errors.
- Browser tests used headless Chromium with touch emulation and controlled game-time updates, not physical-phone performance measurements.
- Production build and asset/size validation passed.

## Limits and next steps
- The static phone preview uses ?quickstart and deliberately starts a new demo on refresh. Persistence testing explicitly used Save/Continue; the preview is not a cloud-save implementation.
- XP, wallet and progression still live in client-controlled local saves. Cooldowns are gameplay guards, not anti-cheat security. A backend must validate accepted actions, rewards, requirements and duplicate requests.
- No new account, database, payment or public multiplayer services were deployed in this update.
- Before wider testing: stable HTTPS hosting, physical Android/iPhone checks, a short onboarding loop, and a documented save-to-server migration/backup plan. Defer more large gameplay features until the core loop and backend are stable.

## Re-running checks
- node --test tests/*.test.mjs
- npm run build && node scripts/validate.mjs
- With the static phone preview running: node tests/e2e/skills272.cjs (GAME_TEST_URL may override the local preview URL).
