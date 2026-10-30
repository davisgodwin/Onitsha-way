# Milestone 14 · v0.14.0 — Qualify, find work, finish the job

## Careers now have a visible next action

Phone → Story & careers shows qualification checklists. Clicking a legal career selects its training path, opens its workplace on the map, and—when qualified—accepts a new staged contract. Clicking the current career again directs you to your active stage instead of doing nothing. Changing careers during a contract asks for confirmation before cancelling it; it never grants a cancellation reward.

Find police station / EFCC office links have been removed from this screen. Both offices and checkpoints remain accessible from the map’s **Find on map** directory and existing map pins.

The map directory also lists workplaces, hotels, filling stations and the active career stage. The always-visible direction marker from v0.13.1, minimap route and golden world beacon are preserved. An active career contract is a navigation destination even if its temporary map marker has cleared on arrival.

## Qualifications

All qualifications below are invented game progression, not real occupational licences.

| Career | Skill needed | Own work equipment | Workplace |
| --- | --- | --- | --- |
| Tech bro / sis | Coding 5 | Work laptop — ₦85,000 | Metadav ICT Hub |
| Photographer / creative | Photography 3 | Digital camera — ₦45,000 | Metadav studio |
| Realtor | Charisma 3 | Client notebook — ₦1,200 | Property work desk |
| Nwa boy / trade apprentice | Hustle 1 | None; mentor supplies training stock | Main Market mentor desk |
| Car seller | Hustle 3 | Vehicle inspection kit — ₦12,000 | Motors & mechanic workshop |
| Oso afia / market broker | Charisma 2 | Client notebook — ₦1,200 | Main Market buyer desk |
| Courier | Fitness 1 | Delivery bag — ₦1,800 | Bridgehead dispatch desk |
| Cook / caterer | Cooking 3 | Pot set — ₦14,000 | Ochanja training kitchen |
| Mechanic | Hustle 3 | Toolbox — ₦9,000 | Motors & mechanic workshop |
| Tailor | Hustle 2 | Sewing starter kit — ₦4,500 | Ochanja fashion workshop |
| Wholesale / logistics | Hustle 3 | Dispatch clipboard — ₦1,500 | Bridgehead dispatch desk |
| Student / learner | Coding 1 | Loaned learning equipment | Metadav ICT Hub |

A player can choose a career before qualifying, but remains a learner/assistant and cannot accept its professional paid contracts. Equipment is bought with the existing wallet and stored as real inventory items. It is not consumed by each job. Removing/selling a required tool blocks further job-stage completion until the tool is restored. Training never grants a free professional laptop or camera.

Metadav has a central game equipment desk with all starter kits; other workplaces sell the tools for their own trades. Existing independent city delivery jobs, vehicle/keke businesses and shop systems remain available with their existing rules. Phone coding, photo and courier shortcuts now lead into the map-based careers. Optional phone music and comedy gigs also require skills (and a microphone for recording); their backend refuses unqualified payouts.

Child mode still permits only supervised student/creative paths, with a loaned studio camera for supervised creative work. It does not unlock adult occupations or crime. These are simplified game activities, not real child-employment eligibility or comprehensive parental controls.

## Training and Metadav

Metadav ICT Hub is a **fictional game location** placed near the playable Onitsha Mall area at the user’s request. Public research did not verify its real-world address. It is not presented as a surveyed real business location or an endorsement.

The enterable ICT lab has computer desks, a photo backdrop/camera area, guided training, a paid gig board and an equipment desk. Workplaces offer the relevant training: coding, photography, charisma, hustle, fitness or cooking.

- A correct guided exercise awards **100 Coding XP**, or **80 XP** for another workplace skill.
- Coding level 5 requires **1,000 XP** under the existing skill curve: ten successful Metadav coding exercises from zero XP.
- Loaned equipment is available for training only, so a beginner can learn before buying tools.
- Sessions require food and energy, apply simulated 30-minute effort, and have a saved **20-second active-city-play cooldown**. Sitting in menus does not count. Incorrect answers give no XP.
- Existing Phone → Learn skills and home cooking are also valid ways to improve skills.
- Real WAT/device time is never fast-forwarded by training or hotel rest.

## Jobs are map-based, staged and paid on completion

Every legal career has at least two changing briefs and a two-stage job: take a brief at its workplace, then travel to the marked work/handover location and respond to the client’s task. Oso afia and photography have three stages with a final buyer/client confirmation back at their work desk.

