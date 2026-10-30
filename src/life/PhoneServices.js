import {hustleEligibility} from '../data/careerProgression.js';
/** Pure, testable phone services. Fictional betting uses only the existing game wallet. */
export class PhoneServices {
  constructor(state, { economy, skills, inventory, character={}, needs, day = () => 1, seed = 1 }) { this.state = state; state.messages ??= []; state.bets ??= {}; state.work ??= {}; state.seq ??= 0; this.economy = economy; this.skills = skills; this.inventory=inventory;this.character=character; this.needs = needs; this.day = day; this.seed = seed; }
  message(from, text) { this.state.messages.unshift({ id: ++this.state.seq, from, text, day: this.day(), read: false }); this.state.messages = this.state.messages.slice(0, 40); }
  work(id) {
    const jobs = { errands: ['hustle', 200], coding: ['coding', 300], music: ['music', 220], comedy: ['comedy', 180], photography: ['photography', 250] };
    if (!jobs[id]) return { ok: false, error: 'unknown-hustle' };
    const key = `${this.day()}:${id}`; if (this.state.work[key]) return { ok: false, error: 'done-today' };
    if (this.needs.energy < 20 || this.needs.state.hunger < 15) return { ok: false, error: 'eat-and-rest' };
    const eligibility=hustleEligibility(id,{skills:this.skills,inventory:this.inventory,character:this.character});if(!eligibility.ok)return{ok:false,error:'Requirements: '+eligibility.missing.join(' · ')};
    const [skill, base] = jobs[id], amount = base + 70 * this.skills.level(skill);
    const r = this.economy.transact({ key: `phone:work:${key}`, amount, reason: `Hustle: ${id}` }); if (!r.ok) return r;
    this.state.work[key] = true; this.skills.add(skill, 24); this.needs.adjust({ energy: -10, fun: -3 });
    // Bound the daily history without allowing an action to repeat on its current day.
    for (const k of Object.keys(this.state.work)) if (Number(k.match(/(?:^|:)(\d+)(?::|$)/)?.[1] ?? this.day()) < this.day() - 7) delete this.state.work[k];
    return { ok: true, amount, minutes: 60 };
  }
  bet(choice) {
    if (this.character.ageGroup === 'child') return { ok: false, error: 'age-restricted' };
    if (!['home', 'draw', 'away'].includes(choice)) return { ok: false, error: 'invalid-pick' };
    const day = this.day(); if (this.state.bets[day]) return { ok: false, error: 'done-today' };
    const debit = this.economy.transact({ key: `bet:stake:${day}`, amount: -100, reason: 'Onitsha Bet: ₦100 stake' }); if (!debit.ok) return debit;
    // Fixed per save/day: a reload cannot reroll the result. No live odds, cashout, deposits or real teams.
    let h = ((this.seed ^ Math.imul(day, 2654435761)) >>> 0); h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13;
    const result = ['home', 'draw', 'away'][(h >>> 0) % 3], won = choice === result;
    this.state.bets[day] = { choice, result, won, stake: 100, payout: won ? 250 : 0 };
    if (won) this.economy.transact({ key: `bet:payout:${day}`, amount: 250, reason: 'Onitsha Bet: game-money prize' });
    return { ok: true, ...this.state.bets[day] };
  }
}
