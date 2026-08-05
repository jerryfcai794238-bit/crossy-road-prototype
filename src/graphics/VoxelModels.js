import * as THREE from 'three';
import { CONFIG } from '../config.js';

// 輔助函式：建立開啓陰影的方塊網格
function createCube(width, height, depth, colorHex) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshLambertMaterial({ color: colorHex });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 👑 體素金黃皇冠 (Crown Voxel Model for #1 Leader)
export function createCrown() {
  const group = new THREE.Group();

  // 皇冠底座 (Golden Base)
  const base = createCube(0.5, 0.12, 0.5, 0xffcc00);
  base.position.y = 0.06;
  group.add(base);

  // 皇冠 4 個頂角尖刺 (Golden Spikes)
  const spike1 = createCube(0.12, 0.25, 0.12, 0xffcc00);
  spike1.position.set(0.18, 0.22, 0.18);

  const spike2 = createCube(0.12, 0.25, 0.12, 0xffcc00);
  spike2.position.set(-0.18, 0.22, 0.18);

  const spike3 = createCube(0.12, 0.25, 0.12, 0xffcc00);
  spike3.position.set(0.18, 0.22, -0.18);

  const spike4 = createCube(0.12, 0.25, 0.12, 0xffcc00);
  spike4.position.set(-0.18, 0.22, -0.18);

  const centerSpike = createCube(0.15, 0.32, 0.15, 0xffe066);
  centerSpike.position.set(0, 0.25, 0);

  // 鑲嵌紅寶石 (Ruby Gemstone)
  const gem = createCube(0.12, 0.12, 0.12, 0xff4757);
  gem.position.set(0, 0.15, 0.26);

  group.add(spike1, spike2, spike3, spike4, centerSpike, gem);
  group.scale.set(0.85, 0.85, 0.85);

  return group;
}

// 1. 小雞體素模型 (Chicken Voxel Model)
export function createChicken() {
  const group = new THREE.Group();

  // 身體 (White Body)
  const body = createCube(0.7, 0.7, 0.7, CONFIG.COLORS.CHICKEN);
  body.position.y = 0.55;
  group.add(body);

  // 雞冠 (Red Comb)
  const comb = createCube(0.15, 0.25, 0.35, CONFIG.COLORS.COMB);
  comb.position.set(0, 0.95, 0.05);
  group.add(comb);

  // 嘴巴 (Orange Beak)
  const beak = createCube(0.25, 0.15, 0.25, CONFIG.COLORS.BEAK);
  beak.position.set(0, 0.55, 0.45);
  group.add(beak);

  // 眼睛 (Black Eyes)
  const leftEye = createCube(0.08, 0.12, 0.08, 0x1e293b);
  leftEye.position.set(0.36, 0.65, 0.2);
  const rightEye = createCube(0.08, 0.12, 0.08, 0x1e293b);
  rightEye.position.set(-0.36, 0.65, 0.2);
  group.add(leftEye, rightEye);

  // 雙腳 (Yellow Legs/Feet)
  const leftLeg = createCube(0.12, 0.25, 0.12, CONFIG.COLORS.BEAK);
  leftLeg.position.set(0.2, 0.12, 0);
  const rightLeg = createCube(0.12, 0.25, 0.12, CONFIG.COLORS.BEAK);
  rightLeg.position.set(-0.2, 0.12, 0);
  group.add(leftLeg, rightLeg);

  group.scale.set(0.95, 0.95, 0.95);
  return group;
}

// 2. 黃色小鴨 (Duck Voxel Model - AI 對手 1)
export function createDuck() {
  const group = new THREE.Group();

  const body = createCube(0.75, 0.7, 0.75, 0xfed330);
  body.position.y = 0.55;
  group.add(body);

  const beak = createCube(0.38, 0.12, 0.3, 0xfa8231);
  beak.position.set(0, 0.5, 0.48);
  group.add(beak);

  const leftEye = createCube(0.08, 0.12, 0.08, 0x1e293b);
  leftEye.position.set(0.39, 0.65, 0.2);
  const rightEye = createCube(0.08, 0.12, 0.08, 0x1e293b);
  rightEye.position.set(-0.39, 0.65, 0.2);
  group.add(leftEye, rightEye);

  group.scale.set(0.95, 0.95, 0.95);
  return group;
}

// 3. 綠色青蛙 (Frog Voxel Model - AI 對手 2)
export function createFrog() {
  const group = new THREE.Group();

  const body = createCube(0.8, 0.55, 0.75, 0x26de81);
  body.position.y = 0.48;
  group.add(body);

  // 大突起眼睛 (Big Frog Eyes)
  const leftEyeSocket = createCube(0.2, 0.2, 0.2, 0x26de81);
  leftEyeSocket.position.set(0.25, 0.8, 0.2);
  const leftPupil = createCube(0.08, 0.1, 0.08, 0x1e293b);
  leftPupil.position.set(0.25, 0.82, 0.28);

  const rightEyeSocket = createCube(0.2, 0.2, 0.2, 0x26de81);
  rightEyeSocket.position.set(-0.25, 0.8, 0.2);
  const rightPupil = createCube(0.08, 0.1, 0.08, 0x1e293b);
  rightPupil.position.set(-0.25, 0.82, 0.28);

  group.add(leftEyeSocket, leftPupil, rightEyeSocket, rightPupil);

  group.scale.set(0.95, 0.95, 0.95);
  return group;
}

// 4. 體素柴犬 (Shiba Voxel Model - AI 對手 3)
export function createShiba() {
  const group = new THREE.Group();

  // 赤柴棕色身體 (Brown Shiba Body)
  const body = createCube(0.72, 0.72, 0.8, 0xe1b12c);
  body.position.y = 0.55;
  group.add(body);

  // 白色口吻 (White Muzzle)
  const muzzle = createCube(0.35, 0.25, 0.25, 0xf5f6fa);
  muzzle.position.set(0, 0.45, 0.45);
  const nose = createCube(0.12, 0.1, 0.1, 0x1e293b);
  nose.position.set(0, 0.52, 0.58);
  group.add(muzzle, nose);

  // 立耳 (Ears)
  const leftEar = createCube(0.15, 0.22, 0.15, 0xe1b12c);
  leftEar.position.set(0.26, 0.98, 0.15);
  const rightEar = createCube(0.15, 0.22, 0.15, 0xe1b12c);
  rightEar.position.set(-0.26, 0.98, 0.15);
  group.add(leftEar, rightEar);

  const leftEye = createCube(0.08, 0.1, 0.08, 0x1e293b);
  leftEye.position.set(0.32, 0.65, 0.38);
  const rightEye = createCube(0.08, 0.1, 0.08, 0x1e293b);
  rightEye.position.set(-0.32, 0.65, 0.38);
  group.add(leftEye, rightEye);

  group.scale.set(0.95, 0.95, 0.95);
  return group;
}

// 5. 車輛體素模型工廠
export function createCar(colorHex) {
  const group = new THREE.Group();

  const chassis = createCube(1.2, 0.45, 1.8, colorHex);
  chassis.position.y = 0.35;

  const cabin = createCube(1.0, 0.4, 1.0, 0xffffff);
  cabin.position.set(0, 0.72, -0.1);

  const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8);
  const wheelMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.WHEEL });

  const wheels = [];
  const positions = [
    [-0.65, 0.2, 0.55],
    [0.65, 0.2, 0.55],
    [-0.65, 0.2, -0.55],
    [0.65, 0.2, -0.55]
  ];

  positions.forEach((pos) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(...pos);
    wheel.castShadow = true;
    wheels.push(wheel);
    group.add(wheel);
  });

  group.add(chassis);
  group.add(cabin);

  return group;
}

