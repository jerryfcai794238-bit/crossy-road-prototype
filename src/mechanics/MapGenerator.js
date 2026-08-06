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
    this.clusterRemaining = 5;

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
      trainState: 'IDLE',
      idleTimer: Math.random() * 4 + 3.0,
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

    const isTruck = Math.random() < 0.35;
    rowData.speed = 3.5 + Math.random() * 3.5;

    const vehicleWidth = isTruck ? 2.3 : 1.8;
    const spacing = vehicleWidth + CONFIG.GRID_SIZE * (3 + Math.random() * 2.5);
    const totalSpan = (CONFIG.MAP_BOUNDS_X * 2 + 8) * CONFIG.GRID_SIZE;
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

  buildRiverRow(rowData, rowGroup) {
    const lane = new THREE.Mesh(this.laneGeo, this.riverMat);
    lane.position.y = -0.05;
    rowGroup.add(lane);

    rowData.speed = 2.0 + Math.random() * 2.0;
    const logLength = Math.floor(Math.random() * 2) + 3;
    const logSpan = logLength * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE * (2.5 + Math.random() * 2);
    const totalSpan = (CONFIG.MAP_BOUNDS_X * 2 + 10) * CONFIG.GRID_SIZE;
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

    const signalMesh = createSignalMesh();
    signalMesh.position.set((-CONFIG.MAP_BOUNDS_X - 0.8) * CONFIG.GRID_SIZE, 0.2, 0);
    rowGroup.add(signalMesh);
    rowData.signal = signalMesh;
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
          if (row.idleTimer <= 0) {
            row.trainState = 'SIGNAL_FLASHING';
            row.warningTimer = 2.0;
          }
        } else if (row.trainState === 'SIGNAL_FLASHING') {
          row.warningTimer -= safeDelta;
          if (row.signal) {
            row.signal.rotation.y += safeDelta * 10.0;
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
          row.train.position.x += row.direction * 38.0 * safeDelta;
          if (Math.abs(row.train.position.x) > boundX * 2.0) {
            row.mesh.remove(row.train);
            row.train = null;
            row.trainState = 'IDLE';
            row.idleTimer = Math.random() * 5 + 4.0;
          }
        }
      }
    }
  }

  removeRow(z, row) {
    if (row && row.mesh) {
      this.scene.remove(row.mesh);
    }
    this.activeRows.delete(z);
  }

  getActiveRows() {
    return this.activeRows;
  }
}
