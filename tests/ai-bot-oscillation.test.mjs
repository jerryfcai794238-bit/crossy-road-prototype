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

// Decision time must continue while airborne. Once the landing state becomes
// available, the pending decision starts the next legal hop in the same frame.
const rapidBot = new AIBot(null, 'rapid-decision', 0, 0, 1);
rapidBot.decisionInterval = 0.1;
const rapidMoves = [];
const rapidTryMove = (actor, direction) => {
  const target = actor.getTargetGridPosition(direction);
  rapidMoves.push(direction);
  actor.gridX = target.x;
  actor.gridZ = target.z;
  actor.position.set(target.x, 0, target.z);
  actor.maxReachedZ = Math.max(actor.maxReachedZ, target.z);
  actor.isJumping = true;
  return true;
};
rapidBot.updateAI(0.3, rows, physics, rapidTryMove, () => true, [], () => true);
assert.deepEqual(rapidMoves, ['UP'], 'BOT must start its first legal move');
rapidBot.updateAI(60, rows, physics, rapidTryMove, () => true, [], () => true);
assert.equal(rapidMoves.length, 1, 'BOT must not choose a new landing while still jumping');
assert.equal(rapidBot.decisionTimer, rapidBot.decisionInterval, 'long airborne time keeps only one pending decision instead of accumulating a move debt');
rapidBot.isJumping = false;
rapidBot.updateAI(0, rows, physics, rapidTryMove, () => true, [], () => true);
assert.deepEqual(rapidMoves, ['UP', 'UP'], 'BOT must move immediately after landing when its decision timer elapsed in the air');

const cautiousBot = new AIBot(null, 'cautious-rate', 0, 0, 0);
const aggressiveBot = new AIBot(null, 'aggressive-rate', 0, 0, 1);
assert.ok(aggressiveBot.getDecisionRate() > cautiousBot.getDecisionRate(), 'aggression action-rate settings increase BOT decision response rate');
assert.ok(aggressiveBot.getDecisionInterval(0.16) < cautiousBot.getDecisionInterval(0.16), 'higher decision response rate shortens the next decision interval without adding random no-op frames');

const enduranceRows = new Map(Array.from({ length: 70 }, (_, z) => [z, { type: 'grass', trees: [] }]));
const enduranceBot = new AIBot(null, 'fallback-endurance', 0, 0, 1);
const clearPhysics = { checkTreeCollision: () => false };
enduranceBot.stamina = 0;
let fallbackMoves = 0;
const fallbackMove = enduranceBot.move.bind(enduranceBot);
enduranceBot.move = (...args) => {
  fallbackMoves++;
  return fallbackMove(...args);
};
for (let index = 0; index < 55; index++) {
  enduranceBot.updateAI(0.22, enduranceRows, clearPhysics);
  assert.equal(enduranceBot.isJumping, true, `fallback AI move ${index + 1} starts without a tryMove callback`);
  enduranceBot.isJumping = false;
  enduranceBot.position.copy(enduranceBot.targetPosition);
}
assert.equal(fallbackMoves, 55, 'fallback AI path completes more than 50 legal moves without a tryMove callback');
assert.ok(enduranceBot.maxReachedZ >= 50, 'fallback AI path continues making forward progress after more than 50 moves');
assert.equal(enduranceBot.stamina, 0, 'fallback AI moves never consume or require BOT stamina');

console.log('ai-bot oscillation regression: passed');
