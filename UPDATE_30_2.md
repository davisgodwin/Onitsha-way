# ONITSHA WAY v0.30.2 — performance and phone layout fixes

This is a maintenance build on top of v0.30.1. It adds no new gameplay and changes no saves, accounts or
server data. The aim is smoother play on phones and lower-end laptops, plus two fixes found in an audit.

## Safe upgrade

1. Settings > Export save first, as always.
2. Extract into a fresh folder and copy your OWN `server/data` folder in from your v0.30.1 install.
3. `npm ci`, then `npm run dev`. Use the same browser, account and `localhost` address as before.
4. Do not reset or clear saves. Nothing in this build needs a reset.

The cached offline copy updates itself (service-worker cache name `onitsha-way-v302-performance`).

## What changed

### Phone layout
- **Mail (✉) button no longer covers the Jump button** on landscape phones. Below 500 px of height the
  phone/mail button sits higher and further in. Below 380 px of height the weather chip hides and the touch
  buttons move up so nothing overlaps. Checked at 844×390, 740×360, 915×412, 667×375, 390×844, 360×780,
  1280×720 and 1100×640 (`src/ui/city-hud.css`).

### Performance
- **Street lights** (`src/world/StreetLighting.js`): the city has thousands of solar lamps. All of them were
  drawn every frame, which accounted for roughly 650,000 triangles. Only the lamps near you are drawn now:
  within 240 m on Low, 380 m on Medium, and 560 m on High. That's about the fog distance, so you
  can't see the difference. Lamps are looked up in a 100 m grid and refreshed whenever you move 20 m.
  The real night lights that are switched off (beyond the quality budget, by day or indoors) are now
  disabled outright instead of left on at zero brightness, because each enabled light makes every lit
  surface more expensive to draw. Lamp placement, coverage and the solar/power-cut behaviour are unchanged.
- **Traffic** (`src/sim/TrafficSystem.js`): empty vehicle, headlamp, tail-lamp, light-pool and board
  batches are hidden when they have nothing in them, so they cost no draw calls.
- **Static merging** (new `src/render/MergeStatic.js`): the city monuments, the place-name stands, the
  career workplaces and the dealership showrooms were built from many small pieces that never move.
  Pieces that share a material are now merged into one mesh after they are built, which cuts draw calls
  without changing how anything looks. Moving or interactive parts, such as the dealer display cars, are
  left alone, and named marker groups are kept.
- **NPC distance culling** (`src/npc/NPCSystem.js`): pedestrians further away than 50 m (Low), 75 m
  (Medium) or 100 m (High) aren't drawn or animated. The NPC you're talking to and the current mission
  contact are always shown.
- **Faster loading after updates** (`vite.config.js`): Three.js is now a separate `three-*.js` file. When
  only the game code changes, browsers that already have the Three.js file don't download it again.
  `scripts/validate.mjs` now checks for this file and its size budget.

### Tests
- `tests/e2e/smoke.mjs` was updated for the signup splash. It starts its own account server with a
  temporary data folder, so your `server/data` is never touched. It then signs up, creates a character,
  walks, saves, reloads and checks that your position came back.
- `tests/e2e/fixes26.mjs` now allows the optional business-link field, which was added to the ad form
  after that test was written. The test still checks that there are no headline or message fields.

## Measured effect

Measured in a headless browser using software rendering (no GPU), at night, averaged over six city spots.
Absolute frame times there are much slower than on any real device, so compare the before and after
figures, not the raw numbers.

| | Draw calls | Triangles | Heap |
|---|---|---|---|
| v0.30.1 | 468 | 1,416k | 397 MB |
| v0.30.2 | 439 | 771k | 391 MB |

Software-rendered frame time was 2,928 ms before the street-light and traffic changes and 2,122 ms after
them. The run after merging was too noisy to quote. The NPC culling was added after these measurements.

**Not verified:** frame rates on a real phone or a real GPU. Please try it on your own phone. Setting Settings >
Graphics quality to Low is still the best option for older phones.

## Not changed / still open

- Memory use is spread across many systems: people about 22 MB, traffic 18 MB, player vehicles 18 MB,
  collision about 15 MB and the club interior 7 MB. There was no single leak to fix, and none was found.
  Scene object counts and heap stayed flat over time.
- The other four planned missions, cloud saves, real payments and ad moderation are still future work, as
  listed in MISSIONS_30.md and UPDATE_29.md.
- Weather data: check that the weather provider's terms suit how you plan to release the game before
  publishing beyond local testing.
