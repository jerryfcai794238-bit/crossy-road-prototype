import { Player } from './Player.js';
import { CONFIG } from '../config.js';
import { getHighestOtherLeaderStrikeTarget } from './LeaderStrikeTargeting.js';

export class AIBot extends Player {
  constructor(mesh, botName, startX = 0, startZ = 0, baseAggression = 0.38) {
    super(mesh);
    this.botName = botName;
    this.startX = startX;
    this.startZ = startZ;
    this.baseAggression = baseAggression;
    this.decisionTimer = 0;
    this.decisionInterval = 0.18;
    this.lastDirection = null;
    this.lateralCooldown = 0;
    this.retreatCooldown = 0;
    this.waitedForPath = false;
    this.scoreItemTarget = null;
    this.scoreItemBlockedAttempts = 0;
    this.scoreItemIgnoredId = null;
    this.scoreItemRetryCooldown = 0;
    this.springPunchDodgeCooldown = 0;
    this.lastDodgedPunchId = null;
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
    this.waitedForPath = false;
    this.scoreItemTarget = null;
    this.scoreItemBlockedAttempts = 0;
    this.scoreItemIgnoredId = null;
    this.scoreItemRetryCooldown = 0;
    this.springPunchDodgeCooldown = 0;
    this.lastDodgedPunchId = null;
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

  updateAI(deltaTime, activeRows, physics, tryMove = null, canMove = null, scoreItems = [], canEnterCell = null, isDynamicHoleUnsafe = null, getDynamicHoleRepairTime = null, springPunchItems = [], leaderStrikeItems = [], springPunches = [], actors = []) {
    if (this.isJumping || this.isRespawning || this.isDead || this.stunTimer > 0) return;

    this.decisionTimer += deltaTime;
    this.lateralCooldown = Math.max(0, this.lateralCooldown - deltaTime);
    this.retreatCooldown = Math.max(0, this.retreatCooldown - deltaTime);
    this.scoreItemRetryCooldown = Math.max(0, this.scoreItemRetryCooldown - deltaTime);
    this.springPunchDodgeCooldown = Math.max(0, this.springPunchDodgeCooldown - deltaTime);
    if (this.scoreItemRetryCooldown === 0) this.scoreItemIgnoredId = null;
    if (this.decisionTimer < this.decisionInterval) return;
    this.decisionTimer = 0;

    const dodgeDirection = this.findSpringPunchDodgeDirection(springPunches, activeRows, physics, canMove, canEnterCell, isDynamicHoleUnsafe);
    const itemDirection = dodgeDirection || this.findLeaderStrikeItemDirection(leaderStrikeItems, actors, activeRows, physics, canMove, canEnterCell, isDynamicHoleUnsafe) || this.findSpringPunchItemDirection(springPunchItems, actors, activeRows, physics, canMove, canEnterCell, isDynamicHoleUnsafe) || this.findScoreItemDirection(scoreItems, activeRows, physics, canMove, canEnterCell, isDynamicHoleUnsafe);
    const direction = itemDirection || this.findPathDirection(activeRows, physics, canMove, canEnterCell, isDynamicHoleUnsafe);
    if (!direction) {
      // 無可行替代路時，短暫等待前方即將修復的唯一通道，避免一個 decision tick 後無謂後退。
      const forward = this.getTargetGridPosition('UP');
      const repairTime = getDynamicHoleRepairTime?.(forward);
      if (repairTime !== null && repairTime <= 0.7) {
        this.waitedForPath = true;
        return;
      }
      if (!this.waitedForPath) {
        this.waitedForPath = true;
        return;
      }
      this.waitedForPath = false;
      this.tryRetreat(activeRows, physics, tryMove, canMove, isDynamicHoleUnsafe);
      return;
    }
    this.waitedForPath = false;

    const actionRate = Math.min(1, Math.max(0.96, this.baseAggression + 0.55));
    if (Math.random() >= actionRate) return;
    const moved = tryMove ? tryMove(this, direction) : this.move(direction);
    if (!moved) {
      if (itemDirection && ++this.scoreItemBlockedAttempts >= 3) {
        this.scoreItemIgnoredId = this.scoreItemTarget;
        this.scoreItemRetryCooldown = 0.9;
        this.scoreItemTarget = null;
        this.scoreItemBlockedAttempts = 0;
      }
      return;
    }

    this.scoreItemBlockedAttempts = 0;

    this.lastDirection = direction;
    if (direction === 'LEFT' || direction === 'RIGHT') this.lateralCooldown = 0.6;
    if (direction === 'DOWN') this.retreatCooldown = 0.7;
  }

  findSpringPunchItemDirection(items, actors, activeRows, physics, canMove, canEnterCell, isDynamicHoleUnsafe) {
    const valuable = items.filter((item) => this.isSpringPunchUsefulFrom(item, actors));
    if (!valuable.length) return null;
    return this.findScoreItemDirection(valuable, activeRows, physics, canMove, canEnterCell, isDynamicHoleUnsafe);
  }

  findLeaderStrikeItemDirection(items, actors, activeRows, physics, canMove, canEnterCell, isDynamicHoleUnsafe) {
    const valuable = items.filter((item) => this.getLeaderStrikeTarget(actors));
    if (!valuable.length) return null;
    return this.findScoreItemDirection(valuable, activeRows, physics, canMove, canEnterCell, isDynamicHoleUnsafe);
  }

  getLeaderStrikeTarget(actors) {
    const target = getHighestOtherLeaderStrikeTarget(this, actors);
    return target && target.stunTimer <= 0 && target.controlImmunityTimer <= 0 ? target : null;
  }

  isSpringPunchUsefulFrom(item, actors) {
    const dx = item.x - this.gridX;
    const dz = item.z - this.gridZ;
    if (Math.abs(dx) + Math.abs(dz) > 5) return false;
    const arrivalFacing = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'LEFT' : 'RIGHT') : 'UP';
    const vector = arrivalFacing === 'UP' ? { x: 0, z: 1 } : arrivalFacing === 'LEFT' ? { x: 1, z: 0 } : { x: -1, z: 0 };
    return actors.some((actor) => actor !== this && !actor.isDead && !actor.isRespawning && actor.stunTimer <= 0 && actor.controlImmunityTimer <= 0 && (
      Math.abs((actor.gridX - item.x) * vector.z - (actor.gridZ - item.z) * vector.x) < 0.01
      && (actor.gridX - item.x) * vector.x + (actor.gridZ - item.z) * vector.z >= 1
      && (actor.gridX - item.x) * vector.x + (actor.gridZ - item.z) * vector.z <= 6
    ));
  }

