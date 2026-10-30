/** Fictional starting backgrounds. Each has an equal chance; not a player choice. */
export const BACKGROUNDS = Object.freeze({
  nwa_ogbe: Object.freeze({ id: 'nwa_ogbe', label: 'Nwa Ogbe', alias: 'Lapo baby', balance: 1_000_000 }),
  nwa_mummy: Object.freeze({ id: 'nwa_mummy', label: 'Nwa Mummy', alias: 'Nepo baby', balance: 5_000_000 }),
});
export const backgroundInfo = id => typeof id === 'string' && Object.hasOwn(BACKGROUNDS, id) ? BACKGROUNDS[id] : null;
export function randomBackground(random = () => {
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  return Math.random();
}) {
  return random() < 0.5 ? 'nwa_ogbe' : 'nwa_mummy';
}
