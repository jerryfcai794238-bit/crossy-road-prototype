import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Player {
  constructor(mesh) {
    this.mesh = mesh;
    this.gridX = 0;
    this.gridZ = 0;

    this.targetGridX = 0;
    this.targetGridZ = 0;

    this.position = new THREE.Vector3(0, 0, 0);
    this.startPosition = new THREE.Vector3(0, 0, 0);
    this.targetPosition = new THREE.Vector3(0, 0, 0);

    this.isJumping = false;
    this.jumpProgress = 0;
    this.jumpDuration = CONFIG.JUMP_DURATION;
    this.jumpHeight = CONFIG.JUMP_HEIGHT;

    this.score = 0;
    this.maxReachedZ = 0;
    this.facingAngle = 0;

    // 狀態標籤
    this.isShielded = false;
    this.isReflexHyper = false;
    this.isRespawning = false;

    this.reset();
  }

  reset() {
    this.gridX = 0;
    this.gridZ = 0;
    this.targetGridX = 0;
    this.targetGridZ = 0;

    this.position.set(0, 0, 0);
    this.startPosition.set(0, 0, 0);
    this.targetPosition.set(0, 0, 0);

    this.isJumping = false;
    this.jumpProgress = 0;
    this.jumpDuration = CONFIG.JUMP_DURATION;
    this.jumpHeight = CONFIG.JUMP_HEIGHT;

    this.score = 0;
    this.maxReachedZ = 0;
    this.facingAngle = 0;

    this.isShielded = false;
    this.isReflexHyper = false;
    this.isRespawning = false;

    if (this.mesh) {
      this.mesh.position.set(0, 0, 0);
      this.mesh.rotation.y = 0;
      this.mesh.scale.set(1, 1, 1);
      this.mesh.visible = true;
    }
  }

  getTargetGridPosition(direction, distance = 1) {
    let nextX = this.gridX;
    let nextZ = this.gridZ;

    switch (direction) {
      case 'UP':
        nextZ += distance;
        break;
      case 'DOWN':
        nextZ -= distance;
        break;
      case 'LEFT':
        nextX += distance;
        break;
      case 'RIGHT':
        nextX -= distance;
        break;
    }

    nextX = Math.max(-CONFIG.MAP_BOUNDS_X, Math.min(CONFIG.MAP_BOUNDS_X, nextX));
    return { x: nextX, z: nextZ };
  }

  setFacingDirection(direction) {
    switch (direction) {
      case 'UP':
        this.facingAngle = 0;
        break;
      case 'DOWN':
        this.facingAngle = Math.PI;
        break;
      case 'LEFT':
        this.facingAngle = Math.PI / 2;
        break;
      case 'RIGHT':
        this.facingAngle = -Math.PI / 2;
        break;
    }
    if (this.mesh) {
      this.mesh.rotation.y = this.facingAngle;
    }
  }

  move(direction, customDistance = 1) {
    if (this.isJumping || this.isRespawning) return false;

    const targetGrid = this.getTargetGridPosition(direction, customDistance);
    this.setFacingDirection(direction);

    this.startPosition.copy(this.position);
    this.targetGridX = targetGrid.x;
    this.targetGridZ = targetGrid.z;

    this.targetPosition.set(
      this.targetGridX * CONFIG.GRID_SIZE,
      0,
      this.targetGridZ * CONFIG.GRID_SIZE
    );

    this.isJumping = true;
    this.jumpProgress = 0;

    // 超感時間狀態下跳躍速度減半（動作快 2 倍）
    this.jumpDuration = this.isReflexHyper ? CONFIG.JUMP_DURATION * 0.5 : CONFIG.JUMP_DURATION;
    this.jumpHeight = customDistance > 1 ? CONFIG.JUMP_HEIGHT * 2.2 : CONFIG.JUMP_HEIGHT;

    if (this.targetGridZ > this.maxReachedZ) {
      this.maxReachedZ = this.targetGridZ;
      this.score = this.maxReachedZ;
    }

    return true;
  }

  // 火箭爆衝 3 格跳躍
  rocketJump() {
    return this.move('UP', 3);
  }

  // 1 秒快速空投重生
  respawn(safeGridZ = Math.max(0, this.gridZ - 2)) {
    this.isRespawning = true;
    this.isJumping = false;
    this.gridX = 0;
    this.gridZ = safeGridZ;

    this.startPosition.set(0, 8, safeGridZ * CONFIG.GRID_SIZE); // 空中 8 單位高空降落
    this.targetPosition.set(0, 0, safeGridZ * CONFIG.GRID_SIZE);
    this.position.copy(this.startPosition);

    if (this.mesh) {
      this.mesh.scale.set(1, 1, 1);
      this.mesh.position.copy(this.position);
      this.mesh.visible = true;
    }

    this.isJumping = true;
    this.jumpProgress = 0;
    this.jumpDuration = 0.8; // 0.8 秒空投降落
    this.jumpHeight = 0;
  }

  update(deltaTime) {
    if (!this.mesh) return;

    if (this.isJumping) {
      this.jumpProgress += deltaTime / this.jumpDuration;
      if (this.jumpProgress >= 1.0) {
        this.jumpProgress = 1.0;
        this.isJumping = false;
        this.isRespawning = false;

        this.gridX = this.targetGridX;
        this.gridZ = this.targetGridZ;
        this.position.copy(this.targetPosition);
      } else {
        this.position.x = THREE.MathUtils.lerp(this.startPosition.x, this.targetPosition.x, this.jumpProgress);
        this.position.z = THREE.MathUtils.lerp(this.startPosition.z, this.targetPosition.z, this.jumpProgress);

        if (this.isRespawning) {
          // 下降降落傘動畫
          this.position.y = THREE.MathUtils.lerp(this.startPosition.y, 0, this.jumpProgress);
        } else {
          // 抛物線跳躍
          const jumpY = Math.sin(this.jumpProgress * Math.PI) * this.jumpHeight;
          this.position.y = jumpY;
        }
      }

      this.mesh.position.copy(this.position);
    } else {
      this.mesh.position.copy(this.position);
    }
  }

  triggerFlattenAnimation() {
    if (this.mesh && !this.isShielded) {
      this.mesh.scale.set(1.4, 0.1, 1.4);
      this.mesh.position.y = 0.05;
    }
  }

  triggerDrownAnimation() {
    if (this.mesh && !this.isShielded) {
      this.mesh.scale.set(0.2, 0.2, 0.2);
      this.mesh.position.y = -0.3;
    }
  }
}
