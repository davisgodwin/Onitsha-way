# ONITSHA WAY v0.32.0 — the city comes alive: pool, draughts, food, barbing, gaming, viewing, basketball, jogging, car wash, events

This build adds the rest of the activities brief on top of v0.31 football. Every activity is a real place in the city
(placed on road-fronting plots like the existing venues — no teleporting to another map), works with keyboard/mouse
and touch, uses the shared activity framework (pause, leave, return to the exact spot), and saves its results once.

## Safe upgrade
Export a save first. Extract into a fresh folder, copy your own `server/data` in, `npm ci`, `npm run dev`.
Save version stays **16** (added in v0.31); this build only adds optional fields (pool record, small game records,
car `dirt`). Older saves load with empty records. Do not reset saves.

## Where things are (all listed in the map's place directory)
| Place | Where | Hours (Onitsha time) |
|---|---|---|
| **Market Corner Pool & Draughts** | next to Market Corner Beer Parlour (Main Market) | 11am–11pm |
| **Mallam Sani's Suya Spot** | near Upper Iweka Motor Park | 4pm–midnight |
| **Roadside corn & ube** | near Onitsha Main Market | 9am–8pm |
| **Mama Chioma puff-puff & akara** | near Ochanja Market | 6am–1pm |
| **Mama Put · Bridgehead** | near Bridgehead | 10am–9pm |
| **Kingsway Barbing & Hair Salon** | near Ochanja | 8am–8pm |
| **Obi's Game Zone** (PS5/FIFA) | near Upper Iweka | 10am–10pm |
| **Iweka Viewing Centre** | near Upper Iweka Motor Park | noon–midnight |
| **CKC Community Court** (basketball) | near Christ the King College | 6am–9pm |
| **Stadium running track** | Chuba Ikpeazu Memorial Stadium | 5am–9pm |
| **Sparkle Car Wash** | Fegge | 8am–7pm |

## The activities
- **8-ball pool** — 7-ft table with real ball physics (collisions, cushions, friction, six pockets). Aim with A/D, ←/→
  or by dragging the mouse (Shift = fine), W/S power, Space to shoot, C to switch cue view/table view; a dotted guide
  shows the white ball's path, the ghost ball and the object ball's direction. Proper 8-ball rules (break, open table,
  solids/stripes, fouls with ball in hand, the 8 to finish; potting it early or with a foul loses). Three regulars
  (Easy/Normal/Hard) with a physics-tested AI. **Optional stake**: free, ₦200 (win ₦350) or ₦500 (win ₦900) — paid
  once when the game starts, paid out once on a win; leaving early forfeits (stated before you agree). Six achievements.
  Opponents remember your head-to-head ("You beat me last time…").
- **Draughts** — international 10×10 rules: men move forward and capture both ways, flying kings, compulsory maximum
  capture, crowning only at the end of a move, draw by 25 king moves or repetition. Tap a piece → highlighted squares
  (or arrows/WASD + Space). Papa Ifeanyi plays at Easy/Normal/Hard (alpha-beta search). Win earns Hustle XP.
- **Street food** — 11 items at four stalls with realistic prices; **eat here** (energy/hunger straight away) or
  **take away** (to your bag). Paid once per item; closed stalls can't sell; refused (without charging) when you're full or broke.
- **Barbing & hair salon** — every hairstyle the character system supports, priced per style; your new look shows
  immediately and is saved.
- **Obi's Game Zone** — ₦300 a match: console 5-a-side on the TV (the same football engine, drawn top-down), stadium controls,
  Easy/Normal/Hard. Record saved.
- **Iweka Viewing Centre** — ₦100 gate: sit with a full room watching a simulated league match between fictional sides
  on the big screen (clearly not a real broadcast). Goals make the room jump and cheer; banter from the crowd; **Z/Zoom**
  shows the screen full size. A full match lifts Fun and Social.
- **Basketball 60-second shootout** — six marked spots (2 and 3 points). Hold Space/Shoot, release in the green zone; the ball
  flies with real physics (rim, backboard, net). Best score saved; Fitness XP.
- **Jogging laps** — start at the RUNNING TRACK board in the stadium, run through the four orange gates in order (normal
  controls, Shift to run). Each lap is timed; 8 Fitness XP a lap (5 laps a day). Cutting across the pitch or impossible
  times don't count. Local joggers use the track 6–9am and 4–7pm.
- **Car wash** — owned cars now collect road dust as you drive (you can see it on the paint). Park near the bay and pay for an
  exterior wash (₦1,500) or wash & polish (₦3,500, dust builds half as fast for 3 days).

## Weekly events (real Onitsha calendar) and invitations
| Event | When | What changes |
|---|---|---|
| **Community 5-a-side Cup** | Saturday 10am–6pm | Cup matches at the stadium: ₦500 entry, **₦1,500 for a win**, up to 3 prize matches a day |
| **Street party** | Friday & Saturday 7–11pm | Speakers, DJ and lights at Market Corner, dancers on the forecourt, parlour music |
| **Sunday draughts challenge** | Sunday 2–6pm | Beat Papa Ifeanyi on Hard for **₦1,000** (once a day) |
| **Big match night** | Wednesday & Saturday 8–11pm | Top fixture at the viewing centre; extra Fun and Social |

Friends text you about each event on the day (phone messages, once per event). Events running now show on the map
("ON NOW"), you get a heads-up when you walk near one, and the pause screen lists **What's on today**.

## Money safety (all activities)
Every charge and payout goes through the existing economy with a unique key and is recorded against the activity's id,
so double taps, repeated events or a second "finish" can't charge or pay twice. Entry fees are shown before you agree.
Prize allowances are per day. Leaving early never pays out.

## Files
New: `src/activities/VenueKit.js`, `ParlourCorner.js`, `StreetServices.js`, `EntertainmentCentres.js`, `Jogging.js`,
`CarWash.js`, `CityEvents.js`, `pool/PoolGame.js`, `pool/PoolTable3D.js`, `pool/PoolActivity.js`,
`draughts/Draughts.js`, `draughts/DraughtsActivity.js`, `basketball/Basketball.js`, `basketball/BasketballCourt.js`,
`football/Pitch2D.js`; tests `tests/pool32.test.mjs`, `tests/draughts32.test.mjs`, `tests/activities32.test.mjs`,
`tests/e2e/activities32.mjs`.
Changed: `src/core/Game.js` (places, frame updates, pause "What's on"), `src/activities/ActivityManager.js` (HUD reset),
`ActivityRecords.js` (pool and small-game records), `activities.css`, `football/FootballActivity.js` & `StadiumFootball.js`
(cup matches), `src/audio/SportSounds.js` (pool clicks, pockets, arcade blips), `src/data/catalogue.js` (street food),
`src/vehicles/VehicleSystem.js` (dirt), `src/save/SaveSystem.js` & `validateSave.js`, `src/input/InputManager.js`
(mouse drag aims in activities), `package.json` (0.32.0, `test:activities`, `e2e:activities`), `public/sw.js`.

## Limitations (honest list)
- NPCs at the new places use the existing NPC system; in the very slow headless test browser they appear only after many
  frames, so screenshots may show empty benches. On a normal device they fill in as you approach (same as existing venues).
- The street party has no dance mini-game; you can join the crowd and the parlour plays music. The viewing centre shows a
  simulated match, not real football.
- Car dust is a colour/roughness tint on the paint, not a texture.
- Frame rate on real phones is not measured (software rendering here). The new places are small and use simple geometry;
  the viewing-centre screen redraws 5 times a second only when you're within 45 m.
- Conversations with existing NPCs don't yet mention your sports results (pool opponents do).
