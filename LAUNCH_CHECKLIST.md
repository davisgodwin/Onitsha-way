# Onitsha Way: launch checklist (v0.48)

These are the checks that need real hardware. I couldn't do them from my workspace, which has no phone, no Windows
PC and no second machine. Everything that can run headless was tested; see TEST_RESULTS_48.md. Tick each box before
inviting real players. **About 30 minutes in all.**

## 1. Windows + XAMPP (the database you'll launch on)
- [ ] Open the XAMPP Control Panel and **Start MySQL**.
- [ ] In the game folder: `npm install`, then `npm run db:setup` (the first time only). It says "✓ Connected … Database and tables are ready."
- [ ] `npm run dev`. In the terminal: `Storage: MySQL database "onitsha_way"` and no red errors.
- [ ] In a browser, create an account and a character, play for 2 minutes, then refresh the page. You're back where you
      were.
- [ ] Stop the server (Ctrl+C) and start it again. Sign in: the same character and money.
- [ ] In phpMyAdmin (http://localhost/phpmyadmin), database `onitsha_way`: the `users` table has your accounts and `game_saves` has your save.
      (Look only. Don't edit them.)

## 2. A real phone on your Wi-Fi
- [ ] On the PC: `npm run lan`. It prints an address like `https://192.168.x.x:5180` and a join code.
- [ ] On the phone (same Wi-Fi), open that address. Accept the certificate warning once (it's your own server; UPDATE_35.md shows the steps). New accounts need the join code.
- [ ] Sign in with a second account. Check:
  - you can walk with the joystick and look around;
  - the phone opens, and Messages works;
  - a bus stop: pressing "Where are you going?" lets you ride.
- [ ] Go to Upper Iweka Motor Park. Buses come in, park in the bays and leave.
- [ ] Turn the phone sideways and back. The buttons stay on screen.
- [ ] Play for 5 minutes. The phone shouldn't get too hot. If it does, set Quality to Low in Settings.

## 3. Two machines together (PC + phone, or two PCs)
- [ ] Both signed in with different accounts. Each sees the other walking in the street.
- [ ] Make friends (Messages → Add friend → Accept).
- [ ] **Decorating online:**
  1. Player A rents a home and goes inside.
  2. A opens Messages → B → **Hire to decorate**, sends the offer, and B accepts.
  3. B arrives inside, presses E in the middle of the room, picks a sofa and sends the suggestion.
  4. A presses Accept: the sofa appears for both players.
  5. B taps Finish, and A pays the fee. B's money goes up by the fee.
- [ ] Football: B, on a Saturday at the stadium, signs for Onitsha City FC and plays the league match (11-a-side).

## 4. The bigger map (GRA is in)
- [ ] Load your own save from v0.47: you, your home, your furniture and your friends are where they were.
- [ ] Drive to GRA Phase I (north): palms, lawns, villas. Drive east or south: COMING SOON boards at the LGA line.
- [ ] On the phone: the frame rate in GRA and in the market is playable (the map is about 50% bigger than before).

## 4b. v0.49 on a real phone
- [ ] Load time and frame rate with the filled city (low setting): in the market, in GRA, driving down Iweka Road.
- [ ] The map: search with the phone keyboard, the chips scroll sideways, pinch to zoom, the key opens.
- [ ] At a traffic light: cars stop on red and go on green; at a warden junction the warden stands on the corner.
- [ ] Rent one of the new walled houses (a TO LET sign at a door inside a compound) and go in.

## 5. Before inviting the public (not just friends on Wi-Fi)
- [ ] Put it online with DEPLOY.md: HTTPS, a real domain and a strong database password (not XAMPP's empty one).
- [ ] Test payments are still test-only. Real money needs a real payment provider, contracts and your own review.
- [ ] Back up `server/data/` (or the MySQL database) every day.
- [ ] Read the reports players send (Messages → Report). There's no automatic moderation.
