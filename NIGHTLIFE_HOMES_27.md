# v0.27.0 — Night lighting, fitted homes and venue music

## 1. Nighttime streets
- Added an instanced solar LED street-light network along the mapped streets, minor roads, paths, main roads and bridge/flyover decks. Major wide roads receive lights on both sides.
- New poles are placed off carriageways and outside buildings, water and protected home entrances. Very short, duplicate or obstructed road fragments may share nearby lighting rather than receive an unsafe pole.
- Warm ground pools plus a bounded pool of real nearby lights illuminate road surfaces, people and vehicles. Lights ramp with the existing dusk/dawn simulation and turn off in daylight.
- These new fixtures are solar-powered, so NEPA cuts do not black out the street network. Existing grid-connected utility lamps still obey power cuts.
- Instancing and 6/9/12 local lights for low/medium/high quality keep GPU light counts bounded. Shadows are not added to thousands of lamps.

## 2. Essential home fittings
- All homes now include ceiling bulbs and a wall switch, a permanent fitted kitchen (cooker, sink, worktop and cabinets/storage), and an enlarged bathroom with toilet, basin and shower.
- Duplexes have their kitchen downstairs; their upstairs bathroom and bulbs remain independent interior fixtures under the house's master switch.
- Bathroom footprint: 2.5 × 2.8 game metres (7 m²), previously 1.65 × 1.95 (~3.2 m²); doorway widened to 1.15 m. Small home minimum dimensions were expanded to retain usable circulation.
- Kitchen: interact at cooker to cook existing recipes using your ingredients; sink washes hands; cabinet access opens the existing home storage.
- Bathroom activities work without purchasing fixtures first. Bought furniture and decorative fittings remain optional upgrades.
- The house switch saves its on/off state. Ceiling bulbs respect NEPA, generators and inverters. A separate carried rechargeable lamp may still light the room when the ceiling switch is off.
- Real warm light sources sit beneath the ceiling bulbs; the existing indoor ambient/daylight simulation still applies.

### Existing saves
Rental IDs, rent expiry, wallet, storage and ownership are not reset. Furnishings that would overlap the new walls or fixed fittings, or obstruct their access, move to home storage with a toast. They are not sold, removed or charged again; place them again in Buy mode. Their old coordinates remain in their placement record for reference.

The larger interiors are game layouts, not surveyed floor plans or exact reconstructions of the exterior footprint. Movable beds, sofas, appliances and decor are still bought by the player.

## 3. Clubs and bars: music that actually plays
Three original instrumental Afrobeat-style game tracks are bundled:
- Iweka Afterglow — 108 BPM
- Niger Breeze — 102 BPM
- Market Lights — 114 BPM

Layered original percussion, bass, offbeat guitar/keys and synth-brass phrases replace the old single kick pulse in the club. These are not licensed commercial artist songs or vocals.

Music is audible inside an open club and within 30 game metres of an open bar. It fades with distance, stops when a venue closes or you leave, and stops during pause/map screens or a hidden tab. Choice menus keep it ducked through the existing audio manager. Audio requires a click/key gesture due to browser autoplay rules.

At a bar menu, club dance-floor menu or the new DJ interaction, select **Music — playlist & volume**: mute/unmute, next track, quiet/normal/loud. The global volume/mute also applies. Music preferences persist in browser settings. The playlist advances automatically; only one source is active.

Local MP3s need no external radio service; production service-worker installation precaches them for offline play. Existing external car radio is unchanged and has separate rights/deployment considerations.

Music generation source: `scripts/compose-venue-music.py` (optional regeneration uses Python, NumPy and FFmpeg; normal players do not need these).

## 4. Upper Iweka monument research — not verified / not added
Searches for an Upper Iweka roundabout statue, monument, sculpture and obelisk did not establish a reliable monument identity and location. No invented statue or historical attribution has been placed there.

The Nnamdi Azikiwe bronze is documented at DMGS Roundabout, **not Upper Iweka**. The existing simplified Zik/DMGS game monument remains in its existing location.
Source consulted: The Sun, “Outrage in Onitsha as Azikiwe’s sculpture is defaced”, 17 January 2025:
https://thesun.ng/outrage-in-onitsha-as-azikiwes-sculpture-is-defaced

To finish this item, provide a photo, monument name or a precise map pin for the Upper Iweka feature. A current reference will also help distinguish the roundabout from the flyover/interchange.

## Install / update
1. Export your important browser saves first. Back up your existing `server/data` folder.
2. Patch ZIP: overlay the included `onitsha-way/` contents onto your existing v0.26.2 project, replacing matching files. Source ZIP: extract into a fresh folder and copy only your OWN server/data from the old project.
3. From the project folder run `npm ci`, then `npm run local`.
4. Keep the same localhost URL/port, browser profile and account to retain your character. Do not clear localStorage or server data. No account credentials are bundled.
5. Static/offline deployment: `npm run build`; upload the complete `dist/` output. Static hosting alone still does not provide the local account/WebSocket server. This is still a prototype; co-op and ads remain TEST-only, with no real payments.

Tests: `npm run check`, `npm run test:nightlife27`, `npm run e2e:nightlife27` (Playwright + Chromium required for browser tests). See `qa/v27/feature-audit.json` and `qa/v27/layout-audit.json` for this release's run results.
