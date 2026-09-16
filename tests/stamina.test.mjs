import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Player } from '../src/mechanics/Player.js';
import { AIBot } from '../src/mechanics/AIBot.js';
import { Game } from '../src/main.js';

const player = new Player(null);
assert.equal(player.maxStamina, 100, 'every character starts with a 100-point stamina cap');
assert.equal(player.stamina, 100, 'every character starts at full stamina');
assert.equal(player.jumpDuration, 0.16, 'each jump remains fixed at 0.16 seconds');

assert.equal(player.move('UP'), true, 'a successful move starts when stamina is available');
assert.equal(player.stamina, 98, 'a successful active move consumes 2 stamina');
player.update(0.1);
player.update(0.1);
assert.equal(player.stamina, 98, 'stamina does not recover while jumping');

for (let index = 0; index < 49; index++) {
  player.isJumping = false;
  player.position.copy(player.targetPosition);
  assert.equal(player.move('UP'), true, `move ${index + 2} consumes stamina`);
}
assert.equal(player.stamina, 0, '50 successive active moves consume the full 100 stamina');
assert.equal(50 * player.jumpDuration, 8, '50 moves at 0.16 seconds take about 8 seconds');
player.isJumping = false;
player.position.copy(player.targetPosition);
assert.equal(player.move('UP'), false, 'zero stamina blocks active movement');

player.update(0.1);
assert.equal(player.stamina, 2, '0.1 stationary seconds restore one movement cost at 20 points per second');
assert.equal(player.move('UP'), true, 'restored stamina enables an active move again');
player.isJumping = false;
player.position.copy(player.targetPosition);
player.stamina = 0;
for (let index = 0; index < 5; index++) player.update(0.1);
assert.equal(player.stamina, 10, 'stationary stamina recovers smoothly at 20 points per second');
for (let index = 0; index < 50; index++) player.update(0.1);
assert.equal(player.stamina, 100, 'stationary recovery never exceeds the stamina cap');

const pushedActor = new Player(null);
pushedActor.stamina = 0;
assert.equal(pushedActor.move('UP', 1, false), true, 'a passive push may move a zero-stamina character');
assert.equal(pushedActor.stamina, 0, 'a passive push does not consume or alter the pushed character stamina');

const playerMesh = new THREE.Group();
const visibleBarPlayer = new Player(playerMesh);
assert.equal(visibleBarPlayer.staminaBar, null, 'the player does not create an isometric 3D Sprite that can visually drift from its head');
assert.equal(playerMesh.children.length, 0, 'the player mesh remains free of hidden stamina geometry that would pollute its visual bounds');
visibleBarPlayer.stamina = 10;
for (let index = 0; index < 8; index++) visibleBarPlayer.updateStaminaBar(0.1);
assert.ok(visibleBarPlayer.staminaBarVisual < visibleBarPlayer.maxStamina, 'low stamina still updates the player-facing visual ratio without a 3D Sprite');
const botMesh = new THREE.Group();
const bot = new AIBot(botMesh, '無條BOT');
assert.equal(bot.staminaBar, null, 'bots do not create overhead stamina bars');

const setGridPosition = (actor, z) => {
  actor.gridZ = z;
  actor.targetGridZ = z;
  actor.position.set(0, 0, z);
  actor.startPosition.copy(actor.position);
  actor.targetPosition.copy(actor.position);
};
const pusher = new Player(null);
const pushedMiddle = new Player(null);
const pushedFront = new Player(null);
setGridPosition(pusher, 0);
setGridPosition(pushedMiddle, 1);
setGridPosition(pushedFront, 2);
const chainActors = [pusher, pushedMiddle, pushedFront];
const chainGame = Object.create(Game.prototype);
chainGame.getActiveActors = () => chainActors;
chainGame.canActorEnter = () => true;

pushedMiddle.stunTimer = 1;
let chainPlan = chainGame.planActorMove(pusher, 'UP');
assert.equal(chainPlan.canMove, false, 'a stunned actor in a push chain rejects the whole plan');
assert.ok(chainActors.every((actor) => !actor.isJumping), 'a rejected stunned chain starts no jumps');
assert.equal(pusher.stamina, 100, 'a rejected stunned chain spends no initiator stamina');

pushedMiddle.stunTimer = 0;
chainPlan = chainGame.planActorMove(pusher, 'UP');
assert.equal(chainPlan.canMove, true, 'a clear chain can be planned');
pushedMiddle.isRespawning = true;
assert.equal(chainGame.startActorMovePlan(chainPlan), false, 'a respawning actor rejects a previously planned chain at start');
assert.ok(chainActors.every((actor) => !actor.isJumping), 'a rejected respawn chain starts no jumps');
assert.equal(pusher.stamina, 100, 'a rejected respawn chain spends no initiator stamina');

pushedMiddle.isRespawning = false;
pushedMiddle.stamina = 0;
chainPlan = chainGame.planActorMove(pusher, 'UP');
assert.equal(chainPlan.canMove, true, 'a zero-stamina pushed actor still permits the chain');
assert.equal(chainGame.startActorMovePlan(chainPlan), true, 'a valid chain starts atomically');
assert.equal(pusher.stamina, 98, 'only the push initiator pays 2 stamina');
assert.equal(pushedMiddle.stamina, 0, 'the pushed zero-stamina actor remains at zero');