  findSpringPunchDodgeDirection(punches, activeRows, physics, canMove, canEnterCell, isDynamicHoleUnsafe) {
    if (this.springPunchDodgeCooldown > 0) return null;
    const threat = punches.find((punch) => {
      if (punch.owner === this) return false;
      const dx = this.position.x - punch.position.x;
      const dz = this.position.z - punch.position.z;
      const along = dx * punch.direction.x + dz * punch.direction.z;
      const lateral = Math.abs(dx * punch.direction.z - dz * punch.direction.x);
      return along >= 0 && lateral <= CONFIG.SPRING_PUNCH.HIT_RADIUS && along / CONFIG.SPRING_PUNCH.SPEED <= 0.65;
    });
    if (!threat) return null;
    const choices = Math.abs(threat.direction.z) > 0
      ? ['LEFT', 'RIGHT', 'UP', 'DOWN'] : ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    for (const direction of choices) {
      const target = this.getTargetGridPosition(direction);
      if (!this.isCellSafe(target, activeRows, physics, 0.16, isDynamicHoleUnsafe) || (canEnterCell && !canEnterCell(this, target)) || (canMove && !canMove(this, direction))) continue;
      const targetX = target.x * CONFIG.GRID_SIZE - threat.position.x;
      const targetZ = target.z * CONFIG.GRID_SIZE - threat.position.z;
      if (Math.abs(targetX * threat.direction.z - targetZ * threat.direction.x) <= CONFIG.SPRING_PUNCH.HIT_RADIUS) continue;
      this.springPunchDodgeCooldown = 0.35;
      this.lastDodgedPunchId = threat.id;
      return direction;
    }
    return null;
  }

