# v0.54.1: the game loads on iPhones (and on smaller Android phones)

## Why it was stuck on iPhone
iPhones (Safari, and every iPhone browser, since all of them run on Safari's engine) give a web page only about
256–384 MB of memory for the images the game paints. The game paints its signs, boards and city textures that way,
and kept them all: about 480 MB.

On iPhone, the page ran out partway through loading and the loading screen froze ("Still loading…"). We reproduced
exactly that screen by giving the game the same limit in the test browser.

## The fix
- **Painted images are freed once used.** As soon as an image is on the graphics card, its painted copy in memory is
  let go. The picture stays the same.
  - This happens while the city loads too, not just after.
  - Peak memory for these images went from 479 MB to 104 MB, and the game finishes loading even under a 160 MB limit.
  - Screens that keep changing are left alone: the TV, the club's LED wall and name, the stadium scoreboard, news
    screens, the parlour board, the arcade screens and the player billboards.
- **Older iPhones (iOS 15)**: a few things the game uses that Safari only added in iOS 15.4 / 16 are now provided by
  the game itself.
- **Phones start on the low setting.** iPhones and Android phones are switched to it once (you can change it in
  Settings). It uses much less memory and loads faster. On the Galaxy S8 the game was stuck while building the city,
  most likely for the same memory reason.
- **Errors show on the loading screen.** If something still goes wrong while loading, the loading screen now says
  what happened, instead of freezing, so a screenshot tells us exactly what failed.

Version 0.54.1 also renames the offline cache, so phones fetch the new files instead of the old copy.
