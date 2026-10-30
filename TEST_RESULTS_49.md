# v0.49.0 test results

Linux sandbox, Node 22, headless Chromium with software rendering (SwiftShader), MariaDB 10.11. **No real phone, no
second machine and no Windows/XAMPP**: LAUNCH_CHECKLIST.md lists those checks, which you have to do yourself.

## Unit, server and integration tests
`node --test --test-concurrency=1 tests/*.test.mjs` with MariaDB running: **409 tests: 409 pass, 0 fail, 0 skipped.**

New: `tests/v49.test.mjs` (4 tests):
- the traffic-light timing (the two directions of a junction are never moving together; green turns amber before red);
- a driver gets the light of the junction ahead and none elsewhere;
- the play area's fast lookup agrees with the exact one;
- the "keep clear" points (doors, counters, people, cars for sale) used when the city is filled.

## In the real game (browser), on the final v0.49 build
`tests/e2e/v49.mjs`: **19 of 19**.
- **The city:**
  - 7,000 new houses on the low setting, every one in a walled compound with a gate;
  - every house on empty land is walled;
  - in a row every house stands exactly the same distance back from the street (3,000 of 3,000 checked);
  - about 3,100 other houses and small businesses got walls and gates.
- **No house under a bridge deck or flyover:** the three at the Niger Bridge ramp are gone.
- **COMING SOON:** 51 gantries and 18 billboards.
- **More places:**
  - 9 filling stations, 7 hotels, 10 bars, 5 clubs, 8 eateries, 6 recreation centres, 8 mini pitches, 5 markets,
    8 schools, 10 churches, 5 police stations and 2 showrooms;
  - the fuel desk, the school, the church and the pitch were each used;
  - 160 more homes, one rented.
- **Traffic:**
  - lights at 208 junctions and wardens at 12;
  - a driver at a red light is told to stop;
  - in 2 simulated minutes at Upper Iweka, with 75 vehicles, there were 0 vehicles inside one another and 0 crashes.
    The same run without the v0.49 traffic changes had dozens of bumps.
- **The map:**
  - GRA Phase I named, and the area chip reads "GRA Phase I · Onitsha North";
  - 10 chips, and a chip shows only its kind of place;
  - search finds "church" places, and choosing a result marks it;
  - the key;
  - it fits a 390 × 844 phone.
- **No page errors.**

Screenshots are in `qa/v49/`:
- the map: default, GRA, close up, the whole city, search, the Food filter, the key, the phone;
- the city: a filled street, GRA rows;
- COMING SOON: a gantry;
- traffic: lights, a warden;
- new places: a school, a church, a recreation centre.

### Regressions, on the final build
- **v0.48 suites:** `soon48` 10/10 · `districts48` 9/9 · `terminals48` 7/7 · `stops48` 4/4 · `vehicles48` 8/8 ·
  `football48` 5/5 · `decor48` 7/7 · `mapext48` 13/13 (old map against new: every home, resident, shop and place of v0.48 kept).
- **Earlier suites:** `smoke` 8/8 · `mobile36` 29/29 · `vehicles25` pass · `fixes262` 14/14 · `nightlife27` 19/19 ·
  `ventures47` 16/16 · `entry` 15/15 · `interiors44` 12/12 · `furniture37` 26/26.
- **Two players on the real server:** `together44` 10/10.
- **Updated expectations:**
  - `vehicles25`: 278 cars for sale (the two new showrooms add 27);
  - `mapext48`: compares the homes the two maps share, since v0.49's extra homes are picked on the map as it is now;
    it also allows for the houses at the bridge.

### Performance (test browser, 390 × 844 phone size, low quality)
| | v0.48 | v0.49 |
|---|---|---|
| Triangles drawn at the start | 391,000 | 487,000 |
| Triangles drawn in the main market | 300,000 | 363,000 |
| Triangles drawn in GRA | 307,000 | 356,000 |
| JS memory | about 510 MB | about 650 MB |
| Load time (software rendering, so slow) | 75 s | 80 s |

On the way, the traffic lights alone drew 290,000 triangles, because every one in the city was drawn. Now only the
ones near you are drawn (about 1,000 triangles).

In the first full round, `mobile36` failed one step: a home card was still open on the phone when the test tapped
"Invite". Run again on the final build, it passed 29/29. `v49` and `soon48` were run again after the last change (the
COMING SOON names), and passed.

## Found and fixed during testing
- **Lots:** the plots near bridge decks weren't checked (decks are left out of road checks), so three new houses
  stood under a flyover. Plots now keep clear of decks.
- **Awada:** gantries were naming roads "towards Awada", but in the OpenStreetMap boundaries Awada is inside
  Onitsha North, so it is open. It is no longer a COMING SOON name.
- **The police pins:** on the map, the police divisions showed as an unknown kind ("police-0"). They're police now,
  and the phone's "Join the police" list shows one entry, not six.
- **The Prestige Autos showroom** wasn't updated each frame in v0.48: its turntables didn't turn and it was drawn
  from across the city. Now it is.

## Not tested
- A real phone, two real machines, XAMPP on Windows (see LAUNCH_CHECKLIST.md).
- Weeks of real-time play.
