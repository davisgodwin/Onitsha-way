# ONITSHA WAY v0.34.0 — LAN play: phones and other PCs on the same Wi-Fi

One computer hosts the game; phones, tablets and other PCs on the **same Wi-Fi** open it in their browser, create or
log in to accounts, and play together in the same city. Mail, multiplayer and cloud saves work across all of them.
Their games are saved on the host computer (in MySQL if you ran `npm run db:setup`, otherwise in `server/data`).

## How to play on your phone
1. On the host computer: stop `npm run dev` if it's running (Ctrl+C), make sure MySQL is started in XAMPP (if you use
   it), then run:
   ```bash
   npm run lan
   ```
   The first time it builds the game (about a minute), then prints something like:
   ```
    On this computer:  http://localhost:5180
    On phones / other PCs on the same Wi-Fi, open:
      http://192.168.1.23:5180

    JOIN CODE for new accounts on other devices:  KQ7M2P
   ```
2. **Windows asks about the firewall** the first time ("Windows Defender Firewall has blocked some features of Node.js").
   Tick **Private networks**, leave Public unticked, press **Allow access**.
3. On the phone (connected to the **same Wi-Fi**), open Chrome/Safari and type the `http://192.168…:5180` address.
4. New player: fill in the signup form and the **Join code** shown in the host's terminal. Existing player: just log in —
   your saved game loads on the phone.

Keep the terminal open while people play; Ctrl+C stops everything.

## Good to know
- **The join code** stops anyone else on the same Wi-Fi from creating accounts. It stays the same each time you run
  `npm run lan` (stored in `server/data/lan.json`); `npm run lan -- --new-code` makes a new one. The host computer
  itself never needs it, and logging in never needs it.
- **Same accounts and saves as `npm run dev`.** If you played on the PC at `localhost:5173` and now open
  `localhost:5180`, the browser treats them as different sites, but the cloud save brings your game across when you log in.
- **Phones use the production build** (smaller and faster). After you change code, just run `npm run lan` again; it
  rebuilds. `npm run lan -- --no-build` skips that when nothing changed.
- **Voice chat needs https**, which plain LAN play doesn't have, so it works on the host computer but phones show
  "Voice needs … HTTPS". Text chat, mail and everything else work.
- **Graphics:** start phones on Low or Medium (Settings → Graphics); the city is big for a phone browser.
- Other port: `npm run lan -- --port 5181`.

## If the phone can't open the page
- Both devices must be on the **same Wi-Fi network** (not one on Wi-Fi and the other on mobile data).
- Windows: Settings → Network & Internet → Wi-Fi → your network → set **Network profile type: Private**. The firewall
  rule from step 2 only applies to Private networks.
  If you clicked Cancel earlier: Windows Security → Firewall & network protection → Allow an app through firewall →
  Change settings → tick **Private** for Node.js.
- Many hostel, hotel, school and café Wi-Fis block devices from talking to each other ("client isolation"). Then use a
  **phone hotspot**: turn on the hotspot on one phone, connect the PC to it, run `npm run lan` again and use the new
  address it prints (often `192.168.43.x` on Android or `172.20.10.x` on iPhone).
- If the terminal lists more than one address, try the one marked without "(probably not your Wi-Fi)" first.

## Safety
- **Only devices on your local network can connect.** The gateway answers this computer and private addresses
  (192.168.x.x, 10.x.x.x, 172.16–31.x.x) and refuses everything else, so even an accidental router port-forward doesn't
  put the game on the internet. The account server itself still listens on 127.0.0.1 only; phones reach it through the
  gateway, which tells it each device's real address (rate limits apply per device).
- It's **plain http**: someone else on the same Wi-Fi with the right tools could read passwords as they're sent. Use your
  own home/office Wi-Fi or a phone hotspot, not public Wi-Fi, and use a password just for this game.
- Still a local prototype: no e-mail verification or password reset; test payments only. Don't port-forward it.

## What changed
- `npm run lan` (`scripts/lan.mjs`): builds, starts the account server (127.0.0.1) and the LAN gateway, prints
  addresses and the join code.
- `server/lanGateway.mjs`: serves the built game (gzip, long caching for hashed files, no files outside `dist/`),
  forwards `/api` and the live `/socket` connection, refuses non-local devices, vouches for each device's address with a
  secret header that browsers can't forge.
- `server/net.mjs`: what counts as the local network; finding this computer's Wi-Fi address.
- `server/service.mjs`: in LAN mode accepts pages opened from local-network addresses (through the gateway only), rate
  limits per device, requires the join code for new accounts from other devices; `/api/health` shows `lan`.
- `src/core/polyfills.js`: browsers switch off `crypto.randomUUID` on plain-http addresses; online actions and messages
  use it, so a fallback is provided (without it, phones couldn't send anything).
- `src/entry/EntryFlow.js`: **Join code** field when the server asks for it; the small print now says your game is kept
  on the hosting computer's server.
- Tests: `tests/lan34.test.mjs`, `tests/e2e/lan34.mjs`.
- No new dependencies. Save format unchanged (16). `npm run dev` works exactly as before.
