/** Scripted city missions. Repeatable trader jobs remain in JobSystem.list. */
export const MISSION_DEFINITIONS = Object.freeze({
  'find-your-friend': Object.freeze({
    id: 'find-your-friend', title: 'Find Your Friend', reward: 500,
    description: 'Ask a local contact where your friend is staying, then meet your friend in the city.',
    objectives: ['Meet your friend at their home gate', 'Finish the welcome conversation'],
  }),
});
export const newMissionState = () => ({ version: 1, records: {}, tracked: null });

/** Stable bindings reuse residents; never spawn a second mission NPC. */
export function bindFriend(residents, origin, reachable = () => true) {
  const near = (a,b) => Math.hypot(a.x-origin.x,a.z-origin.z)-Math.hypot(b.x-origin.x,b.z-origin.z) || a.id.localeCompare(b.id);
  const sources = residents.filter(r => r.id.startsWith('career-city:') && r.kind === 'host' && reachable(r)).sort(near);
  const giver = sources[0];
  if (!giver) return null;
  const friends = residents.filter(r => r.kind === 'gate' && r.id !== giver.id && reachable(r) && Math.hypot(r.x-giver.x,r.z-giver.z)>20).sort(near);
  return friends[0] ? { giver: giver.id, target: friends[0].id } : null;
}
