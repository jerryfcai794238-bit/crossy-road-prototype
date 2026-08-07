import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Player {
  constructor(mesh) {
    this.mesh = mesh;
    this.gridX = 0;
    this.gridZ = 0;
    this.targetGridX = 0;
    this.targetGridZ = 0;
    this.maxReachedZ = 0;
    this.score = 0;

    this.isJumping = false;
    this.jumpProgress = 0;
    this.jumpDuration = CONFIG.JUMP_DURATION || 0.16;
    this.jumpHeight = CONFIG.JUMP_HEIGHT || 0.5;

    this.position = new THREE.Vector3(0, 0, 0);
    this.startPosition = new THREE.Vector3(0, 0, 0);
    this.targetPosition = new THREE.Vector3(0, 0, 0);

    this.targetRotationY = 0;
    this.minAllowedZ = -4;

    this.isDead = false;
    this.isRespawning = false;

    this.hp = 100;
    this.maxHp = 100;
    this.isInvulnerable = false;
    this.invulnerableTimer = 0;

    this.inputBuffer = [];
  }

  reset() {
    this.gridX = 0;
    this.gridZ = 0;
    this.targetGridX = 0;
    this.targetGridZ = 0;
    this.maxReachedZ = 0;
    this.score = 0;
    this.minAllowedZ = -4;

    this.isJumping = false;
    this.jumpProgress = 0;
    this.isDead = false;
    this.isRespawning = false;
    this.hp = 100;
    this.isInvulnerable = false;
    this.invulnerableTimer = 0;
    this.inputBuffer = [];

    this.position.set(0, 0, 0);
    this.startPosition.set(0, 0, 0);
    this.targetPosition.set(0, 0, 0);
    this.targetRotationY = 0;

    if (this.mesh) {
      this.mesh.position.set(0, 0, 0);
      this.mesh.rotation.set(0, 0, 0);
      this.mesh.scale.set(0.95, 0.95, 0.95);
      this.mesh.visible = true;
    }
  }

  getTargetGridPosition(direction, distance = 1) {
    let targetX = Math.round(this.position.x / CONFIG.GRID_SIZE);
    let targetZ = Math.round(this.position.z / CONFIG.GRID_SIZE);

    switch (direction) {
      case 'UP': targetZ += distance; break;
      case 'DOWN': targetZ -= distance; break;
      case 'LEFT': targetX += distance; break;
      case 'RIGHT': targetX -= distance; break;
    }

    return { x: targetX, z: targetZ };
  }

  move(direction, distance = 1) {
    if (this.isJumping || this.isRespawning || this.isDead) return false;

    this.gridX = Math.round(this.position.x / CONFIG.GRID_SIZE);
    this.gridZ = Math.round(this.position.z / CONFIG.GRID_SIZE);
    let newGridX = this.gridX;
    let newGridZ = this.gridZ;

    switch (direction) {
      case 'UP':
        newGridZ += distance;
        this.targetRotationY = 0;
        break;
      case 'DOWN':
        newGridZ -= distance;
        this.targetRotationY = Math.PI;
        break;
      case 'LEFT':
        newGridX += distance;
        this.targetRotationY = Math.PI / 2;
        break;
      case 'RIGHT':
        newGridX -= distance;
        this.targetRotationY = -Math.PI / 2;
        break;
    }

    // 邊界卡死保護
    if (Math.abs(newGridX) > CONFIG.MAP_BOUNDS_X) return false;
    if (this.minAllowedZ !== undefined && newGridZ < this.minAllowedZ) return false;

    this.targetGridX = newGridX;
    this.targetGridZ = newGridZ;

    this.startPosition.copy(this.position);
    this.targetPosition.set(
      this.targetGridX * CONFIG.GRID_SIZE,
      0,
      this.targetGridZ * CONFIG.GRID_SIZE
    );

    this.isJumping = true;
    this.jumpProgress = 0;

    if (this.targetGridZ > this.maxReachedZ) {
      this.maxReachedZ = this.targetGridZ;
      this.score = this.maxReachedZ;
    }

    return true;
  }

  queueInput(direction, distance = 1) {
    if (this.isRespawning || this.isDead) return false;
    if (this.isJumping) {
      if (this.inputBuffer.length < 2) {
        this.inputBuffer.push({ direction, distance });
        return true;
      }
      return false;
    }
    return this.move(direction, distance);
  }

  setFacingDirection(direction) {
    switch (direction) {
      case 'UP': this.targetRotationY = 0; break;
      case 'DOWN': this.targetRotationY = Math.PI; break;
      case 'LEFT': this.targetRotationY = Math.PI / 2; break;
      case 'RIGHT': this.targetRotationY = -Math.PI / 2; break;
    }
  }

  update(deltaTime) {
    const safeDelta = Number.isFinite(deltaTime) && deltaTime > 0 ? Math.min(deltaTime, 0.1) : 0.016;

    if (this.mesh) {
      this.mesh.rotation.y = THREE.MathUtils.lerp(
        this.mesh.rotation.y,
        this.targetRotationY,
        safeDelta * 25
      );
    }

    if (this.isJumping) {
      this.jumpProgress += safeDelta / this.jumpDuration;

      if (this.jumpProgress >= 1.0) {
        this.jumpProgress = 1.0;
        this.isJumping = false;
        this.gridX = this.targetGridX;
        this.gridZ = this.targetGridZ;
        this.position.copy(this.targetPosition);
      } else {
        this.position.x = THREE.MathUtils.lerp(this.startPosition.x, this.targetPosition.x, this.jumpProgress);
        this.position.z = THREE.MathUtils.lerp(this.startPosition.z, this.targetPosition.z, this.jumpProgress);
        this.position.y = Math.sin(this.jumpProgress * Math.PI) * this.jumpHeight;
      }
    }

    // 無敵狀態與 2 秒閃爍處理
    if (this.isInvulnerable) {
      this.invulnerableTimer -= safeDelta;
      if (this.invulnerableTimer <= 0) {
        this.invulnerableTimer = 0;
        this.isInvulnerable = false;
        if (this.mesh) this.mesh.visible = true;
      } else if (this.mesh) {
        this.mesh.visible = Math.floor(this.invulnerableTimer * 20) % 2 === 0;
      }
    }

    // 座標 NaN 安全對齊
    if (!Number.isFinite(this.position.x)) this.position.x = this.gridX * CONFIG.GRID_SIZE;
    if (!Number.isFinite(this.position.y)) this.position.y = 0;
    if (!Number.isFinite(this.position.z)) this.position.z = this.gridZ * CONFIG.GRID_SIZE;

    if (this.mesh && !this.isDead) {
      this.mesh.position.copy(this.position);
    }
  }

  takeDamage(amount) {
    if (this.isInvulnerable || this.isDead) return false;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      return true;
    }
    this.isInvulnerable = true;
    this.invulnerableTimer = 2.0;
    return false;
  }

  triggerFlattenAnimation() {
    this.isDead = true;
    this.isJumping = false;
    this.inputBuffer = [];
    if (this.mesh) {
      this.mesh.scale.set(1.4, 0.08, 1.4);
      this.mesh.position.y = 0.04;
    }
  }

  triggerDrownAnimation() {
    this.isDead = true;
    this.isJumping = false;
    this.inputBuffer = [];
    if (this.mesh) {
      this.mesh.position.y = -0.4;
      this.mesh.scale.set(0.6, 0.6, 0.6);
    }
  }
}
