> Previous-release notes. For current unfurnished rentals, expanded goods and working lights, see FURNISHING_21.md.

# Buy mode · v0.20.0

## Reference and scope

Inspired by the user's Lagos Life screenshots: Buy in the bottom navigation, an overhead home view, a bottom catalogue, design swatches, category tabs, upstairs/downstairs and catalogue hide/show. The public lagoslife.app landing page was inspected; playable Buy interactions required login and were not accessed. No third-party source, furniture assets, branding or hidden behavior was copied. The models, prices and implementation are Onitsha Way's own.

## Using Buy

Bottom navigation is now Home · Buy · Map · Phone. Enter your own rented home, then tap Buy. Outside your home, browse read-only or use Find or manage a home to locate/rent one. Guest homes and landlord viewings cannot be edited.

Categories: Design, Sleep, Kitchen, Bath, Comfort, Fun, Skills, Light, Decor and Power. The catalogue includes 17 furniture/equipment items (12 retained, five new: bed, cooker, shower, floor lamp and bookshelf), eight wall paints and six floor finishes. Furniture cards show rendered thumbnails of the same original models installed in the home.

- **Design:** tap a swatch to preview. Confirm to buy/apply. Closing or cancelling restores the committed finish. Free starter finishes cost nothing; paid finishes belong to that home and can be re-applied without paying twice. Finishes apply to that home, including both duplex floors.
- **Furniture:** select an item, tap or drag a clear floor position, then Buy & place. Rotate with the button or R; arrow keys nudge the preview. A green footprint indicates a valid position; blocked positions disable confirmation. Wall-mounted items and the outdoor generator use their fixed installation locations.
- **Owned furniture:** move it free or Store it. Storage retains ownership; place it again free. The current model supports one of each catalogue item per home, as the catalogue explains.
- **Duplexes:** switch Downstairs/Upstairs. Item placements are saved per floor; ownership belongs to the home.
- **View:** rotate/zoom the cutaway camera or Hide the catalogue. Closing restores the normal camera, ceiling and full-height walls.

New bed/cooker/shower/bookshelf interactions reuse the existing sleep, meal, bathroom and skill systems. The lamp is decorative. Power equipment retains its existing fuel/battery behavior. Bag access remains through the I shortcut and the phone's wallet widget; no inventory is removed.

All prices and payments are fictional **game naira**. No real payment is involved. Business ads and co-op-in-Messages are unchanged; the removed community apps have not returned.

## Upgrade and startup

Keep the existing server/data folder and the same browser profile/address. No save-version bump or destructive migration is required; new fields are initialized lazily in the existing per-home upgrades. Existing ownership, placements, character progress and account data remain usable.

Run npm ci, then npm run local. Open http://localhost:5173. The v0.19.4 launcher fix is retained: launcher and backend read the same package version, and readiness verifies the launched server instance.

## Validation

npm run test:buy
npm run e2e:buy
npm run check
npm run e2e:phone-community
npm run test:startup

Buy unit tests cover catalogue integrity, free/paid finishes, ownership, funds, access and footprints. Browser checks cover real signup, outside-home restrictions, preview cancellation, actual charges, owned-item storage/replacement, cutaway camera restoration, duplex placement, mobile/landscape and persistence after reload. Accounts, entry, online, mail and radio regressions were also run.

The responsive catalogue adds approximately 7 KB to the CSS bundle. Its explicit CSS allowance is 90 KB (previously 80 KB); the 1,400 KB JS and 4,096 KB map budgets are unchanged.
