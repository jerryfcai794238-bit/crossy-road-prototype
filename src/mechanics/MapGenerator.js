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
    this.currentRiverClusterSubtype = null;
    this.lastLilyPadGridXs = null;
    this.currentClusterObj = null;
    this.clusterCounter = 0;

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

    for (let z = -CONFIG.DESPAWN_BEHIND; z <= 15; z++) {
      this.generateRow(z, CONFIG.ROW_TYPES.GRASS, true);
    }

    this.highestZGenerated = 15;
    this.lowestZGenerated = -CONFIG.DESPAWN_BEHIND;

    this.update(0);
  }

  reset() {
    for (const [z, row] of this.activeRows.entries()) {
      this.removeRow(z, row);
    }
    this.activeRows.clear();
    this.highestZGenerated = -CONFIG.DESPAWN_BEHIND;
    this.lowestZGenerated = -CONFIG.DESPAWN_BEHIND;
    this.currentClusterType = CONFIG.ROW_TYPES.GRASS;
    this.clusterRemaining = 5;
    this.currentRiverClusterSubtype = null;
    this.lastLilyPadGridXs = null;
    this.currentClusterObj = null;
    this.clusterCounter = 0;
  }

  update(playerZ) {
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
    if (this.clusterRemaining > 0) {
      this.clusterRemaining--;
      return this.currentClusterType;
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

    this.currentClusterType = nextType;

    if (nextType !== CONFIG.ROW_TYPES.GRASS) {
      this.clusterCounter++;
      this.currentClusterObj = {
        id: this.clusterCounter,
        type: nextType,
        slowLevel: 0,
        rows: []
      };
    } else {
      this.currentClusterObj = null;
    }

    switch (nextType) {
      case CONFIG.ROW_TYPES.GRASS:
        this.clusterRemaining = Math.floor(Math.random() * 3) + 1;
        this.lastLilyPadGridXs = null;
        break;
      case CONFIG.ROW_TYPES.ROAD:
        this.clusterRemaining = Math.floor(Math.random() * 3) + 1;
        this.lastLilyPadGridXs = null;
        break;
      case CONFIG.ROW_TYPES.RIVER:
        this.clusterRemaining = Math.floor(Math.random() * 2) + 1;
        // 以區域為單位定案當前河道區域子類型 (30% LILY_PAD, 70% LOG)
        this.currentRiverClusterSubtype = Math.random() < 0.3 ? 'LILY_PAD' : 'LOG';
        this.lastLilyPadGridXs = null;
        break;
      case CONFIG.ROW_TYPES.RAILROAD:
        this.clusterRemaining = 1;
        this.lastLilyPadGridXs = null;
        break;
    }

    return this.currentClusterType;
  }

  generateRow(z, type, isInitialSafe = false) {
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
      speed: 0
    };

    if (type !== CONFIG.ROW_TYPES.GRASS) {
      if (!this.currentClusterObj || this.currentClusterObj.type !== type) {
        this.clusterCounter++;
        this.currentClusterObj = {
          id: this.clusterCounter,
          type,
          slowLevel: 0,
          rows: []
        };
      }
      rowData.cluster = this.currentClusterObj;
      this.currentClusterObj.rows.push(rowData);
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

  buildGrassRow(rowData, rowGroup, isInitialSafe) {
    const mat = (Math.abs(rowData.z) % 2 === 0) ? this.grassMat1 : this.grassMat2;
    const lane = new THREE.Mesh(this.laneGeo, mat);
    lane.receiveShadow = true;
    rowGroup.add(lane);

    // 1. 每一列草地 100% 保證至少有 3 ~ 4 個絕對無樹木的開放通行缺口 (根除死路)
    const playableRange = CONFIG.MAP_BOUNDS_X - 1; // -5 ~ +5
    const guaranteedOpenCount = Math.floor(Math.random() * 2) + 3; // 3 ~ 4 個通道
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

      if (isInitialSafe && rowData.z >= -3 && rowData.z <= 3 && Math.abs(x) <= 1) {
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

    for (const [z, row] of this.activeRows.entries()) {
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
            row.warningTimer = row.warningDuration || 2.0;
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

            if (row.cluster && row.cluster.slowLevel > 0) {
              this.updateMeshSlowTrail(trainMesh, row.direction, row.cluster.slowLevel);
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

          const trainSpeed = 38.0 * (row.trainSpeedMult || 1.0);
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

  applySlowDown(playerZ) {
    let targetCluster = null;

    // 1. 判斷玩家目前站在哪一列
    const playerRow = this.activeRows.get(playerZ);
    if (playerRow && playerRow.type !== CONFIG.ROW_TYPES.GRASS && playerRow.cluster) {
      targetCluster = playerRow.cluster;
    } else {
      // 2. 玩家站在草地：尋找玩家前方最近的下一個危險區 (z > playerZ)
      let minAheadZ = Infinity;
      for (const [z, row] of this.activeRows.entries()) {
        if (z > playerZ && row.type !== CONFIG.ROW_TYPES.GRASS && row.cluster) {
          if (z < minAheadZ) {
            minAheadZ = z;
            targetCluster = row.cluster;
          }
        }
      }
    }

    if (!targetCluster) {
      return { success: false, slowLevel: 0, remainingUses: 3 };
    }

    if (targetCluster.slowLevel >= 3) {
      return { success: false, slowLevel: 3, remainingUses: 0 };
    }

    targetCluster.slowLevel += 1;
    const slowLevel = targetCluster.slowLevel;

    // 套用減速與冰藍色拖尾特效
    this.applyClusterSlowEffects(targetCluster);

    return {
      success: true,
      slowLevel,
      remainingUses: 3 - slowLevel
    };
  }

  checkSafeZoneReset(playerZ) {
    const row = this.activeRows.get(playerZ);
    if (row && row.type === CONFIG.ROW_TYPES.GRASS) {
      return true;
    }
    return false;
  }

  applyClusterSlowEffects(cluster) {
    const mult = 1 - 0.15 * cluster.slowLevel;

    for (const row of cluster.rows) {
      if (row.baseSpeed === undefined) {
        row.baseSpeed = row.speed || 3.0;
      }
      row.speed = row.baseSpeed * mult;

      // 如果是火車列
      if (row.type === CONFIG.ROW_TYPES.RAILROAD) {
        row.trainSpeedMult = mult;
        row.warningDuration = 2.0 * (1 + 0.15 * cluster.slowLevel);
        if (row.train) {
          this.updateMeshSlowTrail(row.train, row.direction, cluster.slowLevel);
        }
      }

      // 如果是馬路車輛
      if (row.type === CONFIG.ROW_TYPES.ROAD && row.vehicles) {
        row.vehicles.forEach((veh) => {
          this.updateMeshSlowTrail(veh.mesh, row.direction, cluster.slowLevel);
        });
      }

      // 如果是河流浮木
      if (row.type === CONFIG.ROW_TYPES.RIVER && row.logs) {
        row.logs.forEach((log) => {
          if (!log.isStationary) {
            this.updateMeshSlowTrail(log.mesh, row.direction, cluster.slowLevel, true);
          }
        });
      }
    }
  }

  updateMeshSlowTrail(mesh, direction, slowLevel, isLog = false) {
    if (!mesh) return;

    const existing = mesh.getObjectByName('slowTrailGroup');
    if (existing) {
      mesh.remove(existing);
    }

    if (slowLevel <= 0) return;

    const trailGroup = new THREE.Group();
    trailGroup.name = 'slowTrailGroup';

    const lineMat = new THREE.MeshBasicMaterial({
      color: 0x74b9ff,
      transparent: true,
      opacity: 0.85
    });

    const trailCount = Math.min(3, slowLevel);

    if (isLog) {
      const sign = direction === 1 ? -1 : 1;
      const logDepth = mesh.length ? mesh.length * CONFIG.GRID_SIZE * 0.45 : 1.2;

      for (let i = 0; i < trailCount; i++) {
        const trailLen = 0.4 + (i + 1) * 0.35 * slowLevel;
        const trailGeo = new THREE.BoxGeometry(0.12, 0.05, trailLen);
        const trailMesh = new THREE.Mesh(trailGeo, lineMat);
        const offsetX = (i - (trailCount - 1) / 2) * 0.25;
        const offsetZ = sign * (logDepth + trailLen / 2 + i * 0.15);
        trailMesh.position.set(offsetX, 0.05, offsetZ);
        trailGroup.add(trailMesh);
      }
    } else {
      const rearOffset = -1.0;
      for (let i = 0; i < trailCount; i++) {
        const trailLen = 0.5 + (i + 1) * 0.35 * slowLevel;
        const trailGeo = new THREE.BoxGeometry(0.1, 0.08, trailLen);
        const trailMesh = new THREE.Mesh(trailGeo, lineMat);
        const offsetX = (i - (trailCount - 1) / 2) * 0.35;
        const offsetZ = rearOffset - trailLen / 2 - i * 0.2;
        const offsetY = 0.2 + (i % 2) * 0.1;
        trailMesh.position.set(offsetX, offsetY, offsetZ);
        trailGroup.add(trailMesh);
      }
    }

    mesh.add(trailGroup);
  }

  removeRow(z, row) {
    if (row && row.mesh) {
      this.scene.remove(row.mesh);
    }
    if (row && row.cluster && row.cluster.rows) {
      row.cluster.rows = row.cluster.rows.filter((r) => r !== row);
    }
    this.activeRows.delete(z);
  }

  getActiveRows() {
    return this.activeRows;
  }
}
