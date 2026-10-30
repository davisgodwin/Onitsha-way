# v0.52.0 test results

Linux sandbox, headless Chromium (software rendering), MariaDB 10.11.

## Unit tests
`node --test --test-concurrency=1 tests/*.test.mjs` with MariaDB: **414 tests: 414 pass, 0 fail.**

`tests/cloudsave33.test.mjs` failed once while the browser tests were running at the same time: its wait for an autosave timed out on the busy machine. It passed on its own and in the final full run. That code wasn't changed in v0.52.

## Browser: `tests/e2e/v52.mjs`: 12 of 12
- **GRA**:
  - no dirt road left in either GRA (62 roads tarred, 26 of them changed from dirt);
  - roads that never enter GRA are unchanged;
  - both GRAs have their concrete ground.
- **Garages**: tested on 120 homes.
  - All of them got their garage at home: 55 carports inside the compound, 18 garages on the compound and 47 by the
    house.
  - All are within 45 m of the door, and every carport is inside its compound wall.
  - A stored car comes out into the carport.
- **Buy mode**:
  - on a computer, the side panel is 424 px wide and full height;
  - with an item selected, the list keeps 210 px and nothing overlaps, and the selected item shows its picture;
  - searching "sofa" shows 4 of 17 cards;
  - on a phone, the list keeps 190 px with an item selected, and there's no sideways scrolling.
- No page errors.

Screenshots: `qa/v52/`.

## Regressions, on the final build
`furniture37` 26/26 (Buy mode) · `decor48` 7/7 · `smoke` 8/8 · `mobile36` 29/29 · `v50` 23/23 · `v49` 19/19.

Not re-run: `together44`. It was unreliable in v0.51 (see TEST_RESULTS_51.md), and v0.52 doesn't touch online play.
