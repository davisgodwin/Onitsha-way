// v0.41: banks and loans, escrowed contracts, shops and fleets — including the "no money from nowhere" checks.
import test from 'node:test'; import assert from 'node:assert/strict';
import { Economy } from '../src/economy/Economy.js';
import { Bank, BANK, newBank } from '../src/money/Bank.js';
import { Contracts, CONTRACT } from '../src/business/Contracts.js';
import { SHOP_TYPES, PRICE_LEVELS, tradeHour, closeDay, vehicleDay, candidate, ensureOrgs, TRANSPORT_DAY, BUSINESS, hourFactor } from '../src/business/Business.js';
import { defaultSave, migrate, SAVE_VERSION } from '../src/save/SaveSystem.js';

const wallet = (n) => new Economy({ balance: n, ledger: [], processed: [] });
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
function bankWith({ cash = 100000, income = 200000, clean = true, day = { d: 1 } } = {}) {
 const w = wallet(cash); const b = new Bank(newBank(), { wallet: w, ctx: { day: () => day.d, income14: () => income, legalClean: () => clean } }); return { w, b, day };
}

test('opening an account costs the fee once; deposit and withdraw move money without creating any', () => {
 const { w, b } = bankWith();
 assert.ok(b.open('nkwo').ok); assert.equal(b.open('nkwo').ok, false); assert.equal(w.balance, 100000 - BANK.openFee);
 assert.ok(b.deposit(50000).ok); assert.equal(w.balance + b.balance, 100000 - BANK.openFee);
 assert.equal(b.withdraw(999999).ok, false, 'cannot withdraw more than you have'); assert.equal(w.balance + b.balance, 100000 - BANK.openFee);
 assert.ok(b.withdraw(20000).ok); assert.equal(b.balance, 30000); assert.equal(b.deposit(-5).ok, false);
});

test('interest is small, daily, capped and never paid twice for the same day', () => {
 const { b, day } = bankWith({ cash: 5000000 }); b.open('nkwo'); b.deposit(4000000);
 day.d = 2; b.newDay(2); assert.equal(b.balance, 4000000 + 2000, 'capped at 0.1% of 2,000,000');
 b.s.lastDay = 1; b.newDay(2); assert.equal(b.balance, 4002000, 'the same day is not paid again');
 day.d = 5; b.newDay(5); assert.equal(b.balance, 4002000 + 3 * 2000);
});

test('loan offers depend on income, record, score and collateral; one of each kind; a pledged asset cannot back two loans', () => {
 const { b } = bankWith({ income: 200000 }); b.open('nkwo');
 const offers = b.offers([{ key: 'vehicle:v1', label: 'your keke', value: 22000 }, { key: 'home:h1', label: 'your home', value: 600000 }]);
 const p = offers.find((o) => o.kind === 'personal'); assert.ok(p.ok); assert.equal(p.max, 100000);
 assert.equal(offers.find((o) => o.asset === 'vehicle:v1').max, 13200);
 assert.ok(b.borrow(p, 100000).ok); assert.equal(b.balance, 100000);
 assert.equal(b.offers([]).find((o) => o.kind === 'personal').ok, false, 'one personal loan at a time');
 const h = b.offers([{ key: 'home:h1', label: 'your home', value: 600000 }])[1]; assert.ok(b.borrow(h, 300000).ok);
 assert.equal(b.offers([{ key: 'home:h1', label: 'your home', value: 600000 }])[1].ok, false, 'pledged, and only one secured loan');
 assert.equal(bankWith({ clean: false }).b.offers([])[0].ok, false, 'no personal loan with an open police matter');
 const poor = bankWith({ income: 2000 }); poor.b.open('nkwo'); assert.equal(poor.b.offers([])[0].ok, false, 'not enough income');
 const fresh = bankWith(); assert.equal(fresh.b.borrow(fresh.b.offers([])[0], 5000).ok, false, 'no account, no loan');
});

test('instalments come out daily; paying in full frees the collateral and lifts the score', () => {
 const { b, day } = bankWith(); b.open('nkwo');
 const o = b.offers([{ key: 'vehicle:v1', label: 'your bus', value: 300000 }]).find((x) => x.kind === 'secured');
 const { loan } = b.borrow(o, 100000); assert.equal(loan.total, 106000); assert.ok(b.isPledged?.('vehicle:v1') ?? b.s.pledged['vehicle:v1']);
 b.deposit(50000); const before = b.s.score;
 for (let d = 2; d <= 29; d++) { day.d = d; b.newDay(d); }
 assert.equal(loan.status, 'repaid'); assert.equal(loan.paid, 106000); assert.ok(!b.s.pledged['vehicle:v1']); assert.ok(b.s.score > before);
 assert.equal(b.balance, 100000 + 50000 - 106000 + Math.floor(0) + b.s.account.ledger.filter((e) => /interest/i.test(e.reason)).reduce((s, e) => s + e.amount, 0));
});

