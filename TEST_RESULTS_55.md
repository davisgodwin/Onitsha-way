# Test results v0.55.0

- Unit tests: `node --test --test-concurrency=1 tests/*.test.mjs`: 419 / 419 passed (MariaDB test included). This
  includes the new tests/plan55.test.mjs:
  - replayed answers are the same as worked-out ones;
  - a plan file for another build or setting is refused;
  - a wrong plan is caught and the load starts again without it;
  - the flat wall store gives the same answers as before.
- `npm run bake`: recorded plan files: low 180 KB, medium 204 KB, high 226 KB.
- Same city as v0.54.4 on every setting. Full load in Chromium, compared with the v0.54.4 build on:
  - home listing ids and positions;
  - wall edges and shapes;
  - prop circles;
  - hidden buildings;
  - houses on empty land and in rows;
  - services;
  - scene objects.
  All identical on Low, Medium and High.
- Wrong plan file: a deliberately corrupted file (3,000 answers flipped) was caught by a spot check. The page
  reloaded once with `noplan` and built the correct city: 615,160 wall edges and 148,820 shapes on Medium. The
  graphics setting was not lowered.
- Load time on the test machine (2 CPUs, software graphics), v0.54.4 → v0.55:

  | Setting | v0.54.4 (s) | v0.55 (s) |
  |---|---|---|
  | Medium | 58.7 | 32.2 |
  | Low | 44.3 | 28.3 |
  | High | 49.5 | 42.3 |

  These timings vary from run to run on this machine.
- Memory after loading on Low (heap snapshot including shape buffers): 444 MB → 393 MB.
- e2e: production54 8/8, v53 10/10.
- Not tested: a real iPhone 8 (no device here).
- The real-time e2e tests (smoke, v50, mobile36) still don't run on this 2-CPU software-graphics machine, the same as
  v0.54.x.
