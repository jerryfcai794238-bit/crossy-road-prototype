import { CONFIG } from '../config.js';

export class Physics {
  // 1. 檢查樹木與地圖邊界碰撞
  checkTreeCollision(targetGridPos, activeRows) {
    const row = activeRows.get(targetGridPos.z);
    if (!row || row.type !== CONFIG.ROW_TYPES.GRASS) return false;
    return row.trees.has(targetGridPos.x);
  }

  // 2. 檢查車輛與火車碰撞
  checkObstacleCollision(player, activeRows) {
    // 護盾開啟時：抵擋撞擊，無敵不死亡！
    if (player.isShielded) {
      return null;
    }

    const row = activeRows.get(player.gridZ);
    if (!row) return null;

    const playerX = player.position.x;
    const playerRadius = 0.35 * CONFIG.GRID_SIZE;

    // 車輛碰撞
    if (row.type === CONFIG.ROW_TYPES.ROAD) {
      for (const obs of row.obstacles) {
        const obsX = obs.mesh.position.x;
        const halfWidth = obs.width / 2;

        if (Math.abs(playerX - obsX) < halfWidth + playerRadius) {
          return { type: 'car' };
        }
      }
    }

    // 火車碰撞
    if (row.type === CONFIG.ROW_TYPES.RAILROAD && row.trainState === 'CROSSING') {
      const trainX = row.trainMesh.position.x;
      const halfWidth = 1.8;

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

    // 跳躍途中或護盾無敵防護中
    if (player.isJumping || player.isShielded) {
      return { inRiver: true, onLog: true, logSpeed: 0 };
    }

    const playerX = player.position.x;
    const playerRadius = 0.25;

    for (const obs of row.obstacles) {
      const logX = obs.mesh.position.x;
      const halfWidth = obs.width / 2;

      if (playerX >= logX - halfWidth - playerRadius && playerX <= logX + halfWidth + playerRadius) {
        return {
          inRiver: true,
          onLog: true,
          logSpeed: row.direction * row.speed
        };
      }
    }

    // 無護盾且踩空：落水死亡
    return { inRiver: true, onLog: false, logSpeed: 0 };
  }

  // 4. 多人/AI 網格碰撞彈退機制 (Grid Bump)
  checkGridBump(player1, player2) {
    if (!player1 || !player2) return false;
    
    if (player1.gridX === player2.gridX && player1.gridZ === player2.gridZ) {
      // 兩角色在同一格，觸發碰撞彈退
      return true;
    }
    return false;
  }
}
