// v0.41 in the real game: banks and loans, a shop with stock, staff and customers, a transport company with a hired
// driver, bus fares and routes, pledged vehicles, the phone apps, and everything surviving a reload.
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL = process.env.GAME_URL || 'http://127.0.0.1:4241', OUT = 'qa/v41'; fs.mkdirSync(OUT, { recursive: true });
const checks = [], errors = [];
const check = (name, ok, extra = '') => { if (!ok) throw Error('FAIL ' + name + ' ' + extra); checks.push(name); console.log('PASS', name, extra); };
const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
 const c = await b.newContext({ viewport: { width: 1280, height: 800 } });
 await c.addInitScript(() => { if (!localStorage.getItem('onitshaway:settings')) localStorage.setItem('onitshaway:settings', JSON.stringify({ quality: 'low', liveWeather: false, clockFixVersion: 1, adaptive: false, hints: false })); });
 const p = await c.newPage(); p.setDefaultTimeout(240000); p.on('pageerror', (e) => errors.push(e.message));
 await p.goto(URL + '/?quickstart'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.business?.ready, null, { timeout: 400000 });
 const tap = async (re) => { const l = p.getByRole('button', { name: re }).first(); try { await l.click({ timeout: 20000 }); } catch { const opts = await p.evaluate(() => [...document.querySelectorAll('#screen-choice button')].map((x) => x.textContent.trim().slice(0, 60))); throw Error('no button ' + re + ' :: ' + opts.join(' | ')); } await p.waitForTimeout(250); };
 const nextDay = () => p.evaluate(() => { const g = __game; g.clock.day += 1; g.bus.emit('clock:day', g.clock.day); });
 const setup = await p.evaluate(() => { const g = __game; g.clock.setMode('game'); g.clock.rate = 0; g.clock.day = 10; g.clock.minutes = 11 * 60; g.economy.transact({ key: 'seed41-cash', amount: 2000000, reason: 'Shift pay: Market porter' }); const B = g.business; return { branches: B.branches.map((x) => x.name), premises: B.premises.length, pins: B.places().map((x) => x.kind) }; });
 check('two banks and shops to let are placed in town, with map pins', setup.branches.length === 2 && setup.premises >= 6 && setup.pins.includes('bank') && setup.pins.includes('tolet'), JSON.stringify(setup));
 // bank
 await p.evaluate(() => { const g = __game, br = g.business.branches[0]; g.player.teleport(br.x, br.z); g.openChoice(() => g.business.bankView(br)); });
 await tap(/Open an account/); await p.waitForTimeout(300);
 await tap(/Deposit ₦50,000/); await p.waitForTimeout(300);
 await p.screenshot({ path: `${OUT}/bank.png` });
 const acct = await p.evaluate(() => ({ open: __game.saveData.bank.open, bal: __game.business.bank.balance }));
 check('opening an account and depositing at the branch', acct.open && acct.bal === 50000, JSON.stringify(acct));
 await tap(/Loans/); await p.waitForTimeout(300);
 const loanOpts = await p.evaluate(() => [...document.querySelectorAll('#screen-choice button')].map((x) => x.textContent.trim()));
 check('the bank offers a personal loan based on recent income', loanOpts.some((t) => /Personal loan: borrow/.test(t)), loanOpts.slice(0, 3).join(' | '));
 await tap(/Personal loan: borrow ₦20,000/); await tap(/Take the loan/); await p.waitForTimeout(300);
 const loan = await p.evaluate(() => ({ bal: __game.business.bank.balance, loan: __game.saveData.bank.loans[0] }));
 check('taking a loan pays it into the account and sets a repayment schedule', loan.bal === 70000 && loan.loan.total === 22000 && loan.loan.per > 0, JSON.stringify(loan.loan));
 await nextDay();
 const inst = await p.evaluate(() => ({ bal: __game.business.bank.balance, paid: __game.saveData.bank.loans[0].paid }));
 check('the next day an instalment is taken from the account', inst.paid === loan.loan.per, JSON.stringify(inst));
 // a shop
 const pr = await p.evaluate(() => { const g = __game, pr = g.business.premises[0]; g.player.teleport(pr.x, pr.z); g.closeChoice(); g.openChoice(() => g.business.premisesView(pr)); return { id: pr.id, rent: pr.rentWeek }; });
 await tap(/Open a provisions shop here/); await p.waitForTimeout(200);
 await tap(/Rent as/); await p.waitForTimeout(400);
 const org = await p.evaluate(() => { const o = __game.saveData.orgs.list[0]; return o && { name: o.name, lease: o.lease, type: o.type }; });
 check('renting premises registers a business with its own sign', org?.lease === 'rent' && org.type === 'provisions', JSON.stringify(org));
 await p.screenshot({ path: `${OUT}/shop-manage.png` });
 await tap(/Put ₦50,000 into the business/); await p.waitForTimeout(200);
 await tap(/Buy stock/); await tap(/100 packs/); await p.waitForTimeout(200);
 await tap(/Back/); await tap(/Staff:/); await tap(/Hire /); await p.waitForTimeout(300);
 const shop = await p.evaluate(() => { const o = __game.saveData.orgs.list[0]; return { stock: o.stock, staff: o.staff.length, acct: o.account.balance }; });
 check('stock bought and an attendant hired from the business account (3 days of wages set aside)', shop.stock === 100 && shop.staff === 1 && shop.acct < 50000 - 40000, JSON.stringify(shop));
 const trade = await p.evaluate(() => { const g = __game, B = g.business, o = g.saveData.orgs.list[0]; g.closeChoice(); g.player.teleport(0, 0); const a0 = o.account.balance, s0 = o.stock; for (let h = 12; h <= 18; h++) { g.clock.minutes = h * 60; B.tick(); } return { sold: s0 - o.stock, gained: o.account.balance - a0, today: o.today }; });
 check('with the attendant serving, customers buy every hour and the takings go into the business account', trade.sold > 0 && trade.gained > 0, JSON.stringify(trade));
 await nextDay();
 const rep = await p.evaluate(() => { const o = __game.saveData.orgs.list[0]; return { last: o.days.at(-1), escrow: __game.saveData.contracts.list[0].escrow.balance }; });
 check('the day closes with a report: sales, the wage paid from escrow', rep.last && rep.last.revenue > 0 && rep.last.wages > 0, JSON.stringify(rep.last));
 // transport company with a hired driver
 const bought = await p.evaluate(() => { const g = __game, sys = g.vehicles.sys; for (const sp of sys.forSale().filter((s) => s.model === 'keke' || ['toyota_hiace', 'commercial_minibus'].includes(s.model))) { const r = sys.buy(sp.id); if (r.ok) { g.vehicles.addOwned?.(r.vehicle); return r.vehicle; } } return null; });
 check('a keke or minibus bought at a car stand', !!bought, JSON.stringify(bought?.model));
 await p.evaluate(() => { __game.business.startTransport(); }); await p.waitForTimeout(300);
 await tap(/Put ₦50,000 into the business/); await p.waitForTimeout(200);
 await tap(/Put your .* to work/); await p.waitForTimeout(200);
 await tap(/Hire /); await p.waitForTimeout(300);
 await p.screenshot({ path: `${OUT}/fleet.png` });
 const t0 = await p.evaluate(() => __game.saveData.orgs.list.find((o) => o.kind === 'transport').account.balance);
 await nextDay();
 const t1 = await p.evaluate(() => { const o = __game.saveData.orgs.list.find((o) => o.kind === 'transport'); return { bal: o.account.balance, last: o.days.at(-1), dmg: __game.saveData.vehicles.find((v) => v.id === o.vehicles[0].vehicle)?.damage }; });
 check('the hired driver brings back the day\'s takings after fuel; the vehicle wears', t1.last?.remit > 0 && t1.dmg > 0, JSON.stringify({ t0, ...t1 }));
 // a bus of your own: fares and route
 const bus = await p.evaluate(() => { const g = __game, sys = g.vehicles.sys; let v = g.saveData.vehicles.find((x) => x.model !== 'keke' && g.vehicles.paysFares(x)); if (!v) for (const sp of sys.forSale().filter((s) => ['toyota_hiace', 'commercial_minibus', 'mitsubishi_l300', 'commercial_bus'].includes(s.model))) { const r = sys.buy(sp.id); if (r.ok) { g.vehicles.addOwned?.(r.vehicle); v = r.vehicle; break; } } if (!v) return null; g.saveData.business.line = 'M1'; g.vehicles.setFareVehicle(v); const bz = g.vehicles.biz, st = g.transport.net.stops; const m1 = st.filter((s) => s.lines.has('M1')); return { model: v.model, seats: bz.seats, mode: bz.mode, line: bz.line, fare: bz.fareTo(m1[0], m1.at(-1)).fare, keke: (bz.setVehicle({ mode: 'keke' }), bz.fareTo(m1[0], m1.at(-1)).fare), m1: m1.length }; });
 check('a minibus or bus carries more passengers on a chosen route, with bus fares', bus && bus.seats >= 14 && bus.line === 'M1' && bus.m1 >= 2 && bus.fare > 0, JSON.stringify(bus));
 // pledge a vehicle and try to sell it
 const pledge = await p.evaluate(() => { const g = __game, B = g.business, v = g.saveData.vehicles[0]; const o = B.bank.offers(B.assets()).find((x) => x.asset === `vehicle:${v.id}`); const r = o?.ok ? B.bank.borrow(o, Math.min(o.max, 10000)) : { ok: false, error: o?.why }; const lot = { name: 'QA stand' }; const view = g.vehicles.sellView(v, lot); return { r: r.ok ?? r, why: o?.why, pledged: B.isPledged(`vehicle:${v.id}`), sellDisabled: view.options[0].disabled }; });
 check('a vehicle pledged for a loan cannot be sold until the loan is repaid', pledge.pledged && pledge.sellDisabled, JSON.stringify(pledge));
 // phone apps
 await p.evaluate(() => { const g = __game; g.closeChoice(); g.openOverlay('phone'); g.phone.render('bank'); }); await p.waitForTimeout(300);
 const bankTxt = await p.evaluate(() => document.querySelector('#phone-content').innerText); await p.screenshot({ path: `${OUT}/phone-bank.png` });
 await p.evaluate(() => __game.phone.render('business')); await p.waitForTimeout(300);
 const bizTxt = await p.evaluate(() => document.querySelector('#phone-content').innerText); await p.screenshot({ path: `${OUT}/phone-business.png` });
 check('the phone shows the bank account, loans, and your businesses with their latest day', /credit score/.test(bankTxt) && /owed/.test(bankTxt) && bizTxt.includes(org.name) && /Transport/.test(bizTxt), bizTxt.slice(0, 120));
 await p.evaluate(() => { __game.phone.render('profile'); }); const prof = await p.evaluate(() => document.querySelector('#phone-content').innerText);
 check('Profile counts the new work: business owner and transport operator', /Business owner/.test(prof) && /Transport operator/.test(prof));
 // reload: everything persists, and time away is caught up
 const before = await p.evaluate(() => { const g = __game; g.closeOverlay('phone'); g.saveGameNow(); return { orgs: g.saveData.orgs.list.length, bank: g.business.bank.balance, loans: g.saveData.bank.loans.length, contracts: g.saveData.contracts.list.length }; });
 const load = async () => { p.once('dialog', (d) => d.accept()); await p.goto(URL + '/'); await p.waitForTimeout(1500);
  const ob = p.getByRole('button', { name: /Open previous offline save/ }); if (await ob.count()) await ob.first().click();
  await p.waitForFunction(() => window.__game?.state === 'menu', null, { timeout: 400000 }).catch(() => {});
  await p.click('#screen-menu [data-action=continue]'); await p.waitForFunction(() => window.__game?.state === 'playing' && __game.business?.ready, null, { timeout: 400000 }); };
 await load();
 const after = await p.evaluate(() => { const g = __game; return { orgs: g.saveData.orgs.list.length, bank: g.business.bank.balance, loans: g.saveData.bank.loans.length, contracts: g.saveData.contracts.list.length, v: g.saveData.version }; });
 check('banks, loans, businesses and contracts survive a reload (save version 23)', after.v === 23 && after.orgs === before.orgs && after.loans === before.loans && after.contracts === before.contracts, JSON.stringify({ before, after }));
 // an old v18 save (no bank, no businesses) opens cleanly with empty ones
 await p.goto(URL + '/manifest.webmanifest'); // leave the game first so its save-on-exit can't overwrite the edit
 await p.evaluate(() => { for (const k of ['onitshaway:save', 'onitshaway:save:backup']) { const raw = localStorage.getItem(k); if (!raw) continue; const d = JSON.parse(raw); d.version = 18; delete d.bank; delete d.orgs; delete d.contracts; if (d.business) delete d.business.line; d.wallet.balance = 77777; localStorage.setItem(k, JSON.stringify(d)); } });
 await load();
 const mig = await p.evaluate(() => { const g = __game; return { v: g.saveData.version, bank: g.saveData.bank?.open, orgs: g.saveData.orgs?.list.length, contracts: g.saveData.contracts?.list.length, cash: g.economy.balance, line: g.saveData.business.line }; });
 check('a v18 save migrates: cash kept, an empty bank and no businesses', mig.v === 23 && mig.bank === false && mig.orgs === 0 && mig.contracts === 0 && mig.cash === 77777 && mig.line === null, JSON.stringify(mig));
 check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
 console.log(`business41: ${checks.length} checks passed`);
} catch (e) { console.error(e.message); console.error('errors', errors.slice(0, 5)); process.exitCode = 1; } finally { await b.close(); }
