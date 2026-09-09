import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CASUAL_PLAYER_COUNT } from '../src/config.js';
import { CASUAL_START_SLOTS, Game } from '../src/main.js';
import { MapGenerator } from '../src/mechanics/MapGenerator.js';

const disposed = { material: 0, texture: 0 };
const effect = {
  sprite: { material: { dispose: () => { disposed.material++; } } },
  texture: { dispose: () => { disposed.texture++; } }
};
const fakeGame = {
  scoreRewardEffects: [effect], springPunches: [], springPunchEffects: [], leaderStrikes: [], leaderStrikeEffects: [],
  scene: { remove: () => {} }, uiManager: { hideOverlays: () => {} }, disposeSpringPunch: () => {}
};
Game.prototype.clearRuntimeEffects.call(fakeGame);
assert.equal(fakeGame.scoreRewardEffects.length, 0, 'restart must clear active score reward sprites');
assert.deepEqual(disposed, { material: 1, texture: 1 }, 'score reward cleanup must only dispose resources that exist');

let lobbyCleanupCalls = 0;
const lobbyGame = {
  matchTimer: null, matchState: 'finished', isGameStarted: true, isGameOver: true, pendingRespawns: new Map([[{}, {}]]),
  clearRuntimeEffects: () => { lobbyCleanupCalls++; }, clearBots: () => {}, uiManager: { showLobby: () => {} }
};
Game.prototype.returnLobby.call(lobbyGame);
assert.equal(lobbyCleanupCalls, 1, 'returning to lobby must clear frozen combat VFX');
assert.equal(lobbyGame.pendingRespawns.size, 0, 'returning to lobby must clear pending respawns');

const actor = { gridX: 0, gridZ: 0 };
const reservedActor = { gridX: 0, gridZ: 0, isJumping: true, targetGridX: 1, targetGridZ: 0 };
const respawnGame = {
  mapGenerator: { getActiveRows: () => new Map([[0, {}]]), isSafeCheckpointRow: () => true, isDynamicHoleUnsafe: () => false, isDynamicHoleActiveAt: () => false },
  physics: { checkTreeCollision: () => false },
  getActorAtGrid: (cell) => (cell.x === 0 || cell.x === 1 ? reservedActor : null)
};
const slot = Game.prototype.findCasualRespawnPosition.call(respawnGame, actor, { x: 0, z: 0 });
assert.deepEqual(slot, { x: -1, z: 0 }, 'occupied checkpoint and jump reservation must use the next free slot on the real row');

const fallbackRows = new Map([[0, {}], [-1, {}]]);
const fallbackGame = {
  mapGenerator: { getActiveRows: () => fallbackRows, isSafeCheckpointRow: () => true, isDynamicHoleUnsafe: () => false, isDynamicHoleActiveAt: () => false },
  physics: { checkTreeCollision: () => false },
  getActorAtGrid: (cell) => (cell.z === 0 ? reservedActor : null)
};
assert.deepEqual(Game.prototype.findCasualRespawnPosition.call(fallbackGame, actor, { x: 0, z: 0 }), { x: 0, z: -1 }, 'full checkpoint row must use a generated nearby safe grass row');
const missingRowGame = {
  mapGenerator: { getActiveRows: () => new Map(), isSafeCheckpointRow: () => true, isDynamicHoleUnsafe: () => false, isDynamicHoleActiveAt: () => false },
  physics: { checkTreeCollision: () => false }, getActorAtGrid: () => null
};
assert.equal(Game.prototype.findCasualRespawnPosition.call(missingRowGame, actor, { x: 0, z: 0 }), null, 'missing rows must never be treated as safe respawn terrain');

const partyItemRespawnGame = {
  mapGenerator: { getActiveRows: () => new Map([[0, {}]]), isSafeCheckpointRow: () => true, isDynamicHoleUnsafe: () => false, isDynamicHoleActiveAt: () => false, hasPartyItemAt: (cell) => cell.x === 0 && cell.z === 0 },
  physics: { checkTreeCollision: () => false }, getActorAtGrid: () => null
};
assert.deepEqual(Game.prototype.findCasualRespawnPosition.call(partyItemRespawnGame, actor, { x: 0, z: 0 }), { x: -1, z: 0 }, 'respawn must skip a question-box cell');

assert.equal(CASUAL_START_SLOTS[0], 0, 'player must begin at the camera-centred x=0 slot');
assert.equal(CASUAL_PLAYER_COUNT, 5, 'Casual must be a five-player race');
assert.equal(CASUAL_START_SLOTS.length, CASUAL_PLAYER_COUNT, 'start slots must match the casual roster');
assert.equal(new Set(CASUAL_START_SLOTS).size, CASUAL_PLAYER_COUNT, 'all five starting actors need distinct occupancy cells');
assert.equal(CASUAL_START_SLOTS.filter((x) => Math.abs(x) <= 6).length, CASUAL_PLAYER_COUNT, 'all start slots must remain inside map bounds');
const botRosterGame = { scene: new THREE.Scene(), bots: [] };
Game.prototype.createCasualBots.call(botRosterGame);
assert.equal(botRosterGame.bots.length, CASUAL_PLAYER_COUNT - 1, 'five-player Casual creates exactly four BOTs');
assert.deepEqual(botRosterGame.bots.map((bot) => bot.gridX), CASUAL_START_SLOTS.slice(1), 'BOT start slots must match the non-player roster slots');
const startMap = new MapGenerator(new THREE.Scene());
startMap.initMap();
const rowZeroTrees = new Set(startMap.getActiveRows().get(0).trees.map((tree) => tree.gridX));
assert.equal(CASUAL_START_SLOTS.some((x) => rowZeroTrees.has(x)), false, 'real initial map state must not place a starter inside a tree');

const actorBoundMap = new MapGenerator(new THREE.Scene());
actorBoundMap.actorBoundsGetter = () => ({ highestZ: 38, lowestZ: 0, checkpointZs: [-10] });
actorBoundMap.initMap();
actorBoundMap.update(0);
assert.ok(actorBoundMap.highestZGenerated >= 38 + 35, 'leader beyond the player generation horizon must still have generated terrain ahead');
assert.ok(actorBoundMap.getActiveRows().has(0), 'player row must remain while a BOT is far ahead');
assert.ok(actorBoundMap.getActiveRows().has(-10), 'checkpoint row must remain while a BOT is far ahead');

let removedEffects = 0;
const expiredStrikeFeedback = {
  actor: { position: new THREE.Vector3(0, 0, 0) }, age: 0.9,
  ring: { position: new THREE.Vector3(), geometry: { dispose: () => {} }, material: { opacity: 1, dispose: () => {} } },
  sprite: { position: new THREE.Vector3(), material: { opacity: 1, dispose: () => {} } },
  texture: { dispose: () => {} }
};
const feedbackGame = { springPunchEffects: [expiredStrikeFeedback], scene: { remove: () => { removedEffects++; } } };
Game.prototype.updateSpringPunchEffects.call(feedbackGame, 0.11);
assert.equal(feedbackGame.springPunchEffects.length, 0, 'leader-strike feedback must expire after one second even with spring punch disabled');
assert.equal(removedEffects, 2, 'expired feedback must remove both ring and label');
console.log('casual restart cleanup regression: passed');
