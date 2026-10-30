import { backgroundInfo } from '../data/backgrounds.js';
import { defaultSave } from '../save/SaveSystem.js';
import { Economy } from '../economy/Economy.js';
import { HousingSystem } from '../housing/HousingSystem.js';

/** Prepare a fresh life off to the side. Nothing touches the current save or wallet on failure. */
export function prepareNewLife(character, backgroundId, homeId, listings, now) {
  const background = backgroundInfo(backgroundId);
  if (!background) return { ok: false, error: 'Your background could not be loaded. Reopen character creation.' };
  const home = homeId ? listings.find(h => h.id === homeId) : null;
  if (homeId && !home) return { ok: false, error: 'That home is no longer listed. Choose another home or start on the street.' };
  if (home && (!Number.isInteger(home.rent) || home.rent <= 0 || !Number.isFinite(home.days) || home.days <= 0)) return { ok: false, error: 'That rental listing is invalid. Choose another home.' };
  if (home && home.rent > background.balance) return { ok: false, error: 'That home costs more than your starting balance. Choose a cheaper home or start on the street.' };
  const data = defaultSave(character);
  data.lifeStart = { background: background.id, initialBalance: background.balance, homeId: home?.id ?? null };
  data.wallet.balance = 0;
  const economy = new Economy(data.wallet);
  economy.transact({ key: `life-start:${background.id}`, amount: background.balance, reason: `Starting funds: ${background.label}`, ref: { background: background.id } });
  if (home) {
    const housing = new HousingSystem(data.housing, { economy, listings, now: () => now });
    const rented = housing.rent(home.id);
    if (!rented.ok) return { ok: false, error: `Could not rent this home (${rented.error}). No saved game has changed.` };
  }
  return { ok: true, data, home };
}
