import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  createTreeMesh,
  createCarMesh,
  createTruckMesh,
  createLogMesh,
  createTrainMesh,
  createSignalMesh,
  createLilyPadMesh
} from '../graphics/VoxelModels.js';

export class MapGenerator {
  constructor(scene, random = Math.random) {
    this.scene = scene;
    // Keep generation deterministic when a caller supplies a seeded RNG.  This is
    // deliberately a function rather than a global override so runtime behaviour
    // remains exactly Math.random by default.
    this.random = typeof random === 'function' ? random : Math.random;
    this.activeRows = new Map();
    this.destroyedTreeCells = new Set();
    // Casual mode can supply all living actors/checkpoints so generation remains fair to a leader.
    this.actorBoundsGetter = null;

    this.highestZGenerated = -CONFIG.DESPAWN_BEHIND;
    this.lowestZGenerated = -CONFIG.DESPAWN_BEHIND;

    this.currentClusterType = CONFIG.ROW_TYPES.GRASS;
    this.clusterRemaining = 5;
    this.grassClusterSize = 0;
    this.grassClusterRowIndex = 0;
    this.currentDynamicHoleCluster = null;
    this.dynamicHoleClusterCounter = 0;
    this.dynamicHoleClusterHistory = [];
    this.completedOrdinaryHazardChainsSinceDynamicHole = 0;
    this.lastCountedDynamicHoleHazardChainId = null;
    this.forceFirstHazardAtZ8 = true;
    this.forceDynamicHoleGrassAfterFirstHazard = false;
    this.currentRiverClusterSubtype = null;
    this.lastLilyPadGridXs = null;
    this.currentHazardChain = null;
    this.hazardChainCounter = 0;
    this.scoreItems = new Map();
    this.scoreItemsEnabled = false;
    this.scoreItemCellBlocked = null;
    this.scoreItemReferenceX = null;
    this.springPunchItems = new Map();
    this.springPunchItemsEnabled = false;
    this.springPunchCellBlocked = null;
    this.springPunchReferenceX = null;
    this.leaderStrikeItems = new Map();
    this.leaderStrikeItemsEnabled = false;
    this.leaderStrikeCellBlocked = null;
    this.leaderStrikeReferenceX = null;
    this.leaderStrikeBlockIndex = 0;
    this.leaderStrikePendingBlockIndex = null;
    this.leaderStrikeSpawnHistory = [];
    this.dynamicHolesEnabled = false;
    this.dynamicHoleCells = new Map();
    this.dynamicHoleCellBlocked = null;
    this.dynamicHolePlayerZ = 0;
    this.dynamicHoleWaveCooldown = CONFIG.HOLES.WAVE_COOLDOWN;
    this.partyItemRegenTimer = 0;
    this.dynamicHoleWaveId = 0;
    this.reachableXs = new Set();
    this.reachabilityInitialized = false;
    this.carrierFrontier = null;
    this.carrierHorizon = 12;
    this.carrierStep = 0.08;
    this.dynamicHoleConfig = {
      warningDuration: CONFIG.HOLES.WARNING_DURATION,
      holeDuration: CONFIG.HOLES.HOLE_DURATION,
      repairDuration: CONFIG.HOLES.REPAIR_DURATION,
      waveCooldown: CONFIG.HOLES.WAVE_COOLDOWN,
      warningSafetyBuffer: CONFIG.HOLES.WARNING_SAFETY_BUFFER
    };

    this.initGeometriesAndMaterials();
  }

