import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * 建立體素小雞玩家模型
 */
export function createChicken() {
  const group = new THREE.Group();

  // 1. 身體 (Body) - 白色主要方塊
  const bodyGeo = new THREE.BoxGeometry(0.7, 0.75, 0.7);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 2. 雞冠 (Comb) - 紅色頂冠
  const combGeo = new THREE.BoxGeometry(0.18, 0.25, 0.35);
  const combMat = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
  const comb = new THREE.Mesh(combGeo, combMat);
  comb.position.set(0, 0.98, 0.05);
  comb.castShadow = true;
  group.add(comb);

  // 3. 嘴巴 (Beak) - 黃色鳥喙
  const beakGeo = new THREE.BoxGeometry(0.24, 0.16, 0.26);
  const beakMat = new THREE.MeshLambertMaterial({ color: 0xf39c12 });
  const beak = new THREE.Mesh(beakGeo, beakMat);
  beak.position.set(0, 0.55, 0.42);
  beak.castShadow = true;
  group.add(beak);

  // 4. 肉垂 (Wattle) - 嘴下紅肉垂
  const wattleGeo = new THREE.BoxGeometry(0.14, 0.16, 0.14);
  const wattleMat = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const wattle = new THREE.Mesh(wattleGeo, wattleMat);
  wattle.position.set(0, 0.42, 0.4);
  group.add(wattle);

  // 5. 眼睛 (Eyes) - 雙側黑眼珠
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const eyeGeo = new THREE.BoxGeometry(0.08, 0.12, 0.08);

  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(0.36, 0.65, 0.2);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(-0.36, 0.65, 0.2);
  group.add(rightEye);

  // 6. 翅膀 (Wings) - 兩側白翅膀
  const wingGeo = new THREE.BoxGeometry(0.12, 0.35, 0.45);
  const wingMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });

  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.position.set(0.38, 0.52, -0.05);
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWing.position.set(-0.38, 0.52, -0.05);
  group.add(rightWing);

  // 7. 腳 (Legs & Feet) - 橘黃色雙腳
  const legMat = new THREE.MeshLambertMaterial({ color: 0xe67e22 });
  const legGeo = new THREE.BoxGeometry(0.1, 0.25, 0.1);
  const footGeo = new THREE.BoxGeometry(0.18, 0.06, 0.24);

  const leftLegGroup = new THREE.Group();
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.y = 0.125;
  const leftFoot = new THREE.Mesh(footGeo, legMat);
  leftFoot.position.set(0, 0.03, 0.05);
  leftLegGroup.add(leftLeg, leftFoot);
  leftLegGroup.position.set(0.18, 0, 0);

  const rightLegGroup = new THREE.Group();
  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.y = 0.125;
  const rightFoot = new THREE.Mesh(footGeo, legMat);
  rightFoot.position.set(0, 0.03, 0.05);
  rightLegGroup.add(rightLeg, rightFoot);
  rightLegGroup.position.set(-0.18, 0, 0);

  group.add(leftLegGroup, rightLegGroup);

  group.scale.set(1, 1, 1);
  return group;
}

/**
 * 建立樹木模型
 */
export function createTreeMesh(type = 0) {
  const group = new THREE.Group();
  const size = CONFIG.GRID_SIZE;

  // 樹幹
  const trunkGeo = new THREE.BoxGeometry(size * 0.3, size * 0.5, size * 0.3);
  const trunkMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.TREE_TRUNK });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = size * 0.25;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // 樹葉
  const leafColor = CONFIG.COLORS.TREE_LEAVES[type % CONFIG.COLORS.TREE_LEAVES.length];
  const leafMat = new THREE.MeshLambertMaterial({ color: leafColor });

  if (type % 2 === 0) {
    // 松樹 / 松塔造型 (雙層體素金字塔)
    const layer1 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.85, size * 0.5, size * 0.85), leafMat);
    layer1.position.y = size * 0.65;
    layer1.castShadow = true;
    layer1.receiveShadow = true;

    const layer2 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.6, size * 0.5, size * 0.6), leafMat);
    layer2.position.y = size * 1.0;
    layer2.castShadow = true;

    const layer3 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.35, size * 0.4, size * 0.35), leafMat);
    layer3.position.y = size * 1.3;
    layer3.castShadow = true;

    group.add(layer1, layer2, layer3);
  } else {
    // 圓頂體素樹造型
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(size * 0.8, size * 0.9, size * 0.8), leafMat);
    canopy.position.y = size * 0.85;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    group.add(canopy);
  }

  return group;
}

/**
 * 建立車輛模型 (汽車)
 */
