# Milestone 11 — Character and wardrobe refresh (v0.11.0)

## Character appearance

- Refined face: softer skin texture, reshaped jaw, smaller lips/nose, clearer eyes, eyelids and highlights, and tapered eyebrows.
- Slimmer neck and less bulbous shoulder shapes, connected wrists, improved hand proportions, and better shirt/trouser fit.
- Original stylised procedural characters, not scanned humans or photorealistic licensed character assets. The existing skeleton is retained for walking, running, jumping, dancing, driving and seated poses.
- New hair options: taper fade, rounded short afro and cornrows for male characters; braided bob, ponytail, taper fade and cornrows for female characters. Existing hairstyles and NPC red caps remain supported.
- Sneaker tongue/laces, differentiated formal shoes and contrasting soles.

## Wardrobe

**12 complete outfit choices per character**, grouped into Casual, Smart & suits, Traditional and Sport. Existing outfits retain their IDs so previous saves still work.

Shared new looks:
1. T-shirt & denim shorts
2. Linen shirt & tailored shorts
3. Polo & cargo shorts
4. Polo & chinos
5. Oxford shirt & trousers
6. Tailored suit with open collar
7. Two-piece suit & tie
8. Hoodie & jeans
9. Zip-up tracksuit

Male originals: Ankara shirt & jeans, T-shirt & chinos, Senator kaftan.
Female originals: Ankara top & jeans, Ankara gown, blouse & Ankara skirt.

Clothes have garment-specific geometry/details: exposed legs and hems for shorts, cargo pockets, shirt collars/plackets/buttons, jacket lapels and welt pockets, shirt inserts and ties, hoodie pocket/drawstrings/folded hood, tracksuit zip/trim, and sleeve cuffs. These are preset complete looks, not a separate inventory of interchangeable garment pieces or cloth-physics simulation.

The character creator now uses a dedicated, lit preview studio, so real-world night, power cuts and street obstacles do not hide the outfit. On narrow phones the full character is framed above the controls.

## Choose your look

- **New character:** creator → outfit category → outfit. Choose hair, Ankara pattern, top/jacket colour, trouser/shorts colour and shoe colour. “Outfit default” keeps coordinated lower/shoe colours. Bottom colour is disabled for patterned skirts/gowns.
- **Existing character:** Phone → **Wardrobe** → **Open wardrobe**. Outfit choices are free and immediately saved. No rented home or new game is required. The home wardrobe opens the same menu.
- **12 solid colours**, 7 existing Ankara palettes, and 4 shoe-colour overrides. The first six solid colours keep the same meaning as earlier saves. The home/phone wardrobe cycles through colours and hair; the creator has direct swatches.
- Switching outfits preserves chosen colour overrides. Use “Match trousers to outfit” / “Use outfit shoe colour” to restore automatically coordinated colours.

## Saves and time

Save format remains 9. Character name, skin, existing outfit IDs, phone and gameplay progress are retained. The new colour fields are optional; old saves use automatic coordinated colours.

**The working v0.10.1 clock fix is included.** Real WAT is mandatory for normal play, old accelerated preferences are ignored, and the actual date replaces fictional day-number labels. Weather stays simulated by default, with no weather API request or subscription. Optional live-weather opt-in retains its provider terms. See CLOCK_FIX.md for details.

## Run in VS Code

Export your save and back up your old project first. Extract the **source ZIP into a new folder**. Open the folder containing package.json, which must say **0.11.0**. Stop the older server with Ctrl+C, then run:

```sh
npm ci
npm run dev
```

Open the exact Local URL printed by Vite. If the address changes, import your exported save. The separately provided website ZIP is a built static site; it is not the folder to use for npm run dev. See START-HERE.txt and DEPLOY.md.

## Testing

- `npm run check`: unit/regression tests, production build and static validation.
- `npm run e2e:wardrobe`: phone wardrobe without housing, actual mesh switching, colour/hair persistence, save/Continue, real WAT, category filters, both character creators, mobile layout and browser/game-loop errors.
- `npm run e2e:m10`: clock/date migration and earlier clubs/furniture/public-interior regressions.
- Local character studio and geometry audit: all 24 gender/outfit combinations in idle, walking, running, seated and airborne poses, plus every selectable hairstyle. Checks finite positions, normalised skin weights, valid bone indices and sampled skinned vertices. These do not imply production certification on every real phone/browser.

Optional browser tests require playwright-core and Chromium (CHROME_PATH may be set). No test money or debug saves ship as default player data.

### Verified release results

- 138 unit/regression tests passed; production build and static validation passed.
- 57 browser checks passed: 18 wardrobe/creator/save checks, 26 M10 regressions and 13 M9 regressions. No browser or recovered game-loop errors.
- 134 outfit/pose/hairstyle geometry cases passed. Desktop and 390px creator previews were visually inspected, including studio-to-city start.
- Automated checks ran in headless Chromium with software rendering; performance and appearance can differ on real devices.
