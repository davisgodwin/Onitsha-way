# v0.44.0 — Open life, stage 5: players together; walk-in interiors; new menus

## Walk into every establishment
Each one now has a full interior, built when you walk in:
- **Police station** (Nigeria Police Force, Onitsha Division): the charge room counter with officers behind it,
  desks and files, a notice board with wanted posters, benches, the DPO and CID doors, an interview room door, the
  flag, and **the cells** behind bars. Custody, bail, court and joining the force all happen at the front desk.
- **EFCC field office**: reception with turnstiles and a scanner arch, a wall of screens, case-file shelves, an
  **interview room** behind dark glass, a waiting sofa.
- **Hospitals**: reception and card room, rows of waiting chairs and a TV, the **pharmacy** window, a
  **consulting room** (doctor, couch, curtain), **Ward A** with four beds and drips, the nurses' station, a hand-wash
  sink. Reception, the doctor, the ward and the pharmacy each open the hospital's services.
- **Banks**: the banking hall in the bank's colours: four **teller windows** behind glass with tellers, queue barriers,
  **customer service / loans** desks, an **ATM gallery**, the rate board, a security man. The hall is open 8:00–17:00;
  after hours the door is the ATM (and whatever else happens at night).
- **Magistrate Court**: the **bench** with the magistrate, the registrar, the **witness box** and the **dock**,
  prosecution and defence tables, the public gallery, the **registry** counter. Sits 8:00–17:00.
- **Shoprite**: real aisles of stocked shelves (groceries, beverages, household, toiletries), chilled and frozen
  fridges, fresh produce, clothing rails, appliances, **four tills** with cashiers, trolleys.
- **The four home stores**: showrooms laid out for what they sell (sofas, a dining set and a bed; a wall of TVs,
  fridges and washing machines; generators, chandeliers and inverters; plants, vases, carvings and rugs), with the
  shopkeeper at the counter for the catalogue.

## New menus
The menus now look like Onitsha's own signboards: the title is a hand-painted keke-yellow board (Anton lettering,
bundled with the game so it works offline and on LAN; SIL Open Font License), with a green "Anambra State, Nigeria"
strip. The main menu is a route board; the **pause menu** shows today in Onitsha (date, weather, power, who you are,
your record, what's on) beside tiles for everything you can do, instead of a long list; **Settings** are grouped
(Display, Controls, Sound, World, Your save) with Done always in reach. The account screen and the in-game choice
screens share the look. Checked on a desktop and a phone-sized screen.

## Players together (stage 5)
Walk up to another player and press E (**"… — meet"**):
- **Give them money** (₦1,000, ₦5,000 or ₦20,000): the account server moves it from your books to theirs; it
  arrives as "From <your name>". Friends can be paid from anywhere, anyone else only when standing with you. Up to
  ₦500,000 at a time and ₦2,000,000 a day.
- **Send a message**, or **report them** to the moderators (harassment, offensive, cheating, keeps targeting me).
- **Crime between players** (adults, out on the streets): **pick their pocket** (up to 20% of the cash they carry,
  at most ₦5,000) or **rob them** (up to 35%, at most ₦20,000). The **server** decides whether it works and moves the
  money. The other player is told who it was and can **report it to the police**: the police case against you gets
  stronger (and they still hear about it if you're offline when they report it).
- **Safeguards, all enforced by the server**:
  - **safe areas**: near the police, a hospital, a bank or the court, and indoors;
  - **peace mode** (phone > Law & street > Other players): nobody can target you, and you can't target anyone. You
    can't switch it on in the 30 minutes after you've targeted someone;
  - after trying, you wait **10 minutes**; someone who was targeted can't be targeted again for **30 minutes**;
  - at most **three a day**; never with **children**; **blocked** players can't interact at all.
- Phone > Law & street > **Other players** shows peace mode, your waits, and recent incidents (report from there).

## The open items from v0.43
- **The account server over the LAN gateway**: tested (https and secure WebSocket, as phones on your Wi-Fi use it):
  the books open, earnings count, tampering is corrected, and players rob and pay each other through it.
- **A long online session**: tested with over 3,000 transactions across four days of play, the network dropping for
  five hours every day: nothing honest refused, nothing needing correction, the books matching to the naira.
- **The older browser tests** (vehicles, nightlife, football, LAN, furniture): re-run on this build (see
  TEST_RESULTS_44.md).
- **"The server checks results; it doesn't play the game itself"**: partly closed: everything between players
  (payments, pickpocketing and robbery, reports) is now decided and carried out by the server itself. For the single
  player game the server still checks what your game reports against the game's rules, rather than running the whole
  city simulation; that's a design limit, not something a test can close.

## Saves
- No new save version: v0.44 uses save version 20, with the account-server state added in v0.43.

## Not in this stage
- Politics and elections are stage 6; the remaining occupations stage 7; world reactions and balance stage 8.
- Interior staff stand at their posts; they don't walk around.
