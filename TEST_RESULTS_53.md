# v0.53.0 test results

- **Unit tests**: `node --test --test-concurrency=1 tests/*.test.mjs` with MariaDB: 414 pass, 0 fail.
- **`tests/e2e/v53.mjs`**: 10 of 10.
  - GRA homes: 44 listings in Phase I and 58 in Phase II; one rented.
  - Filling station: three staff; in 2 minutes, 5–6 cars served, with stops, refuelling and leaving.
  - Gates: 22,518 sliding gates; a gate opens as you come up to it and closes when you leave.
  - Kiosks: 651 removed from entrances, none left in front of a gate.
  - Furniture: a TV can be put overlapping a sofa, and it stays there after leaving and coming back. Outside the
    home is still refused.
  - No page errors.
- **Regressions**: `furniture37` 26/26 · `decor48` 7/7 · `smoke` 8/8 · `v52` 12/12.
  - `mobile36` was stopped before it finished, so it wasn't run for v0.53.
  - Except `v52`, these ran before the kiosk fix was added.
- **Screenshots**: `qa/v53/` (fuel station, open gate).
