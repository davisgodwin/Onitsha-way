# Milestone 12 — Random backgrounds and starting homes (v0.12.0)

## A background assigned by the game

Each newly created life receives one of two backgrounds, with an equal 50/50 chance:

| Background | Alias | Opening balance |
| --- | --- | ---: |
| Nwa Ogbe | Lapo baby | ₦1,000,000 |
| Nwa Mummy | Nepo baby | ₦5,000,000 |

These are fictional game backgrounds and game naira. The balance uses the existing wallet/account system; there is no real banking, payment, deposit or cashout.

The creator displays the assigned background and amount. There is no background selector or reroll button. Changes to name, gender, phone, clothes and hair never affect the assignment. The pending assignment is kept through Back and page reload on the same browser/address, then cleared once the new life is successfully saved. A later genuinely new life receives a new draw. This remains a local single-player game, not a server-enforced anti-cheat system; clearing browser storage, using a different browser/address or manually editing saves is outside that guarantee.

The opening grant is recorded once in the transaction ledger. Continue, importing an existing save, opening the wardrobe and normal saving do not issue it again. The assigned background remains visible on the phone home screen.

## Rent a home before you start

In character creation, **Where will you start?** offers:

- **No home yet · Old Market Road (free):** keep the full opening balance and start on the street.
- Any of the existing mapped in-game rental listings, grouped by home type: Self-contain, Room and parlour, 2-bedroom flat, Premium bungalow and Duplex, subject to available listings on the bundled map.

Each listing shows its street (or fallback location), rental price, period, area and building identifier. The creator also shows the home's description, the charge and the balance remaining. Choosing a listing does not charge anything yet. **Rent & start at home** accepts that listed rental, subtracts one period's rent from the opening balance, and starts the player inside their rented home on the ground floor.

These are the normal game homes and prices, not a separate free starter-home system. At release, rents are ₦3,500–₦35,000 per seven-day period. Standard renewal, expiry, furniture, kitchen, bathroom, wardrobe, storage, duplex stairs and exit rules remain in place. Prices and generated interiors are game approximations, not surveyed housing data. No extra deposit or agency charge was added.

The first save records the background, the paid rental, remaining balance and indoor spawn. Continue restores the player indoors while the rental is valid. An expired rental follows the existing door/renewal rules. Invalid or unaffordable choices are rejected without replacing the previous saved life. A repeated start event cannot grant or charge twice.

## Existing lives and compatibility

Save format is now **10**. Older saves migrate without changing their current balance, homes, position, appearance, jobs or other progress. They are not retrospectively assigned a background or given the new opening grant; the new backgrounds apply to newly created lives only. Confirming a new game keeps a backup of the previous saved life.

All v0.11.0 wardrobe features remain available: 12 outfits per character, hairstyles, separate clothing colours, and Phone → Wardrobe. The real-time WAT fix is retained. Weather is simulated by default with no paid API or API request needed.

## Run in VS Code

1. Export your existing save and back up your current project.
2. Extract the **source ZIP into a new folder** and open that folder in VS Code.
3. Stop the old server with Ctrl+C. Check that package.json says **0.12.0**.
4. Run `npm ci`, then `npm run dev`.
5. Open the exact Local URL Vite prints. Import your exported save if the browser address changed.

The website ZIP is for static hosting, not for running npm in VS Code. See START-HERE.txt and DEPLOY.md. Do not clear browser site data to update the code; that also removes local saves and the pending creation assignment.

## Testing

- `npm run check`: unit tests, production build and static validation.
- `npm run e2e:lifestart`: creator UI, locked background display, pending persistence, both opening grants, rental payment, home spawn, duplicate-start guard, rent duration/time rebasing, indoor save/Continue, legacy backup, mobile layout and runtime errors.
- `npm run e2e:wardrobe`, `npm run e2e:m10`, `npm run e2e:m9`: wardrobe, clock, housing and earlier gameplay regressions.

Optional browser checks require Playwright/Playwright Core and Chromium (CHROME_PATH). Headless software-rendered checks do not certify every real device or browser.

### Verified release results

- 151 unit/regression tests passed; production build and static validation passed.
- 79 browser checks passed: 22 new-life, 18 wardrobe, 26 M10 and 13 M9. No recorded runtime errors.
- Visually inspected desktop and 390px creation screens, both background amounts, scrollable rental details and the paid home spawn.
