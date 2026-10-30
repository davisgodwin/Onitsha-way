# v0.27.1 — Mobile HUD clean view

On touch devices, tap the small **HUD** button next to Pause to minimize the interface.
Tap it again to restore everything. The button has a 44 × 44 CSS-pixel touch target,
accessible Show HUD / Minimize HUD labels and an expanded-state indicator.

Minimized: hides the status/wallet/clock bar, location/weather/navigation chips,
minimap, phone shortcut, needs meters, avatar, bottom navigation, keyboard hints,
FPS display and the phone-preview graphics panel. Hidden panels no longer catch taps.

Still available: left joystick, right drag-to-look, Run, Jump, contextual Use,
Pause, indoor exit/stair buttons, transit controls and essential driving/ride panels.
A small contextual prompt and the latest toast remain for interaction and warnings.
The touch buttons move lower to free more of the view. Menus, dialogs and the phone
are not hidden or restyled by this preference.

The preference is saved in browser settings, not the character save. It survives
refresh, menus and portrait/landscape rotation. Desktop mouse/keyboard HUD is unchanged.
Mobile HD/Ultra preview controls are retained; restore the HUD to open that panel.

The online test URL remains temporary and depends on the sandbox and tunnel staying up.
