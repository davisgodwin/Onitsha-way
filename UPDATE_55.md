# v0.55: the city is worked out once, not on every phone

## The problem
Every phone was building the whole city of Onitsha from scratch each time the game opened. It decided where each of
the 20,397 buildings, every house to rent or buy, the kiosks, filling stations, gates and walls go. That meant asking
questions like "is this spot free?" and "does this plot touch a road?" about **6–7 million times**. The layout is
seeded, so the answers are the same on every phone, every time. Each phone was redoing a long job whose answer never
changes. The whole city was also kept in memory, which older iPhones run out of: Safari then reloads the page.

## What changed

### 1. The city plan file
- The answers are recorded once from a full load and saved as small files in `public/plan/`: about 180 KB for Low,
  204 KB for Medium and 226 KB for High.
- When a phone loads, it downloads its file and reads the answers from it instead of working them out.
- **The city comes out the same.** On each setting, the finished city was compared with v0.54.4: the same homes
  (ids and places), walls, shapes, props and services.
- **Safety:**
  - The file is named after a fingerprint of the exact game code and map. It is only used by that build, on that
    graphics setting.
  - About 1 answer in 89 is still worked out for real and compared.
  - The finished city is compared with the recorded one.
  - If anything differs, the page reloads once without the file and works the city out itself. It is slower, but
    the city is never different.
- If there is no matching file (for example the code was changed without re-recording), the game works everything
  out as before.
- **After changing any code in `src/` or the map, run `npm run bake`.** It needs `playwright-core` and Chrome or
  Chromium, and records new files. The override zips include fresh files, so nothing to do when you use them.
- Phones keep the file in their cache for the next visit.

### 2. Less memory
- **Walls are kept in flat number arrays**, not one object per wall. The city has 615,000 wall edges.
- **Spare room in the wall grid is given back** after loading.
- **Cars of the same model share one shape.** Only the paint differs, so the cars on lots, in garages and on the road
  no longer each carry their own copy.
- **Traffic car shapes drop their memory copy** once they are on the graphics card.
- **The minimap's temporary shading canvas** (about 37 MB) is released straight away.
- **The plan answers are thrown away** once the city is built.

### 3. Recovery after an out-of-memory reload
If the last load never finished (Safari ran out of memory and reloaded the page), the next load switches to the Low
setting and says so in a message. Low lays out a smaller city and needs less memory. Players can change the setting
back in Settings.

## Measured on the test machine
Measured on 2 CPUs with software graphics, full load until you can play:

| | v0.54.4 | v0.55 |
|---|---|---|
| Load, Medium (s) | 58.7 | 32.9 |
| Load, Low (s) | 44.3 | 28.8 |
| Planning questions worked out while loading | ~6.8 million | ~76,000 spot checks |
| Memory after loading, Low (heap snapshot incl. shape buffers, MB) | 444 | 393 |

A big part of what's left on this machine is the software graphics drawing the loading screen and compiling shaders.
A phone's graphics chip does that much faster.

## Still to know (iPhone 8)
- Loading on iPhone 8 is not tested here: there is no device in the test setup.
- The game still holds about 390 MB after loading on Low, plus what the graphics card holds. The remaining memory is
  spread over many parts of the city. Each is a few tens of MB:
  - the shapes of streets, markets and props;
  - the people;
  - the traffic;
  - the homes data.
- If the iPhone 8 still reloads, the next step is to build those parts only around the player, the way the market
  stalls already are.
