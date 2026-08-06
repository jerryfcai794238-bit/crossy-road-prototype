import * as THREE from 'three';
import { CONFIG } from '../config.js';

function createCube(width, height, depth, colorHex) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshLambertMaterial({ color: colorHex });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// 1. 小雞體素模型 (Chicken)
export function createChicken() {
  const group = new THREE.Group();

  const body = createCube(0.7, 0.7, 0.7, CONFIG.COLORS.CHICKEN);
  body.position.y = 0.55;
  group.add(body);

  const comb = createCube(0.15, 0.25, 0.35, CONFIG.COLORS.COMB);
  comb.position.set(0, 0.95, 0.05);
  group.add(comb);

  const beak = createCube(0.25, 0.15, 0.25, CONFIG.COLORS.BEAK);
  beak.position.set(0, 0.55, 0.45);
  group.add(beak);

  const leftEye = createCube(0.08, 0.12, 0.08, 0x1e293b);
  leftEye.position.set(0.36, 0.65, 0.2);
  const rightEye = createCube(0.08, 0.12, 0.08, 0x1e293b);
  rightEye.position.set(-0.36, 0.65, 0.2);
  group.add(leftEye, rightEye);

  const leftLeg = createCube(0.12, 0.25, 0.12, CONFIG.COLORS.BEAK);
  leftLeg.position.set(0.2, 0.12, 0);
  const rightLeg = createCube(0.12, 0.25, 0.12, CONFIG.COLORS.BEAK);
  rightLeg.position.set(-0.2, 0.12, 0);
  group.add(leftLeg, rightLeg);

  group.scale.set(0.95, 0.95, 0.95);
  return group;
}

// 2. 車輛體素模型 (Car)
export function createCar(colorHex = 0xe74c3c) {
  const group = new THREE.Group();

  const chassis = createCube(1.2, 0.45, 1.8, colorHex);
  chassis.position.y = 0.35;

  const cabin = createCube(1.0, 0.4, 1.0, 0xffffff);
  cabin.position.set(0, 0.72, -0.1);

  const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8);
  const wheelMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.WHEEL });

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
    group.add(wheel);
  });

  group.add(chassis, cabin);
  return group;
}

// 3. 大貨車體素模型 (Truck)
export function createTruck() {
  const group = new THREE.Group();

  const cab = createCube(1.3, 0.8, 0.9, CONFIG.COLORS.TRUCK_CAB);
  cab.position.set(0, 0.55, 1.0);

  const cargo = createCube(1.4, 1.1, 2.3, CONFIG.COLORS.TRUCK_CARGO);
  cargo.position.set(0, 0.75, -0.6);

  group.add(cab, cargo);
  return group;
}

// 4. 高速火車頭 (Train)
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

// 5. 樹木體素模型 (Tree)
export function createTree(treeType = 0) {
  const group = new THREE.Group();

  const leavesColors = CONFIG.COLORS.TREE_LEAVES;
  const leafColor = Array.isArray(leavesColors)
    ? leavesColors[treeType % leavesColors.length]
    : (leavesColors || 0x27ae60);

  const trunk = createCube(0.35, 0.7, 0.35, CONFIG.COLORS.TREE_TRUNK);
  trunk.position.y = 0.35;

  const foliageLow = createCube(1.0, 0.6, 1.0, leafColor);
  foliageLow.position.y = 0.9;

  const foliageMid = createCube(0.8, 0.6, 0.8, leafColor);
  foliageMid.position.y = 1.35;

  const foliageTop = createCube(0.5, 0.5, 0.5, leafColor);
  foliageTop.position.y = 1.75;

  group.add(trunk, foliageLow, foliageMid, foliageTop);
  return group;
}

// 6. 浮木體素模型 (Log)
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

// 7. 老鷹體素模型 (Eagle)
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
  return group;
}

// 8. 鐵路號誌燈 (Signal)
export function createSignalMesh() {
  const group = new THREE.Group();

  const pole = createCube(0.15, 2.0, 0.15, 0x7f8c8d);
  pole.position.y = 1.0;

  const box = createCube(0.7, 0.4, 0.2, 0x1e293b);
  box.position.set(0, 1.7, 0);

  // 左紅燈與右紅燈獨立燈珠
  const leftLightMat = new THREE.MeshBasicMaterial({ color: 0x440000 });
  const leftLightGeo = new THREE.BoxGeometry(0.22, 0.22, 0.1);
  const leftLight = new THREE.Mesh(leftLightGeo, leftLightMat);
  leftLight.position.set(-0.2, 1.7, 0.11);

  const rightLightMat = new THREE.MeshBasicMaterial({ color: 0x440000 });
  const rightLightGeo = new THREE.BoxGeometry(0.22, 0.22, 0.1);
  const rightLight = new THREE.Mesh(rightLightGeo, rightLightMat);
  rightLight.position.set(0.2, 1.7, 0.11);

  group.add(pole, box, leftLight, rightLight);

  group.leftLightMat = leftLightMat;
  group.rightLightMat = rightLightMat;

  return group;
}

export const createTreeMesh = createTree;
export const createCarMesh = createCar;
export const createTruckMesh = createTruck;
export const createLogMesh = createLog;
export const createTrainMesh = createTrain;