  findScoreItemDirection(scoreItems, activeRows, physics, canMove, canEnterCell, isDynamicHoleUnsafe) {
    const candidates = scoreItems.filter((item) => (
      item.id !== this.scoreItemIgnoredId
      && item.z >= this.gridZ
      && item.z <= this.gridZ + 5
      && Math.abs(item.x - this.gridX) <= 3
    ));
    const itemsByCell = new Map(candidates.map((item) => [`${item.x},${item.z}`, item]));
    const queue = [{ x: this.gridX, z: this.gridZ, firstDirection: null, depth: 0 }];
    const visited = new Set([`${this.gridX},${this.gridZ}`]);
    const reachableTargets = [];
    let best = null;

    while (queue.length) {
      const current = queue.shift();
      const item = itemsByCell.get(`${current.x},${current.z}`);
      if (item && current.depth > 0) {
        const row = activeRows.get(item.z);
        const risk = row?.type === CONFIG.ROW_TYPES.ROAD ? 0.6 : row?.type === CONFIG.ROW_TYPES.RAILROAD ? 0.9 : 0;
        const forwardSteps = Math.max(0, item.z - this.gridZ);
        const extraSteps = Math.max(0, current.depth - forwardSteps);
        // 彈簧拳只接受完整安全 BFS 的五步內路徑，且相較正常前進最多多兩步。
        if ((item.type === 'springPunch' || item.type === 'leaderStrike') && extraSteps > 2) continue;
        const utility = 3 - extraSteps * 0.75 - risk;
        if (utility >= 0.6) {
          const target = { item, direction: current.firstDirection, utility };
          reachableTargets.push(target);
          if (!best || utility > best.utility) best = target;
        }
      }
      if (current.depth >= 5) continue;
      for (const move of [{ name: 'UP', dx: 0, dz: 1 }, { name: 'LEFT', dx: 1, dz: 0 }, { name: 'RIGHT', dx: -1, dz: 0 }]) {
        const reversesRecentLateralMove = current.depth === 0 && this.lateralCooldown > 0 && (
          (this.lastDirection === 'LEFT' && move.name === 'RIGHT')
          || (this.lastDirection === 'RIGHT' && move.name === 'LEFT')
        );
        if (reversesRecentLateralMove) continue;
        const next = { x: current.x + move.dx, z: current.z + move.dz };
        const key = `${next.x},${next.z}`;
        if (visited.has(key) || Math.abs(next.x) > CONFIG.MAP_BOUNDS_X) continue;
        const landingPrediction = current.depth === 0 ? (CONFIG.JUMP_DURATION || 0.16) : 0;
        if (!this.isCellSafe(next, activeRows, physics, landingPrediction, isDynamicHoleUnsafe)) continue;
        // 道具繞路的每一步都沿用現有角色占位／跳躍預約，避免規劃穿過競爭者。
        if (canEnterCell && !canEnterCell(this, next)) continue;
        if (current.depth === 0 && canMove && !canMove(this, move.name)) continue;
        visited.add(key);
        queue.push({ ...next, firstDirection: current.firstDirection || move.name, depth: current.depth + 1 });
      }
    }
    const currentTarget = reachableTargets.find((target) => target.item.id === this.scoreItemTarget);
    if (best && currentTarget && best.item.id !== currentTarget.item.id && best.utility - currentTarget.utility < 0.35) {
      best = currentTarget;
    }
    if (!best) {
      this.scoreItemTarget = null;
      this.scoreItemBlockedAttempts = 0;
      return null;
    }
    if (this.scoreItemTarget !== best.item.id) this.scoreItemBlockedAttempts = 0;
    this.scoreItemTarget = best.item.id;
    return best.direction;
  }

