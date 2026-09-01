export function getHighestOtherLeaderStrikeTarget(owner, actors, random = Math.random) {
  const eligible = actors.filter((actor) => actor && actor !== owner && !actor.isDead && !actor.isRespawning);
  if (!eligible.length) return null;
  const highestZ = Math.max(...eligible.map((actor) => actor.gridZ));
  const leaders = eligible.filter((actor) => actor.gridZ === highestZ);
  return leaders[Math.floor(random() * leaders.length)] || null;
}
