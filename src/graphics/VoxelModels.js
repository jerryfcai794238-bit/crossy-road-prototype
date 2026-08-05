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

// 2. 轎車模型 (Car Voxel Model)
export function createCar(colorHex = 0xff4757) {
  const group = new THREE.Group();

  // 車身底盤 (Chassis)
  const body = createCube(1.4, 0.45, 0.95, colorHex);
  body.position.y = 0.35;
  group.add(body);

  // 車頂駕駛艙 (Cabin)
  const cabin = createCube(0.85, 0.4, 0.85, 0xffffff);
  cabin.position.set(-0.1, 0.75, 0);
  group.add(cabin);

  // 車窗 (Windows)
  const windowGlass = createCube(0.8, 0.32, 0.87, 0x2f3542);
  windowGlass.position.set(-0.1, 0.75, 0);
  group.add(windowGlass);

  // 四個輪胎 (Wheels)
  const wheelColor = 0x222222;
  const wheelPositions = [
    [0.45, 0.15, 0.48],
    [0.45, 0.15, -0.48],
    [-0.45, 0.15, 0.48],
    [-0.45, 0.15, -0.48]
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = createCube(0.35, 0.3, 0.15, wheelColor);
    wheel.position.set(x, y, z);
    group.add(wheel);
  });

  // 車燈 (Headlights)
  const lightL = createCube(0.08, 0.12, 0.18, 0xfffa65);
  lightL.position.set(0.71, 0.38, 0.3);
  const lightR = createCube(0.08, 0.12, 0.18, 0xfffa65);
  lightR.position.set(0.71, 0.38, -0.3);
  group.add(lightL, lightR);

  return group;
}

// 3. 卡車/貨車模型 (Truck Voxel Model)
export function createTruck() {
  const group = new THREE.Group();

  // 車頭 (Cabin Front)
  const cabin = createCube(0.7, 0.75, 0.95, 0xff6b6b);
  cabin.position.set(0.65, 0.5, 0);
  group.add(cabin);

  // 後方貨斗 (Cargo Box)
  const cargo = createCube(1.4, 0.9, 1.0, 0xf1f2f6);
  cargo.position.set(-0.4, 0.6, 0);
  group.add(cargo);

  // 輪胎
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

// 4. 樹木模型 (Tree Voxel Model)
export function createTree() {
  const group = new THREE.Group();

  // 樹幹 (Trunk)
  const trunk = createCube(0.35, 0.6, 0.35, CONFIG.COLORS.TREE_TRUNK);
  trunk.position.y = 0.3;
  group.add(trunk);

  // 階梯狀樹葉 (Tiered Leaves)
  const leafColor = CONFIG.COLORS.TREE_LEAVES[Math.floor(Math.random() * CONFIG.COLORS.TREE_LEAVES.length)];

  const tier1 = createCube(1.0, 0.45, 1.0, leafColor);
  tier1.position.y = 0.8;
  const tier2 = createCube(0.75, 0.45, 0.75, leafColor);
  tier2.position.y = 1.25;
  const tier3 = createCube(0.5, 0.4, 0.5, leafColor);
  tier3.position.y = 1.65;

  group.add(tier1, tier2, tier3);
  return group;
}

// 5. 河流漂木模型 (Log Voxel Model)
export function createLog(lengthInGrids = 2.5) {
  const group = new THREE.Group();
  const width = lengthInGrids * CONFIG.GRID_SIZE * 0.85;

  const logBody = createCube(width, 0.3, 0.75, CONFIG.COLORS.LOG);
  logBody.position.y = 0.15;
  group.add(logBody);

  // 年輪細節
  const ring1 = createCube(0.05, 0.22, 0.55, 0xd2b48c);
  ring1.position.set(width / 2 + 0.01, 0.15, 0);
  const ring2 = createCube(0.05, 0.22, 0.55, 0xd2b48c);
  ring2.position.set(-width / 2 - 0.01, 0.15, 0);
  group.add(ring1, ring2);

  return group;
}

// 6. 高速火車頭與車廂模型 (Train Voxel Model)
export function createTrain() {
  const group = new THREE.Group();

  // 車頭 (Engine Body)
  const engine = createCube(3.2, 1.1, 0.95, CONFIG.COLORS.TRAIN);
  engine.position.y = 0.65;
  group.add(engine);

  // 車頭車窗
  const windowFront = createCube(0.4, 0.4, 0.96, 0xffd32a);
  windowFront.position.set(1.2, 0.8, 0);
  group.add(windowFront);

  // 警示燈 (Red Light)
  const warningLight = createCube(0.2, 0.2, 0.2, 0xff4d4d);
  warningLight.position.set(1.5, 1.25, 0);
  group.add(warningLight);

  return group;
}

// === 新增：道具特效 mesh 生成器 (Item VFX Creators) ===

// 7. 金剛護盾 Mesh (Shield Aura)
export function createShieldMesh() {
  const geometry = new THREE.SphereGeometry(0.85, 16, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0xf5cd79,
    transparent: true,
    opacity: 0.45,
    wireframe: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.55;

  // 內層微光
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

// 8. 火箭跳尾焰粒子群 (Rocket Exhaust Voxel Group)
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

// 9. 超感時間時鐘波紋 (Clock Wave Ring)
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
