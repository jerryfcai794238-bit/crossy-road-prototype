import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PartyItemSystem } from '../src/mechanics/PartyItemSystem.js';
import { MapGenerator } from '../src/mechanics/MapGenerator.js';

const makeActor = (x, z) => ({
  gridX: x, gridZ: z, position: new THREE.Vector3(x * 1.2, 0, z * 1.2),
  stunTimer: 0, isDead: false, isRespawning: false, deathCount: 0,
  applyStun(seconds) { this.stunTimer = seconds; return true; }
});

const player = makeActor(0, 0);
const other = makeActor(0, 3);
const scene = new THREE.Scene();
let lightningCount = 0;
const game = {
  player, scene,
  uiManager: { updateItemHUD() {} },
  getActiveActors: () => [player, other],
  startGlobalLightning() { lightningCount++; },
  mapGenerator: { activeRows: new Map(), destroyedTreeCells: new Set() },
  casualRecovery: { schedule() {} }
};
const rngValues = [0.01, 0.36, 0.68, 0.99];
let rngIndex = 0;
const system = new PartyItemSystem(game, () => rngValues[rngIndex++ % rngValues.length]);
system.showFeedback = () => {};
system.burst = () => {};

const rouletteActor = makeActor(0, 10);
assert.equal(system.beginRoulette(rouletteActor), true, 'first empty slot starts roulette');
assert.equal(system.beginRoulette(rouletteActor), true, 'second empty slot may roll at the same time');
const rouletteSlots = system.state(rouletteActor).slots;
assert.equal(rouletteSlots.filter(Boolean).length, 2, 'both fixed slots are occupied while rolling');
assert.ok(rouletteSlots.every(slot => slot.roulette), 'each slot owns its own roulette state');
assert.equal(system.beginRoulette(rouletteActor), false, 'two rolling slots reject pickup before the box is consumed');
const outcomes = new Set(rouletteSlots.map(slot => slot.roulette.result));
assert.ok(outcomes.size > 1 && ![...outcomes].every(type => type === 'rocket'), 'injected roulette RNG produces varied, non-duplicate held results');

const lightningActor = makeActor(1, 10);
const lightningSystem = new PartyItemSystem(game, () => .99);
lightningSystem.showFeedback = () => {};
assert.equal(lightningSystem.beginRoulette(lightningActor), true);
assert.equal(lightningSystem.beginRoulette(lightningActor), true);
assert.deepEqual(lightningSystem.state(lightningActor).slots.map((slot) => slot.roulette.result), ['lightning', 'eagle'], 'two simultaneous roulettes cannot reserve duplicate lightning');

const full = system.state(player);
full.slots = [{ type: 'rocket', readyAt: 0 }, { type: 'eagle', readyAt: 0 }];
assert.equal(system.canReceive(player), false, 'full held slots reject a box');
system.award(player, 0, 'shield');
assert.equal(full.slots[0].type, 'shield', 'shield waits in its resolved slot for the shared trigger gate');
system.update(.01);
assert.equal(full.slots[0], null, 'shield clears only after the shared trigger activates it');
assert.equal(system.hasActiveShield(player), true, 'shield becomes active after the trigger gate');
system.award(player, 0, 'lightning');
assert.equal(lightningCount, 0, 'second instant item waits for the shared trigger interval');
system.update(.8);
assert.equal(lightningCount, 1, 'lightning result activates immediately at its own slot');
assert.equal(full.slots[0], null, 'instant lightning clears only its own slot');

const closeByX = makeActor(3, 0);
const fartherForward = makeActor(0, 4);
game.getActiveActors = () => [player, closeByX, fartherForward];
assert.equal(system.selectRocketTarget(player), closeByX, 'rocket uses actual two-dimensional nearest distance, not Z distance');
system.launchRocket(player, closeByX);
closeByX.position.z = 30;
system.updateRockets(.01);
assert.equal(system.rockets[0].target, closeByX, 'launched rocket keeps its original target while it moves');
closeByX.isDead = true;
system.updateRockets(.01);
assert.equal(system.rockets.length, 0, 'rocket disappears when its locked target dies');
closeByX.isDead = false;

const row = { z: 1, mesh: new THREE.Group(), trees: [], vehicles: [], train: null };
const tree = { gridX: 0, mesh: new THREE.Mesh() };
const car = { width: 1.8, mesh: new THREE.Mesh() };
row.trees.push(tree); row.vehicles.push(car);
row.mesh.add(tree.mesh, car.mesh);
car.mesh.position.set(0, 0, 1.2);
row.train = new THREE.Group(); row.train.position.set(0, 0, 1.2); row.mesh.add(row.train);
game.mapGenerator.activeRows.set(1, row);
system.destroyAlong(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1.2));
assert.equal(row.trees.length, 0, 'rocket removes hit trees from the collision array');
assert.equal(row.vehicles.length, 0, 'rocket removes hit cars from the collision array');
assert.equal(row.train, null, 'rocket removes a hit train');
assert.ok(game.mapGenerator.destroyedTreeCells.has('0,1'), 'destroyed trees persist across map streaming');

