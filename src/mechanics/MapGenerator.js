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
  constructor(scene) {
    this.scene = scene;
    this.activeRows = new Map();

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
    this.dynamicHolesEnabled = false;
    this.dynamicHoleCells = new Map();
    this.dynamicHoleCellBlocked = null;
    this.dynamicHolePlayerZ = 0;
    this.dynamicHoleWaveCooldown = 1.5;
    this.dynamicHoleWaveId = 0;
    this.dynamicHoleConfig = {
      warningDuration: 1.2,
      holeDuration: 2.2,
      repairDuration: 0.6,
      waveCooldown: 0.8,
      warningSafetyBuffer: 0.15
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

    for (let z = -CONFIG.DESPAWN_BEHIND; z <= 7; z++) {
      this.generateRow(z, CONFIG.ROW_TYPES.GRASS, true);
    }

    this.highestZGenerated = 7;
    this.lowestZGenerated = -CONFIG.DESPAWN_BEHIND;

    this.update(0);
  }

  reset() {
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
    this.dynamicHolePlayerZ = 0;
    this.dynamicHoleWaveCooldown = 1.5;
    this.dynamicHoleWaveId = 0;
  }

  update(playerZ) {
    this.dynamicHolePlayerZ = playerZ;
    const targetAheadZ = playerZ + CONFIG.GENERATION_AHEAD;

    while (this.highestZGenerated < targetAheadZ) {
      this.highestZGenerated++;
      const nextType = this.getNextRowType(this.highestZGenerated);
      this.generateRow(this.highestZGenerated, nextType);
    }

    // 身後 25 格以上才安全銷毀，絕不銷毀腳下與退路
    const minKeepZ = playerZ - CONFIG.DESPAWN_BEHIND;
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
      return this.beginCluster(hazardTypes[Math.floor(Math.random() * hazardTypes.length)]);
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

    let nextType = types[Math.floor(Math.random() * types.length)];
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
        this.clusterRemaining = Math.floor(Math.random() * 3) + 1;
        this.grassClusterSize = this.clusterRemaining + 1;
        this.grassClusterRowIndex = 0;
        this.lastLilyPadGridXs = null;
        break;
      case CONFIG.ROW_TYPES.ROAD:
        this.grassClusterSize = 0;
        this.clusterRemaining = Math.floor(Math.random() * 3) + 1;
        this.lastLilyPadGridXs = null;
        break;
      case CONFIG.ROW_TYPES.RIVER:
        this.grassClusterSize = 0;
        this.clusterRemaining = Math.floor(Math.random() * 2) + 1;
        // 以區域為單位定案當前河道區域子類型 (30% LILY_PAD, 70% LOG)
        this.currentRiverClusterSubtype = Math.random() < 0.3 ? 'LILY_PAD' : 'LOG';
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
      idleTimer: Math.random() * 4 + 3.0,
      direction: Math.random() > 0.5 ? 1 : -1,
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

    this.scene.add(rowGroup);
    this.activeRows.set(z, rowData);
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

  buildGrassRow(rowData, rowGroup, isInitialSafe) {
    const mat = (Math.abs(rowData.z) % 2 === 0) ? this.grassMat1 : this.grassMat2;
    const lane = new THREE.Mesh(this.laneGeo, mat);
    lane.receiveShadow = true;
    rowGroup.add(lane);

    // 1. 每一列草地 100% 保證至少有 3 ~ 4 個絕對無樹木的開放通行缺口 (根除死路)
    const playableRange = CONFIG.MAP_BOUNDS_X - 1; // -5 ~ +5
    const guaranteedOpenCount = rowData.isDynamicHoleFloor ? 4 : Math.floor(Math.random() * 2) + 3;
    const openXs = new Set();

    while (openXs.size < guaranteedOpenCount) {
      const randomX = Math.floor(Math.random() * (playableRange * 2 + 1)) - playableRange;
      openXs.add(randomX);
    }

    // 2. 生成樹木，絕對開口點 (openXs) 100% 禁放樹木
    for (let x = -CONFIG.MAP_BOUNDS_X - 2; x <= CONFIG.MAP_BOUNDS_X + 2; x++) {
      const isEdge = Math.abs(x) >= CONFIG.MAP_BOUNDS_X;

      let placeTree = false;
      if (isEdge) {
        placeTree = true;
      } else if (!isInitialSafe && !openXs.has(x)) {
        placeTree = Math.random() < 0.28;
      }

      if (isInitialSafe && rowData.z >= -3 && rowData.z <= 3 && Math.abs(x) <= 4) {
        placeTree = false;
      }

      if (placeTree) {
        const treeType = Math.floor(Math.random() * 3);
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
    const minSpeed = THREE.MathUtils.lerp(2.0, 4.2, zProgress);
    const speedRange = THREE.MathUtils.lerp(1.2, 2.3, zProgress);
    rowData.speed = minSpeed + Math.random() * speedRange;

    // 鄰接河道與車道防同步卡死演算法 (River-Road Anti-Locking Algorithm)
    const adjRowRoad = this.activeRows.get(rowData.z - 1) || this.activeRows.get(rowData.z + 1);
    if (adjRowRoad && adjRowRoad.type === CONFIG.ROW_TYPES.RIVER) {
      if (Math.random() < 0.8) {
        rowData.direction = -adjRowRoad.direction;
      }
      if (rowData.direction === adjRowRoad.direction) {
        if (Math.abs(rowData.speed - adjRowRoad.speed) < 2.2) {
          rowData.speed = adjRowRoad.speed + 2.2;
        }
      }
    }

    // 車輛間隔：Z = 70 步保持 6.5 ~ 9.5 格大空檔，極高分最少保持 4.5 格 (永遠有安全空間過街)
    const isTruck = Math.random() < (0.15 + zProgress * 0.2);
    const vehicleWidth = isTruck ? 2.3 : 1.8;

    const minGapGrids = THREE.MathUtils.lerp(7.5, 4.5, zProgress);
    const gapRangeGrids = THREE.MathUtils.lerp(4.0, 2.5, zProgress);
    const spacing = vehicleWidth + CONFIG.GRID_SIZE * (minGapGrids + Math.random() * gapRangeGrids);

    const totalSpan = (CONFIG.MAP_BOUNDS_X * 2 + 12) * CONFIG.GRID_SIZE;
    const count = Math.floor(totalSpan / spacing);

    const colors = CONFIG.COLORS.CAR_COLORS;

    for (let i = 0; i < count; i++) {
      const colorHex = colors[Math.floor(Math.random() * colors.length)];
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

    const logLength = Math.floor(Math.random() * 2) + 3; // 3 ~ 4 格大浮木
    const minLogGap = 1.0 + Math.random() * 0.3; // 1.0 ~ 1.3 格高密度間距
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
      isPureLilyPadRow = Math.random() < 0.35;
    }

    rowData.isLilyPadRow = isPureLilyPadRow;
    rowData.isPureLilyPadRow = isPureLilyPadRow;

    if (isPureLilyPadRow) {
      // 生成 3 ~ 5 個靜態綠色睡蓮平台 (createLilyPadMesh)，定點擺放於 -4 ~ +4 步道範圍內
      const padCount = Math.floor(Math.random() * 3) + 3; // 3 ~ 5 個
      const playableRange = 4; // -4 ~ +4 步道範圍
      const usedXs = new Set();

      while (usedXs.size < padCount) {
        const gridX = Math.floor(Math.random() * (playableRange * 2 + 1)) - playableRange;
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

      let speed = THREE.MathUtils.lerp(1.5, 3.2, zProgress) + Math.random() * 1.0;
      if (this.lastRiverSpeed && Math.abs(speed - this.lastRiverSpeed) < 1.0) {
        speed += 1.2;
      }
      rowData.speed = speed;

      // 鄰接河道與車道防同步卡死演算法 (River-Road Anti-Locking Algorithm)
      const adjRowRoad = this.activeRows.get(rowData.z - 1) || this.activeRows.get(rowData.z + 1);
      if (adjRowRoad && adjRowRoad.type === CONFIG.ROW_TYPES.ROAD) {
        if (Math.random() < 0.8) {
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
        logLength = Math.floor(Math.random() * 2) + 3; // 3 ~ 4 格
        minLogGap = 1.0 + Math.random() * 0.3; // 1.0 ~ 1.3 格
        gapRandomRange = 0;
      } else {
        logLength = zProgress < 0.5 ? (Math.floor(Math.random() * 2) + 3) : (Math.floor(Math.random() * 2) + 2);
        minLogGap = THREE.MathUtils.lerp(1.2, 2.2, zProgress);
        gapRandomRange = 1.2;
      }

      const logSpan = logLength * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE * (minLogGap + Math.random() * gapRandomRange);
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
    const boundX = (CONFIG.MAP_BOUNDS_X + 5) * CONFIG.GRID_SIZE;

    this.updateDynamicHoles(safeDelta);

    for (const [z, row] of this.activeRows.entries()) {
      if (row.scoreItem?.mesh) {
        row.scoreItem.mesh.rotation.y += safeDelta * 3.5;
        row.scoreItem.mesh.position.y = 0.5 + Math.sin(performance.now() * 0.004 + z) * 0.08;
      }
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
            row.warningTimer = 2.0;
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

          const trainSpeed = 38.0;
          row.train.position.x += row.direction * trainSpeed * safeDelta;
          if (Math.abs(row.train.position.x) > boundX * 2.0) {
            row.mesh.remove(row.train);
            row.train = null;
            row.trainState = 'IDLE';
            row.idleTimer = Math.random() * 5 + 4.0;
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
    this.dynamicHoleWaveCooldown = 1.5;
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
      timer: this.dynamicHoleConfig.warningDuration
    };
    this.dynamicHoleCells.set(hole.key, hole);
    this.applyDynamicHoleVisual(hole);
  }

  createDynamicHoleVisual() {
    const group = new THREE.Group();
    const size = CONFIG.GRID_SIZE * 0.78;
    const warning = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ color: 0xffa52f, transparent: true, opacity: 0.7, depthWrite: false })
    );
    warning.rotation.x = -Math.PI / 2;
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
    hole.position.y = 0.05;
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
    group.add(warning, crackA, crackB, hole, brokenEdge, repair);
    group.userData = { warning, crackA, crackB, hole, brokenEdge, repair };
    return group;
  }

  setDynamicHoleState(hole, state, duration) {
    hole.state = state;
    hole.timer = duration;
    this.applyDynamicHoleVisual(hole);
  }

  applyDynamicHoleVisual(hole) {
    const { warning, crackA, crackB, hole: holeMesh, brokenEdge, repair } = hole.visual.userData;
    warning.visible = hole.state === 'WARNING';
    crackA.visible = hole.state === 'WARNING';
    crackB.visible = hole.state === 'WARNING';
    holeMesh.visible = hole.state === 'HOLE' || hole.state === 'REPAIR_WARNING';
    brokenEdge.visible = hole.state === 'HOLE' || hole.state === 'REPAIR_WARNING';
    repair.visible = hole.state === 'REPAIR_WARNING';
    this.animateDynamicHoleVisual(hole);
  }

  animateDynamicHoleVisual(hole) {
    const { warning, repair } = hole.visual.userData;
    if (hole.state === 'WARNING') {
      const pulse = 0.72 + Math.sin(performance.now() * 0.018) * 0.22;
      warning.material.opacity = pulse;
      warning.scale.setScalar(0.9 + pulse * 0.12);
    } else if (hole.state === 'REPAIR_WARNING') {
      repair.material.opacity = 0.45 + Math.sin(performance.now() * 0.02) * 0.2;
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
    if (row && row.mesh) {
      this.scene.remove(row.mesh);
    }
    if (row?.scoreItem) this.scoreItems.delete(`${row.scoreItem.x},${row.scoreItem.z}`);
    this.activeRows.delete(z);
  }

  getActiveRows() {
    return this.activeRows;
  }
}
