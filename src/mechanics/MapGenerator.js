import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  createTreeMesh,
  createCarMesh,
  createTruckMesh,
  createLogMesh,
  createTrainMesh,
  createSignalMesh
} from '../graphics/VoxelModels.js';

export class MapGenerator {
  constructor(scene) {
    this.scene = scene;

    // 活躍地圖列 key = z, value = rowData
    this.activeRows = new Map();

    this.highestZGenerated = -CONFIG.DESPAWN_BEHIND;
    this.lowestZGenerated = -CONFIG.DESPAWN_BEHIND;

    // 前一個生成類型的追蹤，用於地形叢集控制
    this.currentClusterType = CONFIG.ROW_TYPES.GRASS;
    this.clusterRemaining = CONFIG.INITIAL_SAFE_ROWS;

    // 共享 Geometry & Material 提升效能
    this.initGeometriesAndMaterials();
  }

  /**
   * 初始化共用幾何體與材質，減少記憶體開銷
   */
  initGeometriesAndMaterials() {
    const laneWidth = (CONFIG.MAP_BOUNDS_X * 2 + 8) * CONFIG.GRID_SIZE;
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

    // 鐵軌與枕木幾何體
    this.railGeo = new THREE.BoxGeometry(laneWidth, 0.08, 0.08);
    this.railMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.RAILROAD_RAIL });

    this.tieGeo = new THREE.BoxGeometry(0.18, 0.05, laneDepth * 0.85);
    this.tieMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.RAILROAD_TIE });
  }

  /**
   * 建立初始地圖 (包含起點安全區)
   */
  initMap() {
    this.reset();

    // 生成後方防視角空缺區與初始安全草地區
    for (let z = -CONFIG.DESPAWN_BEHIND; z <= CONFIG.INITIAL_SAFE_ROWS; z++) {
      this.generateRow(z, CONFIG.ROW_TYPES.GRASS, true);
    }

    this.highestZGenerated = CONFIG.INITIAL_SAFE_ROWS;
    this.lowestZGenerated = -CONFIG.DESPAWN_BEHIND;

    // 擴充生成前方區塊
    this.update(0);
  }

  /**
   * 根據玩家目前 position.z 動態生成前方區塊與回收後方區塊
   */
  update(playerZ) {
    const targetAheadZ = playerZ + CONFIG.GENERATION_AHEAD;

    // 生成新區塊
    while (this.highestZGenerated < targetAheadZ) {
      this.highestZGenerated++;
      const nextType = this.getNextRowType();
      this.generateRow(this.highestZGenerated, nextType);
    }

    // 回收刪除舊區塊
    const minKeepZ = playerZ - CONFIG.DESPAWN_BEHIND;
    for (const [z, row] of this.activeRows.entries()) {
      if (z < minKeepZ) {
        this.removeRow(z, row);
      }
    }
  }

  /**
   * 地形種類亂數分配演算法 (連續叢集生成機制)
   */
  getNextRowType() {
    if (this.clusterRemaining > 0) {
      this.clusterRemaining--;
      return this.currentClusterType;
    }

    // 決定下一個地形叢集
    const types = [
      CONFIG.ROW_TYPES.GRASS,
      CONFIG.ROW_TYPES.ROAD,
      CONFIG.ROW_TYPES.RIVER,
      CONFIG.ROW_TYPES.RAILROAD
    ];

    // 避免連續兩大塊相同的地形 (如果是草地可以重複)
    let nextType = types[Math.floor(Math.random() * types.length)];
    if (nextType !== CONFIG.ROW_TYPES.GRASS && nextType === this.currentClusterType) {
      nextType = CONFIG.ROW_TYPES.GRASS;
    }

    this.currentClusterType = nextType;

    switch (nextType) {
      case CONFIG.ROW_TYPES.GRASS:
        this.clusterRemaining = Math.floor(Math.random() * 3) + 1; // 1-3 列
        break;
      case CONFIG.ROW_TYPES.ROAD:
        this.clusterRemaining = Math.floor(Math.random() * 4) + 1; // 1-4 列馬路
        break;
      case CONFIG.ROW_TYPES.RIVER:
        this.clusterRemaining = Math.floor(Math.random() * 3) + 1; // 1-3 列河流
        break;
      case CONFIG.ROW_TYPES.RAILROAD:
        this.clusterRemaining = 1; // 1 列鐵路
        break;
    }

    return this.currentClusterType;
  }

  /**
   * 生成單一地圖列 (Row)
   */
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
      trainState: 'IDLE', // IDLE, WARNING, TRAIN_PASSING
      idleTimer: Math.random() * 4 + 3.0,
      warningTimer: 0,
      direction: Math.random() > 0.5 ? 1 : -1,
      speed: 0
    };

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

  /**
   * 建立草地列 (包含樹木障礙)
   */
  buildGrassRow(rowData, rowGroup, isInitialSafe) {
    // 雙色交替草地
    const mat = (Math.abs(rowData.z) % 2 === 0) ? this.grassMat1 : this.grassMat2;
    const lane = new THREE.Mesh(this.laneGeo, mat);
    lane.receiveShadow = true;
    rowGroup.add(lane);

    // 擺放樹木障礙物
    for (let x = -CONFIG.MAP_BOUNDS_X - 2; x <= CONFIG.MAP_BOUNDS_X + 2; x++) {
      const isEdge = Math.abs(x) >= CONFIG.MAP_BOUNDS_X;

      // 邊界必定放樹，中間亂數放樹
      let placeTree = false;
      if (isEdge) {
        placeTree = true;
      } else if (!isInitialSafe) {
        placeTree = Math.random() < 0.22;
      }

      // 起點周圍 (z 0~3, x -1~1) 保持開闊不擺樹
      if (isInitialSafe && rowData.z >= 0 && rowData.z <= 3 && Math.abs(x) <= 1) {
        placeTree = false;
      }

      if (placeTree) {
        const treeType = Math.floor(Math.random() * 3);
        const treeMesh = createTreeMesh(treeType);
        treeMesh.position.set(x * CONFIG.GRID_SIZE, 0.2, 0);
        rowGroup.add(treeMesh);

        rowData.trees.push({
          gridX: x,
          mesh: treeMesh
        });
      }
    }
  }

  /**
   * 建立馬路列 (包含車輛)
   */
  buildRoadRow(rowData, rowGroup) {
    const lane = new THREE.Mesh(this.laneGeo, this.roadMat);
    lane.receiveShadow = true;
    rowGroup.add(lane);

    // 分隔線黃點
    const lineGeo = new THREE.BoxGeometry(0.6, 0.02, 0.1);
    const lineMat = new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.ROAD_LINE });
    for (let x = -CONFIG.MAP_BOUNDS_X; x <= CONFIG.MAP_BOUNDS_X; x += 3) {
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(x * CONFIG.GRID_SIZE, 0.21, 0);
      rowGroup.add(line);
    }

    // 車速與車輛動態生成
    const isTruck = Math.random() < 0.35;
    const speedMin = isTruck ? CONFIG.OBSTACLES.TRUCK.SPEED_MIN : CONFIG.OBSTACLES.CAR.SPEED_MIN;
    const speedMax = isTruck ? CONFIG.OBSTACLES.TRUCK.SPEED_MAX : CONFIG.OBSTACLES.CAR.SPEED_MAX;
    rowData.speed = speedMin + Math.random() * (speedMax - speedMin);

    const vehicleWidth = isTruck ? CONFIG.OBSTACLES.TRUCK.WIDTH : CONFIG.OBSTACLES.CAR.WIDTH;
    const vehicleDepth = isTruck ? CONFIG.OBSTACLES.TRUCK.DEPTH : CONFIG.OBSTACLES.CAR.DEPTH;

    // 車輛間距 (至少 3.5 個 Grid)
    const spacing = (vehicleWidth + CONFIG.GRID_SIZE * (3 + Math.random() * 2.5));
    const totalSpan = (CONFIG.MAP_BOUNDS_X * 2 + 6) * CONFIG.GRID_SIZE;
    const count = Math.floor(totalSpan / spacing);

    const colors = isTruck ? CONFIG.COLORS.TRUCK_COLORS : CONFIG.COLORS.CAR_COLORS;

    for (let i = 0; i < count; i++) {
      const colorHex = colors[Math.floor(Math.random() * colors.length)];
      const mesh = isTruck ? createTruckMesh(colorHex) : createCarMesh(colorHex);

      const startX = -totalSpan / 2 + i * spacing + (Math.random() * 1.0);
      mesh.position.set(startX, 0.2, 0);

      // 朝向
      if (rowData.direction === -1) {
        mesh.rotation.y = Math.PI;
      }

      rowGroup.add(mesh);

      rowData.vehicles.push({
        mesh,
        width: vehicleWidth,
        depth: vehicleDepth,
        speed: rowData.speed,
        direction: rowData.direction,
        position: mesh.position
      });
    }
  }

  /**
   * 建立河流列 (包含浮木)
   */
  buildRiverRow(rowData, rowGroup) {
    const lane = new THREE.Mesh(this.laneGeo, this.riverMat);
    lane.receiveShadow = true;
    lane.position.y = -0.05;
    rowGroup.add(lane);

    rowData.speed = CONFIG.OBSTACLES.LOG.SPEED_MIN +
      Math.random() * (CONFIG.OBSTACLES.LOG.SPEED_MAX - CONFIG.OBSTACLES.LOG.SPEED_MIN);

    const span = (CONFIG.MAP_BOUNDS_X * 2 + 8) * CONFIG.GRID_SIZE;
    let currentX = -span / 2 + Math.random() * 2;

    while (currentX < span / 2) {
      const segLen = Math.floor(Math.random() * 3) + 2; // 2~4 格長度
      const logMesh = createLogMesh(segLen);

      logMesh.position.set(currentX, 0.1, 0);
      rowGroup.add(logMesh);

      rowData.logs.push({
        mesh: logMesh,
        length: segLen,
        speed: rowData.speed,
        direction: rowData.direction,
        position: logMesh.position
      });

      // 下一個木塊的隨機間距
      const gap = (segLen + 2.2 + Math.random() * 2.5) * CONFIG.GRID_SIZE;
      currentX += gap;
    }
  }

  /**
   * 建立鐵路列 (包含鐵軌、號誌燈、高速火車)
   */
  buildRailroadRow(rowData, rowGroup) {
    // 碎石基座
    const lane = new THREE.Mesh(this.laneGeo, this.railroadGravelMat);
    lane.receiveShadow = true;
    rowGroup.add(lane);

    // 金屬雙鐵軌
    const rail1 = new THREE.Mesh(this.railGeo, this.railMat);
    rail1.position.set(0, 0.23, -0.28);
    const rail2 = new THREE.Mesh(this.railGeo, this.railMat);
    rail2.position.set(0, 0.23, 0.28);
    rowGroup.add(rail1, rail2);

    // 木質枕木 (Tie)
    for (let x = -CONFIG.MAP_BOUNDS_X - 3; x <= CONFIG.MAP_BOUNDS_X + 3; x += 0.8) {
      const tie = new THREE.Mesh(this.tieGeo, this.tieMat);
      tie.position.set(x * CONFIG.GRID_SIZE, 0.21, 0);
      rowGroup.add(tie);
    }

    // 號誌燈 (立於路旁)
    const signalMesh = createSignalMesh();
    const signalX = (CONFIG.MAP_BOUNDS_X - 0.5) * CONFIG.GRID_SIZE;
    signalMesh.position.set(signalX, 0.2, 0.4);
    rowGroup.add(signalMesh);
    rowData.signal = signalMesh;

    // 火車實體 (初始位於鏡頭外)
    const trainMesh = createTrainMesh();
    const startX = -rowData.direction * (CONFIG.MAP_BOUNDS_X + CONFIG.OBSTACLES.TRAIN.LENGTH);
    trainMesh.position.set(startX, 0.2, 0);
    if (rowData.direction === -1) {
      trainMesh.rotation.y = Math.PI;
    }
    rowGroup.add(trainMesh);

    rowData.train = {
      mesh: trainMesh,
      length: CONFIG.OBSTACLES.TRAIN.LENGTH,
      speed: CONFIG.OBSTACLES.TRAIN.SPEED,
      position: trainMesh.position
    };
  }

  /**
   * 每幀更新所有障礙物/浮木/火車動態位置
   */
  animateObstacles(deltaTime, elapsedTime) {
    const boundMargin = (CONFIG.MAP_BOUNDS_X + 5) * CONFIG.GRID_SIZE;

    for (const row of this.activeRows.values()) {
      // 1. 車輛移動與循環
      if (row.type === CONFIG.ROW_TYPES.ROAD) {
        row.vehicles.forEach((veh) => {
          veh.position.x += row.direction * veh.speed * deltaTime;

          if (row.direction === 1 && veh.position.x > boundMargin) {
            veh.position.x = -boundMargin;
          } else if (row.direction === -1 && veh.position.x < -boundMargin) {
            veh.position.x = boundMargin;
          }
        });
      }

      // 2. 浮木移動與循環
      else if (row.type === CONFIG.ROW_TYPES.RIVER) {
        row.logs.forEach((log) => {
          log.position.x += row.direction * log.speed * deltaTime;

          if (row.direction === 1 && log.position.x > boundMargin + 2) {
            log.position.x = -boundMargin - 2;
          } else if (row.direction === -1 && log.position.x < -boundMargin - 2) {
            log.position.x = boundMargin + 2;
          }
        });
      }

      // 3. 鐵路號誌燈與火車狀態機
      else if (row.type === CONFIG.ROW_TYPES.RAILROAD && row.train) {
        const { bulbMat } = row.signal.userData;

        if (row.trainState === 'IDLE') {
          row.idleTimer -= deltaTime;
          bulbMat.color.setHex(CONFIG.COLORS.SIGNAL_OFF);

          if (row.idleTimer <= 0) {
            row.trainState = 'WARNING';
            row.warningTimer = CONFIG.OBSTACLES.TRAIN.WARNING_TIME;
            row.train.position.x = -row.direction * (boundMargin + row.train.length / 2);
          }
        } else if (row.trainState === 'WARNING') {
          row.warningTimer -= deltaTime;

          // 快速紅燈閃爍
          const flash = Math.floor(elapsedTime * 10) % 2 === 0;
          bulbMat.color.setHex(flash ? CONFIG.COLORS.SIGNAL_RED : CONFIG.COLORS.SIGNAL_OFF);

          if (row.warningTimer <= 0) {
            row.trainState = 'TRAIN_PASSING';
            bulbMat.color.setHex(CONFIG.COLORS.SIGNAL_RED);
          }
        } else if (row.trainState === 'TRAIN_PASSING') {
          row.train.position.x += row.direction * row.train.speed * deltaTime;

          // 檢查火車是否完全穿越離場
          const trainPassed = row.direction === 1
            ? row.train.position.x > boundMargin + row.train.length / 2
            : row.train.position.x < -boundMargin - row.train.length / 2;

          if (trainPassed) {
            row.trainState = 'IDLE';
            row.idleTimer = CONFIG.OBSTACLES.TRAIN.INTERVAL_MIN +
              Math.random() * (CONFIG.OBSTACLES.TRAIN.INTERVAL_MAX - CONFIG.OBSTACLES.TRAIN.INTERVAL_MIN);
            bulbMat.color.setHex(CONFIG.COLORS.SIGNAL_OFF);
          }
        }
      }
    }
  }

  /**
   * 取得所有當前活躍地圖列
   */
  getActiveRows() {
    return this.activeRows;
  }

  /**
   * 移除單一地圖列並釋放 Geometry 與 Texture 資源
   */
  removeRow(z, rowData) {
    this.scene.remove(rowData.mesh);

    // 遞迴清理 Group 內的幾何體與材質
    rowData.mesh.traverse((child) => {
      if (child.isMesh) {
        // 不要釋放共用的底板幾何體
        if (child.geometry !== this.laneGeo && child.geometry !== this.railGeo && child.geometry !== this.tieGeo) {
          child.geometry.dispose();
        }
      }
    });

    this.activeRows.delete(z);
  }

  /**
   * 重置地圖
   */
  reset() {
    for (const [z, row] of this.activeRows.entries()) {
      this.removeRow(z, row);
    }
    this.activeRows.clear();
    this.currentClusterType = CONFIG.ROW_TYPES.GRASS;
    this.clusterRemaining = CONFIG.INITIAL_SAFE_ROWS;
  }
}
