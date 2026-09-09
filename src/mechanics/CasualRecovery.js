import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class CasualRecovery {
  constructor(game) {
    this.game = game;
    this.states = new Map();
  }

  schedule(actor, reason = 'impact', penaltySeconds = CONFIG.RESPAWN.PENALTY, options = {}) {
    if (!actor || this.states.has(actor) || actor.isDead || actor.isRespawning) return false;
    const checkpoint = actor === this.game.player ? this.game.casualCheckpoint : actor.checkpoint;
    const state = { phase: options.animate === false ? 'returning' : 'dying', checkpoint, reason, elapsed: 0, penaltySeconds, countDeath: options.countDeath !== false, label: null, labelValue: null };
    if (state.countDeath) actor.deathCount = (actor.deathCount || 0) + 1;
    actor.isDead = true;
    actor.isJumping = false;
    actor.inputBuffer = [];
    actor.respawnRemaining = 0;
    if (actor.mesh) actor.mesh.visible = true;
    if (state.countDeath && actor.behaviorStats) { actor.behaviorStats.death = (actor.behaviorStats.death || 0) + 1; actor.lastIntent = '死亡重生中'; }
    this.states.set(actor, state);
    this.game.pendingRespawns.set(actor, state);
    this.updateUI(actor, 0, state.phase);
    return true;
  }

  update(dt) {
    for (const [actor, state] of this.states) {
      if (state.phase === 'dying') {
        state.elapsed += dt;
        if (actor.mesh) {
          if (state.reason === 'fall') actor.mesh.position.y = -Math.min(0.55, state.elapsed * 0.85);
          else { actor.mesh.scale.y = Math.max(0.1, 0.95 - state.elapsed * 1.25); actor.mesh.rotation.z = state.elapsed * 0.55; }
        }
        if (state.elapsed < CONFIG.RESPAWN.DEATH_ANIMATION) continue;
        state.phase = 'returning';
        if (actor.mesh) actor.mesh.visible = false;
      }
      if (state.phase === 'returning') {
        const position = this.game.findCasualRespawnPosition(actor, state.checkpoint);
        this.updateUI(actor, 0, 'returning');
        if (!position) continue;
        actor.respawnAt(position.x, position.z, 0);
        actor.isDead = false;
        actor.isRespawning = true;
        actor.isInvulnerable = false;
        actor.invulnerableTimer = 0;
        actor.respawnRemaining = state.penaltySeconds;
        if (actor.mesh) { actor.mesh.visible = true; actor.mesh.rotation.x = 0; actor.mesh.rotation.z = 0; actor.mesh.scale.set?.(0.95, 0.95, 0.95); }
        state.phase = 'countdown';
        state.elapsed = state.penaltySeconds;
        this.updateUI(actor, Math.ceil(state.elapsed), 'countdown', state);
        if (state.penaltySeconds <= 0) this.finish(actor, state);
        continue;
      }
      if (state.phase === 'countdown') {
        state.elapsed = Math.max(0, state.elapsed - dt);
        const seconds = Math.ceil(state.elapsed);
        actor.respawnRemaining = state.elapsed;
        this.positionLabel(actor, state);
        this.updateUI(actor, seconds, 'countdown', state);
        if (state.elapsed <= 0) this.finish(actor, state);
      }
    }
  }

  updateUI(actor, seconds, phase, state = this.states.get(actor)) {
    if (actor === this.game.player) this.game.uiManager.updateRespawnCountdown?.(seconds, phase);
    if (phase !== 'countdown') return;
    if (state.labelValue === seconds) return;
    this.disposeLabel(state);
    const label = this.game.createEffectLabel(String(seconds), '#ffffff', '#26324a');
    label.sprite.scale.set(0.52, 0.52, 1);
    this.game.scene.add(label.sprite);
    state.label = label;
    state.labelValue = seconds;
    this.positionLabel(actor, state);
  }

  positionLabel(actor, state) {
    if (!state?.label?.sprite || !actor.position) return;
    state.label.sprite.position.copy(actor.position).add(new THREE.Vector3(0, 1.45, 0));
  }

  finish(actor, state) {
    actor.isRespawning = false;
    actor.respawnRemaining = 0;
    actor.isInvulnerable = true;
    actor.invulnerableTimer = CONFIG.RESPAWN.INVULNERABILITY;
    this.updateUI(actor, null, 'complete');
    this.disposeLabel(state);
    this.states.delete(actor);
    this.game.pendingRespawns.delete(actor);
  }

  disposeLabel(state) {
    if (!state?.label) return;
    this.game.scene.remove(state.label.sprite);
    state.label.sprite.material.dispose();
    state.label.texture.dispose();
    state.label = null;
  }

  clear() {
    this.states.forEach((state) => this.disposeLabel(state));
    this.states.clear();
    this.game.pendingRespawns.clear();
    this.game.uiManager.updateRespawnCountdown?.(null, 'complete');
  }
}
