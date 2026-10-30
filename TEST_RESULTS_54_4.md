# Test results v0.54.4

- Unit tests: `node --test --test-concurrency=1 tests/*.test.mjs`: 414 / 414 passed.
- `vite build`: OK.
- Layout fingerprint, v0.54.3 vs v0.54.4 (full load in Chromium, phone-sized window): identical listing ids and positions
  (389), collision edges (615,160) and shapes (148,820), scene children (341), and the services hash.
- River point test: the banded check compared with the old full-polygon check on 420,706 random and vertex points:
  0 differences.
- Load time on the test machine: 58.7 s → 48.4 s.
- Not run on a real iPhone 8: we have no device here.
- Real-time e2e tests (smoke, v50, mobile36) don't run on this 2-CPU test machine (software graphics at about 0.5 fps).
  v0.50 fails them the same way here.
