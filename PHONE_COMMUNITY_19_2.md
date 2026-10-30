# Phone community apps · v0.19.2

The standalone Local Play dialog is gone. All community controls now use the existing game phone and its Apps/back/close controls.

- **Business ads:** create a billboard test checkout, choose a location and duration, optionally upload artwork, activate a mock payment, cancel campaigns and mark a billboard on the map.
- **Players:** scene players, friendships, invitations, blocking, reports, relationships and shared visits.
- **Voice:** existing WebRTC channel, microphone and push-to-talk controls. No automatic microphone activation.
- **Co-op:** existing crew, tasks and game reward claims.
- **Account:** profile, connection status, reconnect and save/sign out.
- **Nearby chat:** local and team live chat; Messages remains the private/crew inbox.

The HUD online count opens Players. The avatar opens Account. Billboard interactions open Business ads with that billboard's location selected. The redundant floating city button and menu shortcut have been removed; a hold-to-talk control remains only when voice is active outside the phone.

Business ads are still **local TEST simulations**. No real payment is collected, and test activation is not production moderation or payment verification. Voice still requires a supported secure context and user microphone permission.

## Upgrading

Keep the existing server/data directory and browser storage. Use the same browser profile and http://localhost:5173 address. No save schema migration is required. This archive contains source only, not live account records or saved characters. Run npm ci, then npm run local.

## Checks

- npm run check
- npm run test:online
- npm run test:account
- npm run test:mail
- npm run test:entry
- npm run e2e:phone-community
- npm run e2e:phone

Browser checks exercise actual local campaign checkout/activation/cancellation and phone navigation, mobile sizing, disconnect/reconnect and the existing messaging flow. Screenshots are generated under .qa when the browser tests run. Local test data is temporary.
