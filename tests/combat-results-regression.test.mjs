import assert from 'node:assert/strict';
import { Game } from '../src/main.js';

const owner = { gridX: 0, gridZ: 0, stunTimer: 0, controlImmunityTimer: 0 };
const opponents = Array.from({ length: 4 }, (_, index) => ({ botName: `BOT${index}`, gridX: index, gridZ: 20 + index, stunTimer: 0, controlImmunityTimer: 0, isRespawning: false }));
const strikeGame = {
  leaderStrikePrototypeEnabled: true,
  mapGenerator: { collectLeaderStrikeItemAt: () => ({ id: 'global' }) },
  getActiveActors: () => [owner, ...opponents], getActorName: (actor) => actor === owner ? '玩家' : actor.botName,
  uiManager: { showCombatAnnouncement: () => {}, flashGlobalStrike: () => {} }, createLeaderStrikeWarning: (target) => ({ target }), leaderStrikes: []
};
assert.equal(Game.prototype.startGlobalLightning.call(strikeGame, owner), true);
assert.equal(strikeGame.leaderStrikes.length, 4, 'global strike must snapshot every other actor in the five-player race');
assert.ok(strikeGame.leaderStrikes.every((strike) => strike.owner === owner && strike.target !== owner), 'owner must remain immune');

const deadActor = { isDead: false, isRespawning: false, mesh: { visible: true }, inputBuffer: [1] };
const recoveryCalls = [];
const deathGame = {
  casualRecovery: { schedule: (...args) => { recoveryCalls.push(args); return true; } }
};
assert.equal(Game.prototype.scheduleCasualDeath.call(deathGame, deadActor), true);
assert.deepEqual(recoveryCalls[0], [deadActor, 'impact'], 'Game must delegate recovery timing to CasualRecovery');
console.log('combat and results regression: passed');
