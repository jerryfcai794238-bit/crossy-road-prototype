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

    // 最小可後退到的 Z 軸邊界
    this.minAllowedZ = 0;

    // 動畫與狀態控制
    this.isJumping = false;
    this.jumpProgress = 0;
    this.jumpDuration = CONFIG.JUMP_DURATION || 0.18; // 跳躍時間 (秒)
    this.jumpHeight = CONFIG.JUMP_HEIGHT || 0.65;    // 跳躍弧形高度

    this.position = new THREE.Vector3(0, 0, 0);
    this.startPosition = new THREE.Vector3(0, 0, 0);
    this.targetPosition = new THREE.Vector3(0, 0, 0);

    // 面向角度 (0: 朝 +Z 前方, PI/2: 左, -PI/2: 右, PI: 後)
    this.targetRotationY = 0;

    // 死亡與特殊狀態
    this.isDead = false;
    this.isShielded = false;
    this.isRocketJumping = false;
    this.isReflexHyper = false;
    this.isRespawning = false;

    // 事件監聽 (例如火箭跳躍 touchdown 觸地)
    this.onRocketLand = null;
  }

  /**
   * 計算特定方向延伸距離後的網格座標 { x, z }
   */
  getTargetGridPosition(direction, distance = 1) {
    let targetX = this.targetGridX;
    let targetZ = this.targetGridZ;

    switch (direction) {
      case 'UP':
        targetZ += distance;
        break;
      case 'DOWN':
        targetZ -= distance;
        break;
      case 'LEFT':
        targetX += distance;
        break;
      case 'RIGHT':
        targetX -= distance;
        break;
    }

    return { x: targetX, z: targetZ };
  }

  move(direction, distance = 1) {
    if (this.isJumping || this.isRespawning || this.isDead) return false;

    let newGridX = this.targetGridX;
    let newGridZ = this.targetGridZ;

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

    // 地圖左右 X 軸邊界限制
    if (Math.abs(newGridX) > CONFIG.MAP_BOUNDS_X) {
      return false;
    }

    // 身後邊界限制：不允許向後跳出視角下邊界
    if (this.minAllowedZ !== undefined && newGridZ < this.minAllowedZ) {
      return false;
    }

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
      this.minAllowedZ = Math.max(0, this.maxReachedZ - 4);
    }

    return true;
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
    if (this.mesh) {
      this.mesh.rotation.y = THREE.MathUtils.lerp(
        this.mesh.rotation.y,
        this.targetRotationY,
        deltaTime * 20
      );
    }

    if (this.isJumping) {
      this.jumpProgress += deltaTime / this.jumpDuration;

      if (this.jumpProgress >= 1.0) {
        this.jumpProgress = 1.0;
        this.isJumping = false;
        this.gridX = this.targetGridX;
        this.gridZ = this.targetGridZ;
        this.position.copy(this.targetPosition);

        // 火箭跳躍 0ms 觸地事件
        if (this.isRocketJumping) {
          this.isRocketJumping = false;
          if (this.onRocketLand) {
            this.onRocketLand(this.targetGridX, this.targetGridZ);
          }
        }
      } else {
        this.position.x = THREE.MathUtils.lerp(
          this.startPosition.x,
          this.targetPosition.x,
          this.jumpProgress
        );
        this.position.z = THREE.MathUtils.lerp(
          this.startPosition.z,
          this.targetPosition.z,
          this.jumpProgress
        );
        this.position.y = Math.sin(this.jumpProgress * Math.PI) * this.jumpHeight;
      }
    }

    // 確保 3D Mesh 與物理座標實時保持 100% 同步
    if (this.mesh && !this.isRespawning && !this.isDead) {
      this.mesh.position.copy(this.position);
    }
  }

  triggerFlattenAnimation() {
    this.isDead = true;
    if (this.mesh) {
      this.mesh.scale.set(1.4, 0.1, 1.4);
      this.mesh.position.y = 0.05;
    }
  }

  triggerDrownAnimation() {
    this.isDead = true;
    if (this.mesh) {
      this.mesh.scale.set(0.2, 0.2, 0.2);
      this.mesh.position.y = -0.4;
    }
  }

  respawn(safeX = 0, safeZ = 0) {
    this.isDead = false;
    this.isRespawning = true;
    this.gridX = safeX;
    this.gridZ = safeZ;
    this.targetGridX = safeX;
    this.targetGridZ = safeZ;
    this.minAllowedZ = Math.max(0, safeZ - 4);

    const targetX = safeX * CONFIG.GRID_SIZE;
    const targetZ = safeZ * CONFIG.GRID_SIZE;

    this.position.set(targetX, 0, targetZ);
    this.startPosition.copy(this.position);
    this.targetPosition.copy(this.position);

    if (this.mesh) {
      this.mesh.visible = true;
      this.mesh.scale.set(0.95, 0.95, 0.95);
      this.mesh.position.set(targetX, 10, targetZ);
    }

    let dropProgress = 0;
    const animateDrop = () => {
      dropProgress += 0.08;
      if (dropProgress >= 1.0) {
        if (this.mesh) this.mesh.position.set(targetX, 0, targetZ);
        this.isRespawning = false;
      } else {
        const currentY = THREE.MathUtils.lerp(10, 0, dropProgress);
        if (this.mesh) this.mesh.position.y = currentY;
        requestAnimationFrame(animateDrop);
      }
    };
    requestAnimationFrame(animateDrop);
  }

  reset() {
    this.gridX = 0;
    this.gridZ = 0;
    this.targetGridX = 0;
    this.targetGridZ = 0;
    this.maxReachedZ = 0;
    this.score = 0;
    this.minAllowedZ = 0;
    this.isJumping = false;
    this.isDead = false;
    this.isShielded = false;
    this.isRocketJumping = false;
    this.isReflexHyper = false;

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
}
