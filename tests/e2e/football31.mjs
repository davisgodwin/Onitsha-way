/**
 * Browser check for v0.31 5-a-side football at Chuba Ikpeazu Memorial Stadium.
 * Run `npm run build` first; this serves dist/ with `vite preview` on port 4231 (quickstart, no account server).
 * Uses real keyboard / touch input for the controls and drives the match clock forward with the engine, because
 * software-rendered frames are far slower than real time.
 */
import fs from 'node:fs'; import assert from 'node:assert/strict'; import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const port = 4231, base = `http://127.0.0.1:${port}`, dir = 'qa/v31'; fs.mkdirSync(dir, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 250)); }
const checks = []; const check = (name, ok, info = '') => { checks.push(name); assert.ok(ok, `${name} ${info}`); console.log('PASS', name); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// Software frames take seconds, which trips Playwright's click retry; we check the hit target ourselves, then click.
async function tap(p, name) { const loc = p.getByRole('button', { name }); await loc.waitFor({ timeout: 60000 }); await loc.scrollIntoViewIfNeeded();
  const top = await loc.evaluate((b) => { const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e === b || b.contains(e); });
  assert.ok(top, `button "${name}" is covered`); await loc.dispatchEvent('click'); }
const fastForward = (p, seconds) => p.evaluate((s) => { const a = __game.activities.current; for (let i = 0; i < s * 30; i++) { a.match.update(1 / 30); for (const e of a.match.drainEvents()) a.onEvent(e); } }, seconds);
const toEndOfHalf = (p) => p.evaluate(() => { const m = __game.activities.current.match; m.clock = m.halfSeconds - 0.05; if (m.phase !== 'play') { m.phase = 'play'; m.restart = null; } });
async function open(p) {
  await p.goto(base + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 300000 });
  await p.evaluate(() => { const g = __game, s = g.stadiumFootball.spot; g.player.teleport(s.x, s.z, 0); g.needs.state.energy = 90; g.needs.state.hunger = 90; if (g.clock.minutes < 6 * 60 || g.clock.minutes >= 22 * 60) { g.clock.setMode('game'); g.clock.minutes = 15 * 60; } });
  await p.waitForTimeout(3500);
}
try {
  // ------------------------------------------------------------ desktop
  const p = await browser.newPage({ viewport: { width: 1100, height: 640 } }); const errors = [];
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await open(p);
  check('one stadium only, with the 5-a-side pitch inside it', await p.evaluate(() => __game.world.landmarks.list.filter((l) => l.kind === 'stadium').length === 1 && __game.stadiumFootball.frame.parent === __game.world.stadium.group));
  check('map lists the 5-a-side pitch', await p.evaluate(() => { __game.updatePlaces(); return __game.minimap.places.some((x) => /5-a-side/.test(x.label)); }));
  check('pitch-side prompt appears', await p.evaluate(() => /5-a-side/.test(__game.interactions.current?.label?.() ?? '')));
  await p.keyboard.press('KeyE'); await p.waitForTimeout(2000);
  check('pre-match menu opens with E', await p.evaluate(() => __game.state === 'overlay' && /5-a-side/.test(document.querySelector('[data-slot=choice-title]').textContent)));
  await p.screenshot({ path: `${dir}/menu.png` });
  await tap(p, /Kick off/); await p.waitForFunction(() => __game.state === 'activity', null, { timeout: 60000 }); await p.waitForTimeout(3000);
  check('match starts: activity state, scoreboard HUD, controls hint, player hidden in favour of the match body', await p.evaluate(() => __game.activities.active && /0 – 0/.test(document.querySelector('[data-act=score]').textContent) && /Space/.test(document.querySelector('[data-act=hint]').textContent) && !__game.player.human.group.visible));
  check('save marks the match active (an unfinished match is not rewarded)', await p.evaluate(() => /^football-/.test(__game.saveData.activities.active?.id ?? '')));
  await p.screenshot({ path: `${dir}/kickoff.png` });
  await p.keyboard.press('Space'); await p.waitForFunction(() => __game.activities.current.match.phase === 'play', null, { timeout: 30000 }).catch(() => {});
  check('Space takes the kick-off pass', await p.evaluate(() => { const m = __game.activities.current.match; return m.phase === 'play' && m.user.stats.passes === 1; }));
  await p.keyboard.press('KeyM'); await p.waitForTimeout(1500);
  check('walking shortcuts (map) stay off during a match', await p.evaluate(() => __game.state === 'activity'));
  await fastForward(p, 30); await p.waitForTimeout(2500); await p.screenshot({ path: `${dir}/play.png` });
  await p.keyboard.press('Escape'); await p.waitForFunction(() => __game.activities.paused, null, { timeout: 30000 }).catch(() => {});
  check('Esc pauses with Resume / How to play / Leave', await p.evaluate(() => __game.activities.paused && /Resume[\s\S]*How to play[\s\S]*Leave/.test(document.querySelector('[data-act=panel]').innerText)));
  const clock = await p.evaluate(() => __game.activities.current.match.clock); await p.waitForTimeout(2500);
  check('the match clock is frozen while paused', await p.evaluate((c) => __game.activities.current.match.clock === c, clock));
  await tap(p, 'Resume'); await p.waitForTimeout(1000);
  await toEndOfHalf(p); await p.waitForFunction(() => /HALF-TIME/i.test(document.querySelector('[data-act=panel]').innerText), null, { timeout: 60000 });
  check('half-time panel with stats', await p.evaluate(() => /Possession/.test(document.querySelector('[data-act=panel]').innerText)));
  await tap(p, 'Start second half'); await p.waitForTimeout(2500);
  check('second half starts with ends switched', await p.evaluate(() => { const m = __game.activities.current.match; return m.half === 2 && m.dir(0) === -1; }));
  const before = await p.evaluate(() => ({ xp: __game.saveData.skills.fitness ?? 0, energy: __game.needs.energy }));
  await fastForward(p, 20); await toEndOfHalf(p);
  await p.waitForFunction(() => __game.activities.current?.recorded, null, { timeout: 60000 }); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${dir}/full-time.png` });
  const after = await p.evaluate(() => ({ xp: __game.saveData.skills.fitness ?? 0, energy: __game.needs.energy, f: __game.saveData.activities.football, active: __game.saveData.activities.active }));
  check('full time records exactly one match and clears the active marker', after.f.played === 1 && after.f.history.length === 1 && after.active === null);
  check('rewards: Fitness XP and tiredness applied once, no money', after.xp > before.xp && after.energy < before.energy);
  check('first-match achievement', after.f.achievements.includes('first-match'));
  check('a second full-time call cannot record again', await p.evaluate(() => { __game.activities.current.fullTime(); return __game.saveData.activities.football.played === 1; }));
  await tap(p, 'Rematch'); await p.waitForFunction(() => __game.state === 'activity' && !__game.activities.current?.recorded, null, { timeout: 60000 });
  check('rematch starts a fresh match with a new id', await p.evaluate((id) => __game.saveData.activities.active?.id && __game.saveData.activities.active.id !== id, after.f.history[0].id));
  await p.keyboard.press('Escape'); await p.waitForFunction(() => __game.activities.paused, null, { timeout: 30000 }); await tap(p, 'Leave (no result)'); await tap(p, /^Leave$/); await p.waitForTimeout(2500);
  check('leaving mid-match: back in the city at the same spot, no result, abandoned counted', await p.evaluate(() => { const g = __game, s = g.stadiumFootball.spot, f = g.saveData.activities.football; return g.state === 'playing' && g.player.human.group.visible && Math.hypot(g.player.position.x - s.x, g.player.position.z - s.z) < 0.5 && f.played === 1 && f.abandoned === 1 && !g.saveData.activities.active && g.input.pointerLockAllowed; }));
  check('no page errors on desktop', errors.length === 0, JSON.stringify(errors.slice(0, 3)));
  // after dark the pitch is floodlit
  await p.evaluate(() => { const g = __game; g.clock.setMode('game'); g.clock.minutes = 20 * 60 + 30; });
  await p.waitForFunction(() => __game.atmosphere.nightK > 0.2, null, { timeout: 60000 });
  await p.evaluate(() => __game.stadiumFootball.startMatch());
  await p.waitForFunction(() => __game.state === 'activity', null, { timeout: 60000 }); await p.waitForTimeout(3000);
  check('floodlights switch on for an evening match', await p.evaluate(() => __game.activities.current.lights.length === 2));
  await p.screenshot({ path: `${dir}/evening.png` });
  await p.evaluate(() => __game.activities.end({ abandon: true }));
  await p.evaluate(() => { __game.clock.minutes = 23 * 60; });
  check('closed after 10pm with a clear reason', await p.evaluate(() => /6am to 10pm/.test(__game.stadiumFootball.why() ?? '')));
  await p.close();

  // ------------------------------------------------------------ phone (landscape, touch)
  const m = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); const merr = [];
  m.on('pageerror', (e) => merr.push(e.message));
  await open(m);
  await m.evaluate(() => __game.interactions.trigger()); await m.waitForTimeout(1500);
  await tap(m, /Kick off/); await m.waitForFunction(() => __game.state === 'activity', null, { timeout: 60000 }); await m.waitForTimeout(2500);
  check('phone: Pass, Shoot, Tackle, Sprint buttons; walking buttons hidden; joystick layer on', await m.evaluate(() => { const b = [...document.querySelectorAll('.act-btn')].map((x) => x.textContent).join(','); const tl = document.querySelector('.touch-layer'); return b === 'Pass,Shoot,Tackle,Sprint' && !tl.hidden && tl.classList.contains('activity-mode') && getComputedStyle(tl.querySelector('.touch-buttons')).display === 'none'; }));
  await m.locator('.act-btn-pass').dispatchEvent('pointerdown'); await m.locator('.act-btn-pass').dispatchEvent('pointerup'); await m.waitForFunction(() => __game.activities.current.match.phase === 'play', null, { timeout: 30000 }).catch(() => {});
  check('phone: Pass button takes the kick-off', await m.evaluate(() => __game.activities.current.match.user.stats.passes === 1));
  check('phone: HUD fits the screen', await m.evaluate(() => { const r = document.querySelector('.act-bar').getBoundingClientRect(), t = document.querySelector('.act-touch').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && t.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth; }));
  await m.screenshot({ path: `${dir}/phone.png` });
  await m.locator('[data-act-action=pause]').dispatchEvent('click'); await m.waitForFunction(() => __game.activities.paused, null, { timeout: 30000 }); await tap(m, 'Leave (no result)'); await tap(m, /^Leave$/); await m.waitForTimeout(2500);
  check('phone: leaving restores walking controls', await m.evaluate(() => __game.state === 'playing' && !document.querySelector('.touch-layer').classList.contains('activity-mode')));
  check('no page errors on phone', merr.length === 0, JSON.stringify(merr.slice(0, 3)));
  console.log(`PASS FOOTBALL31 ${checks.length}`);
} finally { await browser.close(); server.kill(); }
