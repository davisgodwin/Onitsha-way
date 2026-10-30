# v0.26.0 — Bar life, police stops, roadside dealerships and business flyers

## What changed
1. **Bars and nightlife:** Beer-parlour patrons sit on the actual chairs, gesture with drinks, and dance in the clear space near the counter. Bar staff serve behind the counter. Club interiors mix seated booths, stools, dancing, a DJ and staff instead of one idle crowd. At an open bar, press **E**, choose **Sit with a drink** or **Join the dancing** for a visible 15-second activity; move to stop. Venue hours still apply.
2. **Police checkpoints:** Six deterministic, road-aligned posts on longer main-road segments. Advance signs face both approaches; cones and drums remain at the edge instead of forming a solid barricade. Officers can flag passing traffic. Nearby NPC cars slow, stop briefly and receive passage. Player drivers receive routine stops even without a speeding offence. Stop near the marked checkpoint, then choose **Give police ₦200** or **Run — start police chase**. Payment debits once and grants a 75-second clearance, including across a quick reload. Running parks the car and launches the existing 450 m police runner; escaping returns you to the city, while being caught uses the existing police custody/bail/free-service system. Driving away without stopping also launches pursuit. This is deliberately an on-foot mini-game after leaving the car, not an AI police-car chase. Child characters retain a free warning/help alternative rather than crime pursuits.
3. **NPC attention:** Passing the player no longer changes an idle resident's body or head direction. Explicit conversations, natural NPC-to-NPC chats, browsing, walking and traffic-avoidance reactions still turn people appropriately.
4. **Car dealerships:** All six stands now front primary, secondary or tertiary/main roads, with an open road-facing approach and street-side signs. Each lists **all 36 vehicles** and displays six sample vehicles; the marked collection bay is kept separate. This is full catalogue availability at every stand, not 36 physical display cars at each one. The phone shows the nearest available stand for each model rather than six copies of every listing. Map labels show the full catalogue. Forecourt paving excludes streamed verge grass.
5. **Solid-looking cars:** Shared player/NPC remodels now include floors, seats, seat backs, dashboards and inner lower-body lining. Glazing is opaque dark glass with depth writing; reverse faces do not disappear. Owned front doors still open. Open keke sides, motorcycle frames and the Hilux load bed are intentional, not holes to close.
6. **Image-only advertising:** Business ads now require a PNG, JPEG or WebP flyer. There are no business-name, ad-message or website write-up fields. Put the name, contact details and message on the image itself. Uploads have a preview, are resized before posting, and are rejected server-side if missing, malformed, unsupported or oversized. Billboards display the whole flyer, preserving its proportions without text overlaid on it. Existing text-only campaigns are retained in account history but no longer appear on billboards; cancel/repost them with a flyer. Pricing and test-only activation are unchanged: ₦3,000 per seven-day slot, with no real money collected. Production payments and human moderation remain unimplemented.
7. **Agbero coverage:** Area-boy groups now have **63 encounter sites** across mapped markets, transport hubs and roadside neighbourhoods in the bundled map, instead of three fixed spots. Residents use the existing spatially streamed NPC pool. Nearby on-foot encounters offer walking away, talking, an optional ₦200 gift or an escape run. Approaching never automatically takes money. One automatic encounter per site/day and a 90-second global cooldown prevent repeated pop-up harassment. They do not fill every street or occupy interiors, road carriageways or dealer forecourts.

## Updating without losing your character
1. Export a save backup in Settings and back up your own **server/data** folder. Stop the old server.
2. Extract this source archive into a fresh folder. Copy your own **server/data** into the new folder; do not replace it with anyone else's data.
3. Run **npm ci**, then **npm run local**. Keep the same browser profile, account and localhost address/port.
4. Choose **Continue**. Do not clear browser storage or create a new character.

Old vehicles, legacy sale IDs, wallet transactions, relationships, NPC garages and held-vehicle records remain supported. Dealership locations change, but owned vehicles keep their saved parking coordinates. Save positions made during a bar activity reload as ordinary on-foot positions; the short activity itself is not persisted.

## Verification
- `npm run check`: economy/save regression suite, street-layout tests, production build and required asset validation.
- `npm run test:vehicles`: all 36 models and purchase/fuel/resale/save checks.
- `npm run test:fixes26`: routine checkpoint payments, insufficient funds, runner outcomes, required raster flyers and solid car cabins.
- `npm run test:online`: real account/server/checkout/expiry/restart tests, now using image campaigns.
- `npm run e2e:vehicles25`: all 36 vehicle classes, six accessible roadside plots, full stock, actual purchase and Continue. The script name is retained from the catalogue release.
- `npm run e2e:fixes26`: seated NPCs, bar activities, no idle player-tracking, police choices, caught/escaped pursuits, NPC stopping, agbero cooldown and mobile flyer input.
- `npm run e2e:phone-community`: authenticated server-backed flyer checkout/activation/cancellation and phone/messaging/co-op regression.

Browser suites require a separately installed Playwright package and Chromium; use `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` where supported. They are development tools, not requirements to play. JSON audit reports are under **qa/v26**; bulky visual-QA PNGs are omitted from the source archive. Rendering is still the existing stylised game, not exact manufacturer replicas or a surveyed reproduction of real businesses.

## Research and fictional framing
Checkpoint signs, visible road-edge props and stopping are simplified gameplay layout, not verified operational guidance or a reproduction of specific real police posts. The ₦200 demand and all related officials are fictional. Reporting explicitly distinguishes extortion from lawful policing: https://guardian.ng/news/nigeria/metro/police-dismantle-illegal-checkpoints-on-east-west-road-warn-against-extortion .

## Asset rights
The existing v24 model provenance and licence notes still apply. No new third-party art packs were added. Confirm rights for the previously supplied packs without licence notices before public redistribution.
