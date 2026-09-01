import assert from 'node:assert/strict';
import { AIBot } from '../src/mechanics/AIBot.js';

const blocked = new Set();
const physics = {
  checkTreeCollision: ({ x, z }) => blocked.has(`${x},${z}`)
};
const rows = new Map();
for (let z = 0; z <= 8; z++) rows.set(z, { type: 'grass', trees: [] });

const setWall = (z, enabled) => {
  for (let x = -6; x <= 6; x++) {
    const key = `${x},${z}`;
    if (enabled) blocked.add(key);
    else blocked.delete(key);
  }
};

const bot = new AIBot(null, 'regression', 0, 4, 1);
bot.maxReachedZ = 5;
bot.minAllowedZ = 0;

// After a retreat, only returning to Z=5 is not progress. The old start.z
// condition selected UP here and could oscillate DOWN -> UP -> DOWN.
setWall(6, true);
assert.equal(bot.findPathDirection(rows, physics), null, 'must not treat the old peak as a forward destination');

// Reopening Z=6 proves a real exit exists; taking UP first is still legal.
setWall(6, false);
assert.equal(bot.findPathDirection(rows, physics), 'UP', 'must take the route that can exceed maxReachedZ');

// Repeated path decisions from the retreated tile remain null while the real
// exit is closed, so the planner cannot create an UP/DOWN ping-pong by itself.
setWall(6, true);
assert.deepEqual([
  bot.findPathDirection(rows, physics),
  bot.findPathDirection(rows, physics),
  bot.findPathDirection(rows, physics)
], [null, null, null]);

// Exercise the real decision cycle: wait once, retreat, then replan. The old
// start.z rule produced DOWN -> UP here by walking straight back to Z=5.
const loopBot = new AIBot(null, 'decision-cycle', 0, 5, 1);
loopBot.maxReachedZ = 5;
loopBot.minAllowedZ = 0;
const moveHistory = [];
const tryMove = (actor, direction) => {
  const target = actor.getTargetGridPosition(direction);
  moveHistory.push(direction);
  actor.gridX = target.x;
  actor.gridZ = target.z;
  actor.position.set(target.x, 0, target.z);
  actor.maxReachedZ = Math.max(actor.maxReachedZ, target.z);
  return true;
};
for (let tick = 0; tick < 8; tick++) {
  loopBot.updateAI(0.2, rows, physics, tryMove, () => true, [], () => true);
}
assert.equal(moveHistory[0], 'DOWN', 'blocked bot must retreat after its one-tick wait');
assert.ok(!moveHistory.includes('UP'), `must not walk back to the old peak: ${moveHistory.join(' -> ')}`);

console.log('ai-bot oscillation regression: passed');
