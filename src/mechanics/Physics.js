import { CONFIG } from '../config.js';

export class Physics {
  // 1. 檢查樹木與地圖邊界碰撞
  checkTreeCollision(targetGridPos, activeRows) {
    const row = activeRows.get(targetGridPos.z);
    if (!row || row.type !== CONFIG.ROW_TYPES.GRASS) return false;

    if (Array.isArray(row.trees)) {
      return row.trees.some((t) => t.gridX === targetGridPos.x);
    }
    if (row.trees instanceof Set) {
      return row.trees.has(targetGridPos.x);
    }
    return false;
  }

  // 2. 檢查車輛與火車碰撞
  checkObstacleCollision(player, activeRows) {
    if (player.isShielded) return null;

    const row = activeRows.get(player.gridZ);
    if (!row) return null;

    const playerX = player.position.x;
    const playerRadius = (CONFIG.PLAYER?.COLLISION_RADIUS || 0.35) * CONFIG.GRID_SIZE;

    // 車輛碰撞 (使用 row.vehicles)
    if (row.type === CONFIG.ROW_TYPES.ROAD && row.vehicles) {
      for (const veh of row.vehicles) {
        const obsX = veh.position ? veh.position.x : veh.mesh.position.x;
        const halfWidth = (veh.width || 1.6) / 2;

        if (Math.abs(playerX - obsX) < halfWidth + playerRadius) {
          return { type: 'car' };
        }
      }
    }

    // 火車碰撞 (使用 row.train)
    if (row.type === CONFIG.ROW_TYPES.RAILROAD && row.trainState === 'TRAIN_PASSING' && row.train) {
      const trainX = row.train.position ? row.train.position.x : row.train.mesh.position.x;
      const halfWidth = (row.train.length || 22.0) / 2;

      if (Math.abs(playerX - trainX) < halfWidth + playerRadius) {
        return { type: 'train' };
      }
    }

    return null;
  }

  // 3. 檢查河流與浮木狀態
  checkRiverStatus(player, activeRows) {
    const row = activeRows.get(player.gridZ);
    if (!row || row.type !== CONFIG.ROW_TYPES.RIVER) {
      return { inRiver: false, onLog: false, logSpeed: 0 };
    }

    if (player.isJumping || player.isShielded) {
      return { inRiver: true, onLog: true, logSpeed: 0 };
    }

    const playerX = player.position.x;
    const playerRadius = 0.25;

    if (row.logs) {
      for (const log of row.logs) {
        const logX = log.position ? log.position.x : log.mesh.position.x;
        const width = (log.length || 3) * CONFIG.GRID_SIZE * 0.85;
        const halfWidth = width / 2;

        if (playerX >= logX - halfWidth - playerRadius && playerX <= logX + halfWidth + playerRadius) {
          return {
            inRiver: true,
            onLog: true,
            logSpeed: row.direction * row.speed
          };
        }
      }
    }

    return { inRiver: true, onLog: false, logSpeed: 0 };
  }

  // 4. 多人/AI 網格碰撞彈退機制
  checkGridBump(player1, player2) {
    if (!player1 || !player2) return false;
    return player1.gridX === player2.gridX && player1.gridZ === player2.gridZ;
  }
}
