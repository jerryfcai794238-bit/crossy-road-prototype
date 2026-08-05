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
    this.activeRows = new Map();

    this.highestZGenerated = -CONFIG.DESPAWN_BEHIND;
    this.lowestZGenerated = -CONFIG.DESPAWN_BEHIND;

    this.currentClusterType = CONFIG.ROW_TYPES.GRASS;
    this.clusterRemaining = CONFIG.INITIAL_SAFE_ROWS;

    this.initGeometriesAndMaterials();
  }

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

    this.railGeo = new THREE.BoxGeometry(laneWidth, 0.08, 0.08);
    this.railMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.RAILROAD_RAIL });

    this.tieGeo = new THREE.BoxGeometry(0.18, 0.05, laneDepth * 0.85);
    this.tieMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.RAILROAD_TIE });

    // 火車預警紅色雷射光帶幾何體與材質
    this.warningStripeGeo = new THREE.BoxGeometry(laneWidth, 0.02, laneDepth * 0.9);
  }

  initMap() {
    this.reset();

    for (let z = -CONFIG.DESPAWN_BEHIND; z <= CONFIG.INITIAL_SAFE_ROWS; z++) {
      this.generateRow(z, CONFIG.ROW_TYPES.GRASS, true);
    }

    this.highestZGenerated = CONFIG.INITIAL_SAFE_ROWS;
    this.lowestZGenerated = -CONFIG.DESPAWN_BEHIND;

    this.update(0);
  }

  update(playerZ) {
    const targetAheadZ = playerZ + CONFIG.GENERATION_AHEAD;

    while (this.highestZGenerated < targetAheadZ) {
      this.highestZGenerated++;
      const nextType = this.getNextRowType(this.highestZGenerated);
      this.generateRow(this.highestZGenerated, nextType);
    }

    const minKeepZ = playerZ - CONFIG.DESPAWN_BEHIND;
    for (const [z, row] of this.activeRows.entries()) {
      if (z < minKeepZ) {
        this.removeRow(z, row);
      }
    }
  }

  /**
   * 前期平緩遞增難度演算法 (z < 25 時單線道且間距大)
   */
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

    // 前期 (z < 25) 限制為單列，避免多重連續車道
    if (targetZ < 25) {
      this.clusterRemaining = 1;
      return this.currentClusterType;
    }

    switch (nextType) {
      case CONFIG.ROW_TYPES.GRASS:
        this.clusterRemaining = Math.floor(Math.random() * 3) + 1;
        break;
      case CONFIG.ROW_TYPES.ROAD:
        this.clusterRemaining = Math.floor(Math.random() * 3) + 1;
        break;
      case CONFIG.ROW_TYPES.RIVER:
        this.clusterRemaining = Math.floor(Math.random() * 2) + 1;
        break;
      case CONFIG.ROW_TYPES.RAILROAD:
        this.clusterRemaining = 1;
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
      warningStripe: null,
      trainState: 'IDLE',
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

  buildGrassRow(rowData, rowGroup, isInitialSafe) {
    const mat = (Math.abs(rowData.z) % 2 === 0) ? this.grassMat1 : this.grassMat2;
    const lane = new THREE.Mesh(this.laneGeo, mat);
    lane.receiveShadow = true;
    rowGroup.add(lane);

    for (let x = -CONFIG.MAP_BOUNDS_X - 2; x <= CONFIG.MAP_BOUNDS_X + 2; x++) {
      const isEdge = Math.abs(x) >= CONFIG.MAP_BOUNDS_X;

      let placeTree = false;
      if (isEdge) {
        placeTree = true;
      } else if (!isInitialSafe) {
        placeTree = Math.random() < 0.22;
      }

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

    const isTruck = Math.random() < 0.35;
    const speedMin = isTruck ? CONFIG.OBSTACLES.TRUCK.SPEED_MIN : CONFIG.OBSTACLES.CAR.SPEED_MIN;
    const speedMax = isTruck ? CONFIG.OBSTACLES.TRUCK.SPEED_MAX : CONFIG.OBSTACLES.CAR.SPEED_MAX;
    
    // 前期 (z < 25) 車速降低
    const isEarlyGame = rowData.z < 25;
    const speedFactor = isEarlyGame ? 0.75 : 1.0;
    rowData.speed = (speedMin + Math.random() * (speedMax - speedMin)) * speedFactor;

    const vehicleWidth = isTruck ? CONFIG.OBSTACLES.TRUCK.WIDTH : CONFIG.OBSTACLES.CAR.WIDTH;
    const vehicleDepth = isTruck ? CONFIG.OBSTACLES.TRUCK.DEPTH : CONFIG.OBSTACLES.CAR.DEPTH;

    // 前期車輛間距加大，簡單好過
    const spacingFactor = isEarlyGame ? 1.6 : 1.0;
    const spacing = (vehicleWidth + CONFIG.GRID_SIZE * (3 + Math.random() * 2.5)) * spacingFactor;
    const totalSpan = (CONFIG.MAP_BOUNDS_X * 2 + 6) * CONFIG.GRID_SIZE;
    const count = Math.floor(totalSpan / spacing);

    const colors = isTruck ? CONFIG.COLORS.TRUCK_COLORS : CONFIG.COLORS.CAR_COLORS;

    for (let i = 0; i < count; i++) {
      const colorHex = colors[Math.floor(Math.random() * colors.length)];
      const mesh = isTruck ? createTruckMesh(colorHex) : createCarMesh(colorHex);

      const startX = -totalSpan / 2 + i * spacing + (Math.random() * 1.0);
      mesh.position.set(startX, 0.2, 0);

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
      const segLen = Math.floor(Math.random() * 3) + 2;
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

      const gap = (segLen + 2.2 + Math.random() * 2.5) * CONFIG.GRID_SIZE;
      currentX += gap;
    }
  }

  buildRailroadRow(rowData, rowGroup) {
    const lane = new THREE.Mesh(this.laneGeo, this.railroadGravelMat);
    lane.receiveShadow = true;
    rowGroup.add(lane);

    const rail1 = new THREE.Mesh(this.railGeo, this.railMat);
    rail1.position.set(0, 0.23, -0.28);
    const rail2 = new THREE.Mesh(this.railGeo, this.railMat);
    rail2.position.set(0, 0.23, 0.28);
    rowGroup.add(rail1, rail2);

    for (let x = -CONFIG.MAP_BOUNDS_X - 3; x <= CONFIG.MAP_BOUNDS_X + 3; x += 0.8) {
      const tie = new THREE.Mesh(this.tieGeo, this.tieMat);
      tie.position.set(x * CONFIG.GRID_SIZE, 0.21, 0);
      rowGroup.add(tie);
    }

    // 火車警示紅色雷射條 (對齊正版圖 2 警示效果)
    const stripeMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0
    });
    const warningStripe = new THREE.Mesh(this.warningStripeGeo, stripeMat);
    warningStripe.position.set(0, 0.24, 0);
    rowGroup.add(warningStripe);
    rowData.warningStripe = warningStripe;

    const signalMesh = createSignalMesh();
    const signalX = (CONFIG.MAP_BOUNDS_X - 0.5) * CONFIG.GRID_SIZE;
    signalMesh.position.set(signalX, 0.2, 0.4);
    rowGroup.add(signalMesh);
    rowData.signal = signalMesh;

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

  animateObstacles(deltaTime, elapsedTime, speedMultiplier = 1.0) {
    const boundMargin = (CONFIG.MAP_BOUNDS_X + 5) * CONFIG.GRID_SIZE;
    const effectiveDelta = deltaTime * speedMultiplier;

    for (const row of this.activeRows.values()) {
      if (row.type === CONFIG.ROW_TYPES.ROAD) {
        row.vehicles.forEach((veh) => {
          veh.position.x += row.direction * veh.speed * effectiveDelta;

          if (row.direction === 1 && veh.position.x > boundMargin) {
            veh.position.x = -boundMargin;
          } else if (row.direction === -1 && veh.position.x < -boundMargin) {
            veh.position.x = boundMargin;
          }
        });
      }

      else if (row.type === CONFIG.ROW_TYPES.RIVER) {
        row.logs.forEach((log) => {
          log.position.x += row.direction * log.speed * effectiveDelta;

          if (row.direction === 1 && log.position.x > boundMargin + 2) {
            log.position.x = -boundMargin - 2;
          } else if (row.direction === -1 && log.position.x < -boundMargin - 2) {
            log.position.x = boundMargin + 2;
          }
        });
      }

      else if (row.type === CONFIG.ROW_TYPES.RAILROAD && row.train) {
        const { bulbMat } = row.signal.userData;
        const stripeMat = row.warningStripe.material;

        if (row.trainState === 'IDLE') {
          row.idleTimer -= effectiveDelta;
          bulbMat.color.setHex(CONFIG.COLORS.SIGNAL_OFF);
          stripeMat.opacity = 0;

          if (row.idleTimer <= 0) {
            row.trainState = 'WARNING';
            row.warningTimer = CONFIG.OBSTACLES.TRAIN.WARNING_TIME;
            row.train.position.x = -row.direction * (boundMargin + row.train.length / 2);
          }
        } else if (row.trainState === 'WARNING') {
          row.warningTimer -= effectiveDelta;

          // 號誌紅燈閃爍 + 整條軌道紅色雷射警示光束 (對齊圖 2)
          const flash = Math.floor(elapsedTime * 10) % 2 === 0;
          bulbMat.color.setHex(flash ? CONFIG.COLORS.SIGNAL_RED : CONFIG.COLORS.SIGNAL_OFF);
          stripeMat.opacity = flash ? 0.45 : 0.15;

          if (row.warningTimer <= 0) {
            row.trainState = 'TRAIN_PASSING';
            bulbMat.color.setHex(CONFIG.COLORS.SIGNAL_RED);
            stripeMat.opacity = 0.55;
          }
        } else if (row.trainState === 'TRAIN_PASSING') {
          row.train.position.x += row.direction * row.train.speed * effectiveDelta;
          stripeMat.opacity = 0.55;

          const trainPassed = row.direction === 1
            ? row.train.position.x > boundMargin + row.train.length / 2
            : row.train.position.x < -boundMargin - row.train.length / 2;

          if (trainPassed) {
            row.trainState = 'IDLE';
            row.idleTimer = CONFIG.OBSTACLES.TRAIN.INTERVAL_MIN +
              Math.random() * (CONFIG.OBSTACLES.TRAIN.INTERVAL_MAX - CONFIG.OBSTACLES.TRAIN.INTERVAL_MIN);
            bulbMat.color.setHex(CONFIG.COLORS.SIGNAL_OFF);
            stripeMat.opacity = 0;
          }
        }
      }
    }
  }

  getActiveRows() {
    return this.activeRows;
  }

  removeRow(z, rowData) {
    this.scene.remove(rowData.mesh);
    rowData.mesh.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry !== this.laneGeo && child.geometry !== this.railGeo && child.geometry !== this.tieGeo && child.geometry !== this.warningStripeGeo) {
          child.geometry.dispose();
        }
      }
    });
    this.activeRows.delete(z);
  }

  reset() {
    for (const [z, row] of this.activeRows.entries()) {
      this.removeRow(z, row);
    }
    this.activeRows.clear();
    this.currentClusterType = CONFIG.ROW_TYPES.GRASS;
    this.clusterRemaining = CONFIG.INITIAL_SAFE_ROWS;
  }
}
