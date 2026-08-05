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

  const eyeL = createCube(0.08, 0.12, 0.08, 0x26de81);
  eyeL.position.set(0.39, 0.65, 0.2);
  const eyeR = createCube(0.08, 0.12, 0.08, 0x26de81);
  eyeR.position.set(-0.39, 0.65, 0.2);
  group.add(eyeL, eyeR);

  const wingL = createCube(0.1, 0.35, 0.45, 0xf7b731);
  wingL.position.set(0.42, 0.55, 0);
  const wingR = createCube(0.1, 0.35, 0.45, 0xf7b731);
  wingR.position.set(-0.42, 0.55, 0);
  group.add(wingL, wingR);

  const feetL = createCube(0.15, 0.12, 0.25, 0xfa8231);
  feetL.position.set(0.2, 0.06, 0.05);
  const feetR = createCube(0.15, 0.12, 0.25, 0xfa8231);
  feetR.position.set(-0.2, 0.06, 0.05);
  group.add(feetL, feetR);

  group.scale.set(0.95, 0.95, 0.95);
  return group;
}

// 3. 綠色青蛙 (Frog Voxel Model - AI 對手 2)
export function createFrog() {
  const group = new THREE.Group();

  const body = createCube(0.75, 0.6, 0.75, 0x26de81);
  body.position.y = 0.5;
  group.add(body);

  const belly = createCube(0.55, 0.45, 0.1, 0xffffff);
  belly.position.set(0, 0.45, 0.35);
  group.add(belly);

  const eyeLGroup = createCube(0.22, 0.22, 0.22, 0x20bf6b);
  eyeLGroup.position.set(0.25, 0.88, 0.2);
  const eyePupilL = createCube(0.1, 0.12, 0.1, 0x000000);
  eyePupilL.position.set(0.25, 0.88, 0.3);

  const eyeRGroup = createCube(0.22, 0.22, 0.22, 0x20bf6b);
  eyeRGroup.position.set(-0.25, 0.88, 0.2);
  const eyePupilR = createCube(0.1, 0.12, 0.1, 0x000000);
  eyePupilR.position.set(-0.25, 0.88, 0.3);

  group.add(eyeLGroup, eyePupilL, eyeRGroup, eyePupilR);

  const legL = createCube(0.2, 0.2, 0.45, 0x20bf6b);
  legL.position.set(0.42, 0.22, -0.05);
  const legR = createCube(0.2, 0.2, 0.45, 0x20bf6b);
  legR.position.set(-0.42, 0.22, -0.05);
  group.add(legL, legR);

  group.scale.set(0.95, 0.95, 0.95);
  return group;
}

// 4. 體素柴犬 (Shiba Voxel Model - AI 對手 3)
export function createShiba() {
  const group = new THREE.Group();

  const body = createCube(0.7, 0.7, 0.8, 0xe1b12c);
  body.position.y = 0.55;
  group.add(body);

  const snout = createCube(0.35, 0.25, 0.25, 0xf5f6fa);
  snout.position.set(0, 0.48, 0.45);
  const nose = createCube(0.12, 0.1, 0.1, 0x2f3640);
  nose.position.set(0, 0.52, 0.56);
  group.add(snout, nose);

  const earL = createCube(0.18, 0.22, 0.15, 0xcd840f);
  earL.position.set(0.25, 0.98, 0.15);
  const earR = createCube(0.18, 0.22, 0.15, 0xcd840f);
  earR.position.set(-0.25, 0.98, 0.15);
  group.add(earL, earR);

  const eyeL = createCube(0.08, 0.12, 0.08, 0x2f3640);
  eyeL.position.set(0.32, 0.65, 0.35);
  const eyeR = createCube(0.08, 0.12, 0.08, 0x2f3640);
  eyeR.position.set(-0.32, 0.65, 0.35);
  group.add(eyeL, eyeR);

  const tail = createCube(0.18, 0.3, 0.18, 0xf5f6fa);
  tail.position.set(0, 0.8, -0.42);
  group.add(tail);

  const legPositions = [
    [0.22, 0.12, 0.25], [-0.22, 0.12, 0.25],
    [0.22, 0.12, -0.25], [-0.22, 0.12, -0.25]
  ];
  legPositions.forEach(([x, y, z]) => {
    const leg = createCube(0.15, 0.25, 0.15, 0xf5f6fa);
    leg.position.set(x, y, z);
    group.add(leg);
  });

  group.scale.set(0.95, 0.95, 0.95);
  return group;
}

