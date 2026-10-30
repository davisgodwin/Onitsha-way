# Historical: v0.24.0 — Supplied model packs & Zik Roundabout

**Superseded by CHARACTER_FIX_24_1.md:** the supplied body now applies to all characters and all hairstyles/styles are enabled. The optional model-look and fixed-hairstyle notes below describe the earlier v0.24.0 build only.

## Included in this build
- Selected buildings from all three supplied building packs replace 6,468 eligible ordinary mapped buildings. Their visible envelopes stay inside the existing footprints; shared, instanced geometry is streamed in city chunks. Irregular plots, rental buildings, the rebuilt markets, the mall, churches and special venue identities retain their previous treatment. This is not a claim that every real Onitsha building resembles a supplied model.
- Male and female model-pack characters: four new looks per gender, with the supplied idle, walk, run, jump and sitting clips. There are now 16 wardrobe choices per gender. Skin, top, bottoms where applicable, shoes, age and body scale are supported. Supplied looks have fixed hairstyles; the original looks keep their original hairstyles and traditional/Ankara styles.
- Existing characters are not forcibly changed. Open **Phone → Wardrobe → Open wardrobe**, then choose a **Model pack** look. New characters start with the supplied casual look.
- Supplied sedan, executive saloon and SUV silhouettes are used for street traffic, parked cars, sale cars and owned cars. Owned cars retain extracted hinged front side panels for entry/exit. Existing brands/trim labels, prices, ownership, fuel and repair mechanics are unchanged; the new meshes are generic silhouettes, not exact models of those brands. The supplied Bus updates the existing full-size bus class. An additional converted sports-car mesh is included in the asset library but is not a new purchasable vehicle class.
- **No taxi mesh or taxi vehicle type is included.** The keke is an original remodel inspired by the packs' faceted style: three wheels, open side access, passenger bench, revised canopy, windscreen, mirrors, single headlamp, ventilation and trim. It remains the same gameplay vehicle with the same seats, fares and ownership.
- **Zik / DMGS Roundabout** occupies the existing mapped road ring (OSM way 371153211), rather than the slightly displaced published point. The original simplified model has five curving ivory-coloured tusks, a segmented red bead ring, a bronze-style robed figure, plinth, plaque, greenery, rails and alternating curb stones. The roadway is retained. Its map destination is on clear land outside moving traffic, not inside the island.
- **Stadium work is pending confirmation:** Chuba Ikpeazu Stadium off Awka Road, Godwin Achebe Stadium in Fegge, or both. No stadium has been inserted into this build under an assumed identity.

## Find the monument
Press **M** or open **Map**. In **Landmarks & monuments**, select **Zik / DMGS Roundabout**. Follow the waypoint to the safe roadside viewpoint. The island is a protected scenic landmark, not an enterable building.

## Preserve your account and progress
1. Export a backup of your save, and back up your own `server/data` folder.
2. Stop the old server and extract this ZIP into a fresh folder.
3. Copy your own `server/data` folder into the new installation before starting it. Do not share account data in a source ZIP.
4. Run `npm ci`, then `npm run local`.
5. Keep the same account, browser profile and `http://localhost:5173` address. **Do not clear browser storage or start a new character.**

Accounts and character progress use different stores: server/data for accounts, browser localStorage for characters. Replacing source files alone does not transfer browser saves to another device. Payment flows remain test simulations; this release does not add real payments or public-hosting security.

The new GLB assets are required runtime files under `public/models/v24`. Their first load adds approximately 23 MB before transfer compression. Keep the full folder when deploying. Successful same-origin model requests are cached by the updated service worker for later offline use; first-time account login and live radio retain their previous connectivity needs. Startup now waits for models before building the city.

## Reference review
The monument is a simplified original geometry interpretation, not a photogrammetry scan or surveyed reconstruction. Reference photographs are not bundled or used as textures.
- https://commons.wikimedia.org/wiki/File:DMGS_Roundabout.jpg — photograph by Onyinyeonuoha / Onyinye Achukwu; ivory-coloured tusks, red bead ring, central figure, bases and perimeter treatment.
- https://en.wikivoyage.org/wiki/Onitsha — five tusks and junction context; published statue coordinates differ from the bundled mapped road ring, so the ring controls in-game placement.
- https://www.europlan-online.de/chuba-ikpeazu-memorial-stadium/stadion-65197.html — Chuba Ikpeazu stadium identity and address, pending user selection.
- https://www.factcheckng.com/2024/10/anambra-traders-sports-championship.html — confirms that Godwin Achebe, Fegge, and Chuba Ikpeazu are distinct stadiums.

## Asset provenance
User-supplied archives: building 1.zip, building 2.zip, building 3.zip, male character.zip, female character.zip, vehicle 1.zip, vehicle 2.zip.

Building 1, building 2, both character packs and vehicle 1 include Quaternius CC0 notices; copies are retained in `public/models/v24/licenses`. The building 3 and vehicle 2 uploads contain no license notice; their rights/provenance must be confirmed before a public redistribution. Inclusion here follows the user's instruction to integrate their supplied files and is not a blanket licensing claim.

OBJ material colours are baked into vertex colours. Building 3's supplied palette textures are sampled through the model UVs. FBX character skeletons and five relevant animation clips are converted to GLB. Smooth duplicate variants and unused train, taxi, school bus and utility props are not used. No raw taxi assets are copied into this release.

`public/models/v24/catalogue.json` records the converted source model for every runtime asset. Offline asset conversion is in `scripts/convert-models24.mjs`; it requires the original extracted packs plus the optional `sharp` package, which is not needed to run the game. Example: `node scripts/convert-models24.mjs /path/to/model-packs` with subfolders named building-1, building-2, building-3, male-character, female-character, vehicle-1 and vehicle-2.

## Verification
- `npm run check` — economy/wardrobe regression, street-layout tests, production build and build validation.
- `node --test tests/buy.test.mjs tests/radio.test.mjs tests/account-api.test.mjs tests/entry-session.test.mjs tests/mail.test.mjs` — retained furnishings, radio, accounts, entry and mail behavior.
- `npm run e2e:city23` — retained road-front venues, three markets, river boats, all rental doors, entry/exit and mobile river navigation.
- `npm run e2e:models24` — local browser audit of imported models, character scale, no-taxi catalogue, safe monument destination, homes, map selection and mobile layout. Uses a development server on port 4240, started automatically if not already running. Requires Playwright and Chromium, as do the existing browser suites; set CHROMIUM_PATH if necessary.

Audit JSON files are in `qa/v24` and `qa/v23`. Large visual-QA PNGs are omitted from the source ZIP. Browser checks are sandbox tests, not a guarantee about every older save, GPU or mobile device.
