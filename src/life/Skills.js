/** Persistent skill XP. All nine skills start at level 1 and stop at level 10. */
export const SKILLS = { cooking: 'Cooking', charisma: 'Charisma', fitness: 'Fitness', coding: 'Coding', music: 'Music', dancing: 'Dancing', hustle: 'Hustle', comedy: 'Comedy', photography: 'Photography' };
export const xpForLevel = (level) => 50 * (level - 1) * level;
export class Skills {
  constructor(state = {}, { bus = null } = {}) { this.state = state; this.bus = bus; for (const id of Object.keys(SKILLS)) state[id] = Math.max(0, Math.min(4500, Number.isFinite(state[id]) ? state[id] : 0)); }
  level(id) { let l = 1; while (l < 10 && this.state[id] >= xpForLevel(l + 1)) l++; return l; }
  add(id, xp) {
    if (!Object.hasOwn(SKILLS, id) || !Number.isFinite(xp) || xp <= 0) return false;
    const before = this.level(id); this.state[id] = Math.min(4500, this.state[id] + xp);
    const level = this.level(id);
    if (level > before) this.bus?.emit('skill:level-up', { id, label: SKILLS[id], before, level, xp: this.state[id] });
    return true;
  }
  progress(id) { const level = this.level(id), xp = this.state[id], nextXp = level === 10 ? null : xpForLevel(level + 1); return { id, label: SKILLS[id], level, xp, nextXp, remaining: nextXp === null ? 0 : nextXp - xp, progress: level === 10 ? 1 : (xp - xpForLevel(level)) / (nextXp - xpForLevel(level)) }; }
}
/** Phone and workplace exercises share a saved active-play cooldown; menus cannot advance it. */
export function practiceSkill({ skills, needs, progression, spendTime, travelling = false }, id) {
  if (!Object.hasOwn(SKILLS, id)) return { ok: false, error: 'Unknown skill.' };
  if (id === 'cooking') return { ok: false, error: 'Buy ingredients and use your rented kitchen or visit the catering workshop to practise cooking.' };
  const before = skills.progress(id);
  if (before.level === 10) return { ok: false, error: 'Maximum level reached.' };
  if (travelling) return { ok: false, error: 'Finish your trip before practising.' };
  if (needs.energy < 15 || needs.state.hunger < 15) return { ok: false, error: 'Eat and rest before practising.' };
  const seconds = Math.max(0, Math.ceil((progression.trainingAt ?? 0) - progression.playSeconds));
  if (seconds > 0) return { ok: false, error: `Return to the city for ${seconds} seconds of active play before practising again.` };
  progression.trainingAt = progression.playSeconds + 20;
  spendTime(30);
  skills.add(id, 30); needs.adjust({ energy: -4, fun: 5, social: id === 'charisma' ? 6 : 0 });
  const after = skills.progress(id);
  return { ok: true, gained: after.xp - before.xp, before: before.level, level: after.level };
}
