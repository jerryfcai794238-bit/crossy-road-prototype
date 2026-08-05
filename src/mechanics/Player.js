import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Player {
  constructor(mesh) {
    this.mesh = mesh;

    // 網格座標 (整數)
    this.gridX = 0;
    this.gridZ = 0;

    // 實體世界座標
    this.position = new THREE.Vector3(0, 0, 0);

    // 累計最高分數 (向前步數)
    this.score = 0;

    // 跳躍狀態與動畫變數
    this.isJumping = false;
    this.jumpTimer = 0;
    this.startPosition = new THREE.Vector3(0, 0, 0);
    this.targetPosition = new THREE.Vector3(0, 0, 0);

    // 朝向角度
    this.currentRotationY = 0;
    this.targetRotationY = 0;

    // 死亡狀態標籤
    this.isDead = false;
    this.isDrowning = false;
    this.isFlattened = false;

    // 初始化模型位置
    this.syncMesh();
  }

  /**
   * 根據輸入方向計算目標網格位置，不改變目前狀態
   */
  getTargetGridPosition(direction) {
    let targetX = this.gridX;
    let targetZ = this.gridZ;

    switch (direction) {
      case 'UP':
        targetZ += 1;
        break;
      case 'DOWN':
        targetZ -= 1;
        break;
      case 'LEFT':
        targetX -= 1;
        break;
      case 'RIGHT':
        targetX += 1;
        break;
    }

    return { x: targetX, z: targetZ };
  }

  /**
   * 當前方被樹木阻擋時，只更新朝向而不移動
   */
  setFacingDirection(direction) {
    this.targetRotationY = this.getRotationAngleForDirection(direction);
  }

  /**
   * 計算方向對應的弧度角度
   */
  getRotationAngleForDirection(direction) {
    switch (direction) {
      case 'UP':
        return 0; // 預設朝向 +Z
      case 'DOWN':
        return Math.PI;
      case 'LEFT':
        return Math.PI / 2;
      case 'RIGHT':
        return -Math.PI / 2;
      default:
        return this.targetRotationY;
    }
  }

  /**
   * 執行跳躍移動
   */
  move(direction) {
    if (this.isDead) return false;

    const targetGrid = this.getTargetGridPosition(direction);
    this.setFacingDirection(direction);

    // 如果目前正在跳躍，立刻完成上一階段並開啟新跳躍
    if (this.isJumping) {
      this.position.copy(this.targetPosition);
    }

    // 更新網格位置
    this.gridX = targetGrid.x;
    this.gridZ = targetGrid.z;

    // 更新累積最高遠度得分
    if (this.gridZ > this.score) {
      this.score = this.gridZ;
    }

    // 設定起點與終點世界座標
    this.startPosition.copy(this.position);
    this.targetPosition.set(
      this.gridX * CONFIG.GRID_SIZE,
      0,
      this.gridZ * CONFIG.GRID_SIZE
    );

    // 啟動跳躍動畫
    this.isJumping = true;
    this.jumpTimer = 0;

    return true;
  }

  /**
   * 每幀更新動畫狀態
   */
  update(deltaTime) {
    if (!this.mesh) return;

    // 1. 跳躍弧形動畫 (Jump Arc & Bounce effect)
    if (this.isJumping) {
      this.jumpTimer += deltaTime;
      const progress = Math.min(this.jumpTimer / CONFIG.PLAYER.JUMP_DURATION, 1.0);

      // X/Z 軸線性插值
      this.position.x = THREE.MathUtils.lerp(
        this.startPosition.x,
        this.targetPosition.x,
        progress
      );
      this.position.z = THREE.MathUtils.lerp(
        this.startPosition.z,
        this.targetPosition.z,
        progress
      );

      // Y 軸正弦波弧線跳躍
      const jumpArc = Math.sin(progress * Math.PI);
      this.position.y = jumpArc * CONFIG.PLAYER.JUMP_HEIGHT;

      // 跳躍過程中的體素擠壓伸展 (Squash and Stretch)
      const scaleY = 1.0 + jumpArc * 0.3;
      const scaleXZ = 1.0 - jumpArc * 0.15;
      this.mesh.scale.set(scaleXZ, scaleY, scaleXZ);

      if (progress >= 1.0) {
        this.isJumping = false;
        this.position.copy(this.targetPosition);
        this.position.y = 0;
        this.mesh.scale.set(1.0, 1.0, 1.0);
      }
    }

    // 2. 朝向轉向平滑插值
    this.currentRotationY = THREE.MathUtils.lerp(
      this.currentRotationY,
      this.targetRotationY,
      Math.min(deltaTime * 20, 1.0)
    );
    this.mesh.rotation.y = this.currentRotationY;

    // 3. 特殊死亡動畫 (淹死 drowning / 扁掉 squished)
    if (this.isDrowning) {
      this.position.y -= deltaTime * 3.0;
      const scale = Math.max(0, this.mesh.scale.x - deltaTime * 3.0);
      this.mesh.scale.set(scale, scale, scale);
    } else if (this.isFlattened) {
      this.mesh.scale.set(1.4, 0.05, 1.4);
    }

    // 同步 3D 模型實體位置
    this.syncMesh();
  }

  /**
   * 同步模型 Mesh 世界座標
   */
  syncMesh() {
    if (this.mesh) {
      this.mesh.position.copy(this.position);
    }
  }

  /**
   * 觸發被車/火車壓扁死亡動畫
   */
  triggerFlattenAnimation() {
    this.isDead = true;
    this.isFlattened = true;
    this.isJumping = false;
    this.position.y = 0.02;
  }

  /**
   * 觸發落水淹死動畫
   */
  triggerDrownAnimation() {
    this.isDead = true;
    this.isDrowning = true;
    this.isJumping = false;
  }

  /**
   * 重置主角狀態
   */
  reset() {
    this.gridX = 0;
    this.gridZ = 0;
    this.score = 0;
    this.isJumping = false;
    this.jumpTimer = 0;
    this.isDead = false;
    this.isDrowning = false;
    this.isFlattened = false;

    this.position.set(0, 0, 0);
    this.startPosition.set(0, 0, 0);
    this.targetPosition.set(0, 0, 0);

    this.currentRotationY = 0;
    this.targetRotationY = 0;

    if (this.mesh) {
      this.mesh.position.set(0, 0, 0);
      this.mesh.rotation.set(0, 0, 0);
      this.mesh.scale.set(1, 1, 1);
    }
  }
}