// 5. 轎車模型 (Car Voxel Model)
export function createCar(colorHex = 0xff4757) {
  const group = new THREE.Group();

  const body = createCube(1.4, 0.45, 0.95, colorHex);
  body.position.y = 0.35;
  group.add(body);

  const cabin = createCube(0.85, 0.4, 0.85, 0xffffff);
  cabin.position.set(-0.1, 0.75, 0);
  group.add(cabin);

  const windowGlass = createCube(0.8, 0.32, 0.87, 0x2f3542);
  windowGlass.position.set(-0.1, 0.75, 0);
  group.add(windowGlass);

  const wheelColor = 0x222222;
  const wheelPositions = [
    [0.45, 0.15, 0.48], [0.45, 0.15, -0.48],
    [-0.45, 0.15, 0.48], [-0.45, 0.15, -0.48]
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = createCube(0.35, 0.3, 0.15, wheelColor);
    wheel.position.set(x, y, z);
    group.add(wheel);
  });

  const lightL = createCube(0.08, 0.12, 0.18, 0xfffa65);
  lightL.position.set(0.71, 0.38, 0.3);
  const lightR = createCube(0.08, 0.12, 0.18, 0xfffa65);
  lightR.position.set(0.71, 0.38, -0.3);
  group.add(lightL, lightR);

  return group;
}

// 6. 卡車/貨車模型 (Truck Voxel Model)
export function createTruck(colorHex = 0x57606f) {
  const group = new THREE.Group();

  const cabin = createCube(0.7, 0.75, 0.95, 0xff6b6b);
  cabin.position.set(0.65, 0.5, 0);
  group.add(cabin);

  const cargo = createCube(1.4, 0.9, 1.0, colorHex || 0xf1f2f6);
  cargo.position.set(-0.4, 0.6, 0);
  group.add(cargo);

  const wheelPositions = [
    [0.65, 0.18, 0.48], [0.65, 0.18, -0.48],
    [-0.2, 0.18, 0.48], [-0.2, 0.18, -0.48],
    [-0.75, 0.18, 0.48], [-0.75, 0.18, -0.48]
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = createCube(0.38, 0.32, 0.15, 0x1e272e);
    wheel.position.set(x, y, z);
    group.add(wheel);
  });

  return group;
}

// 7. 樹木模型 (Tree Voxel Model)
export function createTree(type = 0) {
  const group = new THREE.Group();

  const trunk = createCube(0.35, 0.6, 0.35, CONFIG.COLORS.TREE_TRUNK);
  trunk.position.y = 0.3;
  group.add(trunk);

  const leafColor = CONFIG.COLORS.TREE_LEAVES[type % CONFIG.COLORS.TREE_LEAVES.length];

  const tier1 = createCube(1.0, 0.45, 1.0, leafColor);
  tier1.position.y = 0.8;
  const tier2 = createCube(0.75, 0.45, 0.75, leafColor);
  tier2.position.y = 1.25;
  const tier3 = createCube(0.5, 0.4, 0.5, leafColor);
  tier3.position.y = 1.65;

  group.add(tier1, tier2, tier3);
  return group;
}

// 8. 河流漂木模型 (Log Voxel Model)
export function createLog(lengthInGrids = 2.5) {
  const group = new THREE.Group();
  const width = lengthInGrids * CONFIG.GRID_SIZE * 0.85;

  const logBody = createCube(width, 0.3, 0.75, CONFIG.COLORS.LOG);
  logBody.position.y = 0.15;
  group.add(logBody);

  const ring1 = createCube(0.05, 0.22, 0.55, 0xd2b48c);
  ring1.position.set(width / 2 + 0.01, 0.15, 0);
  const ring2 = createCube(0.05, 0.22, 0.55, 0xd2b48c);
  ring2.position.set(-width / 2 - 0.01, 0.15, 0);
  group.add(ring1, ring2);

  return group;
}

