import { CONFIG } from '../config.js';

export class Physics {
  constructor() {}

  /**
   * 評估跳躍的音速 4 級判定 (PERFECT / GREAT / GOOD / BAD)
   * PERFECT: 距離車輛 > 1.2 格 (絕對安全)
   * GOOD: 距離車輛 <= 0.45 格 (極限擦車冒險)
   * GREAT: 介於中間
   */
  evaluateHopRating(player, activeRows) {
    const targetZ = player.targetGridZ;
    const row = activeRows.get(targetZ);

    if (!row || !row.vehicles || row.vehicles.length === 0) {
      return 'PERFECT'; // 草地/普通地塊遠離危險
    }

    let minVehicleDist = 999;
    const playerX = player.position.x;

    for (const veh of row.vehicles) {
      const obsX = veh.position ? veh.position.x : veh.mesh.position.x;
      const distInGrids = Math.abs(playerX - obsX) / CONFIG.GRID_SIZE;
      if (distInGrids < minVehicleDist) {
        minVehicleDist = distInGrids;
      }
    }

    if (minVehicleDist <= 0.45) {
      return 'GOOD'; // 極限擦車
    } else if (minVehicleDist > 1.2) {
      return 'PERFECT'; // 絕對安全
    } else {
      return 'GREAT';
    }
  }

  /**
   * 搜尋 player 身後最靠近的安全草地/岸邊 Z 座標與無樹木的 X 座標
   */
  findNearestSafeZ(player, activeRows) {
    let safeZ = Math.max(0, player.gridZ - 1);
    while (safeZ > 0) {
      const row = activeRows.get(safeZ);
      if (row && row.type === CONFIG.ROW_TYPES.GRASS) {
        let safeX = player.gridX;
        if (row.trees && row.trees.some(t => t.gridX === safeX)) {
          for (let x = 0; x <= CONFIG.MAP_BOUNDS_X; x++) {
            if (!row.trees.some(t => t.gridX === x)) { safeX = x; break; }
            if (!row.trees.some(t => t.gridX === -x)) { safeX = -x; break; }
          }
        }
        return { safeX, safeZ };
      }
      safeZ--;
    }
    return { safeX: 0, safeZ: 0 };
  }

  /**
   * 判斷玩家與動態障礙物 (車輛 / 火車) 的 AABB 碰撞
   */
  checkObstacleCollision(player, activeRows) {
    if (player.isDead || player.isRespawning) return null;

    const row = activeRows.get(player.gridZ);
    if (!row) return null;

    const playerX = player.position.x;
    const playerWidth = CONFIG.GRID_SIZE * 0.55;

    // 1. 車輛碰撞檢測
    if (row.type === CONFIG.ROW_TYPES.ROAD && row.vehicles) {
      for (const veh of row.vehicles) {
        const obsX = veh.position ? veh.position.x : veh.mesh.position.x;
        const width = (veh.isTruck ? 2.3 : 1.6) * CONFIG.GRID_SIZE * 0.7;

        if (Math.abs(playerX - obsX) < (playerWidth + width) / 2) {
          return { type: 'vehicle', isTruck: veh.isTruck, damage: veh.isTruck ? 10 : 5 };
        }
      }
    }

    // 2. 高速火車碰撞檢測
    if (row.type === CONFIG.ROW_TYPES.RAILROAD && row.train) {
      const trainX = row.train.position ? row.train.position.x : row.train.mesh.position.x;
      const trainWidth = 8.0 * CONFIG.GRID_SIZE * 0.7;

      if (Math.abs(playerX - trainX) < (playerWidth + trainWidth) / 2) {
        return { type: 'train', damage: 15 };
      }
    }

    return null;
  }

  /**
   * 判斷玩家在河流處的踩木與落水狀態
   */
  checkRiverStatus(player, activeRows) {
    const row = activeRows.get(player.gridZ);
    if (!row || row.type !== CONFIG.ROW_TYPES.RIVER) {
      return { inRiver: false, onLog: false, logSpeed: 0 };
    }

    const playerX = player.position.x;
    const playerWidth = CONFIG.GRID_SIZE * 0.45;

    if (row.logs) {
      for (const log of row.logs) {
        const logX = log.position ? log.position.x : log.mesh.position.x;
        const logWidth = (log.length || 3) * CONFIG.GRID_SIZE * 0.85;

        if (Math.abs(playerX - logX) < (playerWidth + logWidth) / 2) {
          return { inRiver: true, onLog: true, logSpeed: row.speed, damage: 0 };
        }
      }
    }

    // 未踩在浮木上，判定落水 (-20 HP)
    return { inRiver: true, onLog: false, logSpeed: 0, damage: 20 };
  }

  /**
   * 判斷玩家前方目標格是否被樹木碰撞阻擋
   */
  checkTreeCollision(targetGridPos, activeRows) {
    const row = activeRows.get(targetGridPos.z);
    if (!row || row.type !== CONFIG.ROW_TYPES.GRASS || !row.trees) {
      return false;
    }

    return row.trees.some((tree) => tree.gridX === targetGridPos.x);
  }

  /**
   * 清除指定區域內的樹木
   */
  destroyTreesInArea(targetGridPos, radius = 1, activeRows) {
    for (let z = targetGridPos.z - radius; z <= targetGridPos.z + radius; z++) {
      const row = activeRows.get(z);
      if (row && row.type === CONFIG.ROW_TYPES.GRASS && Array.isArray(row.trees)) {
        for (let i = row.trees.length - 1; i >= 0; i--) {
          const tree = row.trees[i];
          if (Math.abs(tree.gridX - targetGridPos.x) <= radius) {
            if (tree.mesh && tree.mesh.parent) {
              tree.mesh.parent.remove(tree.mesh);
            }
            row.trees.splice(i, 1);
          }
        }
      }
    }
  }

  /**
   * 4 人 1x1 網格 Bump 碰撞推擠
   */
  resolveGridBump(runners) {
    for (let i = 0; i < runners.length; i++) {
      for (let j = i + 1; j < runners.length; j++) {
        const r1 = runners[i];
        const r2 = runners[j];

        if (r1.isDead || r2.isDead || r1.isRespawning || r2.isRespawning) continue;

        if (r1.targetGridX === r2.targetGridX && r1.targetGridZ === r2.targetGridZ) {
          const pusher = r1.isJumping ? r1 : r2;
          const pushed = r1.isJumping ? r2 : r1;

          pushed.targetGridZ -= 1;
          pushed.gridZ = pushed.targetGridZ;
          pushed.startPosition.copy(pushed.position);
          pushed.targetPosition.set(
            pushed.targetGridX * CONFIG.GRID_SIZE,
            0,
            pushed.targetGridZ * CONFIG.GRID_SIZE
          );
        }
      }
    }
  }
}