assert.equal(system.blockAttack(player, 'rocket'), true, 'shield blocks one item hit');
assert.equal(system.hasActiveShield(player), false, 'shield is consumed after one blocked attack');
assert.equal(row.trees.length, 0);
system.activeShields.set(player, { expiresAt: system.time + .01 });
system.update(.02);
assert.equal(system.hasActiveShield(player), false, 'shield expires after its active duration if it was not used');
system.activeShields.set(player, { expiresAt: system.time });
assert.equal(system.blockAttack(player, 'rocket'), false, 'an expired shield cannot block an attack at the ten-second boundary');
assert.equal(system.hasActiveShield(player), false, 'an expired shield clears immediately when an attack checks it');

player.gridZ = 10; other.gridZ = 7;
game.getActiveActors = () => [player, other];
assert.equal(system.selectEagleTarget(player), other, 'first-place owner attacks the next lower placement group');
other.gridZ = 10;
assert.equal(system.selectEagleTarget(player), null, 'tied first place with no lower group keeps eagle in reserve');
const third = makeActor(-1, 7);
game.getActiveActors = () => [player, other, third];
assert.equal(system.selectEagleTarget(player), third, 'first-place tie targets the next lower placement group');

system.activeShields.set(player, { expiresAt: system.time + 1.9 });
game.getActiveActors = () => [player, other, third];
system.updateStatusEffects();
assert.equal(system.shieldEffects.size, 1, 'an active shield creates a persistent actor-following bubble');
assert.deepEqual(system.shieldEffects.get(player).group.position.toArray(), [0, .55, 0], 'shield bubble follows the actor position');
assert.ok(system.shieldEffects.get(player).bubble.material.opacity < .1, 'shield visibly flashes during its final two seconds');
player.stunTimer = 1.5;
system.updateStatusEffects();
assert.equal(system.stunEffects.get(player).group.children.length, 5, 'stunned actors receive a visible ring of yellow stars');
assert.ok(system.stunEffects.get(player).group.children.every((star) => star.userData.isStunStar && star.geometry.type === 'ShapeGeometry'), 'stun VFX uses actual five-point star silhouettes');
player.stunTimer = 0;
player.isDead = true;
system.updateStatusEffects();
assert.equal(system.shieldEffects.size, 0, 'death removes shield VFX');
assert.equal(system.stunEffects.size, 0, 'death removes stun VFX');
player.isDead = false;
system.activeShields.set(player, { expiresAt: system.time + 10 });
system.updateStatusEffects();
system.clear();
assert.equal(system.activeShields.size, 0, 'party clear removes active shield state');
assert.equal(system.shieldEffects.size, 0, 'party clear disposes shield VFX');
system.createRocketImpact(player.position, false);
system.createRocketImpact(player.position, true);
assert.equal(system.impactEffects.length, 2, 'rocket impacts create normal and shield-distinct structural VFX');
system.updateImpactEffects(.72);
assert.equal(system.impactEffects.length, 0, 'rocket impact VFX disposes after its readable duration');
const feedbackSprites = [new THREE.Sprite(), new THREE.Sprite()];
system.feedback = feedbackSprites.map((sprite) => ({ actor: player, sprite, remaining: 1, total: 1 }));
system.layoutFeedback(player);
assert.deepEqual(feedbackSprites.map((sprite) => sprite.position.x), [-.43, .43], 'same-actor item cards use symmetric non-overlapping slots');
system.feedback = [system.feedback[0]];
system.layoutFeedback(player);
assert.equal(feedbackSprites[0].position.x, 0, 'feedback cards re-center after a sibling is removed');
system.feedback = [];

const generatedMap = new MapGenerator(new THREE.Scene());
generatedMap.initMap();
const firstRow = generatedMap.activeRows.get(0);
const edgeTree = firstRow.trees.find(tree => tree.gridX === -8);
assert.ok(edgeTree, 'fixture must start with an actual boundary tree');
generatedMap.destroyedTreeCells.add('-8,0');
generatedMap.removeRow(0, firstRow);
generatedMap.generateRow(0, 'grass', true);
assert.equal(generatedMap.activeRows.get(0).trees.some(tree => tree.gridX === -8), false, 'a removed tree cannot return when that row is rebuilt in the same round');
generatedMap.initMap();
assert.equal(generatedMap.activeRows.get(0).trees.some(tree => tree.gridX === -8), true, 'a new round resets permanent destruction');

console.log('party items regression: passed');
