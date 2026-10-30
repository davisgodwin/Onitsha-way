> Historical M9 notes. See MILESTONE_10.md for the current build; several limitations below are now resolved.

# Milestone 9 — City life: first playable pass (v0.9.0)

This update extends the supplied Milestone 8 source. It is a playable mechanics update, **not a claim that all eleven requests are visually finished**. Every price, activity, crime encounter and generated interior is fictional game design.

## Start here

```sh
npm ci
npm run dev
# Or build the static site:
npm run check
npm run preview
```

Node 18+ is supported by this build's Vite 6 toolchain; Node 22+ is recommended. Open the local address printed by Vite. Do not open `index.html` directly. `dist/` is the ready-to-host static site. See DEPLOY.md for Apache/cPanel, Netlify, Vercel and GitHub Pages. No backend, account or multiplayer service is introduced.

**Before moving an existing game:** Settings → Export save. Save format 8 migrates old saves without resetting their wallet or old energy value. Always keep the original export: older game builds cannot read the new format.

## What changed, against the eleven requests

| Request | Delivered in this pass | Still needs refinement |
| --- | --- | --- |
| 1. Better vehicles and entering cars | Redesigned owned sedan/executive/SUV models with cabins, seats, steering wheels, metallic paint, alloy detail and independently hinged front doors. Opening/closing transition into the real driver state; doors open on exit. Shared car/bus/lorry wheel detail and traffic paint polish. | Original procedural, stylized models, not photorealistic branded models. No full walking/hand-on-handle animation. Keke retains its open-sided model; public transport uses its existing boarding system, not the new private-car door rig. |
| 2. More homes, duplexes, good houses | Up to 46 reachable listings in the supplied map: 12 self-contains, 10 rooms/parlours, 10 flats, 8 premium bungalows and 6 duplexes. Duplexes select multi-level OSM buildings and have separate ground/upstairs spaces. First fifteen legacy picks are preserved where access remains valid. | Duplex stairs switch between two room scenes; they are not continuously walkable 3D stairs. All floor plans are generated, not real surveyed layouts. |
| 3. Household shopping and power | Phone → My home: one each of rugs, plants, art, curtains, sofa, TV, speaker, fridge, fan, desk/laptop, outdoor generator, inverter. Cosmetic paint changes. Safe fixed furniture sockets, power-aware appliance activities, shared kitchen cupboard storage. Purchases that cannot fit in the current room are disabled before charging. | No free drag/rotate placement, furniture reselling or room-by-room build mode. Furnishing is home-specific, but fixed presets are rebuilt for the current floor; an item's position is not user-authored. |
| 4. Entertainment, real clubs, ShopRite | Three explicitly fictional activity hubs (Market Corner Beer Parlour, Bridgehead Riverside Lounge, Osha Afterdark) with signs, tables, scheduled adult NPCs, meals/malt, socializing, music/dance, open mic and toilet use. Hours include overnight opening. ShopRite parking access aisles are excluded from ambient traffic routing, with a designed perimeter fence, open entrance, planting, parking markings and daytime visitors. | These are outdoor activity hubs, not fully modelled club interiors with live dance crowds. House of Pilate is **not placed** without a reliable address/pin. Real researched venues outside the current map are listed only in the research directory, not teleported into the city. |
| 5. Agbero dynamics | Fictional adult rank-regular encounters near Main Market, Upper Iweka and Bridgehead. Keep walking for free, talk calmly/practise charisma, or voluntarily give ₦200. At most one approach per district/game day; escaping the panel also avoids repeated pressure that day. Choice and payment persist in the save. | No combat, robbery, gang territory or forced deductions. These are not allegations about real residents or named businesses. |
| 6. Public buildings, schools, churches | Added labelled approximate locations and visit interactions for All Saints' Cathedral, CKC and Ime Obi Palace, alongside the original Basilica, markets and bridge. DMGS is in the research list pending a campus pin. | Not a comprehensive Onitsha public-building survey. No custom school/church interiors or private royal access. More sites need map pins and map coverage. |
| 7. Six needs | Hunger, energy, fun, social, hygiene and bladder (all 0–100; higher is good), shown on HUD. Time and activity decay, food, sleep, entertainment, conversation/calls, showers and toilets restore the appropriate needs. Needs follow game clock speed and time skips. | Needs tuning and longer real-player sessions are still needed. No autonomous need routing or medical/death simulation. |
| 8. Phone and requested apps | Three fictional cosmetic phones at character creation: Osha One, Niger Pro, Palm Mini. Same apps on all models: Jobs, Messages, Games, Onitsha Bet, Contacts, Help & guide, Book ride, Cars & homes, Hustle, Learn skills, Onitsha gist, plus My home and Places. Open with **O** or the HUD button. | Original app-grid/list navigation built around the supplied list, not an exact copy of Lagos Life. Calls/messages are local NPC simulation, not real communications. Ride booking uses existing bus stops; no private ride-hailing dispatch service. |
| 9. Skills | Cooking, charisma, fitness, coding, music, dancing, hustle, comedy, photography. XP-based levels 1–10. Practice sessions, cooking, conversations, jobs and venue activities give relevant XP. Hustle pay scales modestly with its relevant skill. | Not every skill has a bespoke animation or full career tree. Guided practice is currently a timed activity. |
| 10. Kitchens, ingredients, shopping | Every rental layout has a kitchen; every layout now has bathroom fixtures too. Added yam, plantain, eggs, tomatoes, onions, ugu, fish, beef, seasoning, egusi and cooking oil. New yam/egg, plantain, egusi and fish/rice recipes. Cooking uses existing inventory/space/payment rules and gives cooking XP. | Fridge uses the kitchen storage inventory; no spoilage/temperature simulation. Cooking remains a timed recipe action rather than an animated cooking minigame. |
| 11. Named map | Full map retains road and landmark names, adds the new school/church/public pins and named venue markers. Nearby minimap landmarks get readable names instead of initials alone. Phone → Places provides a browsable directory and waypoint links. | Closely spaced labels still need a larger-map decluttering pass. Outside-map research entries cannot be used as playable destinations. |

