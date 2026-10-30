// v0.40 open life, in the real game: no career at creation, Profile app, apply / shift / dilemma / resign at a
// workplace, self-employment from trader jobs, police record and custody, migration of an old save.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4240', OUT = 'qa/v40'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message));
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing', null, { timeout: 400000 });
 const fresh = await p.evaluate(() => { const g = __game; g.clock.setMode('game'); g.clock.rate = 0; g.clock.day = 3; g.clock.minutes = 10 * 60; g.economy.transact({ key: 'qa40', amount: 200000, reason: 'qa' }); g.needs.adjust({ energy: 100, hunger: 100 }); return { career: !!document.querySelector('[data-field=career]'), job: g.life.work.current, self: Object.keys(g.life.work.w.self), apps: [...document.querySelectorAll('.phone-app span:last-child')].map((e) => e.textContent), msg: g.saveData.phone.messages[0]?.text ?? '' }; });
 check('character creation has no career pick; a new life starts with no job', !fresh.career && fresh.job === null && fresh.self.length === 0, JSON.stringify(fresh.job));
 check('the welcome message no longer points to Find Your Friend', !/Find Your Friend/.test(fresh.msg), fresh.msg.slice(0, 80));
 // Profile app
 await p.evaluate(() => { __game.openOverlay('phone'); __game.phone.render(); });
 const apps = await p.evaluate(() => [...document.querySelectorAll('.phone-app')].map((e) => e.textContent.trim()));
 check('the phone has Profile and no "Story & careers"', apps.includes('Profile') && !apps.some((a) => /Story/.test(a)), apps.join(','));
 await p.evaluate(() => __game.phone.render('profile'));
 const prof = await p.evaluate(() => ({ text: document.querySelector('#phone-content').innerText, dims: document.querySelectorAll('.profile-dim').length, bars: document.querySelectorAll('.profile-bar').length }));
 check('Profile shows work, seven reputation dimensions, record and history', /Looking for opportunities/.test(prof.text) && prof.dims === 7 && /Clean record/.test(prof.text) && /Wealth and status/.test(prof.text), `${prof.dims} dims`);
 await p.screenshot({ path: `${OUT}/profile-new-life.png` });
 await p.evaluate(() => __game.closeOverlay('phone'));
 // workplace: apply, shift, dilemma, promotion requirements, resign
 const site = await p.evaluate(() => { const g = __game, s = g.story.city.sites.find((x) => x.id === 'market'); g.player.teleport(s.x + 2, s.z + 2); g.openChoice(() => g.story.city.siteView(s)); return { id: s.id, name: s.name }; });
 await p.waitForTimeout(500);
 const offer = await p.evaluate(() => [...document.querySelectorAll('#screen-choice button')].map((x) => x.textContent.trim()));
 check('the workplace offers jobs to apply for, with what they pay', offer.some((t) => /Apply: Nwa boy/.test(t) && /a shift/.test(t)), offer.slice(0, 4).join(' | '));
 await p.getByRole('button', { name: /Apply: Nwa boy/ }).click(); await p.waitForTimeout(400);
 const hired = await p.evaluate(() => __game.life.work.current);
 check('applying hires you at the starting rank', hired?.id === 'apprentice' && hired.rank === 0);
 const bal0 = await p.evaluate(() => __game.economy.balance);
 await p.evaluate(() => { const g = __game; g.openChoice(() => g.story.city.siteView(g.story.city.sites.find((x) => x.id === 'market'))); });
 await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/workplace.png` });
 await p.getByRole('button', { name: /Work a shift/ }).click(); await p.waitForTimeout(500);
 const shift = await p.evaluate((b0) => { const g = __game; return { paid: g.economy.balance - b0, shifts: g.life.work.current.shifts, prof: g.life.standing.value('professional', 'apprentice'), log: g.life.standing.s.log.at(-1)?.text }; }, bal0);
 check('a shift pays once, counts towards promotion and builds professional standing', shift.paid > 0 && shift.shifts === 1 && shift.prof > 0, JSON.stringify(shift));
 // the third shift brings a dilemma
 await p.evaluate(() => { const g = __game, c = g.life.work.current; c.shifts = 2; c.lastDay = 0; g.openChoice(() => g.story.city.siteView(g.story.city.sites.find((x) => x.id === 'market'))); });
 await p.getByRole('button', { name: /Work a shift/ }).click(); await p.waitForTimeout(400);
 const dil = await p.evaluate(() => ({ title: document.querySelector('#screen-choice')?.innerText ?? '', integ: __game.life.standing.value('integrity') }));
 check('every third shift brings a real choice: do it properly or take the shortcut', /On the job/.test(dil.title) && /Report the exact stock count/.test(dil.title) && /Cover up a missing item/.test(dil.title), dil.title.slice(0, 120));
 await p.screenshot({ path: `${OUT}/dilemma.png` });
 await p.getByRole('button', { name: /Report the exact stock count/ }).click(); await p.waitForTimeout(400);
 const after = await p.evaluate(() => __game.life.standing.value('integrity'));
 check('choosing honesty builds integrity', after > dil.integ, `${dil.integ} → ${after}`);
 await p.evaluate(() => { const g = __game; g.openChoice(() => g.story.city.siteView(g.story.city.sites.find((x) => x.id === 'market'))); });
 const next = await p.evaluate(() => [...document.querySelectorAll('#screen-choice button')].map((x) => x.textContent.trim()).find((t) => /Next:/.test(t)) ?? '');
 check('the workplace shows what the next promotion needs (shifts, days, skill, standing)', /shifts/.test(next) && /days/.test(next) && /standing/.test(next), next);
 await p.getByRole('button', { name: /Resign/ }).first().click(); await p.waitForTimeout(300);
 await p.getByRole('button', { name: /Resign/ }).first().click(); await p.waitForTimeout(300);
 const quit = await p.evaluate(() => ({ job: __game.life.work.current, hist: __game.life.work.w.history.map((h) => h.text) }));
 check('you can resign whenever you like, and it is in your working history', quit.job === null && quit.hist.some((h) => /Resigned/.test(h)), quit.hist.join(' / '));
 // self-employment from trader jobs, keke fares
 await p.evaluate(() => { const g = __game; g.bus.emit('job:completed', { job: { id: 'qa-job-1', title: 'Deliver a parcel to Ada' }, paid: 900 }); g.bus.emit('job:completed', { job: { id: 'qa-job-1', title: 'dup' }, paid: 900 }); });
 const selfw = await p.evaluate(() => __game.life.work.w.self.errands);
 check('doing trader jobs makes you an errand runner (counted once per job)', selfw?.acts === 1, JSON.stringify(selfw));
 // police record and custody
 await p.evaluate(() => { const g = __game; g.bus.emit('police:paid', { key: 'fine:qa', amount: 3000, offence: 'speeding', post: 'Upper Iweka checkpoint' }); });
 await p.evaluate(() => { const g = __game; g.closeChoice(); g.story.arrest('police', 'QA: theft of a parcel'); });
 await p.waitForTimeout(800);
 const cust = await p.evaluate(() => ({ legal: __game.life.legal().word, rec: __game.life.record.r.entries.map((e) => e.kind) }));
 check('fines and custody go on your record; your status shows you are in custody', cust.legal === 'In custody' && cust.rec.includes('fine') && cust.rec.includes('custody'), JSON.stringify(cust));
 const blocked = await p.evaluate(() => __game.life.work.eligibility('apprentice', __game.life.ctx()).missing.join(' · '));
 check('employers check your record: no job while in custody', /Police record: In custody/.test(blocked), blocked);
 await p.evaluate(() => __game.story.release(true)); await p.waitForTimeout(800);
 const rel = await p.evaluate(() => ({ legal: __game.life.legal().word, rec: __game.life.record.r.entries.map((e) => e.kind) }));
 check('bail releases you; the custody and bail stay on your record', rel.rec.includes('bail') && rel.legal !== 'In custody', JSON.stringify(rel));
 await p.evaluate(() => { __game.openOverlay('phone'); __game.phone.render('profile'); }); await p.waitForTimeout(400);
 await p.screenshot({ path: `${OUT}/profile-after.png` });
 const ptxt = await p.evaluate(() => document.querySelector('#phone-content').innerText);
 check('Profile lists your work, the record and the reputation changes', /Errand runner/.test(ptxt) && /Taken into police custody|custody/i.test(ptxt) && /Worked a shift/.test(ptxt));
 // phone-sized profile
 await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(600);
 const fit = await p.evaluate(() => { const el = document.querySelector('#phone-content'); return { over: el.scrollWidth - el.clientWidth, doc: document.documentElement.scrollWidth - innerWidth }; });
 await p.screenshot({ path: `${OUT}/profile-phone.png` });
 check('Profile fits a phone screen (no sideways scrolling)', fit.over <= 1 && fit.doc <= 1, JSON.stringify(fit));
 await p.setViewportSize({ width: 1280, height: 800 });
 await p.evaluate(() => __game.closeOverlay('phone'));
 // an old (v17) save with a career and a story contract
 await p.evaluate(() => { const g = __game; g.saveGameNow(); const d = JSON.parse(localStorage.getItem('onitshaway:save')); d.version = 17; delete d.life; d.story = { ...(d.story ?? {}), career: 'realtor', trust: 30, contract: { id: 9, career: 'realtor', target: { x: 1, z: 1 } } }; d.wallet.balance = 77777; localStorage.setItem('onitshaway:save', JSON.stringify(d)); g.saveGame = () => {}; g.saveGameNow = () => {}; });
 p.once('dialog', (d) => d.accept());
 await p.goto(URL + '/'); await p.waitForTimeout(1500);
 const btn = p.getByRole('button', { name: /Open previous offline save/ }); if (await btn.count()) await btn.first().click();
 await p.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 400000 }).catch(() => {});
 await p.click('#screen-menu [data-action=continue]'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.life?.ready, null, { timeout: 400000 });
 const mig = await p.evaluate(() => ({ v: __game.saveData.version, job: __game.life.work.current, bal: __game.economy.balance, contract: __game.story.s.contract }));
 check('an old save keeps its career as a job (and its money); the old story contract is retired', mig.v === 23 && mig.job?.id === 'realtor' && mig.bal === 77777 && mig.contract === null, JSON.stringify(mig));
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`life40: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
