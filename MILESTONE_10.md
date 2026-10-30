> **v0.10.1 clock hotfix:** See CLOCK_FIX.md. Real WAT is now mandatory for normal play; old accelerated preferences are overridden. Simulated weather is the default. Earlier clock-selector instructions below are historical.

# Milestone 10 — Nightlife, decorating and a live Onitsha world (v0.10.0)

## What's new

- **House of Pilate** is a playable nightclub near Upper Iweka, at a **fictional game location chosen for this build at the player's request**. The map, phone and entrance do not claim this is its real address. The interior is an original design, not a reproduction of the real venue.
- **House of Pilate and Osha Afterdark open 19:00–04:00 WAT only.** Daytime entry and paid club activities are disabled. At 04:00, visitors are taken safely outside. Ordinary beer parlours/lounges keep their separately listed hours.
- Enterable nightclub room: lit dance floor, DJ booth, speakers, bar, lounge seating, bathroom, varied adult dancers and original synthesized beat controlled by the existing sound volume/mute. Dance for 15 seconds to earn dancing XP; moving cancels the dance. Activity menus, food, socialising and toilets remain available at their interaction points.
- **Home furniture arrangement:** Phone → My home → Arrange furniture. Select an owned item; tap/drag on the floor plan; rotate, recolour and Save position. Store an item without losing ownership, then bring it onto another duplex floor by arranging it there. Position, angle, colour, floor and storage state are saved separately for each home. Doors, stairs, room boundaries, built-in furnishings, existing placed furniture and interaction approaches are protected. Rugs are non-solid. Wall art/curtains remain wall-mounted; generators remain outdoors for safety.
- More vehicle detailing: wheel-arch trim, body creases, door panels/armrests, console, gauges, rear handles, LED strips and SUV roof rails, on top of the existing real opening doors and driver transitions. All models remain original, stylised procedural artwork, not licensed photorealistic vehicles.
- **ShopRite forecourt:** paved parking grounds, a designed access drive, marked parking bays, collidable parked vehicles, landscaped tree islands and benches. Existing perimeter fencing, traffic exclusions and visitors remain. Outside public roads stay outside the compound; the entrance remains open.
- **Public visitor interiors:** a school adult-learning workshop, church reflection room and cultural/public visitor lobby, with opening hours, once-daily skill/needs activities, exits and safe saves. Available through the named visit points for CKC, All Saints, Ime Obi and other supported public pins. These rooms are explicitly fictional/stylised, not surveyed real interiors or access to private royal rooms. Named school/university/hospital/town-hall POIs present in the bundled OSM data are also included, without inventing precise locations for unlocated sites.
- Full-map labels use a screen-space collision allocator; markers remain visible when text cannot fit. Select a marker or use Phone → Places for its full name.

## Real time: default on

- Uses the device's clock, displayed in **Africa/Lagos / WAT (UTC+1, no daylight-saving change)**, regardless of the player's own timezone. It is not a server-authoritative anti-cheat clock; the device clock must be correct.
- Daylight, club/shop hours, NPC schedules and the displayed calendar follow the real Onitsha time/date. Real time continues while paused or on a menu; action/world simulation can still be paused.
- In Settings → World time, choose **Game time** to return to the accelerated clock. The Slow/Normal/Fast control only applies in that mode. For example, use game time if you want to explore nightclubs during real-world daytime.
- **Activities do not fast-forward the real clock.** Their displayed game durations are simulated effort for needs/rewards. Sleeping restores energy but does not turn actual afternoon into morning. Travel skips still move the player without changing civil time. This is an explicit game abstraction, not a promise that an activity waits its full real-world duration.
- Needs and home backup usage follow real elapsed time while the game is open (plus action effort). No offline needs/generator penalty is applied on loading. Saved real dates advance rent/job deadlines across days when returning. Back up saves before switching builds; initial migration/switch to real time rebases current commitments rather than unexpectedly erasing the remaining rental/job time just because the clock display changed.
- NPC/weather/power simulation remains fictional where not explicitly fed by real data. In particular, **power cuts are not live electricity-grid reports**.