Examples:
- **Tech:** agree a website/bug-fix brief at Metadav → visit the trader for tested-work handover.
- **Oso afia:** confirm the buyer’s fabric requirements and disclosed commission → visit an actual generated fabric trader → return for buyer confirmation and commission.
- **Photography:** obtain permission and a shot list at Metadav → complete the market product-photo decision → deliver the agreed photos back at the studio.
- **Courier/caterer:** accept a checked delivery/catering brief → hand over at hotel reception.
- **Mechanic:** agree a safe diagnosis at the workshop → meet the driver at a filling station.

Jobs use short original decision tasks plus physical travel, not full coding, cooking, photo-editing or business simulators. Photography does not save rendered photo files or implement a free-camera photo mode in this release.

Press **E** at the active job pin, or reopen Story & careers while within 12 metres. The menu shows the current stage, the task, missing qualifications and directions. Successful intermediate stages change the pin and pay **nothing**. Only final client acceptance credits the wallet, increases completed work/trust and adds skill XP. A wrong work decision rejects the contract with no payment. Rewards use the existing atomic/idempotent economy service.

The original three-resolved-contracts-per-career-per-WAT-date cap, 20-second active-play job break, trust-based pay bonus, apprenticeship settlement and story crossroads remain. Contract stages and the current destination survive save/reload.

## Hotels and filling stations

Real public names are sourced; **game entrances, simplified interiors, services and prices are invented**. There are no real bookings, payments or business endorsements.

| Place | Evidence and placement |
| --- | --- |
| Grace Lodge Onitsha | Listed on Awka Road. Listings disagree on the street number; approximate road-area game placement, not an exact door. |
| Venus Hotel | Listed at 100 Port Harcourt Road; approximate road-area game placement. |
| Chizilili Hotel | Hotel point in the bundled OpenStreetMap export, node 12569260282. |
| TotalEnergies Oguta Road | Public listing supplies 6.147259, 6.789944; game forecourt moved to a nearby accessible clearing. |
| TotalEnergies Old Market Road | Listed at 54 Old Market Road; approximate road-area game placement. |
| TotalEnergies New Market Road | Listed at 82 Upper New Market Road; approximate road-area game placement. |

Existing OSM filling stations remain registered and now also have visible simplified service forecourts. Some existing map data covers the Asaba bank too; these are not relabelled as surveyed Onitsha addresses.

Hotels have an enterable, furnished visitor/day room, a paid rest/shower service and a reception meal. This is an immediate game service, not a real-time multi-night booking system. New and existing fuel desks sell usable 5 L fuel jerrycans. New filling stations also support existing **drive to pump → stop → F** vehicle refuelling.

Sources:
- https://www.hotelsone.com/nigeria-ng/reservations-onitsha-hotels.html — Grace Lodge and Venus listings/addresses.
- https://gracelodgeonitshaonitshadelta.ng-hotel.net/en — conflicting Grace Lodge street number; therefore no precise street-number claim.
- https://www.openstreetmap.org/node/12569260282 — bundled Chizilili hotel point.
- https://www.hotfrog.com.ng/company/AFc1fC78c9Cory9bmDWTAw/totalenergies-oguta-road-service-station/onitsha/automotive-services — Oguta station and public coordinates.
- https://www.hotfrog.com.ng/search/onitsha — Old Market / New Market station listings.

Soprom was also found in research, but its published Federal Housing Estate/3-3 address was not verified inside the current core area; this update does not invent an in-bounds branch for it. New map coverage would be needed to place more outlying Onitsha hotels accurately.

## Upgrade and validation

Export a valuable save before upgrading. Extract the source into a new folder, run `npm ci` then `npm run dev`, and use Vite’s printed URL. Keep the same site address or import your save. Do not clear browser storage. No new game, paid API or account is required.

Save format **12** adds staged job/progression data; older saves migrate without a wallet or skill grant. Existing un-staged contracts remain single-stage records and must meet current qualifications. Do not load a v12 save in an older build.

- `npm run check`: economy, progression, eligibility, stage/reload/idempotency tests, production build and asset validation.
- `npm run e2e:careers`: all twelve legal careers, qualification failures, actual tool buying/training, ICT interior, map directory, staged payouts/reload, hotels and fuel desks.
- `npm run e2e:city-polish`: varied career briefs, final map layout/office selection, hotel save restoration and child phone shortcuts.
- `npm run e2e:navigation`: compass, destination/job arrow and responsive layout regression.
- Existing law/chase, life-start, wardrobe and time/weather suites remain in `tests/e2e/`.
