# v0.33.0 test results

Run in a Linux sandbox: Node 22, **MariaDB 10.11.14** (the database family XAMPP ships) on 127.0.0.1:3306 as `root` with
no password — the same defaults as XAMPP. Headless Chromium with software rendering. **Not run on Windows/XAMPP itself
or on MySQL 8**; the SQL used is plain MySQL/MariaDB (InnoDB, utf8mb4, LONGTEXT/LONGBLOB, `ON DUPLICATE KEY UPDATE`).

## Unit, layout, build
| Command | Result |
|---|---|
| `npm run check` | **Pass** — 283 tests, 7/7 layout, build, build validation |
| `npm run test:all` | **Pass — 278/278** (includes the new database and cloud-save tests) |

### `tests/database33.test.mjs` (both storage drivers run the same checks)
- File storage (world.json) **and MySQL**: register / duplicate username refused; cloud save needs a login; first upload
  is revision 1; an upload based on an old revision is refused (409) and the reply carries the server copy; a forced
  overwrite keeps the replaced copy; non-saves and saves over 4 MB refused; `?meta=1` omits the save body; each account
  sees only its own save; **two uploads racing on the same revision → exactly one saved, one 409**; Igbo tone marks and
  emoji round-trip byte-for-byte; mail sent through the real WebSocket actions; **after a server restart**: the login
  session, password login, mail, the cloud save and its history are all still there; `/api/health` reports the database.
- MySQL only: a world.json fixture (including a field the server doesn't know about) imports and comes back **identical**;
  accounts and saves are real rows (checked with SQL); changing one account rewrites only that row (`written_at` of the
  others unchanged); trimmed list entries are deleted; **MySQL unavailable**: the write is refused with the XAMPP hint,
  retried automatically, and the change lands once MySQL is back; registering while MySQL is down → HTTP 503 with a
  clear message and no half-made account, then the same username works once MySQL is back. Uses a throwaway database
  (`ow_test_…`) that is dropped afterwards. Skips itself if no MySQL answers (or with `OW_SKIP_MYSQL=1`).
- Save rules: revisions, backup policy (first replacement, hourly, new life, forced), validation.
- Config: file storage by default; `database.json` switches to MySQL with XAMPP defaults; environment overrides; bad
  database names refused.

### `tests/cloudsave33.test.mjs` (the browser code, run in Node against a real server, two simulated browsers)
Which copy wins in every case (only local changed / only server / both / identical / first visit); an existing pre-v0.33
browser save uploads on first login; autosaves upload after the debounce; a new device downloads the game; the old device
picks up newer progress; both devices changed → the most recently played wins and the other is kept (browser backup slot
or server history); simultaneous play → this browser kept, the other copy in history; server down → "safe in this
browser", uploads when back; **a tab that stepped aside for another device uploads nothing and loses to that device on
reload, even with later autosaves**; signing out stops uploads.

## Browser end-to-end
| Suite | Result |
|---|---|
| `cloudsave33.mjs` (new, MySQL) | **14/14** — `db:setup` then the server runs on MySQL; signup through the normal entry screen creates a MySQL row and opens character creation; Settings → Sync now shows "Saved to your account at …"; the save is in `game_saves`; **a phone-sized browser with empty storage logs in and goes straight into the same game** (same character, same money), with a message saying where it came from; the account line fits a 390 px screen; when the phone takes over, **the laptop tab stops uploading and says so**; the laptop reloads into the phone's newer game (not its own later autosave); **after a server restart and wiping the phone's storage, logging in restores the game**; no page errors |
| `entry.mjs` | Pass, 15 |
| `smoke.mjs` | Pass, 8 (new game, save, reload, Continue) |
| `phone18.mjs` | Pass, 20 |
| `online.mjs` | Signup, isolated account save and two players seeing each other **pass**. The suite then stops at a friend-request "Accept" button it can no longer find — see below |

Also checked by hand (scripted): `db:setup` on a copy of this project's `server/data/world.json` (19 accounts, 19
sessions imported; original kept as `world.json.migrated-<date>`); running `db:setup` again imports nothing and changes
nothing; `db:status`, `db:backup` (world.json-format copy + saves), `db:saves` list and `--restore`; a wrong MySQL port
gives "Could not reach MySQL … press Start next to MySQL" from both the tools and the server, and the server exits
instead of falling back to files. Settings screenshot on a phone checked for the offline wording.

`online.mjs` was also run against the unchanged v0.32.0 code and stops at exactly the same "Accept" button, so this is an
older test that no longer matches the phone's friend-request screen, not something this update broke.

Fixed in tests while doing this: `online.mjs` (and the new suite) clicked a "Create an account →" button, but the entry
screen has opened straight on the signup form since an earlier version; it now waits for that form.

## Not verified
- XAMPP on Windows/macOS and MySQL 8 specifically (MariaDB 10.11 was used; the server raises `max_allowed_packet`
  itself when allowed, and `db:setup` explains the `my.ini` change).
- Phones/browsers on other machines on your network reaching the server — the server still listens on 127.0.0.1 only,
  so "another device" here means another browser/profile on the same computer unless you deliberately change `HOST`.
- The `online.mjs` steps after friend requests (crew, visits, dates, ads) in this run — see the note above.
