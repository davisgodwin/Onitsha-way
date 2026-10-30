# ONITSHA WAY v0.33.0 — MySQL database (XAMPP) and cloud saves

Accounts, logins, mail, friend/visit requests, ads and reports can now live in a **MySQL database** (XAMPP's
MySQL/MariaDB works out of the box), and every account's **game save is kept on the account server**, so logging in
in another browser or browser profile continues the same life.

> **Other computers and phones:** the account server still listens on this computer only (127.0.0.1), as before, so
> another physical device can't reach it yet. The save sync itself doesn't care which device asks — reaching the
> server from your phone needs a deliberate, secured network setup (HTTPS, a strong admin password, firewall), which
> this local prototype doesn't do. Until then, Settings → Export/Import save still moves a game between devices.

Nothing changes until you run `npm run db:setup`. Without it the server keeps using `server/data/world.json` exactly as
before (cloud saves then go in `server/data/saves/`).

## Set up MySQL with XAMPP (Windows / macOS / Linux)
1. **Back up first.** Settings → Export save in the game, and copy your `server/data` folder somewhere safe.
2. Install XAMPP (https://www.apachefriends.org) if you don't have it. Open the **XAMPP Control Panel** and press
   **Start** next to **MySQL**. (Apache is not needed for the game.)
3. In the game folder (where `package.json` is), run:
   ```bash
   npm ci
   npm run db:setup
   ```
   This
   - creates the database `onitsha_way` and its tables (utf8mb4, so Igbo tone marks and emoji are stored correctly),
   - copies everything from `server/data/world.json` into it — **all existing accounts keep their usernames and passwords**,
     logins stay valid, mail and requests are kept,
   - renames the original to `server/data/world.json.migrated-<date>` (it is never deleted),
   - writes the connection settings to `server/data/database.json`. From now on the server uses MySQL.
4. Start the game as usual: `npm run dev`. The terminal says `Storage: MySQL database "onitsha_way" on 127.0.0.1:3306`.
   Keep MySQL running in XAMPP while you play.

XAMPP's defaults are user `root` with **no password** on `127.0.0.1:3306`. If you changed them:
```bash
npm run db:setup -- --user root --password "your-password" --port 3306 --database onitsha_way
```
(or edit `server/data/database.json`, or set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`).
Plain MySQL 5.7/8.x and MariaDB 10.x work the same way.

**Recommended once:** XAMPP's `my.ini` ships with `max_allowed_packet=1M`, which is too small for large ad flyers.
The server raises it while it runs (it is allowed to as `root`), but to make it permanent: XAMPP Control Panel →
MySQL → **Config** → `my.ini` → under `[mysqld]` set `max_allowed_packet=64M` → save → Stop/Start MySQL.
`npm run db:setup` tells you if this is needed.

## Looking at the data
Open phpMyAdmin (XAMPP → Apache Start → http://localhost/phpmyadmin) → `onitsha_way`:

| Table | What it holds |
|---|---|
| `users` | accounts (username, display name, created; the full record incl. password hash/salt, friends, blocks in `data`) |
| `sessions` | "keep me logged in" sessions (only a SHA-256 of each token is stored) |
| `requests` | friend / visit / date / crew invitations |
| `mail_threads`, `group_mail` | private messages and crew chat |
| `ads` | test business ad campaigns (flyer image inside `data`) |
| `reports` | player reports |
| `game_saves` | one current save per account: character, game day, size, revision; the save itself gzip-compressed in `data` |
| `game_save_backups` | older copies of each save (up to 8 per account — see below) |
| `meta` | counters such as `mailSeq`, and the schema version |

Please don't edit rows by hand while the server is running — the server holds the world in memory and writes its own
changes back; edits made underneath it can be overwritten. Stop the server first.

## Cloud saves — how they behave
- The game still saves to the browser first (instantly, works offline). A few seconds later the save is uploaded to
  your account (while you keep playing, at least once a minute). Hiding or leaving the tab starts the upload
  straight away; signing out waits for it.
- **Settings → Account save** shows the state ("Saved to your account at 14:32…") and has **Sync now**.
- **Logging in somewhere new:** a browser with no save for that account downloads it — no character creator, you
  continue where you left off. A browser that already has a copy compares revisions:
  - only one side changed → that side is used;
  - both changed (played on two devices without syncing) → the most recently played game is used; the other is kept:
    in that browser's backup slot if the server's copy won, or in the account's save history on the server if the
    browser's copy won. A message tells you which.
- The server refuses an upload that was based on an older revision (HTTP 409), so a stale tab can't silently wipe
  newer progress. Saves over 4 MB or that aren't game saves are refused.
- If the server or MySQL is down, play continues on the browser copy; Settings says it will upload later, and it does.
- **Offline save** (the old "Open previous offline save" option) is not linked to an account and stays in the browser only.

### Save history and restoring
The server keeps an older copy when a save is replaced for the first time, at most once an hour after that, whenever a
different life (new game) replaces the old one, and whenever two devices clashed. Up to 8 copies per account.
```bash
npm run db:saves -- ada_obi                # list the current save and older copies
npm run db:saves -- ada_obi --restore 2    # make copy 2 the current save (the one it replaces is kept too)
```
Then log in again in the game — the restored save is the newest and loads automatically.

## Other database commands
```bash
npm run db:status     # which storage is in use and how many records
npm run db:backup     # copy everything to server/data/backups/backup-<date>/ (world.json format + every save)
```
`db:backup` works on both storage types. Its `world.json` has the same format the server used before MySQL, so you can
go back to file storage at any time: stop the server, move `server/data/database.json` away, put that `world.json`
(and the `saves` folder) in `server/data`, start again.

## If something goes wrong
- *"Could not reach MySQL at 127.0.0.1:3306"* — start MySQL in the XAMPP Control Panel, then `npm run dev` again.
- *"MySQL refused the login"* — wrong user/password in `server/data/database.json`.
- *"The database … does not exist / tables are missing"* — run `npm run db:setup` (safe to run again; it never
  re-imports over existing accounts and never deletes anything).
- If MySQL stops while the game is running, the server keeps everything in memory, logs the problem once, and retries
  until MySQL is back; nothing changed in the meantime is lost unless the server itself is stopped before then.
  Registering a new account is refused (with a clear message) while MySQL is unreachable, so no half-made accounts.
- The server does **not** quietly fall back to `world.json` if MySQL is configured but unreachable — that would split
  your accounts between two places. It stops with the message above instead.

## Unchanged
- The backend still listens on 127.0.0.1 only; MySQL is only contacted on the address you configure (127.0.0.1 by
  default). Don't expose either to the internet — this is still a local prototype (no e-mail verification, no password
  reset, test payments only).
- Save format version stays 16. No gameplay changes.

## Files
- `server/store/` — `index.mjs` (choose storage), `jsonStore.mjs` (the original world.json + save files),
  `mysqlStore.mjs` (MySQL: load at start, row-level transactional writes, retries, cloud saves), `tables.mjs` (table
  layout), `saves.mjs` (save checks, revisions, backup rules).
- `server/service.mjs` — uses the store; new `GET/PUT /api/save`; `/api/health` reports the database state.
- `scripts/db.mjs` — `db:setup`, `db:status`, `db:backup`, `db:saves`.
- `src/save/CloudSave.js` — browser side of cloud saves; `src/save/SaveSystem.js` (`onSaved`, `writeRaw`);
  `src/main.js`, `src/online/OnlineCity.js` (sync on login, account switch and sign-out); Settings line in `index.html`/`Game.js`.
- Tests: `tests/database33.test.mjs`, `tests/cloudsave33.test.mjs`, `tests/e2e/cloudsave33.mjs`.
- New dependency: `mysql2` (MIT licence).