test('three missed instalments are a default: a secured loan loses its asset; an unsecured debt is collected from cash', () => {
 const { w, b, day } = bankWith({ cash: 10000 }); b.open('nkwo');
 const sec = b.offers([{ key: 'vehicle:v1', label: 'your keke', value: 100000 }]).find((x) => x.kind === 'secured');
 b.borrow(sec, 50000); b.withdraw(50000); w.transact({ key: 'spend', amount: -w.balance, reason: 'spent' });
 let taken = null; for (let d = 2; d <= 4; d++) { day.d = d; for (const e of b.newDay(d, { repossess: (k) => { taken = k; return 45000; } })) if (e.kind === 'default') assert.ok(true); }
 const L = b.s.loans[0]; assert.equal(taken, 'vehicle:v1'); assert.equal(L.repossessed, true); assert.ok(!b.s.pledged['vehicle:v1']);
 assert.ok(b.s.score < BANK.scoreStart - 100);
 const p = bankWith({ cash: 0 }); p.b.open?.('nkwo'); p.w.transact({ key: 'gift', amount: 1000, reason: 'x' }); p.b.open('nkwo');
 const per = p.b.offers([]).find((x) => x.kind === 'personal'); p.b.borrow(per, 20000); p.b.withdraw(20000); p.w.transact({ key: 'sp', amount: -p.w.balance, reason: 'spent' });
 for (let d = 2; d <= 4; d++) { p.day.d = d; p.b.newDay(d); }
 assert.equal(p.b.s.loans[0].status, 'default'); assert.equal(p.b.offers([])[0].ok, false, 'a defaulter cannot borrow');
 p.w.transact({ key: 'earn', amount: 5000, reason: 'shift' }); p.day.d = 5; p.b.newDay(5);
 assert.ok(p.w.balance < 5000, 'collectors take from cash'); assert.ok(p.b.s.loans[0].paid > 0);
});

test('a loan is never free money: borrowing then repaying costs exactly the interest', () => {
 const { w, b, day } = bankWith({ cash: 50000 }); b.open('nkwo'); const start = w.balance + b.balance;
 b.deposit(10000); const o = b.offers([])[0]; b.borrow(o, 40000); assert.ok(b.repay(b.s.loans[0].id, 44000).ok); assert.equal(b.s.loans[0].status, 'repaid');
 assert.equal(w.balance + b.balance, start - 4000); day.d = 3; assert.deepEqual(b.newDay(3).filter((e) => e.kind !== 'collected'), []);
});

test('contracts: escrow is funded on acceptance, wages come out once per day, the rest is refunded at the end', () => {
 const acct = wallet(20000), c = new Contracts(undefined);
 const { contract } = c.offer({ title: 'Ada: attendant', payer: 'org:1', payee: 'npc:1', payeeName: 'Ada', amount: 1500 });
 assert.equal(c.accept(contract.id, wallet(100), 1).ok, false, 'must be able to fund the escrow');
 assert.ok(c.accept(contract.id, acct, 1).ok); assert.equal(acct.balance, 20000 - 1500 * CONTRACT.escrowDays); assert.equal(contract.escrow.balance, 4500);
 assert.equal(c.release(contract.id, 2), 1500); assert.equal(c.release(contract.id, 2), 0, 'the same day is not paid twice');
 c.topUp(contract.id, acct, 2); assert.equal(contract.escrow.balance, 4500);
 const r = c.end(contract.id, 3, acct); assert.equal(r.refunded, 4500); assert.equal(acct.balance + 1500, 20000, 'only the wage actually paid has left');
});