export function createCarMesh(colorHex) {
  const group = new THREE.Group();
  const width = CONFIG.OBSTACLES.CAR.WIDTH;
  const depth = CONFIG.OBSTACLES.CAR.DEPTH;

  // 車身底座
  const bodyGeo = new THREE.BoxGeometry(width, 0.45, depth);
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.32;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 車頂座
  const roofGeo = new THREE.BoxGeometry(width * 0.55, 0.38, depth * 0.85);
  const roofMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 0.65, 0);
  roof.castShadow = true;
  group.add(roof);

  // 車窗 (前/後/側)
  const windowGeo = new THREE.BoxGeometry(width * 0.57, 0.28, depth * 0.88);
  const windowMat = new THREE.MeshLambertMaterial({ color: 0xaed6f1 });
  const windows = new THREE.Mesh(windowGeo, windowMat);
  windows.position.set(0, 0.65, 0);
  group.add(windows);

  // 車輪 (4個黑輪)
  const wheelGeo = new THREE.BoxGeometry(0.3, 0.25, 0.15);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const offsets = [
    [-width * 0.3, 0.15, depth * 0.45],
    [width * 0.3, 0.15, depth * 0.45],
    [-width * 0.3, 0.15, -depth * 0.45],
    [width * 0.3, 0.15, -depth * 0.45]
  ];

  offsets.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, y, z);
    group.add(wheel);
  });

  return group;
}

/**
 * 建立卡車模型
 */
export function createTruckMesh(colorHex) {
  const group = new THREE.Group();
  const width = CONFIG.OBSTACLES.TRUCK.WIDTH;
  const depth = CONFIG.OBSTACLES.TRUCK.DEPTH;

  // 車頭 (Cab)
  const cabGeo = new THREE.BoxGeometry(0.8, 0.7, depth * 0.9);
  const cabMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const cab = new THREE.Mesh(cabGeo, cabMat);
  cab.position.set(width * 0.35, 0.45, 0);
  cab.castShadow = true;
  group.add(cab);

  // 貨廂 (Container)
  const boxGeo = new THREE.BoxGeometry(width * 0.65, 0.95, depth * 0.95);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0xecf0f1 });
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.set(-width * 0.18, 0.58, 0);
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);

  // 車輪 (6個黑輪)
  const wheelGeo = new THREE.BoxGeometry(0.3, 0.28, 0.15);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelPositions = [
    [width * 0.35, 0.15, depth * 0.48],
    [width * 0.35, 0.15, -depth * 0.48],
    [-width * 0.1, 0.15, depth * 0.48],
    [-width * 0.1, 0.15, -depth * 0.48],
    [-width * 0.38, 0.15, depth * 0.48],
    [-width * 0.38, 0.15, -depth * 0.48]
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, y, z);
    group.add(wheel);
  });

  return group;
}

/**
 * 建立浮木模型 (River Log)
 */
export function createLogMesh(segmentCount = 3) {
  const group = new THREE.Group();
  const logWidth = segmentCount * CONFIG.GRID_SIZE;
  const depth = 0.85;

  // 木頭主體
  const logGeo = new THREE.BoxGeometry(logWidth, 0.35, depth);
  const logMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.LOG });
  const log = new THREE.Mesh(logGeo, logMat);
  log.position.y = 0.12;
  log.castShadow = true;
  log.receiveShadow = true;
  group.add(log);

  // 木頭截面 (兩端淡色木輪紋顏色)
  const endGeo = new THREE.BoxGeometry(0.06, 0.31, depth * 0.9);
  const endMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.LOG_END });

  const leftEnd = new THREE.Mesh(endGeo, endMat);
  leftEnd.position.set(-logWidth / 2 + 0.02, 0.12, 0);

  const rightEnd = new THREE.Mesh(endGeo, endMat);
  rightEnd.position.set(logWidth / 2 - 0.02, 0.12, 0);

  group.add(leftEnd, rightEnd);

  return group;
}

/**
 * 建立高速火車模型
 */
export function createTrainMesh() {
  const group = new THREE.Group();
  const length = CONFIG.OBSTACLES.TRAIN.LENGTH;

  // 車廂本體
  const bodyGeo = new THREE.BoxGeometry(length, 1.3, 1.0);
  const bodyMat = new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.TRAIN });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  group.add(body);

  // 車頂黃線條裝飾
  const stripeGeo = new THREE.BoxGeometry(length, 0.15, 1.02);
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xf1c40f });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.85;
  group.add(stripe);

  // 車燈 (兩端頭燈)
  const lightGeo = new THREE.BoxGeometry(0.1, 0.3, 0.3);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const frontLight = new THREE.Mesh(lightGeo, lightMat);
  frontLight.position.set(length / 2 + 0.01, 0.7, 0);

  const backLight = new THREE.Mesh(lightGeo, lightMat);
  backLight.position.set(-length / 2 - 0.01, 0.7, 0);

  group.add(frontLight, backLight);

  return group;
}

/**
 * 建立鐵路警示燈模型
 */
export function createSignalMesh() {
  const group = new THREE.Group();

  // 立柱
  const postGeo = new THREE.BoxGeometry(0.12, 1.6, 0.12);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.y = 0.8;
  post.castShadow = true;
  group.add(post);

  // 號誌燈箱
  const boxGeo = new THREE.BoxGeometry(0.35, 0.55, 0.3);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.set(0, 1.35, 0);
  group.add(box);

  // 發光燈泡
  const bulbGeo = new THREE.BoxGeometry(0.18, 0.18, 0.32);
  const bulbMat = new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.SIGNAL_OFF });
  const bulb = new THREE.Mesh(bulbGeo, bulbMat);
  bulb.position.set(0, 1.35, 0);
  group.add(bulb);

  group.userData = { bulbMesh: bulb, bulbMat: bulbMat };
  return group;
}
