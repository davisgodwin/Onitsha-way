# Milestone 13 · v0.13.0 — Your Onitsha story

A first playable story-and-consequences layer, not a finished narrative RPG.

## Play the update

1. Create a new character, choose **Child (10), Young adult (18), Adult (30), or Older adult (68)** and **Slim, Average, or Fuller build**. All existing outfits still work. Older presets have grey hair. These are variants of the existing animated rig, not imported photorealistic models or a biological ageing system.
2. Choose a starting career. The random **Nwa Ogbe / Nwa Mummy** background, balances and optional starting rental work exactly as before. Careers do not change the background or grant extra starting money.
3. Open **Phone (O) → Story & careers**. Existing saves gain the story without losing their balance, homes or other progress. Choose an honest or risky direction, begin a career, then work towards the crossroads.
4. Take a contract, mark its workplace, travel there and press **E**, or reopen Story & careers when within 12 metres. Pick a response to the client's request. Correct work pays game naira and adds trust/skill XP; a bad response earns nothing and loses trust.
5. Complete three contracts to reach the crossroads. Three risky choices also advance the risky story route. Decide whether to invest in community tools and repay recorded fraud proceeds, or remain independent. The city remains playable after this short opening arc.

## Careers

12 legal paths: tech bro/sis, realtor, nwa boy/trade apprentice, car seller, oso afia market broker, courier, caterer, mechanic, tailor, photographer/creative, wholesale/logistics agent and student/learner.

Two adult-only illegal paths: street theft and abstract fictional Yahoo/fraud. There are **no real scam steps, accounts, targets or communications**. A fraud offer is an abstract game payout with reputation, investigation and financial consequences.

Contracts are deliberately small first-pass decision tasks, not full coding, vehicle-dealership, property-management or cooking simulations. Existing delivery jobs, shops, wholesale, cars and home systems remain available separately. Each legal career has a maximum of three resolved contracts per WAT date, with a 20-second active-play break between them. Good standing adds a small pay bonus. Switching careers cancels an unfinished career contract without a payout.

Trade apprenticeship is **separate from oso afia**, represented as mentor-led stock-book training, paid shifts and one ₦100,000 game settlement after five successful shifts (at least two WAT dates under the daily cap). This compressed progression is not a claim that real apprenticeships take five shifts.

Child mode restricts the new career list to supervised learning and creative work; crime, betting and nightclub entry are disabled. It does not represent real child employment or legal eligibility for adult businesses. It is not a complete parental-control system for every legacy city interaction.

## Oso afia research and implementation

Afia TV describes oso afia participants as **middlemen between customers and business owners**, often without shops of their own. The game uses a buyer seeking fabric, an actual in-game fabrics trader as the meeting anchor, matching to the correct seller and a **disclosed commission**. It is an honest brokerage path, not classified as fraud.

Sources used:
- Afia TV, November 7, 2024: https://www.instagram.com/reel/DCEJ1OtsYke — description of customer–business-owner middlemen.
- Stears, Oluwatosin Adeshokan, June 11, 2018: https://www.stears.co/article/imu-ahia-the-apprenticeship-system-building-wealth-in-eastern-nigeria/ — mentor-led Igbo trade apprenticeship and eventual settlement; distinct from casual commission brokerage.

The initial contract does not yet simulate stock negotiation, a moving buyer NPC, delivery logistics or multiple commissioned sellers.

## Theft and Market Dash

There are decision parcels near Main Market, Ochanja and Bridgehead. Approach and use **E**: leave it, return it for trust (once per parcel per WAT date), or—adult characters only—steal it.

Theft starts **Market Dash**, an original procedural three-lane runner with no copied Subway Surfers art, music or characters:
- **A/D or Left/Right:** switch lane.
- **Space/Up/W:** jump crates.
- **Down/S:** slide under crossbars.
- Carts require a lane change. Each obstacle row leaves two clear lanes.
- **450 m** to escape, **three collisions** before being caught.
- Mobile: four large control buttons, plus swipes on the scene.
- **Esc / Pause** freezes the mini-game. Stop running resolves it as caught.

An escape credits the parcel's ₦15,000 fictional proceeds once; capture never credits those proceeds. Police heat and an outstanding investigation can remain after escape. There is no combat or player death.

Pursuit seed, distance, remaining chances and upcoming obstacles are saved. Continue resumes a saved pursuit rather than erasing it. Hiding the tab pauses the runner; the real WAT clock is still device-clock based.

## Police, EFCC, offices and extortion

- Existing traffic checkpoints/fines and their officers remain intact. Story-wanted players on foot can also be stopped near checkpoint locations: cooperate or try another escape run.
- Police capture transfers the character to the **fictional police visitor/custody office**. The **₦25,000 game bond** is paid only after the player chooses it and can afford the full amount.
- Abstract fraud creates recorded criminal proceeds and heat. Only characters with active fraud consequences become eligible for an EFCC raid. First opportunity is after **20–30 minutes of active normal play**; later opportunities are also 20–30 minutes apart, each with a **25% chance**. Paused menus and pursuits do not advance the raid timer. Honest work never triggers this EFCC event.
- EFCC offers cooperation or pursuit. Capture transfers to the separate **fictional EFCC office**, recovers the lesser of recorded criminal proceeds and the available wallet, and offers a **₦125,000 game bond**.
- The bond prices, recovery rules and custody/service system are invented gameplay, **not Nigerian law, real police fees or legal advice**. Offices are generated game locations, not surveyed branch addresses. The map labels mark Police (P), EFCC (E) and checkpoints (!).
- A player who cannot pay can complete **three supervised service tasks for free**, with short five-second active-play breaks in the waiting room between tasks. Return to the desk with E or the Phone button. Release clears the current story case. The wallet cannot go negative.
- Custody persists across save/reload and blocks ordinary city activity until release.
- Street groups now offer **Run from the group**, alongside existing walk-away, calm-talk and optional-payment responses. An escaped run costs nothing. If caught, choose a ₦200 game payment or free community help. No automatic extortion debit and no police arrest for this encounter.

## Saves, dependencies and known scope

Save format **11** adds optional story state; formats through 10 migrate without new starting grants. The device-clock **Africa/Lagos (WAT)** policy, no-API default simulated weather, wardrobe and creator rentals are preserved. Back up an important save using Settings → Export save before replacing a build; an older build cannot load a newer save version.

No new paid API, account login, server or dependency is required. This remains a **single-player local save**, not a secure multiplayer economy. Browser storage can be edited or cleared. Character age is a preset, not a timed life cycle. The criminal story uses abstract nonviolent choices; it is not a simulation of actual offences or enforcement procedures. Office rooms and runner props are original stylised geometry.

## Run from VS Code

Extract the source ZIP to a **new folder**, open that folder in VS Code, then:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Do not double-click index.html. For hosting, run `npm run build` and upload the contents of `dist/`, or use the website ZIP directly. The website ZIP does not contain editable source or require npm.

## Validation

- `npm run check` — rule tests, production build and asset validation.
- `npm run e2e:story` — full story/contract/pursuit/reload/custody/bail/service/EFCC/extortion/creator/mobile checks.
- `npm run e2e:story-outcomes` — story restitution/ending, office entry, home-raid escape and child-mode restrictions.
- Existing regressions: `npm run e2e:lifestart`, `npm run e2e:wardrobe`, `npm run e2e:m10`, `npm run e2e:m9`.
- Model audit covers both genders, all four ages and all three builds in idle, running and seated poses (72 representative cases); visual captures inspect the age/build lineup and desktop/mobile screens.
