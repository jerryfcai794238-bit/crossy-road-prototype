import { Player } from './Player.js';
import { CONFIG } from '../config.js';

export class AIBot extends Player {
  constructor(mesh, botName, startX = 0, startZ = 0, baseAggression = 0.38) {
    super(mesh);
    this.botName = botName;
    this.startX = startX;
    this.startZ = startZ;
    this.baseAggression = baseAggression; // AI 移動基礎衝勁

    // 決策計時器 (縮短至 0.22 秒，大幅提升 AI 前進競爭力)
    this.decisionTimer = 0;
    this.decisionInterval = 0.22;

    this.resetAt(startX, startZ);
  }

  resetAt(startX, startZ) {
    this.reset();
    this.gridX = startX;
    this.gridZ = startZ;
    this.targetGridX = startX;
    this.targetGridZ = startZ;
    this.position.set(startX * CONFIG.GRID_SIZE, 0, startZ * CONFIG.GRID_SIZE);
    this.startPosition.copy(this.position);
    this.targetPosition.copy(this.position);
    this.isDead = false;

    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.visible = true;
    }
  }

  updateAI(deltaTime, activeRows, physics) {
    if (this.isJumping || this.isRespawning || this.isDead) return;

    this.decisionTimer += deltaTime;
    if (this.decisionTimer < this.decisionInterval) return;

    this.decisionTimer = 0;

    // AI 決策邏輯：評估向前、左、右三個方向的安全權重
    const directions = ['UP', 'LEFT', 'RIGHT'];
    let bestDirection = null;
    let bestScore = -999;

    directions.forEach((dir) => {
      const targetPos = this.getTargetGridPosition(dir);

      // 1. 檢查樹木檔路
      if (physics.checkTreeCollision(targetPos, activeRows)) return;

      // 2. 地圖左右邊界限制
      if (Math.abs(targetPos.x) > CONFIG.MAP_BOUNDS_X) return;

      let score = 0;

      // 優先向前 (+Z 軸) 增加競爭分
      if (dir === 'UP') score += 15.0 + Math.random() * 5.0;
      if (dir === 'LEFT' || dir === 'RIGHT') score += 2.0;

      const row = activeRows.get(targetPos.z);
      if (row) {
        // 車道預判：若有車接近，給予極大負分扣除
        if (row.type === CONFIG.ROW_TYPES.ROAD && row.vehicles) {
          for (const veh of row.vehicles) {
            const obsX = veh.position ? veh.position.x : veh.mesh.position.x;
            const dist = Math.abs(targetPos.x * CONFIG.GRID_SIZE - obsX);
            if (dist < 2.5) {
              score -= 80.0;
            }
          }
        }

        // 鐵路號誌預警：若有紅燈 flashing，給予極大負分
        if (row.type === CONFIG.ROW_TYPES.RAILROAD && (row.trainState === 'SIGNAL_FLASHING' || row.trainState === 'TRAIN_PASSING')) {
          score -= 120.0;
        }

        // 河流漂木預判：若踩不到漂木，給予極大負分
        if (row.type === CONFIG.ROW_TYPES.RIVER && row.logs) {
          let canLandOnLog = false;
          for (const log of row.logs) {
            const logX = log.position ? log.position.x : log.mesh.position.x;
            const width = (log.length || 3) * CONFIG.GRID_SIZE * 0.85;
            const halfWidth = width / 2;
            const targetXUnits = targetPos.x * CONFIG.GRID_SIZE;

            if (targetXUnits >= logX - halfWidth - 0.2 && targetXUnits <= logX + halfWidth + 0.2) {
              canLandOnLog = true;
              break;
            }
          }
          if (!canLandOnLog) {
            score -= 150.0;
          } else {
            score += 10.0;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestDirection = dir;
      }
    });

    // 隨機決策概率 (當安全分數 > -40 時執行前進)
    if (bestDirection && bestScore > -40.0) {
      if (Math.random() < this.baseAggression + 0.45) {
        this.move(bestDirection);
      }
    }
  }
}
