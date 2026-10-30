# v0.50.0: watch TV, WELCOME TO GRA gateways, and the nightclub rebuilt

## Television you can watch
Buy a TV (the flat-screen on a stand or the 55" wall TV), place it and switch it on. The menu now has seven channels:

| Channel | What's on | Game time | What you get |
|---|---|---|---|
| Nollywood drama (Ụlọ Movies) | *The Inheritance of Obiageli*, *Village Girl, City Heart*, *Market Wahala* | 60 min | fun, social |
| Hollywood-style action (Cinema Gold) | *Midnight Pursuit* (a car chase), *Steel Horizon* | 90 min | fun |
| Comedy skit (LaughHub) | *Mama Nkechi and the Generator*, *The Danfo Conductor*, *We Have Food at Home* | 20 min | the most fun |
| News (OTV News, fictional) | the evening news, with a ticker | 30 min | a little charisma |
| Football highlights (Sports Arena) | Niger Harbour FC v Coal City United | 40 min | fun, social |
| Music videos (Afro Hits TV) | the top 10 countdown | 30 min | fun, energy |
| Cartoons (KidzToon) | *Mbe the Tortoise* (the folk tale) | 25 min | fun, energy |

- **The picture is real**: the game draws each programme live: the people talk, the cars chase, the ball moves,
  the dancers bounce. Captions run along the bottom.
- **On the TV in the room**: while the TV is on, its screen shows the channel you last watched.
- **Big on your screen**: choosing a channel opens it large, with a progress bar, *Change channel* and *Stop
  watching*. At the end the clock moves on by the programme's length and you get the reward. Stop early (or walk
  away) and you get your share of it.
- **The schedule** changes with the game hour, so a channel doesn't always show the same programme.
- **Made up**: every show, channel, team, artist and character is invented for the game. Nothing is taken from real
  films, broadcasters or clubs.
- **No sound** comes with the programmes.

## WELCOME TO GRA
- **Big arches** stand over the main roads where they enter GRA Phase I and GRA Phase II: four in all, on roads
  into both. They have cream-and-gold pillars with lamps and a green board reading "WELCOME TO GRA PHASE I · ONITSHA ·
  ANAMBRA STATE". You can read the board from both directions.
- **Placement**: the arches go on the biggest roads first (up to three per GRA), a few metres inside GRA. A spot
  where a pillar would stand on a house or another road is skipped, which is why there are four rather than six.
- **On the map**: each one is listed as "Welcome to GRA Phase I · (road)".

## The nightclub, rebuilt
Every club in Onitsha uses the new room (30 × 24 m, before 22 × 18). Each club keeps its own name on the walls.

**The room**
- **The stage**: DJ decks and mixer, speaker stacks and a truss.
- **The LED wall** behind the DJ: an equaliser that moves with the music actually playing, the now-playing track,
  and shout-outs.
- **The dance floor** is LED tiles that pulse with the bass.
- **Lights**: six moving light beams and eight lasers.
- **The VIP section**: three sofas behind a gold rope, with tables and ice buckets.
- **The bar**: a long counter with lit bottle shelves and stools.
- **The bathroom.**

**The people (38)**
- 20 dancers. They raise their arms when the DJ hypes the room.
- 5 VIP guests and 4 people on bar stools.
- The DJ and a hype man on the stage.
- 2 bar staff, 3 waitresses and 2 bouncers at the door.

**Things to do**

| Where | What |
|---|---|
| DJ | **Request a song**. Tip ₦1,000 and it plays next, or ₦5,000 and it plays now with a shout-out ("SHOUT OUT TO ...") on the LED wall. The DJ and hype-man gigs from v0.46 are here too. |
| Dance floor | **Dance** (as before), or **spray money**: ₦5,000, ₦20,000, ₦50,000 or ₦100,000. The notes fly from your hand over the dancers and land on the floor, and the crowd goes up. For ₦50,000 and more the DJ calls your name on the wall. |
| VIP lounge | **Dorime bottle service**: ₦30,000 for two bottles, ₦80,000 for three. The waitresses carry the bottles across the club to your table, held high with sparklers; "DORIME!" goes up on the wall and the room raises their glasses. Then they go back to the bar. Also: chat and relax. |
| Bar | drinks, food and conversation (as before) |
| Bathroom | as before |

- **Rewards**: spraying and Dorime give fun, social and charisma, and are noted in your reputation once a night.
- **The v0.46 bug is fixed**: in v0.46 a code comment hid the dance floor, bar, VIP and bathroom in the club, so
  only the DJ and the exit answered. They all work now.
- **Unchanged**: child characters still can't go into a nightclub. Clubs are open 19:00–04:00.

## Club music
- **Two new original DJ mixes**, made for this game by a script in the project (`scripts/compose-club-mixes.py`):
  - *Onitsha Nights*: an Afrobeats mix, 104 BPM, 7½ minutes;
  - *Amapiano Sunday*: an amapiano mixtape, 113 BPM, 7 minutes, with log drums and shakers.
  
  Each has three tracks blended with DJ crossfades, risers and air horns. The three Afrobeat-style bar tracks
  follow in the club playlist.
- **How they were checked**: they were made and checked by measuring them (levels, frequency balance), not by ear.
  Have a listen and tell me what to change.
- **No commercial songs.** Real Afrobeats and amapiano hits and DJ mixes belong to their artists and labels, so the
  game can't ship them.
- **Your own music**: put music you have the rights to in `public/audio/club/custom/` and list it in
  `playlist.json` (how: `public/audio/club/custom/README.txt`). It then shows in the club playlist and the DJ's
  request list.
- **Streaming**: the long mixes stream as they play rather than being loaded into memory, so they're light on
  phones. They aren't stored for offline play (the short bar tracks still are).

## Saves
- The save version is unchanged (23). Nothing is moved or removed.
- The TV channel isn't saved; a switched-on TV shows the last channel you watched in that session.
