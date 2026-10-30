# v0.27.0 venue music

The bundled venue instrumentals are original game compositions and are separate from the external
car radio. Upload the `audio/afrobeat/` directory with the full build; do not omit the MP3s.
The service worker precaches these three files. Existing account/server and test-only warnings remain.

Radio streams are direct external internet audio, not part of an offline/static game bundle. Station/music rights are not cleared for public hosting. See CAR_RADIO_19.md before publishing.

# v0.19.0: local prototype with external live radio

Account-first startup is not a static-only deployment. Run `npm run dev` for this build. The static-only notes below are historical and do not provide normal player signup/login. Do not host this local prototype publicly; see PHONE_HUD_18.md and ACCOUNT_ENTRY_17.md.

# v0.16.0 hosting warning

The following static-host instructions apply to **offline mode only**. Online accounts, world replication, social actions and ads require the Node server and WebSocket/API routing. Voice needs HTTPS and usually TURN. Real-money ads are NOT implemented: do not expose the test-confirmation endpoint as live billing. Read LOCAL-MULTIPLAYER-16.md before any hosted deployment.

# Deploying Onitsha Way

The game is a static site: `npm run build` writes everything to `dist/` (one HTML page, one JS and one CSS
bundle, the map data, icons, the web-app manifest and a service worker). Any static host works. The build
uses relative paths, so it also runs from a sub-folder (e.g. `https://example.com/games/onitsha/`).

```bash
npm ci
npm run check      # unit tests + production build + build validation (sizes, references, map data, icons)
npm run e2e        # optional browser smoke test (needs `npm i -D playwright-core` and Chrome/Edge/Chromium)
```

## Hosts

| Host | How |
|---|---|
| **cPanel / Apache shared hosting** | Upload the *contents* of `dist/` (including the hidden `.htaccess`) to `public_html/` or a sub-folder. The `.htaccess` sets MIME types, gzip and caching. |
| **Netlify** | Connect the repo; `netlify.toml` builds with `npm run check` and publishes `dist/`. Or drag `dist/` onto the Netlify dashboard. |
| **Vercel** | Import the repo; `vercel.json` sets the build and cache headers. |
| **GitHub Pages** | Push to `main`; `.github/workflows/deploy.yml` tests, builds and publishes. In the repo settings choose Pages → Source: GitHub Actions. |
| **Your own server (nginx)** | Serve `dist/` as static files; give `/assets/*` a long cache (`immutable`) and `index.html` / `sw.js` `no-cache`. |

## Notes

- **HTTPS** is needed for the service worker (offline play, faster reloads) and the "install app" prompt on
  phones. Without HTTPS the game still runs; it just isn't cached for offline play.
- **Updating:** asset file names change with every build, so players get the new version on their next visit;
  the service worker checks the page first and only falls back to its copy when offline.
- **Saves** live in each player's browser (localStorage). Players can export and import their save from
  Settings (for backups, or to move to another browser or device).
- **Opening `dist/index.html` straight from disk (`file://`) does not work** — browsers block module scripts
  and data loading there. Use `npm run preview`, or any local web server.
- **Map data** is © OpenStreetMap contributors (ODbL); the credit is shown in the game's menu and About screen.