// 6. 大貨車體素模型 (Truck Voxel Model)
export function createTruck() {
  const group = new THREE.Group();

  const cab = createCube(1.3, 0.8, 0.9, CONFIG.COLORS.TRUCK_CAB);
  cab.position.set(0, 0.55, 1.0);

  const cargo = createCube(1.4, 1.1, 2.3, CONFIG.COLORS.TRUCK_CARGO);
  cargo.position.set(0, 0.75, -0.6);

  group.add(cab);
  group.add(cargo);

  return group;
}

// 7. 高速火車頭體素模型 (Train Engine Voxel Model)
export function createTrain() {
  const group = new THREE.Group();

  const body = createCube(1.4, 1.2, 8.0, 0xc0392b);
  body.position.y = 0.8;

  const roof = createCube(1.35, 0.25, 7.8, 0xe74c3c);
  roof.position.y = 1.48;

  const lamp = createCube(0.3, 0.3, 0.2, 0xf1c40f);
  lamp.position.set(0, 0.9, 4.05);

  group.add(body, roof, lamp);
  return group;
}

// 8. 鐵路號誌燈體素模型 (Signal Voxel Model)
export function createSignalMesh() {
  const group = new THREE.Group();
  const pole = createCube(0.15, 1.8, 0.15, 0x7f8c8d);
  pole.position.y = 0.9;

  const box = createCube(0.4, 0.7, 0.3, 0x2c3e50);
  box.position.set(0, 1.5, 0);

  const light = createCube(0.2, 0.2, 0.1, 0xe74c3c);
  light.position.set(0, 1.6, 0.16);

  group.add(pole, box, light);
  return group;
}

