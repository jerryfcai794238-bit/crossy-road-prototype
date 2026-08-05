import * as THREE from 'three';
import { createShieldMesh, createRocketExhaust, createTimeWave } from '../graphics/VoxelModels.js';

export const ITEM_TYPES = {
  SHIELD: 'shield',
  ROCKET: 'rocket',
  TIME_SLOW: 'time_slow'
};

export class ItemSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;

    this.activeItem = ITEM_TYPES.SHIELD; // 預設配備金剛護盾
    this.cooldownTimer = 0;
    this.cooldownDuration = 6.0; // 6 秒冷卻
    this.activeTimer = 0;

    // VFX 網格引用
    this.shieldMesh = null;
    this.rocketMesh = null;
    this.timeWaveMesh = null;

    this.initVFX();
  }

  initVFX() {
    this.shieldMesh = createShieldMesh();
    this.shieldMesh.visible = false;
    this.player.mesh.add(this.shieldMesh);

    this.rocketMesh = createRocketExhaust();
    this.rocketMesh.visible = false;
    this.player.mesh.add(this.rocketMesh);

    this.timeWaveMesh = createTimeWave();
    this.timeWaveMesh.visible = false;
    this.scene.add(this.timeWaveMesh);
  }

  selectItem(type) {
    this.activeItem = type;
  }

  useItem() {
    if (this.cooldownTimer > 0 || !this.player || this.player.isRespawning) return false;

    switch (this.activeItem) {
      case ITEM_TYPES.SHIELD:
        this.activateShield();
        break;

      case ITEM_TYPES.ROCKET:
        this.activateRocket();
        break;

      case ITEM_TYPES.TIME_SLOW:
        this.activateTimeSlow();
        break;
    }

    this.cooldownTimer = this.cooldownDuration;
    return true;
  }

  activateShield() {
    this.player.isShielded = true;
    this.shieldMesh.visible = true;
    this.activeTimer = 3.5; // 護盾持續 3.5 秒
  }

  activateRocket() {
    this.player.rocketJump();
    this.rocketMesh.visible = true;
    setTimeout(() => {
      this.rocketMesh.visible = false;
    }, 600);
  }

  activateTimeSlow() {
    this.player.isReflexHyper = true;
    this.timeWaveMesh.position.copy(this.player.position);
    this.timeWaveMesh.scale.set(0.1, 0.1, 0.1);
    this.timeWaveMesh.visible = true;
    this.activeTimer = 3.0; // 超感時間持續 3 秒
  }

  deactivateShield() {
    this.player.isShielded = false;
    if (this.shieldMesh) this.shieldMesh.visible = false;
  }

  deactivateTimeSlow() {
    this.player.isReflexHyper = false;
    if (this.timeWaveMesh) this.timeWaveMesh.visible = false;
  }

  update(deltaTime) {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= deltaTime;
      if (this.cooldownTimer < 0) this.cooldownTimer = 0;
    }

    if (this.activeTimer > 0) {
      this.activeTimer -= deltaTime;

      // 超感時間波紋擴散動畫
      if (this.player.isReflexHyper && this.timeWaveMesh.visible) {
        this.timeWaveMesh.position.copy(this.player.position);
        const scale = (3.0 - this.activeTimer) * 2.5;
        this.timeWaveMesh.scale.set(scale, scale, scale);
      }

      if (this.activeTimer <= 0) {
        this.deactivateShield();
        this.deactivateTimeSlow();
      }
    }
  }

  getCooldownRatio() {
    return this.cooldownTimer / this.cooldownDuration;
  }

  reset() {
    this.cooldownTimer = 0;
    this.activeTimer = 0;
    this.deactivateShield();
    this.deactivateTimeSlow();
    if (this.rocketMesh) this.rocketMesh.visible = false;
  }
}
