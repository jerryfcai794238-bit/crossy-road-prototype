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

    // 100 HP 紅色長血條機制 (HP = 100)
    this.maxHp = 100;
    this.hp = 100;
    this.combo = 0;

    // 20 Combo FEVER 狂熱狀態
    this.isFever = false;
    this.feverTimer = 0;

    // 休閒模式專屬：金幣減速次數 (每區塊最多 3 次，每次-15%)
    this.slowdownStack = 0;

    // 最小可後退到的 Z 軸網格邊界
    this.minAllowedZ = -4;

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

    // 死亡與重生狀態
    this.isDead = false;
    this.isRespawning = false;

    // 輸入緩衝佇列 (Input Buffer - 預存連點指令)
    this.inputBuffer = [];
    this.onBufferedMoveRequested = null;
  }

  /**
   * 計算特定方向延伸距離後的網格座標 { x, z }
   */
  getTargetGridPosition(direction, distance = 1) {
    let targetX = Math.round(this.position.x / CONFIG.GRID_SIZE);
    let targetZ = Math.round(this.position.z / CONFIG.GRID_SIZE);

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

  /**
   * 受傷扣血並彈回身後安全草地 (BAD 斷 Combo，無無敵時間)
   */
  takeDamage(amount, safeZ = 0, safeX = 0) {
    if (this.isDead || this.isRespawning) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.combo = 0; // BAD 斷 Combo 重置為 0

    if (this.hp <= 0) {
      this.isDead = true;
      return true; // 死亡
    }

    // 100% 彈回身後安全草地，並重置最高點與分數對齊 safeZ (防止相機死鎖在遠方)
    this.gridZ = safeZ;
    this.targetGridZ = safeZ;
    this.gridX = safeX;
    this.targetGridX = safeX;

    this.maxReachedZ = safeZ;
    this.score = safeZ;

    this.position.set(safeX * CONFIG.GRID_SIZE, 0, safeZ * CONFIG.GRID_SIZE);
    this.startPosition.copy(this.position);
    this.targetPosition.copy(this.position);

    if (this.mesh) {
      this.mesh.position.copy(this.position);
    }

    return false; // 存活
  }

  /**
   * 增加 Combo 與 10 Combo (+5 HP) 自動回血
   */
  addCombo() {
    this.combo++;

    // 10 Combo (+5 HP) 自動技術回血
    if (this.combo % 10 === 0) {
      this.hp = Math.min(this.maxHp, this.hp + 5);
    }

    // 20 Combo 觸發 5 秒 FEVER 狂熱時刻
    if (this.combo >= 20 && !this.isFever) {
      this.isFever = true;
      this.feverTimer = 5.0;
    }
  }

  /**
   * 佇列與連點緩衝處理
   */
  queueInput(direction, distance = 1) {
    if (this.isRespawning || this.isDead) return false;

    if (this.isJumping) {
      // 在空中時，將連點指令暫存於緩衝佇列 (最多預存 2 次)
      if (this.inputBuffer.length < 2) {
        this.inputBuffer.push({ direction, distance });
        return true;
      }
      return false;
    }

    return this.move(direction, distance);
  }

  move(direction, distance = 1) {
    if (this.isJumping || this.isRespawning || this.isDead) return false;

    // 起跳前依據實時 position 重新校正基準網格
    this.gridX = Math.round(this.position.x / CONFIG.GRID_SIZE);
    this.gridZ = Math.round(this.position.z / CONFIG.GRID_SIZE);
    this.targetGridX = this.gridX;
    this.targetGridZ = this.gridZ;

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

    // 緊貼身後邊界限制：不允許向後超出 minAllowedZ
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
    // 更新 FEVER 狂熱計時
    if (this.isFever) {
      this.feverTimer -= deltaTime;
      if (this.feverTimer <= 0) {
        this.isFever = false;
        this.feverTimer = 0;
      }
    }

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

        // 觸地 0ms 檢查緩衝佇列發動連續無縫跳躍 (0ms 零卡頓)
        if (this.onBufferedMoveRequested && this.inputBuffer.length > 0) {
          const next = this.inputBuffer.shift();
          this.onBufferedMoveRequested(next.direction, next.distance);
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
    this.inputBuffer = [];
    if (this.mesh) {
      this.mesh.scale.set(1.4, 0.1, 1.4);
      this.mesh.position.y = 0.05;
    }
  }

  triggerDrownAnimation() {
    this.isDead = true;
    this.inputBuffer = [];
    if (this.mesh) {
      this.mesh.scale.set(0.2, 0.2, 0.2);
      this.mesh.position.y = -0.4;
    }
  }

  respawn(safeX = 0, safeZ = 0) {
    this.isDead = false;
    this.isRespawning = true;
    this.inputBuffer = [];
    this.hp = this.maxHp;
    this.combo = 0;
    this.gridX = safeX;
    this.gridZ = safeZ;
    this.targetGridX = safeX;
    this.targetGridZ = safeZ;
    this.maxReachedZ = safeZ;
    this.score = safeZ;

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
    this.hp = 100;
    this.combo = 0;
    this.isFever = false;
    this.feverTimer = 0;
    this.slowdownStack = 0;
    this.minAllowedZ = -4;
    this.isJumping = false;
    this.isDead = false;
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
}
