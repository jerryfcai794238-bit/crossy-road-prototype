import assert from 'node:assert/strict';
import { Player } from '../src/mechanics/Player.js';

const mesh = { visible: false, rotation: { y: 0 }, position: { copy: () => {} } };
const player = new Player(mesh);
player.isDead = true;
player.isInvulnerable = true;
player.invulnerableTimer = 0.01;
player.update(0.1);
assert.equal(mesh.visible, false, 'a dead actor must remain hidden even when its invulnerability timer would end');
assert.equal(player.isInvulnerable, true, 'death freeze must not advance invulnerability state before respawn');
console.log('player death visibility regression: passed');
