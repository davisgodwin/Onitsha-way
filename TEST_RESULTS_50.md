# v0.50.0 test results

Linux sandbox, Node 22, headless Chromium with software rendering (SwiftShader), MariaDB 10.11. **No real phone, no
second machine, no Windows/XAMPP, and no one listened to the music**: see the notes at the end.

## Unit, server and integration tests
`node --test --test-concurrency=1 tests/*.test.mjs` with MariaDB running: **412 tests: 412 pass, 0 fail.**

New: `tests/v50.test.mjs` (3 tests):
- where the GRA gateways go on the real map;
- the seven TV channels;
- the two club mixes are real MP3 files of several MB, and the custom-music README is there.

## In the real game (browser), on the final build
`tests/e2e/v50.mjs`: **23 of 23.**

**GRA**
- 4 WELCOME TO GRA arches, on roads into both GRA Phase I and Phase II.
- Every arch stands inside GRA, and all four are on the map.

**TV**
- A switched-on TV offers all seven channels.
- The screen of the TV in the room shows the programme.
- Each channel opens the big view with a drawn picture (58–238 different colours on the canvas).
- Watching to the end closes the view, moves the clock on and raises fun.
- *Stop watching* works.
- The view fits a 390 × 844 phone.

**The club**
- 38 people: 20 dancers, 5 VIP guests, 4 at the bar, the DJ, the hype man, 2 bar staff, 3 waitresses and 2 bouncers.
- The room is merged from 199 meshes to 47.
- All six spots answer (DJ, dance floor, bar, VIP, bathroom, exit). In v0.49, four of them didn't.
- The playlist starts with the two mixes, and both are served.
- **Request a song**: the ₦5,000 tip makes the amapiano mixtape play, with a shout-out on the LED wall.
- **Spray**: ₦50,000 leaves the wallet, the notes fly and land on the floor, and the crowd hypes.
- **Dorime**: ₦30,000 is paid and the waitresses walk over 10 m to the table with two bottles and sparklers.
  "DORIME" goes up on the wall, and afterwards the waitresses go back and the sparklers go out.
- Without money, spraying and Dorime are greyed out.
- The DJ menu fits a phone.
- A child character still can't get in.
- No page errors.

Screenshots in `qa/v50/`:
- GRA: `gra-welcome`, `gra-welcome-phase2`;
- TV: `tv-in-room`, one per channel (`tv-nollywood` … `tv-cartoon`), `tv-mobile`;
- the club: `club-floor`, `club-dj`, `club-bar-vip`, `club-vip`, `club-spray`, `club-notes-floor`, `club-dorime`,
  `club-dj-mobile`.

### Regressions
- `smoke` 8/8 · `mobile36` 29/29 · `nightlife27` 19/19 · `interiors44` 12/12 · `furniture37` 26/26 · `v49` 19/19.
- `decor48` 7/7 · `fixes262` 14/14 · `ventures47` 16/16 · `entry` 15/15.

## Found and fixed during testing
- **nightlife27**: in the first round it failed because the bar-music test reads the decoded track, which the new
  streaming code no longer exposed. The track is exposed again, and the suite passes 19/19.
- **The TV view** closed by itself when the player drifted a few centimetres while standing still. Now it only
  stops if you actually walk away.
- **The news ticker** ran over its "BREAKING" label; it is clipped now.

## Not tested
- **The music by ear.** The two mixes were made by a script and checked by measurement only: loudness, frequency
  balance (the first version had too much hiss, which I fixed), and the files decode. Please listen to them.
- **Performance of the new club on a real phone.** The room is merged into 47 meshes, and the 38 people are the
  same animated figures used in the city. In the browser test it ran without problems, but a low-end phone may
  slow down inside.
- A real phone, two machines, XAMPP on Windows (LAUNCH_CHECKLIST.md).
