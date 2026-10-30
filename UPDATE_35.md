# ONITSHA WAY v0.35.0 — voice chat on phones, other players' vehicles, cleaner map text

## What's fixed
1. **Other players' cars show up.** The server only passed on 12 of the original vehicle models, so anyone driving
   one of the cars, buses, lorries or the motorcycle added in v0.25 looked like they were floating in the air. Every
   model the game sells now reaches other players, and the driver sits properly in the car. The car's movement and
   turning are smoothed, and passengers use each model's real seats.
2. **Voice chat works — on the PC and on phones.**
   - There was no way left to switch voice on (the old Voice phone app was removed in v0.19.3). There's now a
     **🎙 Voice** button under the ✉ messages button in online play.
   - **Tap it** → choose **Talk to players nearby** (60 m, quieter with distance) or **Talk to my crew**. The
     browser asks for the microphone the first time.
   - **Press and hold it to talk** (it turns green: "Talking…"). On a keyboard you can also hold **V**. A quick
     tap while voice is on opens the menu: switch nearby/crew, open mic, mute everyone, turn voice off.
   - Phones only allow the microphone on secure (https) pages, so **`npm run lan` now uses https** (see below).
3. **Map text on phones.** Road names no longer stack on top of each other or on top of pins, the same name
   isn't repeated all over the screen, and nothing hides under the search panel. Area-boy (A) spots are named
   only when you zoom in, because they're named after the street they're on. Bus-stop names follow the same rules.
   The "● 2 online" text in the status bar is now level with the rest of the bar.

## LAN play is now https
Run `npm run lan` as before. The terminal now prints **https://** addresses:
```
 On phones / other PCs on the same Wi-Fi, open:
   https://192.168.1.23:5180
```
If someone types the address without `https://`, they are sent to the https page automatically.

**The first time on each phone, the browser warns** that the connection is not private. That's because the
certificate was made by your PC, not by a public authority. It's your own game on your own Wi-Fi, so it's fine to
continue:
- **Android (Chrome):** tap **Advanced** → **Proceed to 192.168.… (unsafe)**.
- **iPhone (Safari):** tap **Show Details** → **visit this website** → **Visit Website**.
- **Another Windows PC:** Chrome/Edge → **Advanced** → **Continue to 192.168.… (unsafe)**.

Then log in as usual. The 🎙 button works once the page is open this way.

### Optional: install the certificate to remove the warning
If the warning bothers you, or voice or the city won't connect on an iPhone after you accept the warning, install
the game's certificate on that device once. Open the address printed in the terminal, ending
`/onitsha-way-local-ca.crt`, for example `https://192.168.1.23:5180/onitsha-way-local-ca.crt`.
- **Android:** the file downloads. Open **Settings → Security (& privacy) → More security settings → Encryption &
  credentials → Install a certificate → CA certificate → Install anyway**, then pick the downloaded file. The names
  differ a little between phone brands; search Settings for "certificate".
- **iPhone:** Safari asks to download a profile → **Allow**. Then **Settings → Profile Downloaded → Install**.
  Then **Settings → General → About → Certificate Trust Settings** → switch on **Onitsha Way local CA**.
- **Windows PC:** double-click the file → **Install Certificate** → **Current User** → **Place all certificates in**
  → **Trusted Root Certification Authorities**.

The certificate can **only** vouch for local addresses: 192.168.x.x, 10.x.x.x, 172.16–31.x.x, localhost and your PC's
name. It is technically limited so it can never be used for real websites, even if the key were stolen (checked by
the tests). The key stays in `server/data/lan-cert/` on your PC; don't share that folder. To remove the certificate
from a phone later, it's under the same security settings (Android: "User credentials"; iPhone: Settings → General →
VPN & Device Management).

The PC's addresses can change, for example after a router restart or on a different Wi-Fi. `npm run lan` then makes a
new certificate automatically. An installed certificate keeps working because it's the same CA.

`npm run lan -- --http` still starts plain http, as in v0.34. Voice then works on the host PC only.

## Unchanged
Accounts, MySQL, cloud saves, the join code and "local network only" all work as before. `npm run dev` is unchanged.
Save format 16. New dependency: `@peculiar/x509` (MIT) for making the certificates.

## Files
- `server/service.mjs`: accepts every model in `VEHICLE_MODELS` (was a hard-coded list of 12); seat capacity by body type.
- `src/online/OnlineCity.js`: remote cars are smoothed, the driver is seated exactly in the car, and seats are looked up per model.
- `src/online/VoiceButton.js` (new), `src/online/online.css`: the 🎙 button and voice menu.
- `server/lanCert.mjs` (new): local CA with name constraints, and a per-address certificate.
  `server/lanGateway.mjs`: https plus a plain-http redirect on the same port, and the certificate download.
  `scripts/lan.mjs`: https by default, `--http`.
- `src/ui/MapLabels.js`, `src/ui/Minimap.js`: map label collision, repeats, header area and agbero labels.
  `src/ui/city-hud.css`: the online-count alignment.
- Tests: `tests/lan35.test.mjs`, `tests/e2e/lan35.mjs`; `tests/e2e/lan34.mjs` now runs the `--http` mode.