// 9. 樹木體素模型
export function createTree() {
  const group = new THREE.Group();

  const trunk = createCube(0.35, 0.7, 0.35, CONFIG.COLORS.TREE_TRUNK);
  trunk.position.y = 0.35;

  const foliageLow = createCube(1.0, 0.6, 1.0, CONFIG.COLORS.TREE_LEAVES);
  foliageLow.position.y = 0.9;

  const foliageMid = createCube(0.8, 0.6, 0.8, CONFIG.COLORS.TREE_LEAVES);
  foliageMid.position.y = 1.35;

  const foliageTop = createCube(0.5, 0.5, 0.5, CONFIG.COLORS.TREE_LEAVES);
  foliageTop.position.y = 1.75;

  group.add(trunk, foliageLow, foliageMid, foliageTop);
  return group;
}

// 10. 浮木體素模型
export function createLog(lengthInGrids = 3) {
  const group = new THREE.Group();
  const width = 0.85;
  const height = 0.3;
  const depth = lengthInGrids * CONFIG.GRID_SIZE * 0.95;

  const logMesh = createCube(width, height, depth, CONFIG.COLORS.LOG);
  logMesh.position.y = 0.05;

  group.add(logMesh);
  group.length = lengthInGrids;
  return group;
}

// 11. 老鷹體素模型 (Eagle Voxel Model)
export function createEagle() {
  const group = new THREE.Group();

  const body = createCube(1.0, 0.6, 1.2, 0x4a3728);
  body.position.y = 0.5;

  const head = createCube(0.5, 0.5, 0.5, 0xffffff);
  head.position.set(0, 0.65, 0.7);

  const beak = createCube(0.2, 0.2, 0.3, 0xffcc00);
  beak.position.set(0, 0.55, 1.0);

  const leftWing = createCube(2.0, 0.1, 0.8, 0x36271c);
  leftWing.position.set(1.4, 0.5, 0);

  const rightWing = createCube(2.0, 0.1, 0.8, 0x36271c);
  rightWing.position.set(-1.4, 0.5, 0);

  group.add(body, head, beak, leftWing, rightWing);
  group.scale.set(1.2, 1.2, 1.2);
  return group;
}

// 別名導出 (相容舊 MapGenerator 的 Export 別名)
export const createTreeMesh = createTree;
export const createCarMesh = createCar;
export const createTruckMesh = createTruck;
export const createLogMesh = createLog;
export const createTrainMesh = createTrain;
