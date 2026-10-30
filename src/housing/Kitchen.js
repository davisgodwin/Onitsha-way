import { RECIPES } from '../data/housing.js';
import { ITEMS } from '../data/catalogue.js';

/** What each recipe needs and whether you have it: [{recipe, ok, missing:[name], makes}] */
export function recipeStatus(inventory) {
  return RECIPES.map((r) => {
    const missing = Object.entries(r.needs).filter(([id, q]) => !inventory.has(id, q)).map(([id]) => ITEMS[id]?.name ?? id);
    return { recipe: r, ok: missing.length === 0, missing, makes: { ...r.makes, name: ITEMS[r.makes.id].name } };
  });
}

/**
 * Cook a recipe at the stove: all-or-nothing — the ingredients are only used if everything is in the
 * bag and the portions fit. Cooking takes game time (the caller advances the clock).
 */
export function cook(inventory, recipeId) {
  const r = RECIPES.find((x) => x.id === recipeId);
  if (!r) return { ok: false, error: 'no-recipe' };
  for (const [id, q] of Object.entries(r.needs)) if (!inventory.has(id, q)) return { ok: false, error: 'missing', item: ITEMS[id]?.name ?? id };
  const out = ITEMS[r.makes.id];
  // will the meal fit once the ingredients are gone? (an ingredient stack that empties frees its slot)
  const freed = Object.entries(r.needs).filter(([id, q]) => inventory.count(id) === q).length;
  const stackable = inventory.items.some((i) => i.id === out.id);
  if (!stackable && inventory.items.length - freed >= inventory.state.slots) return { ok: false, error: 'bag-full' };
  for (const [id, q] of Object.entries(r.needs)) inventory.remove(id, q);
  inventory.add(out, r.makes.qty);
  return { ok: true, made: out, qty: r.makes.qty, minutes: 40 };
}
