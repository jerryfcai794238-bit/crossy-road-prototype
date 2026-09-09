import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CasualRecovery } from '../src/mechanics/CasualRecovery.js';

const removed = [];
const ui = [];
const game = {
  pendingRespawns: new Map(), player: null, casualCheckpoint: { x: 0, z: 0 },
  scene: { add() {}, remove: (node) => removed.push(node) },
  uiManager: { updateRespawnCountdown: (...args) => ui.push(args) },
  createEffectLabel: () => ({ sprite: { position: new THREE.Vector3(), scale: { set() {} }, material: { dispose() {} } }, texture: { dispose() {} } }),
  findCasualRespawnPosition: () => null
};
const actor = { checkpoint: { x: 2, z: 4 }, position: new THREE.Vector3(0, 0, 0), mesh: { visible: false, scale: { y: .95, set() {} }, rotation: { x: 0, z: 0.4 }, position: { y: 0 } }, inputBuffer: [1], isDead: false, isRespawning: false, respawnAt(x, z) { this.x = x; this.z = z; this.position.set(x, 0, z); } };
game.player = actor;
const recovery = new CasualRecovery(game);
assert.equal(recovery.schedule(actor, 'impact'), true);
assert.equal(actor.mesh.visible, true, 'death animation must force a visible mesh');
recovery.update(.65);
assert.equal(recovery.states.get(actor).phase, 'returning');
assert.equal(actor.deathCount, 1);
recovery.update(1);
assert.equal(recovery.states.get(actor).phase, 'returning', 'full checkpoint must wait without starting countdown');
game.findCasualRespawnPosition = () => ({ x: 1, z: 4 });
recovery.update(.01);
assert.equal(recovery.states.get(actor).phase, 'countdown');
assert.equal(actor.isRespawning, true);
assert.equal(actor.respawnRemaining, 3);
assert.equal(actor.mesh.rotation.z, 0, 'returning must reset impact tilt');
const label = recovery.states.get(actor).label.sprite.position;
assert.deepEqual(label.toArray(), [1, 1.45, 4], 'countdown label must start above the returned actor');
recovery.update(3);
assert.equal(actor.isRespawning, false);
assert.equal(game.pendingRespawns.size, 0);
console.log('casual recovery regression: passed');
