# v0.19.0 — Car radio, first playable version

## Use it

Run `npm ci`, then `npm run local`, and open http://localhost:5173. Enter a vehicle you own. The driving dashboard now includes CAR RADIO.

1. On first use, tap **Enable live radio**. This allows a direct internet connection to the selected station provider and uses internet data.
2. Radio Sapientia 95.3 FM is the default. Use the station dropdown or previous/next controls to tune another station.
3. Adjust radio volume or switch the radio off. Selection, volume, power and the initial enable choice are remembered in this browser's device settings.
4. After enabling once, entering a car automatically tunes your last selected station if power is still on. Some browsers still require a Play radio tap after a reload or delayed entry.
5. Getting out stops playback and releases the stream connection. The game does not record or download programmes for offline listening.

This works in player-owned vehicles, including the existing keke. It does not add radios to public transport or broadcast a driver's station to other players/passengers. Vehicle fuel, damage, purchase, horn and handbrake behavior is retained.

## Stations and what was actually verified

Checked on 2026-10-18. Public availability can change; a configured station is not a guarantee of continuous service or commercial-use permission.

| Station | Configured source | Release verification |
| --- | --- | --- |
| Radio Sapientia 95.3 FM | https://cast4.asurahosting.com/proxy/radiosap/stream | Endpoint returned HTTP 200, audio/mpeg, ICY name “Radio Sapientia Onitsha” and ICY website https://sapientiaonitsha.com/. See browser results for actual media playback check. |
| Udala Radio 104.7 FM | https://stream.zeno.fm/vw5h7u0a4octv | URL appears in the official site's audio element. Direct probe returned HTTP 401 from this environment. May be unavailable; no bypass or replacement broadcast is used. |
| City Radio 89.7 FM | https://stream.zeno.fm/1rtopmpcmdqvv | URL published by its public directory player. Direct probe returned HTTP 401 from this environment. Not claimed as live-tested. |

Sources:
- Official Sapientia site: https://sapientiaonitsha.com/
- Sapientia listening listing used to locate the endpoint: https://radiostations.ng/354-radio-sapientia.html
- Official Udala site: https://radioudala.com/
- City Radio public player: https://www.streema.com/radios/City_Radio_89.7FM

The Sapientia official homepage's “Stream Online” link did not expose a usable direct audio URL during inspection. The configured URL was discovered through the listing, then independently checked against the stream's station identity and official website. It is not the station's television stream or a different country's Sapientia station.

## Audio behavior

- One HTML audio element at a time. Changing station, switching off, leaving the vehicle, quitting to menu, backgrounding or leaving the page releases the previous source.
- Returning to the visible game resumes an enabled in-car radio. Loss of internet shows an offline state; reconnecting can resume it. An ordinary station failure does not trigger an unlimited reconnect loop.
- Errors, stalled buffering and autoplay refusal have honest status and a manual retry. The UI shows “Live internet broadcast” only after the media element fires a playing event.
- Main game mute also mutes the external stream, not just procedural game sounds. Pause/map/phone attenuation is applied to the radio.
- Radio lowers while your enabled voice mode is transmitting or an eligible, unmuted connected peer reports transmission. This uses the existing push-to-talk/open-mic indicators, not speech recognition. Open mic can therefore keep the radio lowered continuously.
- Mobile Safari/iOS may use hardware volume rather than honoring script volume/ducking. Mute/power and stopping still work; test on target phones before launch. Use headphones for voice chat to reduce speaker feedback.
- External streams are not cached by the service worker and do not pass through the game server. The station provider receives the listener's connection; playback requires internet even though the game runs locally.

## Rights and scope

This is a local prototype using publicly exposed listening endpoints. No commercial integration license, station partnership, logo rights or music rights clearance has been obtained or implied. Confirm the necessary station/provider and rights permissions before public release or monetisation. Do not record, redistribute, replace a failed broadcast with unrelated audio, proxy around restrictions or publish the prototype as a licensed radio service.

There are no fake now-playing song names, fabricated signal bars or local copies of station content. Stream errors do not deduct game money. No paywall/authentication bypass was attempted for the unavailable stations.

## Upgrading safely

Stop the old terminal. Extract this version to a new folder and copy your OWN previous `server/data` directory into it before starting. Keep the same browser profile and http://localhost:5173 URL to retain account-scoped character saves and device settings. Back up/export important saves first. Never include server/data in a shared source ZIP.

Account-first entry, the v0.18 phone/messages and test advertising remain. Ads still use simulated payments: ₦3,000 per seven-day slot, no real charge.

## Developer setup

Edit `src/data/radioStations.js` when a station supplies a new approved direct HTTPS audio endpoint, then rebuild/restart. Never include passwords, signed private tokens or secret credentials in this client-side file. MP3/AAC browser-compatible direct streams are the intended format; this implementation does not add an HLS/transcoding proxy.

- `npm run test:radio`: deterministic state, consent, media cleanup, preference, mute/duck, race, timeout and failure tests.
- `npm run e2e:radio`: real account entry, car purchase/entry, live Sapientia media playback, controls, error fixture, mobile/landscape bounds, leaving/re-entry and preference reload. Requires Playwright/Chromium and internet for the live station check.
- `npm run check`: existing 251 core assertions, production build and asset validation.
- Existing account, session, mail and multiplayer server tests remain available.

See QA_RADIO_19.md for exact release coverage and limitations.
