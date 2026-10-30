# Unfurnished homes and expanded catalogue · v0.21.0

## Rentals now start empty

Every rental type (self-contain, room and parlour, flat, bungalow and both duplex floors) is an unfurnished shell. Walls, partitions, floors, ceilings, windows, doors and stairs remain. Beds, wardrobes, sofas, tables, kitchen units, bathroom fixtures, rugs, pictures and lights are not supplied with rent.

Buy furniture and appliances using fictional game money, then choose their position in **Buy mode**. There is no automatic starter furniture grant. Basic neutral wall/floor finishes remain available free. Viewing a vacant rental also shows its empty shell. NPC host homes still have their own furnished layouts; those furnishings never become yours.

Existing purchased furniture, stored items, custom placements and paid finishes are preserved. The old, unowned built-in furniture disappears; purchased items are not deleted. Existing Shoprite deliveries without a saved placement retain their legacy delivery sockets; new deliveries are stored until you place them.

## 57 furnishings and 22 finishes

| Category | Choices | Examples |
| --- | ---: | --- |
| Design | 22 | 12 wall paints and 10 tile colour finishes |
| Sleep | 6 | Single, double, king and bunk beds; wardrobe; bedside drawer |
| Kitchen | 7 | Full/compact fridges, cooker/oven range, cabinet, dining set, chair |
| Bath | 6 | Shower, toilet, basin, bath, washer, towel cabinet |
| Comfort | 6 | Sofa, armchair, loveseat, fan, coffee table, ottoman |
| Fun | 6 | TV, speaker, console, radio, board-game table, aquarium |
| Skills | 6 | Laptop desk, bookshelf, writing desk, easel, guitar, sewing station |
| Light | 5 | Floor, bedside, arc and tripod lamps; rechargeable lantern |
| Decor | 9 | Rugs, plants, wall art, curtains, mirror, floor vase, room divider |
| Power | 6 | Two outdoor generators, inverter variants, power station, battery cabinet |

These are original Onitsha Way models. Catalogue thumbnails, placement previews and installed furniture use the same models. All prices are game balancing values, not real-world quotes.

## Arrange your home

1. Rent and enter your home. Tap **Buy** in the bottom navigation.
2. Choose a category and item. Tap/drag a clear floor position.
3. Rotate with the button or **R**; arrow keys nudge by a quarter metre.
4. Confirm **Buy & place**. Previewing or cancelling costs nothing.
5. Select an owned item to move it free, or **Store** it and place it again later.

A placement must stay inside the room and keep walls, other solid furnishings, doors, stairs and the player's approach clear. Rugs can sit under furniture. Placements belong to a home and floor; finishes apply across both duplex floors. The current model supports **one of each catalogue item per home**; different variants can be owned together. Wall art/curtains use fitted locations; generators are installed outside by the front door for safety.

Shoprite appliance deliveries now go into home storage. Enter that home and use Buy mode to place them. Phone → My home links to Buy mode, the room editor and backup-power controls rather than a second automatic-install shop.

## Working household items

- Sleep at a placed bed; rest on purchased seating; change outfits at your wardrobe.
- Prepare recipes on a placed cooker/oven. Food and supplies use the existing shared home inventory through a purchased fridge/cabinet.
- A toilet unlocks toilet use, a shower/bath unlocks bathing, and a basin unlocks hand washing. Rent alone unlocks none of these actions. Stored fixtures cannot be used.
- The washer freshens clothes/hygiene and needs power. TV, speaker/radio, fan, console, laptop and sewing station also need power.
- Read for charisma; practise composition at the easel for photography; guitar for music; sewing for hustle; laptop for coding. These use existing game skills rather than inventing unsaved skill types.
- Placed lamps can be switched on/off through their interaction. They need grid/backup power; the rechargeable lantern works during cuts. Buying a lamp does not create an invisible free ceiling lamp.
- Phone → My home manages generator fuel and battery backup. Generator variants share the existing home fuel tank (1 L / 120 game minutes); battery variants share one charge reserve (4 hours grid charging / 6 hours backup). Extra units do not multiply reserves. Stored battery units do not power or charge a home.

## Update safely

Back up/export important saves. Preserve **server/data**, the browser profile and the same URL; do not clear browser storage. No destructive save migration or account reset is required.

Stop the old local command with Ctrl+C, extract the source, copy your own server/data to the new installation if using a fresh folder, run **npm ci**, then **npm run local**. Open **http://localhost:5173**. The package-version/instance readiness fix remains in place.

Business ads is still the only added community phone app; co-op remains inside Messages → Groups. No Players, Voice, Account, Nearby chat or standalone Co-op app has been reintroduced.

## Regression commands

- npm run test:buy — catalogue, prices, new empty state, storage-first purchases, model bounds, power variants, legacy saves.
- npm run e2e:buy — real signup, all rental shells, every furnishing purchase, actual interactions, storage, preview cancellation, mobile/landscape, reload persistence.
- npm run check — base game tests, production build, bundle/map validation.
- npm run e2e:phone-community — simplified phone and crew chat regressions.
- npm run test:startup — actual npm run local readiness and occupied-port regression. Run separately from a running local game or browser suite.

## Verified for this release

14 furnishing unit tests; 266 Buy browser checks; 251 base game tests; production build and bundle validation; 31 simplified-phone/co-op browser checks; 2 actual launcher tests. Account (10), entry (1), online (3), mail (1) and radio (25) regression tests also passed. Desktop, mobile and landscape screenshots were inspected. Logs are included under qa/v21-*.
