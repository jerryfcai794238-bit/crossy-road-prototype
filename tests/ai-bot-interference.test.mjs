import assert from 'node:assert/strict';
import { AIBot } from '../src/mechanics/AIBot.js';

const bot = new AIBot(null, '干擾BOT', 0, 0, 0.8);
const player = {
  gridX: 0,
  gridZ: 1,
  isDead: false,
  isRespawning: false,
  isJumping: false,
  getTargetGridPosition(direction) {
    return direction === 'UP' ? { x: 0, z: 2 } : { x: 0, z: 1 };
  }
};

let requestedDirection = null;
const direction = bot.findInterferenceDirection(
  [bot, player],
  new Map([[0, { type: 'grass' }], [1, { type: 'grass' }], [2, { type: 'grass' }]]),
  { checkTreeCollision: () => false },
  (_actor, candidate) => { requestedDirection = candidate; return candidate === 'UP'; },
  () => false,
  (cell) => cell.x === 0 && cell.z === 2
);

assert.equal(direction, 'UP', 'BOT should select a legal push that sends an adjacent player into an active hazard');
assert.equal(requestedDirection, 'UP', 'interference must ask the existing legality pipeline before acting');
assert.equal(bot.findInterferenceDirection([bot, player], new Map([[0, { type: 'grass' }], [1, { type: 'grass' }], [2, { type: 'grass' }]]), { checkTreeCollision: () => false }, () => false, () => false, () => true), null, 'illegal pushes must be rejected');
assert.equal(bot.isCellSafe({ x: 0, z: 99 }, new Map(), { checkTreeCollision: () => false }), false, 'unknown rows must never be safe for BOT routing');
const leadingBot = new AIBot(null, '前方BOT', 0, 5, 0.8);
const rearPlayer = { gridX: 0, gridZ: 3, isDead: false, isRespawning: false };
const forwardRows = new Map(Array.from({ length: 8 }, (_, z) => [z, { type: 'grass' }]));
assert.equal(leadingBot.findPressureDirection([leadingBot, rearPlayer], forwardRows, { checkTreeCollision: () => false }, () => true, () => false), null, 'BOT already ahead of a stopped player must not pressure-retreat');
console.log('ai-bot interference regression: passed');
