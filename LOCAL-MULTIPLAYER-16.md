> Historical v0.16 notes. v0.17 account-first entry and remembered-session behavior supersede registration/session instructions below. See ACCOUNT_ENTRY_17.md.

# v0.16.0 · Local city, real players

This is a **local multiplayer prototype**, not a launch-ready public game. All existing offline careers, rentals, shopping, needs, vehicles, map directions and saves remain available.

## Start here

Install **Node.js 22 LTS or newer**. In this folder:

```sh
npm ci
npm run local
```

Open **http://localhost:5173**. Keep the terminal open. Ctrl+C stops both Vite and the local account/world server (port 8787). If a port is occupied, stop the previous copy rather than opening a different origin accidentally. The normal `npm run dev` command still starts the offline frontend alone; use `npm run local` for multiplayer.

1. Export your valuable save from the previous build before updating. Extract into a fresh folder. Do not clear browser storage.
2. Use the same site address as before, or import your exported save via Settings. `localhost` and `127.0.0.1`, and different ports, use different browser storage.
3. From the main menu or in-game Online city button, choose **Account → New player? Create an account**. Accounts require a username, display name and password of at least ten characters. Do not reuse a sensitive password in a development prototype.
4. Create a character for the account or choose **Copy my offline character into this account**. Copying is explicit, backs up an existing account character, and never deletes the original offline save. Each account's character has a separate browser save key. Settings are shared.
5. Open a **second browser profile or another browser**, register a different account, and enter the city. Incognito can act as the second profile, but its character save disappears when its browser session closes. A new sign-in for the same account replaces the old connection.
6. Players in the same city/interior scene receive animated avatars and green name tags. Personal progress remains browser-local; there is no server cloud-save migration between devices yet.

Online mode is **18+**, with explicit registration confirmation and an online block for child characters. This is not verified age assurance or parental control. Offline child play remains unchanged.

## Social play

- Open **Players**, request friendship, and wait for the other player to accept. Invitations expire after five minutes and can be declined or cancelled.
- Friends can request a mutually accepted relationship. Only one partner at a time; either player can end it. Friendships and relationships persist on the local server.
- Ask a friend on a date (currently Shoprite). Both players must arrive within 30 m of the marker, check in, and stay together for 30 real seconds. Leaving resets the timer. Completion adds social/fun to the local character. No romantic actions are forced.
- Enter your rented home and invite a friend. Accepting enters a read-only guest version of that same home scene. The host and visitor can see/talk to each other. Guests cannot use the host's owner editing controls; they may leave freely. The host can end a visit. Leaving/disconnecting the host revokes access.
- Private home shell/floor and player movement are synchronized, **not live furniture edits or the host's stored inventory**. Homes and vehicle ownership are still personal/instanced; there is no global property scarcity.
- Stop your owned car near a friend (within 15 m), then offer a passenger seat. Acceptance boards them. They follow your moving car and can leave from Players. Driver can eject a passenger. Up to three online passengers in a car; two in a keke. Leaving/losing the driver ends the ride. Remote vehicles are visual, not additional solid collision bodies.
- Mute, block, unfriend, end relationship, and report controls are present. Reports are written to the local data file for the operator; **there is no live moderation team**. Blocks remove shared scene visibility/chat/voice eligibility and cancel social access. A block is not a substitute for production safety systems.

The underlying NPCs, traffic, weather and ordinary career systems still simulate per client. This is not a fully authoritative MMO simulation. Remote players/vehicles do not collide with or damage each other, and every legacy activity is not converted to co-op.

## Text and voice

**Enter** opens Chat. Nearby text reaches players within 60 m in the same scene. Team chat reaches your current crew; direct messages require friendship. Text is escaped/rendered as text, length-limited and rate-limited. Chat history is held in memory, not saved on the server.

**Voice → Nearby or Team → Apply voice channel** asks for microphone permission. Microphone is off by default. Hold **V** or the large hold-to-talk button to transmit. Release to mute. Open mic, deafen, peer mute, and Turn microphone off are available. Nearby volume fades to zero over 60 m. Team voice currently connects eligible team members **in the same scene**. Turning off voice releases microphone tracks and closes peers.

Audio uses browser WebRTC peer connections; the server relays signalling only. No voice recording is implemented. No STUN/TURN credentials or outside voice provider are required for same-machine testing. LAN/firewalls can prevent direct peer connections; a hosted release needs HTTPS, connectivity testing and often TURN.

**Browser restriction:** microphone capture works on `localhost` or HTTPS. A phone opening `http://192.168...` cannot normally use its microphone. Use same-computer browser profiles now, or configure trusted HTTPS for LAN voice testing. A real microphone is needed to hear a human; automated QA uses synthetic microphones only to test connection and PTT controls.

## Co-op tasks

Invite a friend to a team from Players (up to four members). A leader with at least two members can start:

