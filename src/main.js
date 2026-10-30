import './core/polyfills.js';
import { installTapGuard } from './ui/TapGuard.js';
installTapGuard(); // no ghost taps on panels that open under the finger
import '@fontsource/anton/latin-400.css'; // v0.44 sign-painter display face, bundled (SIL Open Font License 1.1)
import './ui/styles.css';
import { Game } from './core/Game.js';
import { EntryFlow } from './entry/EntryFlow.js';
import { SaveSystem } from './save/SaveSystem.js';
import { CloudSave } from './save/CloudSave.js';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl');
  } catch { return false; }
}

let game;
// offline play and quick reloads (production builds served from their own page, not inside a frame)
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.top === window && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.info('[sw] not registered:', e.message)));
}
window.addEventListener('error', (e) => { if (game?.state && game.state !== 'loading') game.reportError?.(e.error ?? e.message, 'window'); });
window.addEventListener('unhandledrejection', (e) => game?.reportError?.(e.reason, 'promise'));
async function start() {
  // QA-only shortcut preserves the existing regression harness. Normal play always enters here.
  const dev = new URLSearchParams(location.search).has('quickstart');
  const account = dev ? null : await new EntryFlow().start();
  if (!dev) SaveSystem.setScope(account?.me.id || null);
  if (!dev && account) {
    // Bring this browser's copy and the account server's copy into line before anything loads.
    const status = document.querySelector('#screen-loading .load-status'); if (status) status.textContent = 'Syncing your saved game…';
    CloudSave.attach(account.me.id, account.token);
    await CloudSave.reconcile().catch((e) => console.warn('[cloud] sync skipped:', e.message));
  }
  game = new Game();
  game.entryAccount = account;
  game.ui.accountMode = !!account;
  if (!webglAvailable()) {
    game.ui.fatal('Your browser or device does not support WebGL. Try a recent Chrome, Edge, Firefox or Safari.');
    return;
  }
  await game.init();
  if (!dev && account) {
    if (SaveSystem.hasSave()) game.continueGameNow();
    else game.openCreator();
    if (CloudSave.notice) { game.ui.toast(CloudSave.notice, 7000); CloudSave.notice = ''; }
  }
}
start().catch(err => {
  console.error(err);
  if (game) game.ui.fatal(`The game failed to start: ${err?.message ?? err}. Please reload the page.`);
});
