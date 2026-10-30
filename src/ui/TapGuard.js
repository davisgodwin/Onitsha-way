/**
 * Stops "ghost taps" on phones.
 * A touch button (Use, Buy, an app icon…) acts as the finger goes down; the panel it opens appears under the finger,
 * and when the finger lifts, the browser's click lands on whatever option is now there — so a car got picked, or
 * "Buy" chosen, without the player choosing it.
 * Rule: a click only counts on something that was already on screen when that finger (or mouse button) went down.
 * Anything added to the page, or un-hidden, after the press ignores that press's click. Keyboard "clicks" (Enter,
 * Space, number keys) are unaffected.
 */
let downAt = -Infinity, keyAt = -Infinity;
const born = new WeakMap();
const now = () => performance.now();

export function installTapGuard(root = document) {
  if (root.__tapGuard) return; root.__tapGuard = true;
  root.addEventListener('pointerdown', () => { downAt = now(); }, true);
  root.addEventListener('touchstart', () => { downAt = now(); }, { capture: true, passive: true });
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') keyAt = now(); }, true);
  new MutationObserver((list) => {
    const t = now();
    for (const m of list) {
      if (m.type === 'childList') { for (const n of m.addedNodes) if (n.nodeType === 1) born.set(n, t); }
      else if (m.type === 'attributes' && m.target.nodeType === 1 && !m.target.hidden && m.target.getAttribute('aria-hidden') !== 'true') born.set(m.target, t);
    }
  }).observe(root.documentElement ?? root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden'] });
  root.addEventListener('click', (e) => {
    // programmatic clicks and real keyboard presses (Enter/Space on a focused button) are never ghost taps.
    // (Touch taps can also arrive with detail 0, so detail alone can't tell them apart.)
    if (!e.isTrusted || (e.detail === 0 && now() - keyAt < 1000 && keyAt > downAt)) return;
    for (let n = e.target; n && n.nodeType === 1; n = n.parentElement) {
      const t = born.get(n);
      if (t !== undefined && t > downAt) { e.preventDefault(); e.stopImmediatePropagation(); (globalThis.__tapGuardLog ??= []).push({ at: Math.round(now()), target: e.target.className || e.target.tagName, by: n.id || n.className || n.tagName, ms: Math.round(t - downAt) }); return; }
    }
  }, true);
}
/** For tests. */
export const tapGuardState = () => ({ downAt });
