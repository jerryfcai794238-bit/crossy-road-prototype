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

  // 2. 爆破清理以中心點為首的 3x3 (九宮格) 範圍內所有樹木 (火箭跳躍落地爆破)
  destroyTreesInArea(centerGridPos, radius = 1, activeRows) {
    let destroyedCount = 0;

    for (let zOffset = -radius; zOffset <= radius; zOffset++) {
      const targetZ = centerGridPos.z + zOffset;
      const row = activeRows.get(targetZ);
      if (!row || row.type !== CONFIG.ROW_TYPES.GRASS || !Array.isArray(row.trees)) continue;

      for (let xOffset = -radius; xOffset <= radius; xOffset++) {
        const targetX = centerGridPos.x + xOffset;
        const treeIndex = row.trees.findIndex((t) => t.gridX === targetX);

        if (treeIndex !== -1) {
          const tree = row.trees[treeIndex];
          if (tree.mesh && tree.mesh.parent) {
            tree.mesh.parent.remove(tree.mesh);
            tree.mesh.traverse((child) => {
              if (child.geometry) child.geometry.dispose();
            });
          }
          row.trees.splice(treeIndex, 1);
          destroyedCount++;
        }
      }
    }

    return destroyedCount;
  }

  // 3. 檢查車輛與火車碰撞
  checkObstacleCollision(player, activeRows) {
    if (player.isShielded) return null;

    const row = activeRows.get(player.gridZ);
    if (!row) return null;

    const playerX = player.position.x;
    const playerRadius = (CONFIG.PLAYER?.COLLISION_RADIUS || 0.35) * CONFIG.GRID_SIZE;

    // 車輛碰撞
    if (row.type === CONFIG.ROW_TYPES.ROAD && row.vehicles) {
      for (const veh of row.vehicles) {
        const obsX = veh.position ? veh.position.x : veh.mesh.position.x;
        const halfWidth = (veh.width || 1.6) / 2;

        if (Math.abs(playerX - obsX) < halfWidth + playerRadius) {
          return { type: 'car' };
        }
      }
    }

    // 火車碰撞
    if (row.type === CONFIG.ROW_TYPES.RAILROAD && row.trainState === 'TRAIN_PASSING' && row.train) {
      const trainX = row.train.position ? row.train.position.x : row.train.mesh.position.x;
      const halfWidth = (row.train.length || 22.0) / 2;

      if (Math.abs(playerX - trainX) < halfWidth + playerRadius) {
        return { type: 'train' };
      }
    }

    return null;
  }

  // 4. 檢查河流與浮木狀態
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

  // 5. 多人/AI 網格碰撞彈退機制 (Grid Bump Physics)
  resolveGridBump(runners) {
    for (let i = 0; i < runners.length; i++) {
      for (let j = i + 1; j < runners.length; j++) {
        const r1 = runners[i];
        const r2 = runners[j];

        if (!r1 || !r2 || r1.isRespawning || r2.isRespawning) continue;

        // 檢測當前或目標網格重疊 (1x1 格子)
        const cellOverlap = r1.targetGridX === r2.targetGridX && r1.targetGridZ === r2.targetGridZ;
        const posOverlap = Math.abs(r1.position.x - r2.position.x) < 0.6 && Math.abs(r1.position.z - r2.position.z) < 0.6;

        if (cellOverlap && posOverlap) {
          // 產生 Bump 彈退 (較遲跳躍者或 r2 被推離 1 格)
          const targetToPush = r1.isJumping ? r2 : r1;
          targetToPush.position.x += (Math.random() > 0.5 ? 0.3 : -0.3);
          targetToPush.position.z -= 0.2;
        }
      }
    }
  }
}
