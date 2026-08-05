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

    this.isShielded = false;
    this.isReflexHyper = false;
    this.isRespawning = false;
    this.isRocketJumping = false;
    this.onRocketLand = null;

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
    this.isRocketJumping = false;
    this.onRocketLand = null;

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

    this.jumpDuration = this.isReflexHyper ? CONFIG.JUMP_DURATION * 0.5 : CONFIG.JUMP_DURATION;
    this.jumpHeight = customDistance > 1 ? CONFIG.JUMP_HEIGHT * 2.2 : CONFIG.JUMP_HEIGHT;

    if (this.targetGridZ > this.maxReachedZ) {
      this.maxReachedZ = this.targetGridZ;
      this.score = this.maxReachedZ;
    }

    return true;
  }

  rocketJump() {
    this.isRocketJumping = true;
    return this.move('UP', 3);
  }

  // 3 秒空投復活
  respawn(safeGridX = 0, safeGridZ = 0) {
    this.isRespawning = true;
    this.isJumping = true;
    this.jumpProgress = 0;
    this.jumpDuration = 3.0;
    this.jumpHeight = 0;

    this.gridX = safeGridX;
    this.gridZ = safeGridZ;
    this.targetGridX = safeGridX;
    this.targetGridZ = safeGridZ;

    const posX = safeGridX * CONFIG.GRID_SIZE;
    const posZ = safeGridZ * CONFIG.GRID_SIZE;

    this.startPosition.set(posX, 10, posZ);
    this.targetPosition.set(posX, 0, posZ);
    this.position.copy(this.startPosition);

    if (this.mesh) {
      this.mesh.scale.set(1, 1, 1);
      this.mesh.rotation.y = 0;
      this.mesh.position.copy(this.position);
      this.mesh.visible = true;
    }
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

        // 火箭跳躍著地瞬間 (第 0.00 秒) 觸發事件
        if (this.isRocketJumping) {
          this.isRocketJumping = false;
          if (typeof this.onRocketLand === 'function') {
            this.onRocketLand();
          }
        }
      } else {
        this.position.x = THREE.MathUtils.lerp(this.startPosition.x, this.targetPosition.x, this.jumpProgress);
        this.position.z = THREE.MathUtils.lerp(this.startPosition.z, this.targetPosition.z, this.jumpProgress);

        if (this.isRespawning) {
          this.position.y = THREE.MathUtils.lerp(this.startPosition.y, 0, this.jumpProgress);
        } else {
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