- **Legal delivery** at Main Market: ₦1,000 game money per member.
- **Fictional risky parcel** at Bridgehead: ₦1,500 game money per member and local wanted risk. This is an abstract game rendezvous, not a real-world crime workflow.

All members must meet at the marker, contribute a check-in, remain at the location, and finish/check in after at least 30 server-clock seconds. The reward is issued once per task to each member. Claim it from Co-op; the local economy records an idempotency key before acknowledging the server credit. Rewards are not real currency and cannot be cashed out. Teams/tasks/dates/visits/seat occupancy are session-only; friendship, relationships, reports, ad orders and pending credits persist.

## Seven-day business billboards

**₦3,000 = one seven-day slot at one chosen location.** This build defines multiple slots as **consecutive time**, not simultaneous billboard capacity: two slots = ₦6,000 for 14 days, three = ₦9,000 for 21 days, up to 52 slots per campaign. To advertise in multiple areas, make separate campaigns.

Locations: **Upper Iweka, Shoprite, Main Market and Bridgehead**. The community boards are invented game placements, not real outdoor advertising inventory.

1. Open Business ads. Enter a business headline/message, an optional normal HTTPS website link, location, slot count, and optional PNG/JPEG/WebP artwork. Artwork is resized locally (maximum 640 px side, roughly 200 KB payload). No SVG, arbitrary HTML or script links.
2. Create a **test checkout**. The server computes the amount from slot count. Client-supplied amounts/expiry dates are ignored. An order alone does not appear on the billboard.
3. Click **Simulate successful payment · no real charge**. This explicitly combines mock payment and local-only approval. It does **not** contact a bank/provider, charge the player, deduct game naira or represent a paid invoice.
4. Other signed-in players on this server see the active test campaign at the selected community billboard. Active ads for an area rotate every eight seconds. Boards and campaign UI are marked TEST.
5. A slot starts at **test activation** and lasts exactly 7 × 24 server-clock hours. Multiple slots extend the expiry consecutively. Replaying checkout or activation does not duplicate/extend the order. Server restart preserves the start/expiry. No new browser visit can extend it.
6. Players may inspect business links from the billboard's Business ads panel; links never navigate/open automatically.

Local mode allows self-confirmation so you can test now. **Never use that endpoint as payment proof in production.** `TEST_PAYMENTS=false` disables activation entirely; there is deliberately no pretend live-payment implementation. Campaigns already marked TEST must never be displayed as paid real advertisements. A public release needs real provider checkout, signed server-to-server verification/webhooks, idempotency, moderation/review, refunds/disputes, business/content policies and audit logs.

## Graphics

- Layered procedural cloud banks, hazy horizon, sun highlights and night stars/moon, driven by the existing WAT/time/weather system.
- Streamed, wind-animated instanced grass on dry, free roadside verges, with lower density on low quality. Not grass covering asphalt or the river.
- Refined laterite mud textures and shallow damp rut detail on existing dirt/path surfaces. Paved roads remain paved; this is not a claim of surveyed road-surface accuracy.

The art style remains procedural/stylized. This is **not photorealism or a PUBG/Call of Duty engine port**. Existing quality/adaptive-resolution controls still apply.

## Data and operating limits

- `server/data/world.json`: salted scrypt password hashes, profiles, friendships, relationships, campaigns, reports and unclaimed game rewards. **Back up the entire folder privately**, not just the browser save. It is excluded from the source ZIP and Git.
- Tokens are random, stored per browser tab session, expire after 12 hours, and are invalidated when the server restarts. Sign in again after a restart. No password reset/email delivery is implemented.
- Character saves remain browser-local under `onitshaway:account:<id>:save`; the pre-existing offline `onitshaway:save` is preserved. Export each important character from Settings.
- Local server binds `127.0.0.1` by default and supports up to 32 connected accounts. It is a single-process JSON-file development server, not a scalable transactional database. Do not run multiple instances on the same data folder.
- Ad campaigns use the local server computer's wall clock. Keep it accurate; changing that clock changes expiry evaluation.
- LAN test setup requires explicit server/frontend binding and exact `ALLOWED_ORIGINS`, plus trusted HTTPS for voice. Do not expose development ports on the public internet. The delivered defaults intentionally stay on loopback.

## Before hosting

Authoritative movement/economy/asset ownership, robust session/CSRF policies, secure deployment, durable transactional storage/backups, HTTPS and TURN, room sharding/interest management, verified age/child safety choices, live moderation, real payment verification and privacy/business policies remain launch work. The client currently owns its progression and reports location/home/vehicle state; **cheating is possible**. Do not take real ad payments or run this as a public MMO yet.

## Checks

```sh
npm run check
npm run test:online
npm run e2e:online
```

Browser tests require Playwright and Chromium available separately; they are development QA tools, not required to play. See `qa/online-*-results.json` and `QA_LOCAL_16.md` for the delivered results/limitations.
