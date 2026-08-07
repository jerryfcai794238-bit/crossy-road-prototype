import { CONFIG } from '../config.js';

export class Physics {
  constructor() {}

  checkTreeCollision(targetPos, activeRows) {
    const row = activeRows.get(targetPos.z);
    if (!row || !row.trees) return false;

    return row.trees.some((tree) => tree.gridX === targetPos.x);
  }

  checkObstacleCollision(player, activeRows) {
    if (player.isDead || player.isRespawning) return null;

    const currentZ = Math.round(player.position.z / CONFIG.GRID_SIZE);
    const row = activeRows.get(currentZ);
    if (!row) return null;

    const pX = player.position.x;
    const pWidth = 0.5 * CONFIG.GRID_SIZE;

    // 車輛碰撞判定
    if (row.type === CONFIG.ROW_TYPES.ROAD && row.vehicles) {
      for (const veh of row.vehicles) {
        const vX = veh.mesh.position.x;
        const vWidth = (veh.width || 1.8);
        const halfV = vWidth / 2;

        if (pX + pWidth > vX - halfV && pX - pWidth < vX + halfV) {
          return { type: 'car', speed: Math.abs(row.speed || 0) };
        }
      }
    }

    // 火車撞擊判定
    if (row.type === CONFIG.ROW_TYPES.RAILROAD && row.trainState === 'TRAIN_PASSING' && row.train) {
      const tX = row.train.position.x;
      const tWidth = 8.0;
      const halfT = tWidth / 2;

      if (pX + pWidth > tX - halfT && pX - pWidth < tX + halfT) {
        return { type: 'train', speed: 38.0 };
      }
    }

    return null;
  }

  checkRiverStatus(player, activeRows) {
    if (player.isJumping) return { inRiver: false, onLog: false };

    const currentZ = Math.round(player.position.z / CONFIG.GRID_SIZE);
    const row = activeRows.get(currentZ);
    if (!row || row.type !== CONFIG.ROW_TYPES.RIVER) {
      return { inRiver: false, onLog: false };
    }

    const pX = player.position.x;
    const pWidth = 0.3 * CONFIG.GRID_SIZE;

    if (row.logs) {
      // 1. 優先檢查靜態睡蓮踏板 (Stationary Lily Pads - 避風港優先)
      for (const log of row.logs) {
        if (!log.isStationary) continue;
        const lX = log.mesh.position.x;
        const lWidth = (log.length || 1) * CONFIG.GRID_SIZE * 1.15;
        const halfL = lWidth / 2;

        if (pX + pWidth >= lX - halfL && pX - pWidth <= lX + halfL) {
          return { inRiver: true, onLog: true, logSpeed: 0 };
        }
      }

      // 2. 次要檢查一般動態浮木 (Moving Logs)
      for (const log of row.logs) {
        if (log.isStationary) continue;
        const lX = log.mesh.position.x;
        const lWidth = (log.length || 3) * CONFIG.GRID_SIZE * 1.15;
        const halfL = lWidth / 2;

        if (pX + pWidth >= lX - halfL && pX - pWidth <= lX + halfL) {
          return { inRiver: true, onLog: true, logSpeed: row.direction * row.speed };
        }
      }
    }

    return { inRiver: true, onLog: false };
  }
}
