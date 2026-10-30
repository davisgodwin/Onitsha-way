# v0.35.0 test results

Linux sandbox, Node 22, MariaDB 10.11, headless Chromium (software rendering) with a fake microphone. **No real
phone, iPhone or Windows PC.** The "phone" is a phone-sized touch Chromium opening the game on this machine's network
address, accepting the certificate warning the way a player taps "Proceed".

## Unit, layout, build
| Command | Result |
|---|---|
| `npm run check` | **Pass**: 283 tests, 7/7 layout, build, build validation |
| `npm run test:all` | **Pass, 286/286**, 0 skipped |

`tests/lan35.test.mjs` (new) covers:
- **https gateway.** The certificate verifies against the local CA (and is untrusted without it, which is why
  phones warn). Plain http on the same port redirects to https with the path kept. The CA download works and never
  contains a key. The API and the secure WebSocket (wss) work over https.
- **Certificate reuse.** The certificate is reused, renewed when the Wi-Fi address changes, and keeps the same CA.
  Key files are private to the owner.
- **Name constraints.** A certificate for www.google.com or a public IP signed with this CA is **rejected**
  (OpenSSL: "permitted subtree violation"). The game's own certificate is trusted.
- **All vehicle models.** All 43 vehicle models are kept by the server when a player drives them, and unknown names
  (e.g. `__proto__`) are still refused.

## Browser end-to-end
| Suite | Result |
|---|---|
| `lan35.mjs` (new) | **17/17**, with the PC on `https://localhost` and the phone on the network address. The phone's plain-http address redirects to https, where the microphone is allowed. **The phone sees the PC player's Toyota Corolla** (a v0.25 model the server used to drop) **with the driver seated in it, and the car moves as they drive**. The 🎙 button shows and a tap opens the voice menu. Nearby voice starts on the phone. **PC and phone open a direct voice connection with audio both ways.** The phone is muted until the button is held; **holding it sends audio and the PC sees "talking"**; letting go mutes; a long hold doesn't open the menu. Holding V on the PC still works. No page errors |
| `lan34.mjs` | Pass, 14 (now runs `npm run lan -- --http`) |
| `cloudsave33.mjs` | Pass, 14 |
| `entry.mjs` | Pass, 15 |
| `smoke.mjs` | Pass, 8 |
| `phone18.mjs` | Pass, 20 |
| `place-names301.cjs` | Pass, 12 (map labels are still names only) |
| `vehicles25.mjs` | Pass |

Screenshots reviewed: the phone HUD (Voice button below ✉, green "Talking…" while held), the voice menu, the phone
app, messages, homes list, landscape HUD, **the remote car on the phone**, and the big map on phone and desktop.
Before the fix, the phone map repeated "Old Market Road" six times and had labels on top of pins and under the search
panel. After the fix there are no overlaps, nothing under the panel, and street names appear (more when zoomed in).

## Not verified
- A real Android phone or iPhone, the real certificate warning screens, and installing the CA on them. The
  steps in UPDATE_35.md follow the platforms' usual menus, but names vary by phone brand.
- Voice over real Wi-Fi between separate devices (the test devices ran on one machine), and audio quality.
- Whether iPhone Safari keeps the live connection over wss after "visit this website" without installing the CA.
  UPDATE_35.md recommends installing it if the city won't connect.
