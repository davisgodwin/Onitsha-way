# ONITSHA WAY v0.31.0: 5-a-side football at the stadium

This is the first stage of the activities expansion: a shared activity framework, plus a playable 5-a-side football match inside the existing **Chuba Ikpeazu Memorial Stadium**. The stadium has not been copied or moved. The match is played on a marked 40 × 25 m pitch across the half nearest the main entrance.

## Safe upgrade

1. Go to Settings > Export save first.
2. Extract this build into a fresh folder, then copy your own `server/data` folder into it.
3. Run `npm ci`, then `npm run dev`. Use the same browser, account and `localhost` address as before.
4. Saves move from version 15 to **version 16**. Your existing save gains an empty football record and nothing else changes. Your wallet, missions, homes and vehicles are untouched. Do not reset saves.

## How to play

1. Go to the stadium. It is listed on the map as **5-a-side football · Chuba Ikpeazu Memorial Stadium**.
2. Walk to the green **5-A-SIDE · FRIENDLIES** board on the touchline and press **E** (or tap **Use** on a phone).
3. Pick your opponents, difficulty and match length, then press **Kick off**.

| | Desktop | Phone |
|---|---|---|
| Move | WASD / arrow keys (right = right of the screen, up = away from you) | Joystick (left side) |
| Sprint | Hold Shift (uses stamina) | **Sprint** toggle, or push the joystick all the way |
| Pass | Space or left click. Passes to the team-mate in the direction you are pushing. Without the ball, it calls for a pass. | **Pass** |
| Shoot | Hold **F** to charge, release to shoot where you are heading | Hold **Shoot**, release |
| Tackle | **E** when an opponent has the ball. Tackles from behind can give away a free kick. | **Tackle** |
| Pause | Esc, P or ❚❚ | ❚❚ |

You start each match with the kick-off. When it's your restart (kick-in, corner or free kick), the prompt shows on screen. If you wait 8 seconds, a team-mate takes it.

## What the match includes

- **Teams and players:**
  - You against a local side, 5 players each including goalkeepers. Your four team-mates and all five opponents are AI.
  - The AI players hold positions, press, cover, chase loose balls, intercept, pass into space, dribble around opponents and shoot.
  - Keepers position themselves, read shots, dive, catch, parry and distribute.
- **Ball:** real ball physics, with rolling friction, bounces, a lofted shot arc, the posts and crossbar, and nets.
- **Rules:**
  - A goal counts only when the whole ball crosses the line between the posts and under the bar.
  - Kick-ins, corners, goal kicks and fouls (free kicks) are all played.
  - Teams switch ends at half-time.
- **Match flow:** kick-off, two halves with a clock, a half-time screen with stats, then full time with the result, stats, your goals, assists and tackles, and a rematch option.
- **Stadium atmosphere:**
  - a pitch-side scoreboard showing the live score and clock;
  - spectators in the nearest stands, who jump on goals;
  - a referee who follows play;
  - floodlights for evening matches.
- **Sounds:** whistle, kicks, bounces, a clang off the post, crowd murmur, cheers and groans. They are generated in code, so there are no audio files and no licensing questions.
- **Difficulty:** Easy, Normal and Hard change the AI's speed, tackling, keeper skill, decision speed and shooting range.
- **Length:** 2 × 2, 2 × 3 or 2 × 5 minutes.

## Rewards and fairness

- **No money:** friendlies cost nothing to enter and pay nothing.
- **What you earn:**
  - **+25 Fitness XP** for a full match, +5 per goal (up to 3 goals) and +5 for a win;
  - a **football standing** that goes from Newcomer to Weekend baller, Known on the pitch, Local star and finally Stadium legend;
  - **eight achievements**: First kick, Winner, Off the mark, Hat-trick, Clean sheet, Playmaker, Stadium regular and Giant killer.
- **Needs:** a match tires you (Energy −18, Hunger −10, Hygiene −15) and lifts Fun and Social.
- **To play** you need Energy of at least 20 and Hunger of at least 15. The pitch is open 6am–10pm Onitsha time.
- **Each match is recorded once.** Every match has its own ID in the save, and a finished match is rewarded exactly once.
  - **Leave** (from pause) ends the match with no result and no reward.
  - If the page or app closes mid-match, the next load records it as "left early", and you are back on the touchline.

## For later activities: the shared activity framework

`src/activities/ActivityManager.js` handles everything activities have in common:

- They start only from normal walking play, not while driving, riding, indoors, in custody or in a chase.
- The game uses a dedicated `activity` state. The city keeps running, but walking shortcuts (map, bag, phone…) and pointer lock are off.
- There is one HUD for every activity: score bar, status line, power and stamina meters, controls hint, touch buttons, and a shared panel for pause, half-time and results.
- Pause works from Esc, P or ❚❚, and also when you switch tabs (which saves too).
- Leaving puts you back exactly where you stood, with camera, controls and HUD restored.

Pool, board games and basketball can use the same framework without duplicating any of this.

## Changed and new files

**New:**
- `src/activities/ActivityManager.js`, `src/activities/ActivityRecords.js`, `src/activities/activities.css`
- `src/activities/football/FootballMatch.js`: the rules, ball physics and AI. It contains no Three.js, so it can be unit-tested.
- `src/activities/football/FootballActivity.js`: the 3D match, camera, crowd, floodlights, HUD and sounds.
- `src/activities/football/StadiumFootball.js`: pitch markings, goals, board, scoreboard, the pre-match menu and the map place.
- `src/audio/SportSounds.js`
- `tests/football31.test.mjs` (13 tests) and `tests/e2e/football31.mjs` (26 browser checks)

**Changed:**
- `src/core/Game.js`: the `activity` state, focus, save position, the abandoned-match check on load and the map place
- `src/save/SaveSystem.js` and `src/save/validateSave.js`: save version 16
- `src/input/InputManager.js` (mouse button as a game action in activities) and `src/input/TouchControls.js` (activity mode)
- `src/ui/UIManager.js` and `index.html`: the activity screen
- `scripts/validate.mjs`: CSS budget raised from 90 kB to 100 kB for the activity HUD
- `tests/place-names301.test.mjs`: the pinned schema version is now 16
- Older browser tests: `audit`, `city-polish`, `shoprite` and `phone18` now follow the signup splash; `vehicles25` counts dealership pins by kind. See TEST_RESULTS_31.md.
- `package.json` (0.31.0, `test:football` and `e2e:football` scripts), `public/sw.js` cache name

## Limitations

- **Animation:** there are no motion-capture clips. Kicks, tackles, dives, the keeper holding the ball and celebrations are poses added in code on top of the existing run cycle. It plays correctly, but it is not console-game animation.
- **Your player:** you control one player and cannot switch to team-mates.
- **Balance:** checked in simulation only. About 5–6 goals per AI-vs-AI match across both halves. A human player who presses and shoots well can win comfortably on Normal; Hard is tougher. Feedback from real play will tune it.
- **Performance:** frame rate on real phones and GPUs has not been measured, because testing used software rendering. The match adds 11 animated players, a low-cost crowd of about 260 simple figures (two draw calls) and, at night, two spotlights.
- **Pitch:** the 5-a-side lines are drawn on top of the full-size pitch markings, like a multi-use pitch.
- **Not in this build:**
  - paid competitions or entry fees;
  - neighbourhood street pitches;
  - pool and the other planned activities.

  These are later stages, and the framework is ready for them.