## Mechanics and balance

- Normal needs rates are per elapsed game minute. Sleep restores energy but still consumes hunger, bladder and other needs over time. There is no surprise death at zero.
- First meaningful conversation with a person each day boosts social/charisma; repeated click-throughs do not farm it.
- Phone quiz: one round per day; fun reward, no cash reward.
- Phone hustle gigs: one of each type per day, one game hour each, minimum food/energy, no duplicate payout on reload.
- Onitsha Bet is an **optional fictional football prediction** with only existing game-wallet money. ₦100 stake, ₦250 total return on a correct pick, one ticket per game day, fixed per-save/day result. No deposits, cashouts, real teams, live odds, external gambling links or real-money integration.
- Generator fuel: 1 L per 120 game minutes of grid outage. Add a 5 L jerrycan from a spare-parts trader. Generator runs outside, never inside the home. When grid power is present it is in automatic standby and does not burn fuel.
- Inverter starts empty, takes four game hours of grid supply to charge, and covers six game hours of outage at full charge. Generator covers the load first when both are enabled; inverter covers the remainder. Fuel/battery accounting also runs through sleeps and skipped travel. No offline real-world fuel drain.
- Household items are installed once per home. Rental expiry blocks new purchases and furniture use. Ownership stays with that home's save record.

## Controls added

- **O**: phone (or click/tap the Phone button below the minimap).
- **E** at bathroom: toilet/shower/wash hands.
- **E** at home interaction point: My home shop/power controls.
- **E** at duplex stairs: switch floors.
- **E** at your car: open/enter, or use its existing repair/fuel menu.
- **E** at a venue entrance: activities and toilets.
- **M**: named full map, as before.

## Testing and evidence

- `npm test`: **100 passing tests**, including 24 new M9 cases for needs, XP, home ownership/payment/fuel/battery, phone limits and persistence, club hours, traffic exclusion, rental expansion and car door rigs.
- `npm run check`: tests, production build and static build validation.
- Optional browser tests (Chrome/Chromium installed): `npm install -D playwright-core`, set `CHROME_PATH` if required, then `npm run e2e:m9`. This starts a local production preview and writes screenshots/results under `.qa/` (ignored by Git). It uses fresh test-only save data and a test-only money grant; none is embedded in the game defaults.
- Chromium integration checks cover the HUD phone button, skill practice, quiz, ride-stop list, duplex floors, toilets, furnishing/fuel, car entry, club XP, refusing street payment, save/continue and phone layouts at 1280×800, 390×844 and 844×390.
- Dependency security: upgraded the development toolchain from Vite 5 to a patched Vite 6.4.x line; the final `npm audit` run reported zero known vulnerabilities at review time.
- Not certified on real phones, real GPUs, Safari or Firefox. Screenshot review on software Chromium is not a hardware performance benchmark.

## Sources / unresolved place research

- CKC location: https://en.wikipedia.org/wiki/Christ_the_King_College,_Onitsha (6.14284, 6.79086; point/interior still approximate for gameplay).
- All Saints' Cathedral and Ime Obi coordinates: https://en.wikivoyage.org/wiki/Onitsha (6.154702, 6.789541 and 6.153038, 6.79219).
- DMGS identity/address: https://en.wikipedia.org/wiki/Dennis_Memorial_Grammar_School (Oguta Road; no campus pin added).
- Remmy Grills and Bar listing and Dolly Hills hotel/bar: https://en.wikivoyage.org/wiki/Onitsha. Their listed coordinates lie outside the supplied map. Dolly Hills is not presented as a verified nightclub.
- Lagos Life official site: https://lagoslife.app/ was inspected but its dynamically rendered interface was not available to text extraction. No claim is made of reproducing its exact phone screens or implementation.
- **Needed from the project owner:** House of Pilate Google Maps pin/address (and confirmation of the name); additional desired clubs/schools/churches with pins; screenshots of the Lagos Life phone if closer navigation matching is desired.

## Suggested next pass

1. Playtest the first 20 game minutes and adjust needs/earnings/rent prices.
2. Decide on a consistent vehicle/character asset style before buying/licensing detailed GLBs.
3. Add verified real venues, their correct entrances and proper interiors.
4. Move duplexes from stair transitions to walkable multi-level collision and camera support.
5. Upgrade fixed-socket furnishing to persistent per-floor placement/editing.
6. Run device profiling, especially touch controls, memory, labels and traffic density on mid-range Android phones.
