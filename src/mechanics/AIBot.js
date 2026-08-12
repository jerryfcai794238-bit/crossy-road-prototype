import { Player } from './Player.js';
import { CONFIG } from '../config.js';

export class AIBot extends Player {
  constructor(mesh, botName, startX = 0, startZ = 0, baseAggression = 0.38) {
    super(mesh);
    this.botName = botName;
    this.startX = startX;
    this.startZ = startZ;
    this.baseAggression = baseAggression;
    this.decisionTimer = 0;
    this.decisionInterval = 0.22;
    this.lastDirection = null;
    this.lateralCooldown = 0;
    this.retreatCooldown = 0;
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
    this.checkpoint = { x: startX, z: startZ };
    this.lastDirection = null;
    this.lateralCooldown = 0;
    this.retreatCooldown = 0;
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.visible = true;
    }
  }

  updateCheckpoint() {
    if (this.gridZ > this.checkpoint.z) {
      this.checkpoint = { x: this.gridX, z: this.gridZ };
    }
  }

  updateAI(deltaTime, activeRows, physics, tryMove = null, canMove = null) {
    if (this.isJumping || this.isRespawning || this.isDead) return;

    this.decisionTimer += deltaTime;
    this.lateralCooldown = Math.max(0, this.lateralCooldown - deltaTime);
    this.retreatCooldown = Math.max(0, this.retreatCooldown - deltaTime);
    if (this.decisionTimer < this.decisionInterval) return;
    this.decisionTimer = 0;

    const direction = this.findPathDirection(activeRows, physics, canMove);
    if (!direction) {
      this.tryRetreat(activeRows, physics, tryMove, canMove);
      return;
    }

    if (Math.random() >= this.baseAggression + 0.45) return;
    const moved = tryMove ? tryMove(this, direction) : this.move(direction);
    if (!moved) return;

    this.lastDirection = direction;
    if (direction === 'LEFT' || direction === 'RIGHT') this.lateralCooldown = 0.6;
    if (direction === 'DOWN') this.retreatCooldown = 0.7;
  }

  findPathDirection(activeRows, physics, canMove) {
    const start = { x: this.gridX, z: this.gridZ };
    // 路徑搜尋可以退回目前允許的最小列，讓 AI 在死路時先退幾格再繞路，
    // 而不是被「上一個安全區」鎖死在原地。
    const lowestReachableZ = Number.isFinite(this.minAllowedZ) ? this.minAllowedZ : -4;
    const moves = [
      { name: 'UP', dx: 0, dz: 1 },
      { name: 'LEFT', dx: 1, dz: 0 },
      { name: 'RIGHT', dx: -1, dz: 0 },
      { name: 'DOWN', dx: 0, dz: -1 }
    ];
    const queue = [{ ...start, firstDirection: null, depth: 0 }];
    const visited = new Set([`${start.x},${start.z}`]);
    let best = null;

    while (queue.length > 0) {
      const current = queue.shift();
      if (current.depth > 0 && current.z > start.z) {
        const score = current.z * 100 - current.depth * 3 - Math.abs(current.x - start.x);
        if (!best || score > best.score) best = { direction: current.firstDirection, score };
      }
      if (current.depth >= 10) continue;

      for (const move of moves) {
        const next = { x: current.x + move.dx, z: current.z + move.dz };
        if (Math.abs(next.x) > CONFIG.MAP_BOUNDS_X || next.z < lowestReachableZ) continue;
        const key = `${next.x},${next.z}`;
        if (visited.has(key)) continue;
        if (!this.isCellSafe(next, activeRows, physics)) continue;
        if (current.depth === 0 && canMove && !canMove(this, move.name)) continue;

        visited.add(key);
        queue.push({
          ...next,
          firstDirection: current.firstDirection || move.name,
          depth: current.depth + 1
        });
      }
    }

    return best?.direction || null;
  }

  tryRetreat(activeRows, physics, tryMove, canMove) {
    if (this.retreatCooldown > 0) return false;
    const targetPos = this.getTargetGridPosition('DOWN');
    const lowestReachableZ = Number.isFinite(this.minAllowedZ) ? this.minAllowedZ : -4;
    if (targetPos.z < lowestReachableZ || Math.abs(targetPos.x) > CONFIG.MAP_BOUNDS_X) return false;
    if (!this.isCellSafe(targetPos, activeRows, physics)) return false;
    if (canMove && !canMove(this, 'DOWN')) return false;

    const moved = tryMove ? tryMove(this, 'DOWN') : this.move('DOWN');
    if (moved) {
      this.lastDirection = 'DOWN';
      this.retreatCooldown = 0.7;
    }
    return moved;
  }

  isCellSafe(targetPos, activeRows, physics) {
    if (physics.checkTreeCollision(targetPos, activeRows)) return false;
    const row = activeRows.get(targetPos.z);
    if (!row) return true;

    if (row.type === CONFIG.ROW_TYPES.ROAD && row.vehicles) {
      const targetX = targetPos.x * CONFIG.GRID_SIZE;
      if (row.vehicles.some((vehicle) => {
        const vehicleX = vehicle.position ? vehicle.position.x : vehicle.mesh.position.x;
        return Math.abs(targetX - vehicleX) < 2.2;
      })) return false;
    }

    if (row.type === CONFIG.ROW_TYPES.RAILROAD && row.trainState !== 'IDLE') return false;

    if (row.type === CONFIG.ROW_TYPES.RIVER) {
      const targetX = targetPos.x * CONFIG.GRID_SIZE;
      const isOnLog = row.logs?.some((log) => {
        const logX = log.position ? log.position.x : log.mesh.position.x;
        const width = (log.length || 3) * CONFIG.GRID_SIZE * 0.85;
        return Math.abs(targetX - logX) <= width / 2 + 0.2;
      });
      if (!isOnLog) return false;
    }

    return true;
  }
}