  initGeometriesAndMaterials() {
    const laneWidth = (CONFIG.MAP_BOUNDS_X * 2 + 10) * CONFIG.GRID_SIZE;
    const laneDepth = CONFIG.GRID_SIZE;

    this.laneGeo = new THREE.BoxGeometry(laneWidth, 0.4, laneDepth);

    this.grassMat1 = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.GRASS_PRIMARY });
    this.grassMat2 = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.GRASS_SECONDARY });
    this.roadMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.ROAD });
    this.riverMat = new THREE.MeshLambertMaterial({
      color: CONFIG.COLORS.RIVER,
      transparent: true,
      opacity: 0.85
    });
    this.railroadGravelMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.RAILROAD_GRAVEL });

    this.railGeo = new THREE.BoxGeometry(laneWidth, 0.08, 0.08);
    this.railMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.RAILROAD_RAIL });

    this.tieGeo = new THREE.BoxGeometry(0.18, 0.05, laneDepth * 0.85);
    this.tieMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.RAILROAD_TIE });
  }

  initMap() {
    this.reset();

    for (let z = -CONFIG.DESPAWN_BEHIND; z <= CONFIG.BOXES.SAFE_END_Z; z++) {
      this.generateRow(z, CONFIG.ROW_TYPES.GRASS, true);
    }

    this.highestZGenerated = CONFIG.BOXES.SAFE_END_Z;
    this.lowestZGenerated = -CONFIG.DESPAWN_BEHIND;

    this.update(0);
  }

  reset() {
    this.destroyedTreeCells.clear();
    this.clearDynamicHoles();
    for (const [z, row] of this.activeRows.entries()) {
      this.removeRow(z, row);
    }
    this.activeRows.clear();
    this.highestZGenerated = -CONFIG.DESPAWN_BEHIND;
    this.lowestZGenerated = -CONFIG.DESPAWN_BEHIND;
    this.currentClusterType = CONFIG.ROW_TYPES.GRASS;
    this.clusterRemaining = 5;
    this.grassClusterSize = 0;
    this.grassClusterRowIndex = 0;
    this.currentDynamicHoleCluster = null;
    this.dynamicHoleClusterCounter = 0;
    this.dynamicHoleClusterHistory = [];
    this.completedOrdinaryHazardChainsSinceDynamicHole = 0;
    this.lastCountedDynamicHoleHazardChainId = null;
    this.forceFirstHazardAtZ8 = true;
    this.forceDynamicHoleGrassAfterFirstHazard = false;
    this.currentRiverClusterSubtype = null;
    this.lastLilyPadGridXs = null;
    this.currentHazardChain = null;
    this.hazardChainCounter = 0;
    this.scoreItems.clear();
    this.springPunchItems.clear();
    this.leaderStrikeItems.clear();
    this.leaderStrikeBlockIndex = 0;
    this.leaderStrikePendingBlockIndex = null;
    this.leaderStrikeSpawnHistory = [];
    this.dynamicHolePlayerZ = 0;
    this.dynamicHoleWaveCooldown = CONFIG.HOLES.WAVE_COOLDOWN;
    this.partyItemRegenTimer = 0;
    this.dynamicHoleWaveId = 0;
    this.reachableXs.clear();
    this.reachabilityInitialized = false;
    this.carrierFrontier = null;
  }

  update(playerZ) {
    this.dynamicHolePlayerZ = playerZ;
    const actorBounds = this.actorBoundsGetter?.() || null;
    const highestActorZ = Number.isFinite(actorBounds?.highestZ) ? actorBounds.highestZ : playerZ;
    const targetAheadZ = Math.max(playerZ, highestActorZ) + CONFIG.GENERATION_AHEAD;

    while (this.highestZGenerated < targetAheadZ) {
      this.highestZGenerated++;
      const nextType = this.getNextRowType(this.highestZGenerated);
      this.generateRow(this.highestZGenerated, nextType);
    }
    if (this.partyItemRegenTimer <= 0) {
      const before = this.springPunchItems.size;
      this.ensureSpringPunchItem(playerZ, this.springPunchReferenceX?.() ?? 0);
      if (highestActorZ > playerZ + 6) this.ensureSpringPunchItem(highestActorZ, 0);
      if (this.springPunchItems.size > before) this.partyItemRegenTimer = CONFIG.BOXES.REGEN_SECONDS;
    }

    // 身後 25 格以上才安全銷毀，絕不銷毀腳下與退路
    const lowestActorZ = Number.isFinite(actorBounds?.lowestZ) ? actorBounds.lowestZ : playerZ;
    const checkpointZs = Array.isArray(actorBounds?.checkpointZs) ? actorBounds.checkpointZs.filter(Number.isFinite) : [];
    const minKeepZ = Math.min(playerZ, lowestActorZ, ...checkpointZs) - CONFIG.DESPAWN_BEHIND;
    for (const [z, row] of this.activeRows.entries()) {
      if (z < minKeepZ) {
        this.removeRow(z, row);
      }
    }
  }

  getNextRowType(targetZ = 0) {
    if (this.forceFirstHazardAtZ8 && targetZ === 8) {
      this.forceFirstHazardAtZ8 = false;
      this.forceDynamicHoleGrassAfterFirstHazard = true;
      const hazardTypes = [CONFIG.ROW_TYPES.ROAD, CONFIG.ROW_TYPES.RIVER, CONFIG.ROW_TYPES.RAILROAD];
      return this.beginCluster(hazardTypes[Math.floor(this.random() * hazardTypes.length)]);
    }

    if (this.clusterRemaining > 0) {
      this.clusterRemaining--;
      return this.currentClusterType;
    }

    if (this.forceDynamicHoleGrassAfterFirstHazard) {
      this.forceDynamicHoleGrassAfterFirstHazard = false;
      return this.beginDynamicHoleGrassCluster();
    }

    // 首段之後，每完成兩個普通危險群才插入一次破洞區，兩個破洞區之間必定隔著危險群。
    if (this.currentClusterType !== CONFIG.ROW_TYPES.GRASS) {
      const completedChainId = this.currentHazardChain?.id;
      if (completedChainId && completedChainId !== this.lastCountedDynamicHoleHazardChainId) {
        this.lastCountedDynamicHoleHazardChainId = completedChainId;
        this.completedOrdinaryHazardChainsSinceDynamicHole++;
      }
      if (this.completedOrdinaryHazardChainsSinceDynamicHole >= 2) {
        return this.beginDynamicHoleGrassCluster();
      }
    }

    const types = [
      CONFIG.ROW_TYPES.GRASS,
      CONFIG.ROW_TYPES.ROAD,
      CONFIG.ROW_TYPES.RIVER,
      CONFIG.ROW_TYPES.RAILROAD
    ];

    let nextType = types[Math.floor(this.random() * types.length)];
    if (nextType !== CONFIG.ROW_TYPES.GRASS && nextType === this.currentClusterType) {
      nextType = CONFIG.ROW_TYPES.GRASS;
    }

    return this.beginCluster(nextType);
  }

  beginCluster(nextType) {
    this.currentClusterType = nextType;
    this.currentDynamicHoleCluster = null;

    switch (nextType) {
      case CONFIG.ROW_TYPES.GRASS:
        this.clusterRemaining = Math.floor(this.random() * 3) + 1;
        this.grassClusterSize = this.clusterRemaining + 1;
        this.grassClusterRowIndex = 0;
        this.lastLilyPadGridXs = null;
        break;
      case CONFIG.ROW_TYPES.ROAD:
        this.grassClusterSize = 0;
        this.clusterRemaining = Math.floor(this.random() * 3) + 1;
        this.lastLilyPadGridXs = null;
        break;
      case CONFIG.ROW_TYPES.RIVER:
        this.grassClusterSize = 0;
        this.clusterRemaining = Math.floor(this.random() * 2) + 1;
        // 以區域為單位定案當前河道區域子類型 (30% LILY_PAD, 70% LOG)
        this.currentRiverClusterSubtype = this.random() < 0.3 ? 'LILY_PAD' : 'LOG';
        this.lastLilyPadGridXs = null;
        break;
      case CONFIG.ROW_TYPES.RAILROAD:
        this.grassClusterSize = 0;
        this.clusterRemaining = 1;
        this.lastLilyPadGridXs = null;
        break;
    }

    return this.currentClusterType;
  }

  beginDynamicHoleGrassCluster() {
    this.currentClusterType = CONFIG.ROW_TYPES.GRASS;
    this.clusterRemaining = 3;
    this.grassClusterSize = 4;
    this.grassClusterRowIndex = 0;
    this.dynamicHoleClusterCounter++;
    this.currentDynamicHoleCluster = {
      id: this.dynamicHoleClusterCounter,
      precedingHazardChainId: this.currentHazardChain?.id ?? null,
      entry: null,
      floors: [],
      exit: null
    };
    this.dynamicHoleClusterHistory.push(this.currentDynamicHoleCluster);
    this.completedOrdinaryHazardChainsSinceDynamicHole = 0;
    this.lastCountedDynamicHoleHazardChainId = this.currentHazardChain?.id ?? null;
    this.lastLilyPadGridXs = null;
    return this.currentClusterType;
  }

  generateRow(z, type, isInitialSafe = false) {
    const dynamicHoleRole = type === CONFIG.ROW_TYPES.GRASS && !isInitialSafe && this.currentDynamicHoleCluster
      ? ['entry', 'floor', 'floor', 'exit'][this.grassClusterRowIndex] || null
      : null;
    const isDynamicHoleFloor = dynamicHoleRole === 'floor';
    const rowGroup = new THREE.Group();
    rowGroup.position.set(0, -0.2, z * CONFIG.GRID_SIZE);

    const rowData = {
      z,
      type,
      mesh: rowGroup,
      trees: [],
      vehicles: [],
      logs: [],
      train: null,
      signal: null,
      trainState: 'IDLE',
      idleTimer: this.random() * 4 + 3.0,
      direction: this.random() > 0.5 ? 1 : -1,
      speed: 0,
      isInitialSafe,
      isDynamicHoleFloor,
      dynamicHoleCluster: this.currentDynamicHoleCluster,
      dynamicHoleRole
    };

    if (rowData.dynamicHoleCluster) {
      if (dynamicHoleRole === 'entry') rowData.dynamicHoleCluster.entry = rowData;
      else if (dynamicHoleRole === 'floor') rowData.dynamicHoleCluster.floors.push(rowData);
      else if (dynamicHoleRole === 'exit') rowData.dynamicHoleCluster.exit = rowData;
    }

    if (type === CONFIG.ROW_TYPES.GRASS && !isInitialSafe && this.grassClusterSize > 0) {
      this.grassClusterRowIndex++;
    }

    const completedHazardChain = type === CONFIG.ROW_TYPES.GRASS ? this.currentHazardChain : null;
    if (type !== CONFIG.ROW_TYPES.GRASS) {
      if (!this.currentHazardChain) {
        this.hazardChainCounter++;
        this.currentHazardChain = { id: this.hazardChainCounter, rows: [] };
      }
      rowData.hazardChain = this.currentHazardChain;
      this.currentHazardChain.rows.push(rowData);
    } else {
      this.finalizeHazardChain(this.currentHazardChain);
      this.currentHazardChain = null;
    }

    switch (type) {
      case CONFIG.ROW_TYPES.GRASS:
        this.buildGrassRow(rowData, rowGroup, isInitialSafe);
        break;
      case CONFIG.ROW_TYPES.ROAD:
        this.buildRoadRow(rowData, rowGroup);
        break;
      case CONFIG.ROW_TYPES.RIVER:
        this.buildRiverRow(rowData, rowGroup);
        break;
      case CONFIG.ROW_TYPES.RAILROAD:
        this.buildRailroadRow(rowData, rowGroup);
        break;
    }

    this.activeRows.set(z, rowData);
    this.updateGeneratedReachability(rowData);
    // Reachability is settled before the row enters the scene: players never see
    // a corrective tree/pad jump after generation.
    this.scene.add(rowGroup);

    if (type === CONFIG.ROW_TYPES.GRASS && !isInitialSafe) {
      if (completedHazardChain) this.registerLeaderStrikeBlock(rowData);
      if (dynamicHoleRole === 'exit') this.registerLeaderStrikeBlock(rowData);
      if (!rowData.dynamicHoleCluster) this.placePendingLeaderStrike(rowData);
    }
  }

  getPlayableXs() {
    const xs = [];
    for (let x = -CONFIG.MAP_BOUNDS_X + 1; x <= CONFIG.MAP_BOUNDS_X - 1; x++) xs.push(x);
    return xs;
  }

  getRowTraversableXs(row) {
    if (row.type === CONFIG.ROW_TYPES.RIVER && row.isPureLilyPadRow) {
      return new Set(row.logs
        .filter((log) => log.isStationary)
        .map((log) => Math.round(log.mesh.position.x / CONFIG.GRID_SIZE)));
    }
    // A moving river is intentionally not a plain floor. Its legal cells are
    // calculated by carrier support in getCarrierFrontierForRiver().
    if (row.type === CONFIG.ROW_TYPES.RIVER) return new Set();
    const treeXs = new Set(row.trees.map((tree) => tree.gridX));
    return new Set(this.getPlayableXs().filter((x) => !treeXs.has(x)));
  }

  floodRowFromEntries(traversable, entries) {
    const reachable = new Set();
    const queue = [...entries].filter((x) => traversable.has(x));
    queue.forEach((x) => reachable.add(x));
    while (queue.length) {
      const x = queue.shift();
      for (const nextX of [x - 1, x + 1]) {
        if (traversable.has(nextX) && !reachable.has(nextX)) {
          reachable.add(nextX);
          queue.push(nextX);
        }
      }
    }
    return reachable;
  }

  repairGeneratedRowEntrance(row, previousReachable) {
    const candidates = [...previousReachable];
    if (!candidates.length) return null;
    const x = candidates[Math.floor(this.random() * candidates.length)];
    if (row.type === CONFIG.ROW_TYPES.RIVER) {
      const pad = row.logs.find((log) => log.isStationary);
      if (pad) {
        pad.mesh.position.x = x * CONFIG.GRID_SIZE;
        row.reachabilityRepair = { type: 'moved-lily-pad', x };
        return x;
      }
      const mesh = createLilyPadMesh();
      mesh.position.set(x * CONFIG.GRID_SIZE, 0.1, 0);
      row.mesh.add(mesh);
      row.logs.push({ mesh, length: 1, isStationary: true, speed: 0, reachabilityFallback: true });
      row.reachabilityRepair = { type: 'added-lily-carrier', x };
      return x;
    }
    const treeIndex = row.trees.findIndex((tree) => tree.gridX === x);
    if (treeIndex >= 0) {
      const [tree] = row.trees.splice(treeIndex, 1);
      row.mesh.remove(tree.mesh);
      tree.mesh.traverse((node) => { node.geometry?.dispose(); node.material?.dispose(); });
    }
    row.reachabilityRepair = { type: 'cleared-tree', x };
    return x;
  }

  updateGeneratedReachability(row) {
    if (this.reachabilityInitialized && !this.reachableXs.size && !this.carrierFrontier?.length) {
      throw new Error(`Map reachability frontier was empty before Z=${row.z}`);
    }
    const previousReachable = this.reachabilityInitialized
      ? new Set(this.reachableXs)
      : new Set(this.getPlayableXs());

    if (row.type === CONFIG.ROW_TYPES.RIVER) {
      const incomingCarrierFrontier = this.carrierFrontier;
      row.carrierInputFrontier = incomingCarrierFrontier;
      let carrierStates = this.getCarrierFrontierForRiver(row, previousReachable, incomingCarrierFrontier);
      if (!carrierStates.length) {
        // This is the smallest static fallback: one pad at an actually reachable
        // entry X. It preserves the generated logs, water, speed and danger.
        const repairEntries = this.carrierFrontier?.length
          ? new Set(this.carrierFrontier.map((state) => state.x))
          : previousReachable;
        this.repairGeneratedRowEntrance(row, repairEntries);
        carrierStates = this.getCarrierFrontierForRiver(row, previousReachable, incomingCarrierFrontier);
      }
      if (!carrierStates.length) throw new Error(`Map reachability repair failed for river Z=${row.z}`);
      row.carrierFrontier = carrierStates;
      row.reachableXs = [...new Set(carrierStates.map((state) => state.x))].sort((a, b) => a - b);
      row.reachabilityEntryXs = [...previousReachable];
      this.reachableXs = new Set(row.reachableXs);
      this.carrierFrontier = carrierStates;
      this.reachabilityInitialized = true;
      return;
    }

    let traversable = this.getRowTraversableXs(row);
    let reachable = this.floodRowFromEntries(traversable, previousReachable);
    if (!reachable.size) {
      this.repairGeneratedRowEntrance(row, previousReachable);
      traversable = this.getRowTraversableXs(row);
      reachable = this.floodRowFromEntries(traversable, previousReachable);
    }
    row.reachableXs = [...reachable].sort((a, b) => a - b);
    row.reachabilityEntryXs = [...previousReachable].filter((x) => traversable.has(x));
    this.reachableXs = reachable;
    this.carrierFrontier = null;
    this.reachabilityInitialized = true;
  }

  getCarrierX(log, row, time) {
    if (log.isStationary) return log.mesh.position.x;
    const bound = (CONFIG.MAP_BOUNDS_X + 5) * CONFIG.GRID_SIZE;
    const direction = row.direction >= 0 ? 1 : -1;
    const speed = Math.max(0, row.speed || 0);
    let x = log.mesh.position.x;
    let remaining = Math.max(0, time);
    // animateObstacles clamps each runtime delta to 0.1s, moves once, then
    // snaps the carrier to the opposite bound and discards any overshoot.
    // Replaying those exact steps avoids the modulo-wrap drift that can invent
    // support near an edge.
    while (remaining > 1e-9) {
      const delta = Math.min(remaining, 0.1);
      x += direction * speed * delta;
      if (direction > 0 && x > bound) x = -bound;
      else if (direction < 0 && x < -bound) x = bound;
      remaining -= delta;
    }
    return x;
  }

  carrierSupportsGridX(log, row, gridX, time) {
    const playerHalfWidth = 0.3 * CONFIG.GRID_SIZE;
    const logHalfWidth = (log.length || (log.isStationary ? 1 : 3)) * CONFIG.GRID_SIZE * 1.15 / 2;
    const playerX = gridX * CONFIG.GRID_SIZE;
    const logX = this.getCarrierX(log, row, time);
    return playerX + playerHalfWidth >= logX - logHalfWidth
      && playerX - playerHalfWidth <= logX + logHalfWidth;
  }

  getCarrierFrontierForRiver(row, previousReachable, incomingCarrierFrontier = this.carrierFrontier) {
    const sourceStates = incomingCarrierFrontier?.length
      ? incomingCarrierFrontier
      : [...previousReachable].map((x) => ({ x, time: 0 }));
    const states = [];
    const seen = new Set();
    const jump = CONFIG.JUMP_DURATION;
    for (const source of sourceStates) {
      const times = incomingCarrierFrontier?.length
        ? [source.time + jump]
        : Array.from({ length: Math.floor((this.carrierHorizon - jump) / this.carrierStep) + 1 }, (_, index) => jump + index * this.carrierStep);
      for (const time of times) {
        if (time > this.carrierHorizon) continue;
        // A river-to-river jump advances exactly one jump duration. The first
        // river can be entered after waiting on a safe non-river row; every
        // retained landing state has a real Physics-compatible carrier under it.
        const x = source.x;
        const logIndex = row.logs.findIndex((log) => this.carrierSupportsGridX(log, row, x, time));
        if (logIndex < 0) continue;
        const key = `${Math.round(time / this.carrierStep)}:${x}:${logIndex}`;
        if (seen.has(key)) continue;
        seen.add(key);
        states.push({ x, time: Number(time.toFixed(3)), logIndex });
      }
    }
    return states;
  }

  // 每個連續危險區只挑一個可落地格；hash 讓同一條地圖生成順序可重現。
  finalizeHazardChain(chain) {
    if (!this.scoreItemsEnabled || !chain || chain.scoreItemCreated) return;
    const candidateRows = chain.rows.filter((row) => (
      row.z > 3 && (row.type === CONFIG.ROW_TYPES.ROAD || row.type === CONFIG.ROW_TYPES.RAILROAD)
    ));
    if (!candidateRows.length) return;

    const rowOffset = (chain.id * 7 + chain.rows.length) % candidateRows.length;
    const orderedRows = candidateRows.map((_, index) => candidateRows[(index + rowOffset) % candidateRows.length]);
    const rawReferenceX = this.scoreItemReferenceX ? this.scoreItemReferenceX() : 0;
    const referenceX = Math.max(
      -CONFIG.MAP_BOUNDS_X,
      Math.min(CONFIG.MAP_BOUNDS_X, Math.round(Number.isFinite(rawReferenceX) ? rawReferenceX : 0))
    );
    const offsets = [-1, 1, -2, 2];

    for (const row of orderedRows) {
      for (const offset of offsets) {
        const x = referenceX + offset;
        if (Math.abs(x) > CONFIG.MAP_BOUNDS_X || !this.isScoreItemCellClear(row, x)) continue;

        const mesh = this.createScoreItemMesh();
        mesh.position.set(x * CONFIG.GRID_SIZE, 0.48, 0);
        row.mesh.add(mesh);
        const item = { id: `score-${chain.id}`, x, z: row.z, points: 3, mesh, row };
        row.scoreItem = item;
        this.scoreItems.set(`${x},${row.z}`, item);
        chain.scoreItemCreated = true;
        return;
      }
    }
  }

  isScoreItemCellClear(row, x) {
    if (this.scoreItemCellBlocked?.({ x, z: row.z })) return false;
    if (row.type === CONFIG.ROW_TYPES.ROAD) {
      const targetX = x * CONFIG.GRID_SIZE;
      return !row.vehicles.some((vehicle) => Math.abs(vehicle.mesh.position.x - targetX) < 1.5);
    }
    return row.type === CONFIG.ROW_TYPES.RAILROAD && row.trainState === 'IDLE';
  }

  createScoreItemMesh() {
    const group = new THREE.Group();
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.26, 0),
      new THREE.MeshLambertMaterial({ color: 0xffd34e, emissive: 0x6a4300 })
    );
    gem.rotation.y = Math.PI / 4;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.045, 6, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff2a8 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(gem, ring);
    return group;
  }

  collectScoreItemAt(gridPosition) {
    const key = `${gridPosition.x},${gridPosition.z}`;
    const item = this.scoreItems.get(key);
    if (!item) return null;
    // delete 在移除 mesh 前完成，讓同一影格的競爭者只能有一名成功。
    this.scoreItems.delete(key);
    item.row.scoreItem = null;
    item.row.mesh.remove(item.mesh);
    return item;
  }

  ensureSpringPunchItem(referenceZ = 0, referenceX = 0) {
    if (!this.springPunchItemsEnabled || this.springPunchItems.size >= 8) return;
    const batchSize = Math.min(CONFIG.BOXES.BATCH_MAX, 8 - this.springPunchItems.size);
    if (batchSize < 2) return;
    if ([...this.springPunchItems.values()].some(item => item.z >= referenceZ + 1 && item.z <= referenceZ + 8)) return;
    const rows = [...this.activeRows.values()].filter((row) => (
      row.z >= Math.max(CONFIG.BOXES.SAFE_END_Z + 1, referenceZ + 2) && row.z <= Math.max(this.highestZGenerated, referenceZ + 8) && row.type === CONFIG.ROW_TYPES.GRASS && !row.dynamicHoleCluster && !row.scoreItem && !(row.springPunchItems?.length)
    ));
    for (const row of rows) {
      const candidates = [];
      for (let offset = 0; offset <= CONFIG.MAP_BOUNDS_X * 2; offset++) {
        const signedOffset = offset === 0 ? 0 : (offset % 2 ? Math.ceil(offset / 2) : -offset / 2);
        const x = Math.round(referenceX) + signedOffset;
        if (Math.abs(x) >= CONFIG.MAP_BOUNDS_X || !this.canPlacePartyItemAt({ x, z: row.z }) || row.trees.some((tree) => tree.gridX === x) || this.springPunchCellBlocked?.({ x, z: row.z })) continue;
        candidates.push(x);
        if (candidates.length === batchSize) break;
      }
      // 普通問號箱只作同列橫排；空間不足時換一列，絕不退化成縱向單箱。
      if (candidates.length < CONFIG.BOXES.BATCH_MIN) continue;
      row.springPunchItems = [];
      for (const x of candidates) {
        const key = `${x},${row.z}`;
        const mesh = this.createSpringPunchItemMesh();
        mesh.position.set(x * CONFIG.GRID_SIZE, 0.46, 0);
        row.mesh.add(mesh);
        const item = { id: `spring-${row.z}-${x}`, x, z: row.z, type: 'springPunch', mesh, row };
        row.springPunchItems.push(item);
        this.springPunchItems.set(key, item);
      }
      row.springPunchItem = row.springPunchItems[0] || null; // 舊呼叫端相容用代表項。
      return;
    }
  }

  createSpringPunchItemMesh() {
    return this.createPartyBoxMesh(0xffb72c);
  }

  collectSpringPunchItemAt(gridPosition) {
    const key = `${gridPosition.x},${gridPosition.z}`;
    const item = this.springPunchItems.get(key);
    if (!item) return null;
    this.springPunchItems.delete(key);
    item.row.springPunchItems = (item.row.springPunchItems || []).filter((candidate) => candidate !== item);
    item.row.springPunchItem = item.row.springPunchItems[0] || null;
    item.row.mesh.remove(item.mesh);
    item.mesh.traverse((node) => { node.geometry?.dispose(); node.material?.dispose(); });
    return item;
  }

  registerLeaderStrikeBlock(row) {
    if (!this.leaderStrikeItemsEnabled) return;
    this.leaderStrikeBlockIndex++;
    if (this.leaderStrikeItems.size) {
      this.leaderStrikePendingBlockIndex = null;
      return;
    }
    if (this.leaderStrikeBlockIndex % CONFIG.BOXES.ROW_SPACING !== 0) return;
    this.leaderStrikePendingBlockIndex = this.leaderStrikeBlockIndex;
    if (!row.dynamicHoleCluster) this.placePendingLeaderStrike(row);
  }

  placePendingLeaderStrike(row) {
    if (!this.leaderStrikeItemsEnabled || this.leaderStrikePendingBlockIndex === null) return false;
    if (this.leaderStrikeItems.size) {
      this.leaderStrikePendingBlockIndex = null;
      return false;
    }
    // 動態破洞區的 entry/floor/exit 都不是穩定落點；下一列一般草地才可放置。
    if (row.z <= CONFIG.BOXES.SAFE_END_Z || row.type !== CONFIG.ROW_TYPES.GRASS || row.dynamicHoleCluster || row.scoreItem) return false;
    const rawReferenceX = this.leaderStrikeReferenceX ? this.leaderStrikeReferenceX() : 0;
    const referenceX = Math.round(Number.isFinite(rawReferenceX) ? rawReferenceX : 0);
    const candidates = [...(row.reachableXs || [])]
      .sort((a, b) => Math.abs(a - referenceX) - Math.abs(b - referenceX) || a - b);
    for (const x of candidates) {
      const key = `${x},${row.z}`;
      if (row.trees.some((tree) => tree.gridX === x) || !this.canPlacePartyItemAt({ x, z: row.z }) || this.leaderStrikeCellBlocked?.({ x, z: row.z })) continue;
      const mesh = this.createLeaderStrikeItemMesh();
      mesh.position.set(x * CONFIG.GRID_SIZE, 0.48, 0);
      row.mesh.add(mesh);
      const item = {
        id: `leader-strike-${this.leaderStrikePendingBlockIndex}-${row.z}-${x}`,
        x,
        z: row.z,
        type: 'leaderStrike',
        blockIndex: this.leaderStrikePendingBlockIndex,
        mesh,
        row
      };
      row.leaderStrikeItem = item;
      row.leaderStrikeItems = [...(row.leaderStrikeItems || []), item];
      this.leaderStrikeItems.set(key, item);
      this.leaderStrikeSpawnHistory.push({ blockIndex: item.blockIndex, x, z: row.z, dynamicHole: false });
      this.leaderStrikePendingBlockIndex = null;
      return true;
    }
    return false;
  }

  createLeaderStrikeItemMesh() {
    return this.createPartyBoxMesh(0x53c8ff);
  }

  createPartyBoxMesh(color) {
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(.62, .62, .62);
    const box = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: 0x766bff, emissive: 0x192952, transparent: true, opacity: .92 }));
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xa3f2ff, transparent: true, opacity: .8 }));
    group.add(box, edge);
    for (let side = 0; side < 4; side++) {
      const face = new THREE.Group();
      const points = [[-.12,.10],[-.09,.18],[.01,.20],[.12,.15],[.11,.05],[.01,-.01],[0,-.08]].map(([x,y]) => new THREE.Vector3(x,y,.326));
      const mark = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 18, .033, 6, false), new THREE.MeshBasicMaterial({ color: 0xfff6bc }));
      const dot = new THREE.Mesh(new THREE.BoxGeometry(.065,.065,.018), new THREE.MeshBasicMaterial({ color: 0xffffff })); dot.position.set(0,-.19,.33);
      face.add(mark, dot); face.rotation.y = side * Math.PI / 2; group.add(face);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.44,.025,6,20), new THREE.MeshBasicMaterial({ color: 0x9beaff, transparent: true, opacity: .65 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = -.38; group.add(ring);
    return group;
  }

  collectLeaderStrikeItemAt(gridPosition) {
    const key = `${gridPosition.x},${gridPosition.z}`;
    const item = this.leaderStrikeItems.get(key);
    if (!item) return null;
    this.removeLeaderStrikeItem(item);
    return item;
  }

  hasPartyItemAt(gridPosition) {
    const { x, z } = this.normalizeGridPosition(gridPosition);
    const key = `${x},${z}`;
    return this.springPunchItems.has(key) || this.leaderStrikeItems.has(key);
  }

  hasPartyItemOnAdjacentRow(z) {
    return [...this.springPunchItems.values(), ...this.leaderStrikeItems.values()]
      .some((item) => Math.abs(item.z - z) > 0 && Math.abs(item.z - z) < CONFIG.BOXES.ROW_SPACING);
  }

  canPlacePartyItemAt(gridPosition) {
    const { x, z } = this.normalizeGridPosition(gridPosition);
    return z > CONFIG.BOXES.SAFE_END_Z && !this.hasPartyItemAt({ x, z }) && !this.hasPartyItemOnAdjacentRow(z);
  }

  removeLeaderStrikeItem(item) {
    if (!item) return;
    const key = `${item.x},${item.z}`;
    this.leaderStrikeItems.delete(key);
    item.row.leaderStrikeItems = (item.row.leaderStrikeItems || []).filter((candidate) => candidate !== item);
    item.row.leaderStrikeItem = item.row.leaderStrikeItems[0] || null;
    item.row.mesh.remove(item.mesh);
    item.mesh.traverse((node) => { node.geometry?.dispose(); node.material?.dispose(); });
  }

  buildGrassRow(rowData, rowGroup, isInitialSafe) {
    const mat = (Math.abs(rowData.z) % 2 === 0) ? this.grassMat1 : this.grassMat2;
    const lane = new THREE.Mesh(this.laneGeo, mat);
    lane.receiveShadow = true;
    rowGroup.add(lane);

    // 1. 每一列草地 100% 保證至少有 3 ~ 4 個絕對無樹木的開放通行缺口 (根除死路)
    const playableRange = CONFIG.MAP_BOUNDS_X - 1; // -5 ~ +5
    const guaranteedOpenCount = rowData.isDynamicHoleFloor ? 4 : Math.floor(this.random() * 2) + 3;
    const openXs = new Set();

    while (openXs.size < guaranteedOpenCount) {
      const randomX = Math.floor(this.random() * (playableRange * 2 + 1)) - playableRange;
      openXs.add(randomX);
    }

    // 2. 生成樹木，絕對開口點 (openXs) 100% 禁放樹木
    for (let x = -CONFIG.MAP_BOUNDS_X - 2; x <= CONFIG.MAP_BOUNDS_X + 2; x++) {
      const isEdge = Math.abs(x) >= CONFIG.MAP_BOUNDS_X;

      let placeTree = false;
      if (isEdge) {
        placeTree = true;
      } else if (!isInitialSafe && !openXs.has(x)) {
        placeTree = this.random() < 0.28;
      }

      if (isInitialSafe && rowData.z >= -3 && rowData.z <= 3 && Math.abs(x) <= 4) {
        placeTree = false;
      }

      if (placeTree && !this.destroyedTreeCells.has(`${x},${rowData.z}`)) {
        const treeType = Math.floor(this.random() * 3);
        const treeMesh = createTreeMesh(treeType);
        treeMesh.position.set(x * CONFIG.GRID_SIZE, 0.2, 0);
        rowGroup.add(treeMesh);

        rowData.trees.push({ gridX: x, mesh: treeMesh });
      }
    }
  }

  buildRoadRow(rowData, rowGroup) {
    const lane = new THREE.Mesh(this.laneGeo, this.roadMat);
    lane.receiveShadow = true;
    rowGroup.add(lane);

    const lineGeo = new THREE.BoxGeometry(0.6, 0.02, 0.1);
    const lineMat = new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.ROAD_LINE });
    for (let x = -CONFIG.MAP_BOUNDS_X; x <= CONFIG.MAP_BOUNDS_X; x += 3) {
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(x * CONFIG.GRID_SIZE, 0.21, 0);
      rowGroup.add(line);
    }

    // 非河道列，重置連續河道反向追蹤
    this.lastRiverDirection = undefined;
    this.lastRiverSpeed = undefined;

    // 📈 漸進式難度權重 (延伸至 Z = 220 步，使 Z = 70 步依然保持大車距極易通過)
    const zProgress = Math.min(1.0, Math.max(0, (rowData.z || 0) / 220.0));

    // 車速：開局極緩 (2.0 ~ 3.2)，Z = 70 步保持平緩 (3.0 ~ 4.2)，極高分 (4.2 ~ 6.5)
    const minSpeed = THREE.MathUtils.lerp(CONFIG.MAP.ROAD_SPEED_MIN, CONFIG.MAP.ROAD_SPEED_MAX, zProgress);
    const speedRange = THREE.MathUtils.lerp(CONFIG.MAP.ROAD_SPEED_RANGE_MIN, CONFIG.MAP.ROAD_SPEED_RANGE_MAX, zProgress);
    rowData.speed = minSpeed + this.random() * speedRange;

    // 鄰接河道與車道防同步卡死演算法 (River-Road Anti-Locking Algorithm)
    const adjRowRoad = this.activeRows.get(rowData.z - 1) || this.activeRows.get(rowData.z + 1);
    if (adjRowRoad && adjRowRoad.type === CONFIG.ROW_TYPES.RIVER) {
      if (this.random() < 0.8) {
        rowData.direction = -adjRowRoad.direction;
      }
      if (rowData.direction === adjRowRoad.direction) {
        if (Math.abs(rowData.speed - adjRowRoad.speed) < 2.2) {
          rowData.speed = adjRowRoad.speed + 2.2;
        }
      }
    }

    // 車輛間隔：Z = 70 步保持 6.5 ~ 9.5 格大空檔，極高分最少保持 4.5 格 (永遠有安全空間過街)
    const isTruck = this.random() < (0.15 + zProgress * 0.2);
    const vehicleWidth = isTruck ? 2.3 : 1.8;

    const minGapGrids = THREE.MathUtils.lerp(7.5, 4.5, zProgress);
    const gapRangeGrids = THREE.MathUtils.lerp(4.0, 2.5, zProgress);
    const spacing = vehicleWidth + CONFIG.GRID_SIZE * (minGapGrids + this.random() * gapRangeGrids);

    const totalSpan = (CONFIG.MAP_BOUNDS_X * 2 + 12) * CONFIG.GRID_SIZE;
    const count = Math.floor(totalSpan / spacing);

    const colors = CONFIG.COLORS.CAR_COLORS;

    for (let i = 0; i < count; i++) {
      const colorHex = colors[Math.floor(this.random() * colors.length)];
      const mesh = isTruck ? createTruckMesh() : createCarMesh(colorHex);

      const startX = -totalSpan / 2 + i * spacing;
      mesh.position.set(startX, 0.2, 0);

      // 車頭方向對齊 X 軸 (行進方向 +X 或 -X)
      if (rowData.direction === 1) {
        mesh.rotation.y = Math.PI / 2;
      } else {
        mesh.rotation.y = -Math.PI / 2;
      }

      rowGroup.add(mesh);
      rowData.vehicles.push({ mesh, width: vehicleWidth });
    }
  }

  upgradeRiverRowLogs(targetRowData) {
    if (!targetRowData || targetRowData.type !== CONFIG.ROW_TYPES.RIVER || targetRowData.isPureLilyPadRow) {
      return;
    }

    if (targetRowData.logs) {
      targetRowData.logs.forEach((log) => {
        if (log.mesh) {
          targetRowData.mesh.remove(log.mesh);
        }
      });
    }
    targetRowData.logs = [];

    const logLength = Math.floor(this.random() * 2) + 3; // 3 ~ 4 格大浮木
    const minLogGap = 1.0 + this.random() * 0.3; // 1.0 ~ 1.3 格高密度間距
    const logSpan = logLength * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE * minLogGap;
    const totalSpan = (CONFIG.MAP_BOUNDS_X * 2 + 12) * CONFIG.GRID_SIZE;
    const count = Math.floor(totalSpan / logSpan);

    for (let i = 0; i < count; i++) {
      const mesh = createLogMesh(logLength);
      const startX = -totalSpan / 2 + i * logSpan;
      mesh.position.set(startX, 0.1, 0);
      mesh.rotation.y = Math.PI / 2;

      targetRowData.mesh.add(mesh);
      targetRowData.logs.push({ mesh, length: logLength });
    }
    targetRowData.isUpgraded = true;
    // A following lily row upgrades these moving logs after their first carrier
    // frontier was recorded. Refresh that evidence against the final carriers.
    if (targetRowData.carrierInputFrontier !== undefined) {
      const incomingFrontier = targetRowData.carrierInputFrontier;
      const entryXs = new Set(targetRowData.reachabilityEntryXs || []);
      let recalculated = this.getCarrierFrontierForRiver(
        targetRowData,
        entryXs,
        incomingFrontier
      );
      if (!recalculated.length) {
        const repairEntries = incomingFrontier?.length
          ? new Set(incomingFrontier.map((state) => state.x))
          : entryXs;
        this.repairGeneratedRowEntrance(targetRowData, repairEntries);
        recalculated = this.getCarrierFrontierForRiver(targetRowData, entryXs, incomingFrontier);
      }
      if (!recalculated.length) throw new Error(`Map reachability repair failed after river upgrade Z=${targetRowData.z}`);
      targetRowData.carrierFrontier = recalculated;
      targetRowData.reachableXs = [...new Set(recalculated.map((state) => state.x))].sort((a, b) => a - b);
      this.reachableXs = new Set(targetRowData.reachableXs);
      this.carrierFrontier = recalculated;
    }
  }

  buildRiverRow(rowData, rowGroup) {
    const lane = new THREE.Mesh(this.laneGeo, this.riverMat);
    lane.position.y = -0.05;
    rowGroup.add(lane);

    // 1. 檢查前一行 z-1 是否為綠色睡蓮踏板河道 (adjRowPrevIsLilyPad)
    const prevRow = this.activeRows.get(rowData.z - 1);
    const adjRowPrevIsLilyPad = Boolean(
      prevRow &&
      prevRow.type === CONFIG.ROW_TYPES.RIVER &&
      (prevRow.isLilyPadRow || prevRow.isPureLilyPadRow)
    );

    // 2 & 3. 判定當前列 z 是否為單列純靜態綠色平台踏板河道 (No Consecutive Lily-Pad Rows Constraint)
    let isPureLilyPadRow = false;

    if (adjRowPrevIsLilyPad) {
      // 若 z-1 已經是綠色睡蓮踏板河道 (adjRowPrevIsLilyPad === true)：100% 強制為【動態浮木河道】，絕不允許連續兩列都是綠色平台！
      isPureLilyPadRow = false;
    } else {
      // 若 z-1 不是睡蓮河道：當前列有 35% 機率為單列【純靜態綠色平台踏板河道】
      isPureLilyPadRow = this.random() < 0.35;
    }

    rowData.isLilyPadRow = isPureLilyPadRow;
    rowData.isPureLilyPadRow = isPureLilyPadRow;

    if (isPureLilyPadRow) {
      // 生成 3 ~ 5 個靜態綠色睡蓮平台 (createLilyPadMesh)，定點擺放於 -4 ~ +4 步道範圍內
      const padCount = Math.floor(this.random() * 3) + 3; // 3 ~ 5 個
      const playableRange = 4; // -4 ~ +4 步道範圍
      const usedXs = new Set();

      while (usedXs.size < padCount) {
        const gridX = Math.floor(this.random() * (playableRange * 2 + 1)) - playableRange;
        usedXs.add(gridX);
      }

      for (const gridX of usedXs) {
        const padMesh = createLilyPadMesh();
        padMesh.position.set(gridX * CONFIG.GRID_SIZE, 0.1, 0);
        rowGroup.add(padMesh);

        rowData.logs.push({
          mesh: padMesh,
          length: 1,
          isStationary: true,
          speed: 0
        });
      }

      // 同時自動將前一行 (z-1) 的動態浮木升級為 3~4 格大浮木與 1.0~1.3 格高密度間距
      if (prevRow && prevRow.type === CONFIG.ROW_TYPES.RIVER && !prevRow.isPureLilyPadRow) {
        this.upgradeRiverRowLogs(prevRow);
      }
    } else {
      // 當前列為【動態浮木河道】 (isPureLilyPadRow = false)
      this.lastLilyPadGridXs = null;

      // 📈 漸進式難度權重
      const zProgress = Math.min(1.0, Math.max(0, (rowData.z || 0) / 220.0));

      // 🪵 連續河道交錯演算法：相鄰河道 100% 強制反向，並保持 1.2 單位/秒以上速差
      if (this.lastRiverDirection !== undefined) {
        rowData.direction = -this.lastRiverDirection;
      }
      this.lastRiverDirection = rowData.direction;

      let speed = THREE.MathUtils.lerp(CONFIG.MAP.RIVER_SPEED_MIN, CONFIG.MAP.RIVER_SPEED_MAX, zProgress) + this.random() * CONFIG.MAP.RIVER_SPEED_JITTER;
      if (this.lastRiverSpeed && Math.abs(speed - this.lastRiverSpeed) < 1.0) {
        speed += 1.2;
      }
      rowData.speed = speed;

      // 鄰接河道與車道防同步卡死演算法 (River-Road Anti-Locking Algorithm)
      const adjRowRoad = this.activeRows.get(rowData.z - 1) || this.activeRows.get(rowData.z + 1);
      if (adjRowRoad && adjRowRoad.type === CONFIG.ROW_TYPES.ROAD) {
        if (this.random() < 0.8) {
          rowData.direction = -adjRowRoad.direction;
        }
        if (rowData.direction === adjRowRoad.direction) {
          if (Math.abs(rowData.speed - adjRowRoad.speed) < 2.2) {
            rowData.speed = adjRowRoad.speed + 2.2;
          }
        }
      }

      this.lastRiverSpeed = rowData.speed;

      // 檢查前一行或下一行是否為睡蓮列
      const nextRow = this.activeRows.get(rowData.z + 1);
      const isAdjacentToLilyPad = adjRowPrevIsLilyPad || Boolean(nextRow && nextRow.type === CONFIG.ROW_TYPES.RIVER && (nextRow.isLilyPadRow || nextRow.isPureLilyPadRow));

      let logLength, minLogGap, gapRandomRange;
      if (isAdjacentToLilyPad) {
        // 相鄰睡蓮列升級為 3~4 格大浮木與 1.0~1.3 格高密度間距
        logLength = Math.floor(this.random() * 2) + 3; // 3 ~ 4 格
        minLogGap = 1.0 + this.random() * 0.3; // 1.0 ~ 1.3 格
        gapRandomRange = 0;
      } else {
        logLength = zProgress < 0.5 ? (Math.floor(this.random() * 2) + 3) : (Math.floor(this.random() * 2) + 2);
        minLogGap = THREE.MathUtils.lerp(1.2, 2.2, zProgress);
        gapRandomRange = 1.2;
      }

      const logSpan = logLength * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE * (minLogGap + this.random() * gapRandomRange);
      const totalSpan = (CONFIG.MAP_BOUNDS_X * 2 + 12) * CONFIG.GRID_SIZE;
      const count = Math.floor(totalSpan / logSpan);

      for (let i = 0; i < count; i++) {
        const mesh = createLogMesh(logLength);
        const startX = -totalSpan / 2 + i * logSpan;
        mesh.position.set(startX, 0.1, 0);

        // 浮木長軸橫向平躺擺放於 X 軸河道
        mesh.rotation.y = Math.PI / 2;

        rowGroup.add(mesh);
        rowData.logs.push({ mesh, length: logLength });
      }
    }
  }

  buildRailroadRow(rowData, rowGroup) {
    const gravel = new THREE.Mesh(this.laneGeo, this.railroadGravelMat);
    gravel.receiveShadow = true;
    rowGroup.add(gravel);

    const rail1 = new THREE.Mesh(this.railGeo, this.railMat);
    rail1.position.set(0, 0.22, -0.28);
    const rail2 = new THREE.Mesh(this.railGeo, this.railMat);
    rail2.position.set(0, 0.22, 0.28);
    rowGroup.add(rail1, rail2);

    const laneWidth = (CONFIG.MAP_BOUNDS_X * 2 + 10) * CONFIG.GRID_SIZE;
    for (let x = -laneWidth / 2; x <= laneWidth / 2; x += 0.7) {
      const tie = new THREE.Mesh(this.tieGeo, this.tieMat);
      tie.position.set(x, 0.2, 0);
      rowGroup.add(tie);
    }

    // 🚥 鐵道號誌燈柱：擺放於玩家初始直線前進視覺顯眼處 (x = -2.2 與 x = +2.2)，正面 180 度迎面玩家
    const signalLeft = createSignalMesh();
    signalLeft.position.set(-2.2 * CONFIG.GRID_SIZE, 0.2, 0);
    signalLeft.rotation.y = Math.PI;

    const signalRight = createSignalMesh();
    signalRight.position.set(2.2 * CONFIG.GRID_SIZE, 0.2, 0);
    signalRight.rotation.y = Math.PI;

    rowGroup.add(signalLeft, signalRight);
    rowData.signals = [signalLeft, signalRight];
  }

  animateObstacles(deltaTime) {
    const safeDelta = Number.isFinite(deltaTime) && deltaTime > 0 ? Math.min(deltaTime, 0.1) : 0.016;
    this.partyItemRegenTimer = Math.max(0, this.partyItemRegenTimer - safeDelta);
    const boundX = (CONFIG.MAP_BOUNDS_X + 5) * CONFIG.GRID_SIZE;

    this.updateDynamicHoles(safeDelta);

    for (const [z, row] of this.activeRows.entries()) {
      if (row.scoreItem?.mesh) {
        row.scoreItem.mesh.rotation.y += safeDelta * 3.5;
        row.scoreItem.mesh.position.y = 0.5 + Math.sin(performance.now() * 0.004 + z) * 0.08;
      }
      (row.springPunchItems || (row.springPunchItem ? [row.springPunchItem] : [])).forEach((item, index) => {
        item.mesh.rotation.y += safeDelta * 4;
        item.mesh.position.y = 0.48 + Math.sin(performance.now() * 0.005 + z + index) * 0.07;
      });
      (row.leaderStrikeItems || (row.leaderStrikeItem ? [row.leaderStrikeItem] : [])).forEach((item, index) => {
        item.mesh.rotation.y -= safeDelta * 3.2;
        item.mesh.position.y = 0.48 + Math.sin(performance.now() * 0.0045 + z + index) * 0.08;
      });
      if (row.type === CONFIG.ROW_TYPES.ROAD && row.vehicles) {
        row.vehicles.forEach((veh) => {
          veh.mesh.position.x += row.direction * row.speed * safeDelta;
          if (row.direction === 1 && veh.mesh.position.x > boundX) {
            veh.mesh.position.x = -boundX;
          } else if (row.direction === -1 && veh.mesh.position.x < -boundX) {
            veh.mesh.position.x = boundX;
          }
        });
      }

      if (row.type === CONFIG.ROW_TYPES.RIVER && row.logs) {
        row.logs.forEach((log) => {
          if (log.isStationary) return;
          log.mesh.position.x += row.direction * row.speed * safeDelta;
          if (row.direction === 1 && log.mesh.position.x > boundX) {
            log.mesh.position.x = -boundX;
          } else if (row.direction === -1 && log.mesh.position.x < -boundX) {
            log.mesh.position.x = boundX;
          }
        });
      }

      if (row.type === CONFIG.ROW_TYPES.RAILROAD) {
        if (row.trainState === 'IDLE') {
          row.idleTimer -= safeDelta;
          if (row.signals) {
            row.signals.forEach((sig) => {
              sig.leftLightMat.color.setHex(0x440000);
              sig.rightLightMat.color.setHex(0x440000);
            });
          }
          if (row.idleTimer <= 0) {
            row.trainState = 'SIGNAL_FLASHING';
            row.warningTimer = CONFIG.MAP.TRAIN_WARNING_SECONDS;
            row.flashTick = 0;
          }
        } else if (row.trainState === 'SIGNAL_FLASHING') {
          row.warningTimer -= safeDelta;
          row.flashTick = (row.flashTick || 0) + safeDelta * 10.0;
          const isLeftOn = Math.floor(row.flashTick) % 2 === 0;

          if (row.signals) {
            row.signals.forEach((sig) => {
              sig.leftLightMat.color.setHex(isLeftOn ? 0xff0000 : 0x440000);
              sig.rightLightMat.color.setHex(isLeftOn ? 0x440000 : 0xff0000);
            });
          }

          if (row.warningTimer <= 0) {
            row.trainState = 'TRAIN_PASSING';
            const trainMesh = createTrainMesh();
            const startX = row.direction === 1 ? -boundX * 1.5 : boundX * 1.5;
            trainMesh.position.set(startX, 0.2, 0);

            // 火車頭方向對齊 X 軸 (行進方向 +X 或 -X)
            if (row.direction === 1) {
              trainMesh.rotation.y = Math.PI / 2;
            } else {
              trainMesh.rotation.y = -Math.PI / 2;
            }

            row.mesh.add(trainMesh);
            row.train = trainMesh;
          }
        } else if (row.trainState === 'TRAIN_PASSING' && row.train) {
          row.flashTick = (row.flashTick || 0) + safeDelta * 12.0;
          const isLeftOn = Math.floor(row.flashTick) % 2 === 0;

          if (row.signals) {
            row.signals.forEach((sig) => {
              sig.leftLightMat.color.setHex(isLeftOn ? 0xff0000 : 0x440000);
              sig.rightLightMat.color.setHex(isLeftOn ? 0x440000 : 0xff0000);
            });
          }

          const trainSpeed = CONFIG.MAP.TRAIN_SPEED;
          row.train.position.x += row.direction * trainSpeed * safeDelta;
          if (Math.abs(row.train.position.x) > boundX * 2.0) {
            row.mesh.remove(row.train);
            row.train = null;
            row.trainState = 'IDLE';
            row.idleTimer = this.random() * 5 + 4.0;
            if (row.signals) {
              row.signals.forEach((sig) => {
                sig.leftLightMat.color.setHex(0x440000);
                sig.rightLightMat.color.setHex(0x440000);
              });
            }
          }
        }
      }
    }
  }

  setDynamicHolesEnabled(enabled) {
    this.dynamicHolesEnabled = Boolean(enabled);
    if (!this.dynamicHolesEnabled) this.clearDynamicHoles();
    this.dynamicHoleWaveCooldown = CONFIG.HOLES.WAVE_COOLDOWN;
  }

  getDynamicHoleState(gridPosition) {
    const { x, z } = this.normalizeGridPosition(gridPosition);
    return this.dynamicHoleCells.get(`${x},${z}`)?.state || null;
  }

  // 玩家可主動嘗試跳入破洞；BOT 則以落地 ETA 預先把即將塌陷的格子視為不可走。
  isDynamicHoleUnsafe(gridPosition, landingPrediction = 0) {
    const { x, z } = this.normalizeGridPosition(gridPosition);
    const hole = this.dynamicHoleCells.get(`${x},${z}`);
    if (!hole) return false;
    if (hole.state === 'HOLE' || hole.state === 'REPAIR_WARNING') return true;
    return hole.state === 'WARNING'
      && hole.timer <= Math.max(0, landingPrediction) + this.dynamicHoleConfig.warningSafetyBuffer;
  }

  isDynamicHoleActiveAt(gridPosition) {
    const state = this.getDynamicHoleState(gridPosition);
    return state === 'HOLE' || state === 'REPAIR_WARNING';
  }

  isSafeCheckpointRow(gridPosition) {
    const { z } = this.normalizeGridPosition(gridPosition);
    const row = this.activeRows.get(z);
    // 動態破洞區的入口只提供通行，不覆寫上一個安全區 checkpoint；
    // 角色必須完整通過洞區，抵達 exit 才能取得新的重生點。
    return row?.type === CONFIG.ROW_TYPES.GRASS
      && !row.isDynamicHoleFloor
      && row.dynamicHoleRole !== 'entry';
  }

  getDynamicHoleRepairTime(gridPosition) {
    const { x, z } = this.normalizeGridPosition(gridPosition);
    const hole = this.dynamicHoleCells.get(`${x},${z}`);
    return hole?.state === 'REPAIR_WARNING' ? Math.max(0, hole.timer) : null;
  }

  normalizeGridPosition(gridPosition) {
    return {
      x: gridPosition?.x ?? gridPosition?.gridX,
      z: gridPosition?.z ?? gridPosition?.gridZ
    };
  }

  clearDynamicHoles() {
    for (const hole of this.dynamicHoleCells.values()) {
      this.disposeDynamicHoleVisual(hole);
    }
    this.dynamicHoleCells.clear();
  }

  disposeDynamicHoleVisual(hole) {
    hole.row?.mesh?.remove(hole.visual);
    const geometries = new Set();
    const materials = new Set();
    hole.visual?.traverse((child) => {
      if (child.geometry) geometries.add(child.geometry);
      if (child.material) materials.add(child.material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }

  updateDynamicHoles(deltaTime) {
    if (!this.dynamicHolesEnabled) return;

    for (const hole of [...this.dynamicHoleCells.values()]) {
      hole.timer -= deltaTime;
      hole.visualElapsed = (hole.visualElapsed || 0) + deltaTime;
      if (hole.state === 'WARNING' && hole.timer <= 0) {
        this.setDynamicHoleState(hole, 'HOLE', this.dynamicHoleConfig.holeDuration);
      } else if (hole.state === 'HOLE' && hole.timer <= 0) {
        this.setDynamicHoleState(hole, 'REPAIR_WARNING', this.dynamicHoleConfig.repairDuration);
      } else if (hole.state === 'REPAIR_WARNING' && hole.timer <= 0) {
        this.disposeDynamicHoleVisual(hole);
        this.dynamicHoleCells.delete(hole.key);
      } else {
        this.animateDynamicHoleVisual(hole);
      }
    }

    if (this.dynamicHoleCells.size > 0) return;
    this.dynamicHoleWaveCooldown -= deltaTime;
    if (this.dynamicHoleWaveCooldown <= 0) this.beginDynamicHoleWave();
  }

  beginDynamicHoleWave() {
    const placements = this.findDynamicHolePlacements();
    this.dynamicHoleWaveCooldown = this.dynamicHoleConfig.waveCooldown;
    if (!placements.length) return;
    this.dynamicHoleWaveId++;
    placements.forEach(({ row, x }) => this.createDynamicHole(row, x));
  }

  findDynamicHolePlacements() {
    // 第一個危險地板可在玩家前一格，讓 playerZ=入口附近時仍能選到完整 floor pair。
    const minZ = this.dynamicHolePlayerZ + 1;
    const maxZ = this.dynamicHolePlayerZ + 8;
    const rows = [...this.activeRows.values()]
      .filter((row) => row.isDynamicHoleFloor
        && row.z >= minZ
        && row.z <= maxZ
        && !row.scoreItem)
      .sort((a, b) => a.z - b.z);

    // 僅接受同一個明確 cluster 的 floor pair，避免以列號相鄰推測入口／出口。
    for (let index = 0; index < rows.length - 1; index++) {
      const first = rows[index];
      const second = rows[index + 1];
      if (!first.dynamicHoleCluster
        || first.dynamicHoleCluster !== second.dynamicHoleCluster
        || first.dynamicHoleRole !== 'floor' || second.dynamicHoleRole !== 'floor') continue;
      const firstXs = this.getDynamicHoleCandidateXs(first);
      const secondXs = this.getDynamicHoleCandidateXs(second);
      for (const firstX of firstXs) {
        for (const secondX of secondXs) {
          if (Math.abs(firstX - secondX) < 2) continue;
          const placements = [{ row: first, x: firstX }, { row: second, x: secondX }];
          if (this.hasDynamicHolePath(first, second, placements)) return placements;
        }
      }
    }

    // 結構不完整時直接跳過本波；不將一般安全草地降級為危險地板。
    return [];
  }

  getDynamicHoleCandidateXs(row) {
    const openXs = [];
    for (let x = -CONFIG.MAP_BOUNDS_X + 1; x <= CONFIG.MAP_BOUNDS_X - 1; x++) {
      if (!row.trees.some((tree) => tree.gridX === x)
        && !this.dynamicHoleCellBlocked?.({ x, z: row.z })) openXs.push(x);
    }
    // 草地原本保證 3~4 個開口；保留 3 個才允許抽成洞。
    if (openXs.length < 4) return [];
    const offset = (this.dynamicHoleWaveId + row.z * 3) % openXs.length;
    return openXs.map((_, index) => openXs[(index + offset + openXs.length) % openXs.length]);
  }

  hasDynamicHolePath(firstRow, secondRow, placements) {
    const cluster = firstRow.dynamicHoleCluster;
    if (!cluster || cluster !== secondRow.dynamicHoleCluster
      || cluster.floors.length !== 2
      || cluster.floors[0] !== firstRow || cluster.floors[1] !== secondRow) return false;

    const { entry: entryRow, exit: exitRow } = cluster;
    if (!entryRow || !exitRow
      || this.activeRows.get(entryRow.z) !== entryRow || this.activeRows.get(exitRow.z) !== exitRow
      || entryRow.type !== CONFIG.ROW_TYPES.GRASS || exitRow.type !== CONFIG.ROW_TYPES.GRASS
      || entryRow.isDynamicHoleFloor || exitRow.isDynamicHoleFloor
      || entryRow.dynamicHoleCluster !== cluster || exitRow.dynamicHoleCluster !== cluster
      || entryRow.dynamicHoleRole !== 'entry' || exitRow.dynamicHoleRole !== 'exit') return false;

    const blocked = new Set(placements.map(({ x, row }) => `${x},${row.z}`));
    const rowsByZ = new Map([
      [entryRow.z, entryRow],
      [firstRow.z, firstRow],
      [secondRow.z, secondRow],
      [exitRow.z, exitRow]
    ]);
    const isOpen = (x, z) => Math.abs(x) < CONFIG.MAP_BOUNDS_X
      && !blocked.has(`${x},${z}`)
      && !rowsByZ.get(z)?.trees.some((tree) => tree.gridX === x);
    const queue = [];
    const visited = new Set();
    for (let x = -CONFIG.MAP_BOUNDS_X + 1; x < CONFIG.MAP_BOUNDS_X; x++) {
      if (isOpen(x, entryRow.z)) {
        queue.push({ x, z: entryRow.z });
        visited.add(`${x},${entryRow.z}`);
      }
    }
    while (queue.length) {
      const current = queue.shift();
      if (current.z === exitRow.z) return true;
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, 1]]) {
        const next = { x: current.x + dx, z: current.z + dz };
        const key = `${next.x},${next.z}`;
        if (next.z > exitRow.z || visited.has(key) || !isOpen(next.x, next.z)) continue;
        visited.add(key);
        queue.push(next);
      }
    }
    return false;
  }

  createDynamicHole(row, x) {
    const visual = this.createDynamicHoleVisual();
    visual.position.set(x * CONFIG.GRID_SIZE, 0.215, 0);
    row.mesh.add(visual);
    const hole = {
      key: `${x},${row.z}`,
      row,
      x,
      z: row.z,
      visual,
      state: 'WARNING',
      timer: this.dynamicHoleConfig.warningDuration,
      visualElapsed: 0
    };
    this.dynamicHoleCells.set(hole.key, hole);
    this.applyDynamicHoleVisual(hole);
  }

  createDynamicHoleVisual() {
    const group = new THREE.Group();
    const size = CONFIG.GRID_SIZE * 0.78;
    const warning = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ color: 0xff283d, transparent: true, opacity: 0.58, depthWrite: false })
    );
    warning.rotation.x = -Math.PI / 2;
    const warningRing = new THREE.Mesh(
      new THREE.RingGeometry(size * 0.37, size * 0.49, 12),
      new THREE.MeshBasicMaterial({ color: 0xff5264, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    warningRing.rotation.x = -Math.PI / 2;
    warningRing.position.y = 0.028;
    const fireball = new THREE.Group();
    const fireCore = new THREE.Mesh(new THREE.SphereGeometry(.19, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 1 }));
    const fireTail = new THREE.Mesh(new THREE.ConeGeometry(.16, .62, 8), new THREE.MeshBasicMaterial({ color: 0xff5c31, transparent: true, opacity: .9 }));
    fireTail.position.y = .35;
    fireball.add(fireCore, fireTail);
    for (let index = 0; index < 4; index++) {
      const ember = new THREE.Mesh(new THREE.SphereGeometry(.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffa23d, transparent: true, opacity: .8 }));
      ember.position.set((index - 1.5) * .07, .55 + index * .12, 0);
      fireball.add(ember);
    }
    fireball.position.y = CONFIG.HOLES.FIREBALL_HEIGHT;
    const crackA = new THREE.Mesh(
      new THREE.BoxGeometry(size * 0.08, 0.025, size * 0.78),
      new THREE.MeshBasicMaterial({ color: 0x6d2500 })
    );
    crackA.position.y = 0.02;
    crackA.rotation.y = 0.58;
    const crackB = crackA.clone();
    crackB.scale.z = 0.58;
    crackB.rotation.y = -0.72;
    const hole = new THREE.Mesh(
      new THREE.BoxGeometry(size, 0.16, size),
      new THREE.MeshLambertMaterial({ color: 0x101018, emissive: 0x030306 })
    );
    // lane 頂面在 world Y=0；黑洞面與碎裂邊緣刻意高於它，避免被草地方塊遮住。
    hole.position.y = -0.08;
    const brokenEdge = new THREE.Group();
    const edgeMaterial = new THREE.MeshLambertMaterial({ color: 0x6d3416, emissive: 0x260d02 });
    const edgeLength = size * 0.9;
    [[0, 0.125, -size * 0.48, edgeLength, 0.07], [0, 0.125, size * 0.48, edgeLength, 0.07],
      [-size * 0.48, 0.125, 0, 0.07, edgeLength], [size * 0.48, 0.125, 0, 0.07, edgeLength]]
      .forEach(([x, y, z, width, depth]) => {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), edgeMaterial);
        edge.position.set(x, y, z);
        edge.rotation.y = (x === 0 ? 0.08 : -0.08);
        brokenEdge.add(edge);
      });
    const repair = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ color: 0x38f1dc, transparent: true, opacity: 0.55, depthWrite: false })
    );
    repair.rotation.x = -Math.PI / 2;
    const fragments = new THREE.Group();
    for (let index = 0; index < 6; index++) {
      const fragment = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.13), edgeMaterial.clone());
      const angle = (Math.PI * 2 * index) / 6;
      fragment.position.set(Math.cos(angle) * size * 0.42, 0.12, Math.sin(angle) * size * 0.42);
      fragment.rotation.y = angle;
      fragments.add(fragment);
    }
    const impact = new THREE.Group();
    const impactFlash = new THREE.Mesh(new THREE.SphereGeometry(.32, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9ac, transparent: true, opacity: 1 }));
    const impactRing = new THREE.Mesh(new THREE.RingGeometry(.12, .42, 16), new THREE.MeshBasicMaterial({ color: 0xff7b45, transparent: true, opacity: .9, side: THREE.DoubleSide }));
    impactRing.rotation.x = -Math.PI / 2;
    impact.add(impactFlash, impactRing);
    for (let index = 0; index < 8; index++) {
      const ember = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .07), new THREE.MeshBasicMaterial({ color: 0xffb454, transparent: true, opacity: .9 }));
      const angle = index * Math.PI * 2 / 8;
      ember.userData.velocity = new THREE.Vector3(Math.cos(angle) * 1.4, .8 + (index % 3) * .25, Math.sin(angle) * 1.4);
      impact.add(ember);
    }
    group.add(warning, warningRing, fireball, crackA, crackB, hole, brokenEdge, repair, fragments, impact);
    group.userData = { warning, warningRing, fireball, crackA, crackB, hole, brokenEdge, repair, fragments, impact, impactFlash, impactRing };
    return group;
  }

  setDynamicHoleState(hole, state, duration) {
    hole.state = state;
    hole.timer = duration;
    hole.visualElapsed = 0;
    this.applyDynamicHoleVisual(hole);
  }

  applyDynamicHoleVisual(hole) {
    const { warning, warningRing, fireball, crackA, crackB, hole: holeMesh, brokenEdge, repair, fragments, impact } = hole.visual.userData;
    warning.visible = hole.state === 'WARNING';
    warningRing.visible = hole.state === 'WARNING';
    fireball.visible = hole.state === 'WARNING';
    crackA.visible = hole.state === 'WARNING';
    crackB.visible = hole.state === 'WARNING';
    holeMesh.visible = hole.state === 'HOLE' || hole.state === 'REPAIR_WARNING';
    brokenEdge.visible = hole.state === 'HOLE' || hole.state === 'REPAIR_WARNING';
    repair.visible = hole.state === 'REPAIR_WARNING';
    fragments.visible = hole.state === 'HOLE' || hole.state === 'REPAIR_WARNING';
    impact.visible = hole.state === 'HOLE';
    this.animateDynamicHoleVisual(hole);
  }

  animateDynamicHoleVisual(hole) {
    const { warning, warningRing, fireball, repair, hole: holeMesh, brokenEdge, fragments, impact, impactFlash, impactRing } = hole.visual.userData;
    if (hole.state === 'WARNING') {
      const pulse = 0.72 + Math.sin(performance.now() * 0.018) * 0.22;
      warning.material.opacity = pulse;
      warning.scale.setScalar(0.9 + pulse * 0.12);
      warningRing.material.opacity = 0.35 + pulse * 0.5;
      warningRing.scale.setScalar(0.92 + pulse * 0.16);
      const descend = Math.max(0, Math.min(1, hole.timer / this.dynamicHoleConfig.warningDuration));
      fireball.position.y = .2 + descend * Math.max(0, CONFIG.HOLES.FIREBALL_HEIGHT - .2);
      fireball.rotation.y += .12;
    } else if (hole.state === 'HOLE') {
      holeMesh.position.y = -0.1 - Math.sin(performance.now() * 0.012) * 0.025;
      brokenEdge.rotation.y += 0.003;
      fragments.children.forEach((fragment, index) => { fragment.position.y = 0.1 + Math.sin(performance.now() * 0.014 + index) * 0.035; });
      const impactProgress = Math.min(1, hole.visualElapsed / .72);
      impactFlash.scale.setScalar(1 + impactProgress * 2.5);
      impactFlash.material.opacity = Math.max(0, 1 - impactProgress * 1.3);
      impactRing.scale.setScalar(1 + impactProgress * 3.6);
      impactRing.material.opacity = Math.max(0, .9 - impactProgress);
      impact.children.forEach((child) => {
        if (!child.userData.velocity) return;
        child.position.addScaledVector(child.userData.velocity, .016);
        child.material.opacity = Math.max(0, 1 - impactProgress);
      });
    } else if (hole.state === 'REPAIR_WARNING') {
      repair.material.opacity = 0.45 + Math.sin(performance.now() * 0.02) * 0.2;
      holeMesh.position.y = -0.08 + (1 - hole.timer / this.dynamicHoleConfig.repairDuration) * 0.12;
      fragments.children.forEach((fragment) => { fragment.position.y = Math.max(0.08, fragment.position.y - 0.01); });
    }
  }

  checkSafeZoneReset(playerZ) {
    const row = this.activeRows.get(playerZ);
    if (row && row.type === CONFIG.ROW_TYPES.GRASS) {
      return true;
    }
    return false;
  }

  removeRow(z, row) {
    (row?.leaderStrikeItems || (row?.leaderStrikeItem ? [row.leaderStrikeItem] : [])).slice().forEach((item) => this.removeLeaderStrikeItem(item));
    if (row && row.mesh) {
      this.scene.remove(row.mesh);
    }
    if (row?.scoreItem) this.scoreItems.delete(`${row.scoreItem.x},${row.scoreItem.z}`);
    (row?.springPunchItems || (row?.springPunchItem ? [row.springPunchItem] : [])).slice().forEach((item) => {
      this.springPunchItems.delete(`${item.x},${item.z}`);
      row.mesh?.remove(item.mesh);
      item.mesh?.traverse((node) => { node.geometry?.dispose(); node.material?.dispose(); });
    });
    this.activeRows.delete(z);
  }

  getActiveRows() {
    return this.activeRows;
  }
}