test('a shop sells only when open, served and stocked; customers who are turned away hurt satisfaction', () => {
 const org = ensureOrgs({ list: [{ id: 'o', kind: 'shop', type: 'provisions', price: 'normal', open: 7, close: 21, stock: 100, satisfaction: 0.6, rep: 20 }] }).list[0];
 assert.equal(tradeHour(org, { hour: 22, footfall: 1, ownerPresent: true, rng: () => 0.5 }).open, false);
 assert.equal(tradeHour(org, { hour: 12, footfall: 1, ownerPresent: false, staff: [], rng: () => 0.5 }).open, false, 'nobody serving');
 const r = tradeHour(org, { hour: 12, footfall: 1.5, ownerPresent: true, rng: () => 0.5 }); assert.ok(r.served > 0 && r.revenue === r.served * SHOP_TYPES.provisions.price);
 org.stock = 0; const sat = org.satisfaction; const e = tradeHour(org, { hour: 12, footfall: 1.5, ownerPresent: true, rng: () => 0.5 });
 assert.equal(e.served, 0); assert.ok(e.missed > 0 && org.satisfaction < sat);
 const cheap = { ...org, stock: 999, price: 'cheap' }, dear = { ...org, stock: 999, price: 'premium' };
 assert.ok(tradeHour(cheap, { hour: 17, footfall: 1, ownerPresent: true, rng: () => 0.5 }).customers > tradeHour(dear, { hour: 17, footfall: 1, ownerPresent: true, rng: () => 0.5 }).customers);
 const buka = ensureOrgs({ list: [{ id: 'b', kind: 'shop', type: 'buka', stock: 100 }] }).list[0]; assert.equal(closeDay(buka).spoiled, 35, 'food spoils overnight');
 assert.ok(hourFactor('bar', 21) > hourFactor('bar', 13), 'beer parlours are busiest in the evening');
});

test('an untrustworthy attendant skims when you are away, never when you are there', () => {
 const org = () => ensureOrgs({ list: [{ id: 'o', kind: 'shop', type: 'provisions', stock: 500, satisfaction: 0.9, rep: 80 }] }).list[0];
 assert.equal(tradeHour(org(), { hour: 17, footfall: 2, ownerPresent: true, staff: [{ reliability: 0.6 }], rng: () => 0.5 }).skimmed, 0);
 assert.ok(tradeHour(org(), { hour: 17, footfall: 2, ownerPresent: false, staff: [{ reliability: 0.6 }], rng: () => 0.5 }).skimmed > 0);
 assert.equal(tradeHour(org(), { hour: 17, footfall: 2, ownerPresent: false, staff: [{ reliability: 0.95 }], rng: () => 0.5 }).skimmed, 0);
});

test('fleets: a day\'s takings less fuel; broken-down vehicles earn nothing; dishonest drivers bring back less', () => {
 const good = vehicleDay({ mode: 'minibus', driver: { skill: 1, reliability: 0.95 }, rng: () => 0.5 });
 assert.ok(good.worked && good.remit === good.gross - good.fuel && good.kept === 0 && good.fuel > 0);
 const bad = vehicleDay({ mode: 'minibus', driver: { skill: 1, reliability: 0.6 }, rng: () => 0.5 }); assert.ok(bad.remit < good.remit && bad.kept > 0);
 assert.equal(vehicleDay({ mode: 'keke', driver: { skill: 1 }, damage: BUSINESS.breakdownAt, rng: () => 0.5 }).worked, false);
 assert.ok(vehicleDay({ mode: 'keke', driver: { skill: 1, reliability: 1 }, rng: () => 0.5 }).gross < TRANSPORT_DAY.keke.gross * 1.3);
});

test('hiring candidates are deterministic and their wages follow skill', () => {
 assert.deepEqual(candidate('org:1:driver:5:0', 'driver', 'cbus'), candidate('org:1:driver:5:0', 'driver', 'cbus'));
 const c = candidate('x', 'driver', 'cbus'); assert.ok(c.wage >= TRANSPORT_DAY.cbus.wage * 0.8 && c.reliability >= 0.6 && c.reliability <= 1);
});

test('save v19: new lives have an empty bank and no businesses; old saves gain them without changes', () => {
 const d = defaultSave({ name: 'A', gender: 'female', ageGroup: 'adult' }); assert.equal(SAVE_VERSION, 23); assert.equal(d.bank.open, false); assert.deepEqual(d.orgs.list, []);
 const old = structuredClone(d); delete old.bank; delete old.orgs; delete old.contracts; old.version = 18; old.wallet.balance = 4321;
 const m = migrate(old); assert.equal(m.version, 23); assert.equal(m.bank.open, false); assert.deepEqual(m.orgs.list, []); assert.equal(m.wallet.balance, 4321);
});