  findPathDirection(activeRows, physics, canMove, canEnterCell, isDynamicHoleUnsafe) {
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
      // A retreat must not turn the previously reached peak into a fake forward
      // destination. Only a route beyond the bot's historical peak is progress.
      if (current.depth > 0 && current.z > this.maxReachedZ) {
        const score = current.z * 100 - current.depth * 3 - Math.abs(current.x - start.x);
        if (!best || score > best.score) best = { direction: current.firstDirection, score };
      }
      if (current.depth >= 10) continue;

      for (const move of moves) {
        const next = { x: current.x + move.dx, z: current.z + move.dz };
        if (Math.abs(next.x) > CONFIG.MAP_BOUNDS_X || next.z < lowestReachableZ) continue;
        const key = `${next.x},${next.z}`;
        if (visited.has(key)) continue;
        const landingPrediction = current.depth === 0 ? (CONFIG.JUMP_DURATION || 0.16) : 0;
        if (!this.isCellSafe(next, activeRows, physics, landingPrediction, isDynamicHoleUnsafe)) continue;
        if (canEnterCell && !canEnterCell(this, next)) continue;
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

  tryRetreat(activeRows, physics, tryMove, canMove, isDynamicHoleUnsafe) {
    if (this.retreatCooldown > 0) return false;
    const targetPos = this.getTargetGridPosition('DOWN');
    const lowestReachableZ = Number.isFinite(this.minAllowedZ) ? this.minAllowedZ : -4;
    if (targetPos.z < lowestReachableZ || Math.abs(targetPos.x) > CONFIG.MAP_BOUNDS_X) return false;
    if (!this.isCellSafe(targetPos, activeRows, physics, CONFIG.JUMP_DURATION || 0.16, isDynamicHoleUnsafe)) return false;
    if (canMove && !canMove(this, 'DOWN')) return false;

    const moved = tryMove ? tryMove(this, 'DOWN') : this.move('DOWN');
    if (moved) {
      this.lastDirection = 'DOWN';
      this.retreatCooldown = 0.7;
    }
    return moved;
  }

  predictLaneObjectX(currentX, row, predictionSeconds) {
    if (!(predictionSeconds > 0)) return currentX;
    const direction = Number.isFinite(row.direction) ? row.direction : 0;
    const speed = Number.isFinite(row.speed) ? row.speed : 0;
    let predictedX = currentX + direction * speed * predictionSeconds;
    const boundX = (CONFIG.MAP_BOUNDS_X + 5) * CONFIG.GRID_SIZE;
    if (predictedX > boundX) predictedX = -boundX + (predictedX - boundX);
    else if (predictedX < -boundX) predictedX = boundX + (predictedX + boundX);
    return predictedX;
  }

  isCellSafe(targetPos, activeRows, physics, predictionSeconds = 0, isDynamicHoleUnsafe = null) {
    if (physics.checkTreeCollision(targetPos, activeRows)) return false;
    if (isDynamicHoleUnsafe?.(targetPos, predictionSeconds)) return false;
    const row = activeRows.get(targetPos.z);
    if (!row) return true;

    if (row.type === CONFIG.ROW_TYPES.ROAD && row.vehicles) {
      const targetX = targetPos.x * CONFIG.GRID_SIZE;
      if (row.vehicles.some((vehicle) => {
        const vehicleX = vehicle.position ? vehicle.position.x : vehicle.mesh.position.x;
        const predictedVehicleX = this.predictLaneObjectX(vehicleX, row, predictionSeconds);
        return Math.abs(targetX - vehicleX) < 2.2 || Math.abs(targetX - predictedVehicleX) < 2.2;
      })) return false;
    }

    if (row.type === CONFIG.ROW_TYPES.RAILROAD && row.trainState !== 'IDLE') return false;

    if (row.type === CONFIG.ROW_TYPES.RIVER) {
      const targetX = targetPos.x * CONFIG.GRID_SIZE;
      const isOnLog = row.logs?.some((log) => {
        const logX = log.position ? log.position.x : log.mesh.position.x;
        const landingLogX = log.isStationary ? logX : this.predictLaneObjectX(logX, row, predictionSeconds);
        const width = (log.length || 3) * CONFIG.GRID_SIZE * 0.85;
        return Math.abs(targetX - landingLogX) <= width / 2 + 0.2;
      });
      if (!isOnLog) return false;
    }

    return true;
  }
}