## Live weather: default on

- Fixed Onitsha coordinates: 6.15°N, 6.79°E. Never asks for player geolocation. A request to the provider shares the normal request IP, not the player's character/save data.
- Provider: Open-Meteo current model-derived conditions: temperature, precipitation, weather code, clouds and wind. Rain/cloud/fog conditions feed the game's existing visual/audio systems; not every measured variable has a bespoke effect.
- Successful refreshes are limited to once per 15 minutes while actively playing. Requests time out without blocking gameplay and failed requests retry after a minute of active play.
- HUD labels **live weather**, **cached weather** or **offline fallback**. Cached successful data may be used for up to six hours; beyond that the deterministic game weather is used. Phone → Onitsha gist shows the fetch time and API sample time. A simulated fallback is never described as a current real observation.
- Disable Live Onitsha weather in Settings to stay fully simulated/offline.
- Attribution is visible in Help & guide: [Open-Meteo](https://open-meteo.com/), data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The API supplies model-derived current conditions, not a sensor at each game street; network interruptions and update delays are normal.

### Important before a commercial release

The included **free Open-Meteo endpoint is for a non-commercial demo**. An ad-supported, subscription or other commercial release needs a commercial provider agreement/licensed endpoint, normally through a server-side proxy. Do not put a paid secret API key in this browser source. See the [provider terms](https://open-meteo.com/en/terms) and [pricing](https://open-meteo.com/en/pricing). This build does not purchase a weather subscription, deploy a backend or claim production service guarantees.

## Run / deploy

```sh
npm ci
npm run dev
# Production:
npm run check
npm run preview
```

Use Node 18+ (22+ recommended). Serve over HTTP/HTTPS; do not double-click index.html. The separate website ZIP contains the built static files. Extract its contents into your hosting root, including assets/, data/, sw.js and .htaccess where supported. See DEPLOY.md.

### Controls

- O / HUD Phone → Places: find House of Pilate or another named location, mark it and travel there.
- E at a nightclub entrance, at night: enter. E inside: exit, dance floor, bar, lounge or WC.
- O → My home → Arrange furniture: touch/mouse floor-plan controls; scroll for Save position and Store.
- Settings: Real WAT / Game time; live-weather toggle.
- Existing walking, driving, cooking, work, map and save controls are unchanged.

## Saves and remaining production boundaries

Save format **9** migrates previous saves and adds floor-specific furniture placements/real-date fields. Keep an export of your M8/M9 save; older builds cannot read the new save version. Furniture from M9 gets a safe initial delivery position on the first floor where it is rendered. Club/public saves record a safe exterior plus venue ID and only restore indoors during opening hours.

This is still the same single-player, browser-based game. Duplex stairs still switch between ground/upstairs scenes rather than using continuous multi-storey physics. The whole Onitsha map has not been expanded to cover every real club/school outside its boundaries. Real-world structures are not surveyed replicas, private cars/public transport keep their distinct boarding systems, there is no multiplayer or real messaging/payment, and real-device Safari/Firefox/performance certification is not included. These boundaries are stated rather than hidden behind “everything is finished.”

## QA

- `npm test` / `npm run check`: 126 unit/regression cases plus production build and static validation.
- `npm run e2e:m10`: real WAT/default mode, weather application, fictional venue disclosure, day/night entry, modelled interior/crowd, dance XP, closing time, safe club save, furniture transform/collision/storage/floors, mobile editor, school workshop, public exit, real-time rest, browser/game-loop error checks.
- `npm run e2e:m9`: earlier phone, needs, rental, car-entry and save/continue browser regressions.
- Optional browser tests require `npm install -D playwright-core` and Chrome/Chromium; set CHROME_PATH as needed. No test grants or saves are shipped as game defaults. Tests write ignored .qa/ evidence; qa/ contains release logs.
- Live provider was separately reached successfully over HTTPS during development; browser weather tests use controlled responses so a changing forecast does not make tests flaky. Dependency audit details are in qa/.
