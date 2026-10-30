# v0.16.0 local prototype — QA notes

## Scope

The baseline is the supplied v0.15.0 Shoprite/cars source. Old milestones are preserved. No third-party production service was connected and no real payment was made.

## Delivered results

- **251** existing economy/progression/save assertions passed, plus production build/asset validation.
- **40** server integration assertions passed, plus account-save isolation and disabled-payment tests (three Node test cases total).
- **21** two-profile multiplayer browser checks passed with no recorded browser/game-loop errors.
- **35** existing Shoprite/car browser checks passed with no recorded errors.
- Final component/world visual checks passed: complete six-tab navigation at 390px, billboard off the mall access lane, no streamed grass on mall paving; five final renders were visually inspected.

The multiplayer browser run exercised real local connections. The subsequent final layout/placement-only changes were checked using the actual UI component in a lightweight visual harness and an actual single-player world render. No human microphone listening test, public hosting, multi-device HTTPS/LAN test or production-payment test was performed.

## Automated checks

- Existing `npm run check`: 251 economy/progression/save checks, production build and asset validation.
- `npm run test:online`: local account/WS integration, registration restrictions, wrong-password rejection, origin checks, multiplayer presence, nearby chat range, social consent/replay protection, relationships, dates, private home access/revocation, stopped-car passengers, crew completion/reward replay prevention, server-calculated ad prices, checkout/activation idempotency, ownership checks, exact seven-day expiry, persistence across server restart, blocked communication, unsafe ad links/artwork, isolated character-save keys, and disabled-test-payment safety switch. The numbered server scenario and two additional test cases are in `qa/online-server-results.json` and the test source.
- Frontend private-file test: Vite returns **403** for an actual private-data fixture and the server source, while the frontend remains **200**. Results in `qa/online-private-files.json`. The fixture was deleted.
- Two-profile browser results, where present, are recorded in `qa/online-browser-results.json`. Real WebSocket traffic and local WebRTC connections are used. Voice QA uses synthetic microphones to verify connection and push-to-talk track state; it is not a human listening/acoustic-quality test.

## Visual inspection

Online Players and Business ads layouts are inspected at desktop and 390px widths. The game-world render is inspected for sky, player labels, grass and billboard placement. QA uses low graphics and software Chromium rendering; it does not establish performance on every phone/GPU.

## Fixed during QA

- Distinct account save keys and explicit offline-copy flow; no silent replacement of the original save.
- Private server files denied by the frontend development server.
- Modal Escape/key handling cannot leak into movement/pause input.
- Cross-scene home invitations available through the persistent Friends list.
- In-game touch hold-to-talk button alongside the desktop V shortcut.
- Guest permissions continuously reconciled in world snapshots as well as explicit revocation messages, including when the guest's first presence arrives late.
- Upstairs invitation floor mapping uses the game's actual duplexUp layout ID.
- Server-derived price/duration, idempotent test activation, and an explicit switch disabling all test activation.

## Deliberate limits

This is local play, not a finished MMO. NPCs/traffic/weather and personal economy/assets remain per-client. Shared tasks are rendezvous prototypes, not conversions of every career. Remote avatars/vehicles are visual, not additional authoritative collision bodies. Home shells/floors and people synchronize; live furnishing/inventory edits do not. Teams, dates, visits and seats are session-only. Character saves are browser-local, not cloud saves. Voice is local mesh with no TURN/STUN and needs localhost/HTTPS. Reports have no live moderation team. All ads are TEST, with no real payment processing, invoices or payouts. Do not host publicly or collect real money using this prototype.
