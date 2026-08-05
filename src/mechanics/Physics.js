import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Physics {
  /**
   * 輔助函式：取得指定 Z 軸列資料
   */
  getRow(activeRows, z) {
    if (!activeRows) return null;
    if (activeRows instanceof Map) {
      return activeRows.get(z);
    }
    return activeRows[z];
  }

  /**
   * 1. 樹木與地圖邊界阻擋判定
   * @param {Object} targetPos { x: gridX, z: gridZ }
   * @param {Map|Object} activeRows
   * @returns {boolean} 是否被樹木或邊界阻擋
   */
  checkTreeCollision(targetPos, activeRows) {
    // 檢查左右網格邊界
    if (Math.abs(targetPos.x) > CONFIG.MAP_BOUNDS_X) {
      return true;
    }

    const row = this.getRow(activeRows, targetPos.z);
    if (!row) return false;

    // 如果該列是草地，檢查目標 X 位置是否有樹木
    if (row.type === CONFIG.ROW_TYPES.GRASS && row.trees) {
      return row.trees.some((tree) => tree.gridX === targetPos.x);
    }

    return false;
  }

  /**
   * 2. 車輛與火車碰撞判定 (AABB 盒碰撞)
   * @param {Player} player
   * @param {Map|Object} activeRows
   * @returns {Object|null} 碰撞資訊 { type: 'car'|'train', obstacle } 或 null
   */
  checkObstacleCollision(player, activeRows) {
    if (!player || player.isDead) return null;

    const playerX = player.position.x;
    const playerZ = player.position.z;
    const playerRadius = CONFIG.PLAYER.COLLISION_RADIUS;

    // 檢查玩家目前的 Z 軸與前後臨近列 (避免跳躍過程中沒撞到)
    const checkZList = [
      Math.floor((playerZ + CONFIG.GRID_SIZE * 0.4) / CONFIG.GRID_SIZE),
      Math.floor((playerZ - CONFIG.GRID_SIZE * 0.4) / CONFIG.GRID_SIZE),
      player.gridZ
    ];

    const uniqueZList = [...new Set(checkZList)];

    for (const z of uniqueZList) {
      const row = this.getRow(activeRows, z);
      if (!row) continue;

      const rowWorldZ = row.z * CONFIG.GRID_SIZE;

      // 判定 A: 馬路車輛 (ROAD)
      if (row.type === CONFIG.ROW_TYPES.ROAD && row.vehicles) {
        for (const veh of row.vehicles) {
          const vehWorldX = veh.position.x;
          const halfW = veh.width / 2;
          const halfD = veh.depth / 2;

          const distX = Math.abs(playerX - vehWorldX);
          const distZ = Math.abs(playerZ - rowWorldZ);

          if (distX < (halfW + playerRadius * 0.75) && distZ < (halfD + playerRadius * 0.75)) {
            return { type: 'car', vehicle: veh };
          }
        }
      }

      // 判定 B: 鐵路火車 (RAILROAD)
      else if (row.type === CONFIG.ROW_TYPES.RAILROAD && row.train) {
        if (row.trainState === 'TRAIN_PASSING') {
          const trainWorldX = row.train.position.x;
          const halfW = row.train.length / 2;
          const halfD = 0.55;

          const distX = Math.abs(playerX - trainWorldX);
          const distZ = Math.abs(playerZ - rowWorldZ);

          if (distX < (halfW + playerRadius * 0.75) && distZ < (halfD + playerRadius * 0.75)) {
            return { type: 'train', train: row.train };
          }
        }
      }
    }

    return null;
  }

  /**
   * 3. 河流落水與浮木踩踏檢測
   * @param {Player} player
   * @param {Map|Object} activeRows
   * @returns {Object} { inRiver: boolean, onLog: boolean, logSpeed: number }
   */
  checkRiverStatus(player, activeRows) {
    if (!player) {
      return { inRiver: false, onLog: false, logSpeed: 0 };
    }

    // 當玩家處於高空跳躍狀態時，不會落水
    if (player.isJumping && player.position.y > 0.25) {
      return { inRiver: false, onLog: false, logSpeed: 0 };
    }

    // 依據主角目前實體 Z 座標定位最近的河流列
    const currentZ = Math.round(player.position.z / CONFIG.GRID_SIZE);
    const row = this.getRow(activeRows, currentZ);

    if (!row || row.type !== CONFIG.ROW_TYPES.RIVER) {
      return { inRiver: false, onLog: false, logSpeed: 0 };
    }

    const playerX = player.position.x;

    // 檢查是否踩在該列的任何一塊浮木上
    if (row.logs) {
      for (const log of row.logs) {
        const logWorldX = log.position.x;
        const logTotalWidth = log.length * CONFIG.GRID_SIZE;
        const halfWidth = logTotalWidth / 2;

        // 浮木前後端允許一點點的安全容錯範圍
        const safetyMargin = CONFIG.GRID_SIZE * 0.25;

        if (
          playerX >= (logWorldX - halfWidth + safetyMargin) &&
          playerX <= (logWorldX + halfWidth - safetyMargin)
        ) {
          return {
            inRiver: true,
            onLog: true,
            logSpeed: log.direction * log.speed
          };
        }
      }
    }

    // 在河流列但沒踩在浮木上 => 落水
    return {
      inRiver: true,
      onLog: false,
      logSpeed: 0
    };
  }
}
