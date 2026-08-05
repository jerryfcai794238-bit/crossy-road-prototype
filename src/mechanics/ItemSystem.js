import * as THREE from 'three';
import { createShieldMesh, createRocketExhaust, createTimeWave, createRocketBlastRing } from '../graphics/VoxelModels.js';

export const ITEM_TYPES = {
  SHIELD: 'shield',
  ROCKET: 'rocket',
  TIME_SLOW: 'time_slow'
};

export class ItemSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;

    // 各技能獨立 CD (剩餘秒數) 與 CD 總長度
    this.cooldowns = {
      shield: 0,
      rocket: 0,
      time_slow: 0
    };

    this.cooldownDurations = {
      shield: 6.0,
      rocket: 5.0,
      time_slow: 6.0
    };

    // 各技能作用持續時間
    this.activeTimers = {
      shield: 0,
      time_slow: 0
    };

    // 特效 Mesh
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

  useItem(type) {
    if (!this.player || this.player.isRespawning) return false;
    if (this.cooldowns[type] > 0) return false;

    switch (type) {
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

    this.cooldowns[type] = this.cooldownDurations[type];
    return true;
  }

  activateShield() {
    this.player.isShielded = true;
    this.shieldMesh.visible = true;
    this.activeTimers.shield = 3.5;
  }

  activateRocket() {
    this.rocketMesh.visible = true;

    // 綁定小雞雙腳觸地的精準事件 (第 0.00 秒零延遲爆發光環)
    this.player.onRocketLand = () => {
      this.rocketMesh.visible = false;

      const blast = createRocketBlastRing();
      blast.position.copy(this.player.position);
      this.scene.add(blast);

      setTimeout(() => {
        this.scene.remove(blast);
      }, 400);

      this.player.onRocketLand = null;
    };

    this.player.rocketJump();
  }

  activateTimeSlow() {
    this.player.isReflexHyper = true;
    this.timeWaveMesh.position.copy(this.player.position);
    this.timeWaveMesh.scale.set(0.1, 0.1, 0.1);
    this.timeWaveMesh.visible = true;
    this.activeTimers.time_slow = 3.5;
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
    // 獨立更新各技能 CD
    for (const key in this.cooldowns) {
      if (this.cooldowns[key] > 0) {
        this.cooldowns[key] -= deltaTime;
        if (this.cooldowns[key] < 0) this.cooldowns[key] = 0;
      }
    }

    // 更新護盾作用倒數
    if (this.activeTimers.shield > 0) {
      this.activeTimers.shield -= deltaTime;
      if (this.activeTimers.shield <= 0) {
        this.deactivateShield();
      }
    }

    // 更新超感技能作用倒數與波紋擴散
    if (this.activeTimers.time_slow > 0) {
      this.activeTimers.time_slow -= deltaTime;
      if (this.timeWaveMesh && this.timeWaveMesh.visible) {
        this.timeWaveMesh.position.copy(this.player.position);
        const scale = (3.5 - this.activeTimers.time_slow) * 2.5;
        this.timeWaveMesh.scale.set(scale, scale, scale);
      }
      if (this.activeTimers.time_slow <= 0) {
        this.deactivateTimeSlow();
      }
    }
  }

  getCooldownRatios() {
    return {
      shield: this.cooldowns.shield / this.cooldownDurations.shield,
      rocket: this.cooldowns.rocket / this.cooldownDurations.rocket,
      time_slow: this.cooldowns.time_slow / this.cooldownDurations.time_slow
    };
  }

  reset() {
    for (const key in this.cooldowns) {
      this.cooldowns[key] = 0;
    }
    for (const key in this.activeTimers) {
      this.activeTimers[key] = 0;
    }
    this.deactivateShield();
    this.deactivateTimeSlow();
    if (this.rocketMesh) this.rocketMesh.visible = false;
  }
}