const heldGame = Object.create(Game.prototype);
heldGame.heldKeys = new Map();
heldGame.player = { isJumping: false, inputBuffer: [] };
const keyboardMoves = [];
heldGame.handlePlayerInput = (direction) => keyboardMoves.push(direction);
assert.equal(heldGame.handleHeldKeyDown('w', 'UP'), true, 'first keydown moves immediately');
assert.equal(heldGame.handleHeldKeyDown('w', 'UP'), false, 'repeated keydown does not depend on OS repeat');
assert.equal(heldGame.handleHeldKeyDown('d', 'RIGHT'), true, 'a later held key is registered');
assert.equal(heldGame.getHeldDirection(), 'RIGHT', 'the latest still-held key wins');
assert.equal(heldGame.handleHeldKeyUp('d'), true, 'keyup stops that direction immediately');
assert.equal(heldGame.getHeldDirection(), 'UP', 'releasing the latest key restores the older held direction');
assert.equal(heldGame.handleHeldKeyUp('w'), true, 'keyup releases the final held key');
assert.equal(heldGame.getHeldDirection(), null, 'no held key means no continuous movement');
assert.deepEqual(keyboardMoves, ['UP', 'RIGHT'], 'only initial presses issue discrete input');
heldGame.heldKeys.set('w', 'UP');
const continuedMoves = [];
heldGame.handlePlayerMove = (direction) => { continuedMoves.push(direction); return 'moved'; };
assert.equal(heldGame.continueHeldMovement(), true, 'landing continues the held direction once');
heldGame.player.inputBuffer.push({ direction: 'LEFT' });
assert.equal(heldGame.continueHeldMovement(), false, 'queued discrete input keeps its existing priority');
assert.deepEqual(continuedMoves, ['UP'], 'held movement runs at most once per landing tick');

const pauseGame = Object.create(Game.prototype);
pauseGame.heldKeys = new Map([['w', 'UP']]);
pauseGame.isGameStarted = true;
pauseGame.isGameOver = false;
pauseGame.currentMode = 'challenge';
pauseGame.uiManager = { showGameSettings() {}, hideGameSettings() {}, btnGameSettings: { focus() {} } };
pauseGame.openGameSettings();
assert.equal(pauseGame.getHeldDirection(), null, 'opening pause clears held movement');
pauseGame.resumeGame();
assert.equal(pauseGame.getHeldDirection(), null, 'resuming requires a new keydown before movement can continue');

const lobbyGame = Object.create(Game.prototype);
lobbyGame.heldKeys = new Map([['w', 'UP']]);
lobbyGame.matchTimer = null;
lobbyGame.pendingRespawns = new Map();
lobbyGame.cancelEagleAttack = () => {};
lobbyGame.clearRuntimeEffects = () => {};
lobbyGame.clearBots = () => {};
lobbyGame.uiManager = { showLobby() {} };
lobbyGame.returnLobby();
assert.equal(lobbyGame.getHeldDirection(), null, 'returning to lobby clears held movement');

const gameSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const uiSource = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
assert.match(uiSource, /const app = document\.getElementById\('app'\);[\s\S]*?app\.append\(marker\);/, 'the player marker mounts outside the canvas container so SceneSetup cannot remove it');
assert.match(gameSource, /new THREE\.Box3\(\)\.setFromObject\(this\.player\.mesh\);[\s\S]*?groundAnchor = new THREE\.Vector3\(actorCenter\.x, playerBounds\.min\.y, actorCenter\.z\)\.project\(camera\);[\s\S]*?headAnchor\.y = playerBounds\.max\.y;[\s\S]*?headAnchor\.project\(camera\)/, 'the visible player stamina marker combines the model-foot X with the model-top Y');
assert.match(gameSource, /this\.scene\.updateMatrixWorld\(true\);\s*camera\.updateMatrixWorld\(true\);/, 'the marker projects from the current frame scene and camera matrices');
assert.match(gameSource, /this\.updatePlayerStaminaMarker\(\);/, 'the player stamina marker refreshes after each camera update');
assert.match(gameSource, /this\.player\.update\(deltaTime\);\s*this\.uiManager\.updateStamina\([\s\S]*?this\.updatePlayerStaminaMarker\(\);/, 'the marker refreshes before later gameplay branches can return early');
assert.match(uiSource, /player-stamina-marker/, 'only the UI manager creates the projected player stamina marker');
assert.match(uiSource, /existingMarker\.querySelector\('\.player-stamina-fill'\)/, 'a surviving marker is rebound after a UI reload instead of being silently ignored');
assert.match(uiSource, /translate3d\(\$\{x\}px, \$\{y\}px, 0\) translate\(-50%, -100%\)/, 'the marker centers its screen-space bar directly above the projected head point');
for (const method of ['beginCasualMatching()', 'launchGame(mode = \'casual\', startImmediately = true)']) {
  const methodStart = gameSource.indexOf(method);
  const methodEnd = gameSource.indexOf('\n  }\n', methodStart);
  const body = gameSource.slice(methodStart, methodEnd);
  assert.match(body, /this\.player\.reset\(\);\s*this\.uiManager\.updateStamina\(this\.player\.stamina, this\.player\.maxStamina\);/, `${method} resets the HUD stamina with the player`);
}
for (const method of ['beginCasualMatching()', 'cancelCasualMatching()', 'launchGame(mode = \'casual\', startImmediately = true)', 'returnLobby()', 'openGameSettings()', 'leaveGame()', "gameOver(reason = '被車撞飛了！')"]) {
  const methodStart = gameSource.indexOf(method);
  const methodEnd = gameSource.indexOf('\n  }\n', methodStart);
  const body = gameSource.slice(methodStart, methodEnd);
  assert.match(body, /this\.clearHeldKeys\?\.\(\);/, `${method} clears held movement at its lifecycle boundary`);
}
assert.match(gameSource, /const \[actor\] = plan\.chain;[\s\S]*?!actor\.canSpendStamina\(\)/, 'only the push initiator must have stamina when starting a chain');
assert.match(gameSource, /chainActor\.move\(plan\.direction, stepDistance, index === 0\)/, 'only the chain initiator pays stamina; pushed actors move passively');
console.log('stamina mechanics: passed');
