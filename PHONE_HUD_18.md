# v0.18.0 — City HUD and messaging phone

This update adapts the layout and messaging journey in the supplied Lagos Life screenshots, using Onitsha Way branding and its existing third-person world. It is not a camera-mode conversion or a copy of the reference game's assets.

## Play

Stop the old game terminal. Run `npm ci`, then `npm run local`; open http://localhost:5173 and keep the terminal running. Account creation still happens before character creation and entry into the city. Returning accounts resume their saved character.

For an upgrade, back up your saves and copy your OWN `server/data` folder from the previous installation into this one before starting. Keep the same browser profile and URL. Do not share server data, passwords or session files.

## HUD

- Compact white date/time, mood, connected-player count, sound and game-wallet strip.
- Bottom Home, Bag, Map and Phone navigation; existing actions are wired to real game screens.
- Small initial avatar and six live needs meters. Hover for names and values.
- Smaller minimap, location/weather/direction chips and an unread-message envelope.
- Go outside and floor controls appear only in applicable interiors.
- Responsive phone and HUD layouts; the multiplayer voice dock is hidden while the phone is open.

Online counts mean connected authenticated local-server sessions, not a public/global population. The initials are not a rendered portrait. Wallet money is game money, not a real bank account.

## Phone and messages

Open Phone from the bottom bar, then Messages; the envelope opens the inbox directly. Jobs, Messages, Games and People appear in the first app row. The other existing game apps remain available.

- Chats and Groups tabs; All, Unread and Read filters; chat search.
- Exact @username lookup to start a private conversation, including with an offline registered account.
- A stranger's first message is a request. They cannot send more until accepted; the recipient can accept or decline. Friends can chat directly.
- Left/right message bubbles, date separators, timestamps and actual Sent/Read state for direct messages. Read is recorded when the recipient opens the accepted conversation, not merely when connected.
- Emoji picker; Enter sends and Shift+Enter adds a line. Drafts survive an incoming refresh and app navigation during this page session; unsent drafts do NOT survive a page reload.
- Real unread badges and inbox previews. NPC/job notifications are kept separately under Notices.
- Existing social invitations can be accepted or declined from Invitations.
- Invite home is enabled for friends while you are in your own home. Visit requests require a friend currently hosting at home; entry needs the host's acceptance.
- Conversation actions offer friendship/crew invitations, block and local report. Voice opens the existing nearby/team live-voice controls; it is not an audio-message recorder or a private phone call.
- Groups currently means the existing co-op crew (up to four players), not arbitrary permanent group creation. Current membership is required to read/send. Crews are runtime sessions and must be recreated after the server restarts.

## Local data and limits

Accounts, private message history, read cursors, friends and test campaigns are saved on the local server in `server/data/world.json`. Character progress stays in account-scoped browser storage; it is not cloud sync. Offline messages arrive when the recipient reconnects to the same server.

Messages are plain text stored unencrypted in the local server file, not end-to-end encrypted. Only participants receive direct-message history through the API. Blocking prevents further access/delivery through the messaging API; it does not erase the operator's data file. Local reports are saved for the operator; there is no staffed moderation service.

Private threads retain the latest 200 messages, with a maximum of 200 conversations initiated per account. Crew rooms retain 200 messages each and at most 100 rooms. Rate limits apply. No message deletion UI, attachments, browser push notifications, money transfers, recorded voice notes or cross-device character sync are included.

Advertising remains TEST mode: one ₦3,000 slot lasts seven days; multiple slots extend the campaign consecutively. No real payments are charged. This prototype is not ready for public hosting without server-authoritative game state, HTTPS, recovery, moderation and verified payment integration.

## Developer checks

- `npm run check` — core regressions, production build, asset/map validation.
- `npm run test:mail` — private messaging, consent, persistence, read receipts, crew membership, blocking and visit authorization.
- `npm run test:online`, `npm run test:account`, `npm run test:entry` — retained multiplayer, account and session checks.
- `npm run e2e:phone` — real browser signup, HUD, phone requests/chat/read/unread/drafts/mobile/home invitation/reload. Requires Playwright plus Chromium; PLAYWRIGHT_MODULE may point to an installed Playwright module.

All tests use isolated temporary server data. See QA_PHONE_18.md for release results.
