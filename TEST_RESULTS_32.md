# v0.32.0 test results

Run headless Chromium with software rendering (SwiftShader), Node 22. No real phone/GPU.

## Unit, layout, build
| Command | Result |
|---|---|
| `npm run check` | **Pass** — 283 tests, 7/7 layout, build, build validation |
| `npm run test:all` | **Pass — 272/272** (includes the new pool, draughts and activities tests) |
| `npm run test:activities` | **Pass** — pool 9, draughts 7, activities 7 |

New unit tests cover:
- **Pool** (`tests/pool32.test.mjs`): rack layout and kitchen; straight pots and group assignment; balls never leave the bed
  un-potted and always settle; scratch → ball in hand; wrong-ball-first and no-cushion fouls; 8 early loses, 8 after
  clearing wins, scratching on the 8 loses; 8 on the break re-spotted; AI plays full racks to a legal finish at every level.
- **Draughts** (`tests/draughts32.test.mjs`): opening moves; compulsory and maximum capture; backward captures by men;
  flying kings; no double jumps; crowning only at the end of a move; game end; AI games finish; illegal moves refused.
- **Activities** (`tests/activities32.test.mjs`): every basketball spot has a scoring release and misses when far off;
  ball never passes through the board; shootout scoring and timer; the jogging lap is continuous and gates must be in
  order; street food pays once, eat-here vs take-away, refuses when full/broke without charging; car wash pays once and
  clears dust, polish expiry; pool/small-game records once only, abandoned counts, v16 save repair; events: weekday
  schedule, one invitation per event per day, prize cap per day, the same prize key never pays twice.

## Browser end-to-end — all 16 suites pass
| Suite | Result |
|---|---|
| `activities32.mjs` (new) | **44/44** — all places placed and on the map; pool with a ₦200 stake (taken once; payout only on a win; a second finish can't pay), A/D aim, Space break; draughts tap-to-move with legal destinations only and an AI reply, result recorded, board removed after leaving; suya bought and eaten (paid once, needs up) and closed in the morning; haircut saved; game zone fee and Space pass on the console; viewing centre fee and Z zoom; basketball hold/release shot, perfect release scores from every spot, best saved; jogging lap timed with Fitness XP and cutting across the pitch voids the lap; car wash pays once and clears dust; Saturday cup on, one phone invitation, ₦500 entry and ₦1,500 prize paid once; street party appears on party night; pause screen "What's on today"; phone: hold ▶ aims, buttons fit without overlap, draughts board fits; no page errors |
| `football31.mjs` | Pass, 26 |
| `smoke.mjs` | Pass, 8 steps |
| `fixes26.mjs` | Pass, 22 |
| `nightlife27.mjs` | Pass, 19 |
| `models24.mjs` | Pass |
| `vehicles25.mjs` | Pass |
| `place-names301.cjs` | Pass, 12 |
| `roads-power291.cjs` | Pass, 23 |
| `city23.mjs` | Pass |
| `missions30.cjs` | Pass, 24 |
| `checkpoint261.mjs` | Pass, 5 |
| `audit.mjs` | Pass, 30 |
| `city-polish.mjs` | Pass, 23 |
| `phone18.mjs` | Pass, 20 |
| `shoprite.mjs` | Pass, 88 |

Two existing suites caught real issues during this work, both fixed before the final run:
- `place-names301` — map labels must be names only; the new places first included opening hours. Labels are now names only
  (hours are shown when you walk up).
- `fixes26` — counts the bar's drinkers/dancers by NPC kind; the new places' people now use their own kind (`activity`)
  so existing venues are unaffected.

## Measured AI/physics behaviour (Node)
- Pool AI vs AI, 6 racks per level: every rack finishes legally in 12–29 shots; planning averages 10–15 ms, worst 220 ms.
- Draughts AI: Easy/Normal/Hard search budgets 120/350/900 ms per move.
- Basketball: each spot's scoring window found by simulation (±0.008–0.024 power), mapped to a forgiving meter zone.

## Not verified
- Frame rate, touch feel and audio on a real phone/GPU.
- In the slow test browser the NPCs at new places appear after roughly 30–45 s of frames; checked once with a 60 s wait
  (all four Market Corner regulars present). On normal frame rates this is a few seconds.
