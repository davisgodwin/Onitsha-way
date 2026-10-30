# ONITSHA WAY v0.36.0: phone fixes for buying, pop-ups, the car dashboard and visiting friends

## 1. Buying a car or a house no longer picks for you
On phones, pressing **Use** at a car stand jumped straight to a vehicle page (e.g. "Toyota Highlander"). At a TO LET
door it jumped to "Buy Self-contain?". The Use button acts as your finger goes down; the panel then opened under
your finger, and when you lifted it the phone's "tap" landed on whatever option was now there.

Now a tap only counts on a button that was already on screen when your finger went down. This covers **every**
panel in the game (car stands, houses, shops, phone apps), not just these two. Keyboard Enter/Space and the number
keys work as before. The fix was reproduced with a real held press and then confirmed.

## 2. Your car and your front door: a small card instead of a big pop-up
Using **your own car** (when it has options: at a car stand, with a jerrycan or a part to fit) or **your own front
door** now shows a compact card at the bottom of the screen. The street stays visible above it, the main action
(**Drive** / **Enter home**) is a big button, and the other options sit in two columns underneath. Tap ✕ or anywhere
above the card to close it. Car names are shown properly ("Your Toyota Corolla", not "Your toyota corolla
(2003–2019)").

## 3. The driving dashboard can be minimised
- Tap **▾** on the dashboard to shrink it to a small pill: speed, a fuel bar and **Get out** (plus **Fill up** at a
  pump). Tap **▴** to bring the full dashboard back. Your choice is remembered.
- On phones the car radio starts **folded** (station name plus On/Off); tap its ↗ to open it. On a PC it starts
  open, as before. A choice you made before is kept.

## 4. Invite and visit now work, and say what's needed
The system itself worked, but on a phone it was close to unusable. The buttons sat greyed out with no reason, "Add
friend" was hidden behind •••, and invitations waited unseen in Messages → Invitations.
- **Invitations pop up on screen** as a card at the top: "Ada invites you to their home", "Obi wants to visit your
  home", "… wants to be your friend", rides, crews and dates. **Accept**, **Decline** or **Later** right there
  (Later keeps it in Messages until it expires after 5 minutes). If you can't accept yet, it says why. For example,
  for a visit request: "Go inside your own home first, then accept".
- In a chat, **＋ Add friend** is right next to the buttons when you aren't friends yet.
- **Invite home** and **Visit** are always tappable and explain what's missing:
  - not friends yet → tap ＋ Add friend;
  - you aren't inside your home → go inside first (your home is marked on the map);
  - your friend isn't at home or isn't playing → you're told, instead of nothing happening.
  - They turn green when they'll work right away.
- The host is told when a guest arrives. The guest sees "Visiting Ada's home. Use the door to leave."
- **Leaving through the door** now just takes a guest outside. Before, it offered to rent the friend's house.

How to visit, step by step:
1. Both players: open **Messages**, type the other's **@username**, tap **＋ Add friend**; the other taps
   **Accept** on the card.
2. The host goes inside their home (rented or bought) and taps **Invite home** in the chat. The guest taps
   **Accept**. Or the guest taps **Visit** while the host is at home, and the host taps **Accept**.

## 5. Reconnecting by itself
If the connection to the account server dropped (a Wi-Fi blip, the server restarting) or failed when the game
started, the game never tried again. You stayed offline until you reloaded. Now it reconnects by itself after 2, 4, 8
and then every 15 seconds. It doesn't retry after you sign out, when your session has ended, or when the same account
was opened on another device.

## Files
- `src/ui/TapGuard.js` (new, installed in `src/main.js`): the tap rule from section 1.
- `src/ui/UIManager.js`, `src/ui/styles.css`: the `sheet` card mode for quick menus.
  `src/vehicles/VehicleController.js` and `src/housing/HomeController.js` use it, with proper car names.
- `src/ui/DriveDash.js` + `drive-dash.css` (new): the minimisable dashboard.
  `src/radio/CarRadioController.js`: the radio starts folded on phones.
- `src/online/InviteBanner.js` (new) and `online.css`: the invitation card.
  `src/phone/Messenger.js`: Add friend, and Invite/Visit that explain themselves.
  `src/online/OnlineCity.js`: the guest's leave/arrival messages and automatic reconnecting.
  `src/housing/HomeController.js`: the guest's door.
- Test: `tests/e2e/mobile36.mjs`.
- Save format unchanged (16). No new dependencies.
