// v0.48: league matches are 11-a-side on the whole stadium field; friendlies stay 5-a-side.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4243', OUT = 'qa/v48'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || /activit|toast/i.test(m.text())) console.log('CONSOLE', m.text().slice(0, 300)); });
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 });
 const start = await p.evaluate(() => { const g = __game, Vn = g.ventures; for (const s of ['fitness', 'charisma']) for (let i = 0; i < 12; i++) g.skills.add(s, 400); Vn.footballView().options[0].act(); const sp = g.stadiumFootball.spot; g.player.teleport(sp.x + 2, sp.z + 2); let d = g.clock.day; while (((d - 1) % 7) !== 5) d++; g.clock.day = d; g.clock.setMode('game'); g.clock.minutes = 12 * 60; Vn.update(); const opt = Vn.footballView().options.find((o) => /League match/.test(o.label)); const why = g.stadiumFootball.why(), blk = g.activities.blocked(); window.__toasts = []; const t0 = g.ui.toast.bind(g.ui); g.ui.toast = (x) => { window.__toasts.push(x); t0(x); }; opt.act(); const act = g.activities.current, m = act?.match; return { blk, toasts: window.__toasts, why, dis: opt.disabled, sub: opt.sub, ok: !!act, title: act?.title, n: m?.N, players: m?.players.length, L: m && (window.__PITCH_L = act.venue.frame === act.venue.frame11) , home: act?.homeName, opp: act?.opponent?.name }; });
 check('the league match starts as an 11-a-side game: 22 players on the whole stadium field', start.ok && start.n === 11 && start.players === 22 && start.L === true, JSON.stringify(start));
 await p.evaluate(() => { const g = __game; g.activities.closePanel(); }); await p.waitForTimeout(3500); await p.screenshot({ path: `${OUT}/football-11-kickoff.png` });
 const run = await p.evaluate(() => { const g = __game, a = g.activities.current, m = a.match; const before = g.economy.balance; let guard = 0; while (m.phase !== 'fulltime' && guard++ < 20000) { m.update(0.25); if (m.phase === 'halftime') m.startSecondHalf(); } const r = m.result; a.fullTime(); return { phase: m.phase, score: r?.score, passes: r?.stats?.[0]?.passes + r?.stats?.[1]?.passes, shots: r?.stats?.[0]?.shots + r?.stats?.[1]?.shots, paid: g.economy.balance - before, results: g.ventures.V.club.results.length }; });
 check('the match plays out (passes and shots both ways) and ends', run.phase === 'fulltime' && run.passes > 20 && run.shots > 2, JSON.stringify(run));
 check('the result goes into the league and the appearance fee is paid', run.results >= 1 && run.paid > 0, JSON.stringify(run));
 await p.screenshot({ path: `${OUT}/football-11-fulltime.png` });
 const back = await p.evaluate(() => { const g = __game; g.activities.end(); return { L: g.stadiumFootball.frame === g.stadiumFootball.frame5 }; });
 const friendly = await p.evaluate(() => { const g = __game; g.state = 'playing'; g.stadiumFootball.startMatch(g.stadiumFootball.opts); const a = g.activities.current; return { n: a?.match?.N, frame5: g.stadiumFootball.frame === g.stadiumFootball.frame5 }; });
 check('afterwards a friendly is 5-a-side on the small pitch again', friendly.n === 5 && friendly.frame5, JSON.stringify({ back, friendly }));
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`football48: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
