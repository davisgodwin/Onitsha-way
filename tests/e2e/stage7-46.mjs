// v0.46 stage 7 (first part): study at Shanahan University, graduate, get hired as a teacher at CKC and work a shift
// (a real class), the hospital refuses a doctor without a medical degree, freelance journalism, a DJ set.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4249', OUT = 'qa/v46'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message));
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.justice?.ready, null, { timeout: 400000 });
 await p.evaluate(() => { const g = __game; g.clock.setMode('game'); g.clock.rate = 0; g.clock.day = 2; g.clock.minutes = 10 * 60; g.economy.transact({ key: 'qa46b', amount: 2_000_000, reason: 'qa' }); });
 // the university
 const uni = await p.evaluate(() => { const g = __game, l = g.world.landmarks.list.find((x) => x.university); g.civic.enter(l); const v = g.occupationsCity.universityView(l); return { inside: g.civic.inside?.university, opts: v.options.map((o) => o.label) }; });
 check('inside Shanahan University: admissions lists the programmes', uni.inside && ['Medicine', 'Nursing', 'Law', 'Education', 'Computer Science', 'Mass Communication'].every((k) => uni.opts.some((o) => o.includes(k))), JSON.stringify(uni.opts));
 await p.evaluate(() => { const g = __game; g.cameraRig.pitch = 0.35; }); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/inside-university.png` });
 const grad = await p.evaluate(() => { const g = __game, O = g.occupationsCity, before = g.economy.balance; O.enrol('education'); const paid = before - g.economy.balance, out = []; let d = 2; for (let k = 0; k < 20 && g.saveData.education.enrolled; k++, d++) { const wd = (d - 1) % 7; if (wd >= 5) continue; g.clock.day = d; g.clock.minutes = 10 * 60; out.push(O.attend()?.ok); } return { paid, out, degrees: g.saveData.education.degrees }; });
 check('enrol in Education, attend a lecture a day, graduate with the degree', grad.paid > 0 && grad.degrees.includes('education'), JSON.stringify(grad));
 await p.evaluate(() => { __game.player.stand(); __game.civic.exit({ quiet: true }); });
 // CKC: apply as a teacher in the staff room and work a shift (a real class)
 const job = await p.evaluate(() => { const g = __game, l = g.world.landmarks.get('ckc'); let d = g.clock.day; while (((d - 1) % 7) === 6) d++; g.clock.day = d; g.clock.minutes = 9 * 60; g.civic.enter(l); const v = g.occupationsCity.staffView(l); const apply = v.options.find((o) => /Apply: Teacher/.test(o.label)); apply.act(); return { hired: g.life.work.current?.id, label: apply.label }; });
 check('the CKC staff room: apply, hired as a teacher', job.hired === 'teacher', JSON.stringify(job));
 const shift = await p.evaluate(() => { const g = __game, before = g.economy.balance; g.needs.state.energy = 90; g.needs.state.hunger = 90; g.life.startShift(); const titles = []; for (let i = 0; i < 4 && g.state === 'overlay'; i++) { const v = g.choiceBuilder?.() ?? null; if (!v) break; titles.push(v.title); const right = v.options[0]; right.act(); } return { paid: g.economy.balance - before, titles, shifts: g.life.work.current.shifts }; });
 check('a shift is a class: answer well, get paid', shift.paid > 0 && shift.shifts === 1, JSON.stringify(shift));
 await p.evaluate(() => __game.civic.exit({ quiet: true }));
 // the hospital refuses a doctor without a medical degree
 const doc = await p.evaluate(() => { const g = __game, h = g.hospitals.list[0]; g.hospitals.enter(h); const labels = []; const pos = g.player.position; for (const it of g.interactions.items) { if (it.enabled && !it.enabled()) continue; if (Math.hypot(it.x - pos.x, it.z - pos.z) > 30) continue; labels.push(typeof it.label === 'function' ? it.label() : it.label); } const v = g.occupationsCity.staffView({ name: h.name }, ['doctor', 'nurse']); const d = v.options.find((o) => /Doctor/.test(o.label)); return { staff: labels.some((l) => /Staff only/.test(l)), disabled: d.disabled, why: d.why }; });
 check('the hospital\'s staff door: no medical degree, no doctor\'s job', doc.staff && doc.disabled && /Medicine/.test(doc.why), JSON.stringify(doc));
 await p.evaluate(() => __game.civic.exit({ quiet: true }));
 // freelance journalism
 const news = await p.evaluate(() => { const g = __game, O = g.occupationsCity, a = O.assignments()[0]; O.takeStory(a); const far = O.report(); g.player.teleport(a.x + 5, a.z + 5); const near = O.report(); const before = g.economy.balance; const f = O.file(); return { a: a.title, far: far.error, near: near.ok, pay: g.economy.balance - before, feed: O.W.feed.length, rank: g.life.work.w.self.journalist?.acts }; });
 check('a Courier assignment: go there, report, file, get paid, and it\'s in the paper', /Go to the place/.test(news.far) && news.near && news.pay > 0 && news.feed === 1 && news.rank === 1, JSON.stringify(news));
 await p.evaluate(() => { const g = __game; g.closeChoice?.(); g.openOverlay('phone'); g.phone.render('courier'); }); await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/phone-courier.png` }); await p.evaluate(() => __game.closeOverlay('phone'));
 // a DJ set at a club
 const dj = await p.evaluate(() => { const g = __game, v = g.cityLife.venues?.find?.((x) => x.kind === 'club') ?? g.world.landmarks.list.find((x) => x.kind === 'club'); g.clock.minutes = 22 * 60; const ok = g.club.enter(v); const before = g.economy.balance; const view = g.occupationsCity.boothView(); view.options[1].act(); return { ok, pay: g.economy.balance - before, acts: g.life.work.w.self.dj?.acts }; });
 check('the DJ booth at the club: play a set, get paid, become known as a DJ', dj.pay > 0 && dj.acts === 1, JSON.stringify(dj));
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`stage7-46: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
