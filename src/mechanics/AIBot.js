import { Player } from './Player.js';
import { CONFIG } from '../config.js';

export class AIBot extends Player {
  constructor(mesh, name, startGridX, startGridZ, reactionSpeed = 0.35) {
    super(mesh);
    this.botName = name;
    this.reactionSpeed = reactionSpeed; // 跳躍間隔決策時間 (秒)
    this.decisionTimer = Math.random() * 0.5; // 隨機錯開起跳時間

    // 初始位置設定
    this.resetAt(startGridX, startGridZ);
  }

  resetAt(startX, startZ) {
    this.reset();
    this.gridX = startX;
    this.gridZ = startZ;
    this.targetGridX = startX;
    this.targetGridZ = startZ;

    const posX = startX * CONFIG.GRID_SIZE;
    const posZ = startZ * CONFIG.GRID_SIZE;

    this.position.set(posX, 0, posZ);
    this.startPosition.set(posX, 0, posZ);
    this.targetPosition.set(posX, 0, posZ);

    if (this.mesh) {
      this.mesh.position.set(posX, 0, posZ);
      this.mesh.rotation.y = 0;
      this.mesh.visible = true;
    }
  }

  updateAI(deltaTime, activeRows, physics) {
    if (this.isJumping || this.isRespawning) return;

    this.decisionTimer -= deltaTime;
    if (this.decisionTimer > 0) return;

    // 重置決策計時器 (帶有些微隨機抖動，模擬人類手感)
    this.decisionTimer = this.reactionSpeed + (Math.random() - 0.5) * 0.15;

    // 決策移動方向
    const bestMove = this.decideBestMove(activeRows, physics);
    if (bestMove) {
      // 檢查樹木阻擋
      const targetPos = this.getTargetGridPosition(bestMove);
      if (!physics.checkTreeCollision(targetPos, activeRows)) {
        this.move(bestMove);
      }
    }
  }

  /**
   * AI 智慧路徑決策邏輯 (向前、左避、右避、等待)
   */
  decideBestMove(activeRows, physics) {
    const upTarget = this.getTargetGridPosition('UP');
    const leftTarget = this.getTargetGridPosition('LEFT');
    const rightTarget = this.getTargetGridPosition('RIGHT');

    const isUpBlocked = physics.checkTreeCollision(upTarget, activeRows);
    const isUpSafe = this.isCellSafe(upTarget, activeRows);

    // 1. 如果前方無樹且無危險，90% 優先向前 jump
    if (!isUpBlocked && isUpSafe) {
      return 'UP';
    }

    // 2. 如果前方有樹木，嘗試往左或往右避開
    const canLeft = !physics.checkTreeCollision(leftTarget, activeRows) && this.isCellSafe(leftTarget, activeRows);
    const canRight = !physics.checkTreeCollision(rightTarget, activeRows) && this.isCellSafe(rightTarget, activeRows);

    if (canLeft && canRight) {
      return Math.random() > 0.5 ? 'LEFT' : 'RIGHT';
    } else if (canLeft) {
      return 'LEFT';
    } else if (canRight) {
      return 'RIGHT';
    }

    // 3. 前方為危險車道/無浮木，暫時停頓等待
    return null;
  }

  /**
   * 檢查目標格子是否有即將撞击的車輛或危險水域
   */
  isCellSafe(targetGridPos, activeRows) {
    const row = activeRows.get(targetGridPos.z);
    if (!row) return true;

    // 馬路車流預測
    if (row.type === CONFIG.ROW_TYPES.ROAD && row.vehicles) {
      const targetX = targetGridPos.x * CONFIG.GRID_SIZE;
      for (const veh of row.vehicles) {
        const obsX = veh.position ? veh.position.x : veh.mesh.position.x;
        const halfWidth = (veh.width || 1.6) / 2;
        // 若車輛極度靠近該 X 座標，判定為危險
        if (Math.abs(targetX - obsX) < halfWidth + 0.8) {
          return false;
        }
      }
    }

    // 河流浮木預測
    if (row.type === CONFIG.ROW_TYPES.RIVER && row.logs) {
      const targetX = targetGridPos.x * CONFIG.GRID_SIZE;
      let onLog = false;
      for (const log of row.logs) {
        const logX = log.position ? log.position.x : log.mesh.position.x;
        const width = (log.length || 3) * CONFIG.GRID_SIZE * 0.85;
        if (Math.abs(targetX - logX) < width / 2) {
          onLog = true;
          break;
        }
      }
      if (!onLog) return false; // 無浮木水域不安全
    }

    // 鐵路火車警示燈預測
    if (row.type === CONFIG.ROW_TYPES.RAILROAD && row.trainState !== 'IDLE') {
      return false; // 警示燈亮起或火車通過中不安全
    }

    return true;
  }
}