// 9. 高速火車頭與車廂模型 (Train Voxel Model)
export function createTrain() {
  const group = new THREE.Group();

  const engine = createCube(3.2, 1.1, 0.95, CONFIG.COLORS.TRAIN);
  engine.position.y = 0.65;
  group.add(engine);

  const windowFront = createCube(0.4, 0.4, 0.96, 0xffd32a);
  windowFront.position.set(1.2, 0.8, 0);
  group.add(windowFront);

  const warningLight = createCube(0.2, 0.2, 0.2, 0xff4d4d);
  warningLight.position.set(1.5, 1.25, 0);
  group.add(warningLight);

  return group;
}

// 10. 鐵路號誌燈 (Signal Pole)
export function createSignal() {
  const group = new THREE.Group();

  const pole = createCube(0.12, 1.2, 0.12, 0x57606f);
  pole.position.y = 0.6;
  group.add(pole);

  const box = createCube(0.3, 0.45, 0.25, 0x2f3542);
  box.position.set(0, 1.0, 0);
  group.add(box);

  const bulbMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  const bulbGeo = new THREE.BoxGeometry(0.15, 0.15, 0.1);
  const bulb = new THREE.Mesh(bulbGeo, bulbMat);
  bulb.position.set(0, 1.0, 0.13);
  group.add(bulb);

  group.userData = { bulbMat };
  return group;
}

// 11. 體素老鷹模型 (Eagle Voxel Model - 正版 Eagle Grab 淘汰)
export function createEagle() {
  const group = new THREE.Group();

  const body = createCube(1.2, 0.8, 1.4, 0x4b3621);
  body.position.y = 0.6;
  group.add(body);

  const head = createCube(0.7, 0.6, 0.7, 0xf5f6fa);
  head.position.set(0, 0.85, 0.7);
  group.add(head);

  const beak = createCube(0.3, 0.35, 0.45, 0xfbc531);
  beak.position.set(0, 0.7, 1.15);
  group.add(beak);

  const wingL = createCube(1.8, 0.15, 0.9, 0x2f1b0c);
  wingL.position.set(1.4, 0.7, 0);
  wingL.rotation.z = -0.15;
  const wingR = createCube(1.8, 0.15, 0.9, 0x2f1b0c);
  wingR.position.set(-1.4, 0.7, 0);
  wingR.rotation.z = 0.15;
  group.add(wingL, wingR);

  const clawL = createCube(0.2, 0.3, 0.2, 0x44bd32);
  clawL.position.set(0.3, 0.15, 0.2);
  const clawR = createCube(0.2, 0.3, 0.2, 0x44bd32);
  clawR.position.set(-0.3, 0.15, 0.2);
  group.add(clawL, clawR);

  group.scale.set(1.2, 1.2, 1.2);
  return group;
}

// 12. 道具 VFX 特效模型
export function createShieldMesh() {
  const geometry = new THREE.SphereGeometry(0.85, 16, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0xf5cd79,
    transparent: true,
    opacity: 0.45
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.55;

  const innerGeo = new THREE.SphereGeometry(0.72, 12, 12);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xfffa65,
    transparent: true,
    opacity: 0.25
  });
  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  mesh.add(innerMesh);

  return mesh;
}

export function createRocketExhaust() {
  const group = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const p = createCube(0.18, 0.18, 0.18, Math.random() < 0.6 ? 0xff4757 : 0xffa502);
    p.position.set(
      (Math.random() - 0.5) * 0.4,
      -0.2 - Math.random() * 0.4,
      -0.3 - Math.random() * 0.3
    );
    group.add(p);
  }
  return group;
}

export function createRocketBlastRing() {
  const group = new THREE.Group();

  const geometry = new THREE.RingGeometry(0.3, 3.4, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff4757,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  group.add(ring);

  for (let i = 0; i < 12; i++) {
    const p = createCube(0.25, 0.25, 0.25, Math.random() < 0.5 ? 0xffa502 : 0xff781e);
    const angle = (i / 12) * Math.PI * 2;
    p.position.set(Math.cos(angle) * 1.8, 0.2, Math.sin(angle) * 1.8);
    group.add(p);
  }

  return group;
}

export function createTimeWave() {
  const geometry = new THREE.RingGeometry(0.2, 2.5, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00d2d3,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = 0.05;
  return mesh;
}

// === 導出 MapGenerator 相容之別名函數 ===
export const createTreeMesh = createTree;
export const createCarMesh = createCar;
export const createTruckMesh = createTruck;
export const createLogMesh = createLog;
export const createTrainMesh = createTrain;
export const createSignalMesh = createSignal;
