import * as THREE from 'three';
import { CASUAL_PLAYER_COUNT, CONFIG, loadGameConfig } from './config.js';
import { SceneSetup } from './graphics/SceneSetup.js';
import { AI_CHARACTER_VARIANTS, createChicken, createEagle } from './graphics/VoxelModels.js';
import { Player } from './mechanics/Player.js';
import { AIBot } from './mechanics/AIBot.js';
import { getHighestOtherLeaderStrikeTarget } from './mechanics/LeaderStrikeTargeting.js';
import { MapGenerator } from './mechanics/MapGenerator.js';
import { Physics } from './mechanics/Physics.js';
import { UIManager } from './ui/UIManager.js';
import { PartyItemSystem } from './mechanics/PartyItemSystem.js';
import { CasualRecovery } from './mechanics/CasualRecovery.js';

// 開發驗證開關：只啟用道具生成、獨立道具分與回饋；正式前進分／排行榜不納入道具分。
const SCORE_ITEM_PROTOTYPE_ENABLED = true;
const DYNAMIC_HOLES_PROTOTYPE_ENABLED = true;
const SPRING_PUNCH_PROTOTYPE_ENABLED = true;
const LEADER_STRIKE_PROTOTYPE_ENABLED = true;
export const CASUAL_START_SLOTS = [0, -2, -1, 1, 2];

export class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.uiManager = new UIManager();

    // 1. 3D 場景
    this.sceneSetup = new SceneSetup(this.container);
    this.scene = this.sceneSetup.scene;

    // 2. 地圖與物理
    this.mapGenerator = new MapGenerator(this.scene);
    this.mapGenerator.actorBoundsGetter = () => {
      if (this.currentMode !== 'casual') return null;
      const actors = this.getActiveActors();
      const positions = actors.flatMap((actor) => [actor.gridZ, actor.targetGridZ]).filter(Number.isFinite);
      const checkpointZs = [this.casualCheckpoint?.z, ...this.bots.map((bot) => bot.checkpoint?.z)].filter(Number.isFinite);
      return {
        highestZ: positions.length ? Math.max(...positions) : 0,
        lowestZ: positions.length ? Math.min(...positions) : 0,
        checkpointZs
      };
    };
    this.scoreItemsPrototypeEnabled = SCORE_ITEM_PROTOTYPE_ENABLED;
    this.dynamicHolesPrototypeEnabled = DYNAMIC_HOLES_PROTOTYPE_ENABLED;
    this.mapGenerator.scoreItemsEnabled = this.scoreItemsPrototypeEnabled;
    this.springPunchPrototypeEnabled = SPRING_PUNCH_PROTOTYPE_ENABLED;
    this.mapGenerator.springPunchItemsEnabled = this.springPunchPrototypeEnabled;
    this.mapGenerator.springPunchReferenceX = () => this.player?.gridX ?? 0;
    this.leaderStrikePrototypeEnabled = LEADER_STRIKE_PROTOTYPE_ENABLED;
    this.mapGenerator.leaderStrikeItemsEnabled = this.leaderStrikePrototypeEnabled;
    this.mapGenerator.leaderStrikeReferenceX = () => this.player?.gridX ?? 0;
    this.physics = new Physics();

    // 3. 狀態
    this.isGameStarted = false;
    this.isGameOver = false;
    this.isPaused = false;
    this.matchState = 'idle';
    this.matchTimer = null;
    this.pendingRespawns = new Map();

    // 身後老鷹底邊界推進 (0.35格/秒)
    this.cameraAutoScrollZ = CONFIG.CAMERA.START_Z * CONFIG.GRID_SIZE;

    this.idleTimer = 0;
    this.lastPlayerZ = 0;
    this.eagleMesh = null;
    this.isEagleAttacking = false;
    this.eagleAttackTimer = null;
    this.casualDuration = CONFIG.MATCH.CASUAL_DURATION;
    this.casualTimeRemaining = this.casualDuration;
    this.casualCheckpoint = { x: 0, z: 0 };
    this.lastLandedZ = 0;
    this.scoreRewardEffects = [];
    this.springPunches = [];
    this.springPunchEffects = [];
    this.leaderStrikes = [];
    this.leaderStrikeEffects = [];
    this.partyItemStates = new Map();

    // 4. 小雞主角
    this.chickenMesh = createChicken();
    this.scene.add(this.chickenMesh);
    this.player = new Player(this.chickenMesh);
    this.bots = [];
    this.partyItems = new PartyItemSystem(this);
    this.partyItemStates = this.partyItems.states;
    this.casualRecovery = new CasualRecovery(this);
    this.mapGenerator.scoreItemCellBlocked = (gridPosition) => Boolean(this.getActorAtGrid(gridPosition));
    this.mapGenerator.scoreItemReferenceX = () => this.player?.gridX ?? 0;
    this.mapGenerator.springPunchCellBlocked = (gridPosition) => Boolean(this.getActorAtGrid(gridPosition)) || this.mapGenerator.scoreItems.has(`${gridPosition.x},${gridPosition.z}`) || this.mapGenerator.leaderStrikeItems.has(`${gridPosition.x},${gridPosition.z}`);
    this.mapGenerator.leaderStrikeCellBlocked = (gridPosition) => Boolean(this.getActorAtGrid(gridPosition)) || this.mapGenerator.scoreItems.has(`${gridPosition.x},${gridPosition.z}`) || this.mapGenerator.springPunchItems.has(`${gridPosition.x},${gridPosition.z}`);
    this.mapGenerator.dynamicHoleCellBlocked = (gridPosition) => {
      const isPlayerCheckpoint = gridPosition.x === this.casualCheckpoint?.x && gridPosition.z === this.casualCheckpoint?.z;
      const isBotCheckpoint = this.bots.some((bot) => (
        gridPosition.x === bot.checkpoint?.x && gridPosition.z === bot.checkpoint?.z
      ));
      return isPlayerCheckpoint || isBotCheckpoint;
    };

    this.clock = new THREE.Clock();

    // 5. 初始化輸入與地圖 (修復模式參數 mode 傳遞)
    this.setupInputListeners();
    this.uiManager.init(
      (mode) => this.startGame(mode),
      (mode) => this.restartGame(mode),
      () => this.returnLobby(),
      () => this.cancelCasualMatching(),
      () => this.openGameSettings(),
      () => this.resumeGame(),
      () => this.leaveGame()
    );

    this.mapGenerator.initMap();

    // 啟動動畫迴圈
    this.animate = this.animate.bind(this);
    this.animate();
  }

  setupInputListeners() {
    window.addEventListener('keydown', (e) => {
      if (!this.isGameStarted || this.isGameOver || this.isPaused) return;
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') this.handlePlayerInput('UP');
      else if (key === 's' || key === 'arrowdown') this.handlePlayerInput('DOWN');
      else if (key === 'a' || key === 'arrowleft') this.handlePlayerInput('LEFT');
      else if (key === 'd' || key === 'arrowright') this.handlePlayerInput('RIGHT');
    });

    // 虛擬 D-Pad 控制器
    document.getElementById('btn-up')?.addEventListener('click', () => this.handlePlayerInput('UP'));
    document.getElementById('btn-down')?.addEventListener('click', () => this.handlePlayerInput('DOWN'));
    document.getElementById('btn-left')?.addEventListener('click', () => this.handlePlayerInput('LEFT'));
    document.getElementById('btn-right')?.addEventListener('click', () => this.handlePlayerInput('RIGHT'));

    // 螢幕點擊往前跳
    this.container?.addEventListener('pointerdown', (e) => {
      if (
        e.target.closest('#hud') ||
        e.target.closest('#leaderboard') ||
        e.target.closest('#mobile-controls') ||
        e.target.closest('.overlay')
      ) return;
      if (!this.isGameStarted || this.isGameOver || this.isPaused) return;
      this.handlePlayerInput('UP');
    });
  }

  handlePlayerInput(direction, distance = 1) {
    if (!this.isGameStarted || this.isGameOver || this.isPaused) return;
    if (this.player.stunTimer > 0) return;

    if (this.player.isJumping) {
      this.player.queueInput(direction, distance);
      return;
    }

    this.handlePlayerMove(direction, distance);
  }

  handlePlayerMove(direction, distance = 1, isBuffered = false) {
    if (!this.isGameStarted || this.isGameOver) return;

    const movePlan = this.planActorMove(this.player, direction, distance);
    if (!movePlan.canMove) {
      this.player.setFacingDirection(direction);
      // 前方角色尚在跳躍時，保留本次有效意圖，等其落地後優先重判；
      // 靜態牆／危險格只拒絕這一步，不吞掉已排隊的後續輸入。
      if (movePlan.waitForActor && !isBuffered) this.player.queueInput(direction, distance);
      return movePlan.waitForActor ? 'waiting' : 'blocked';
    } else {
      this.startActorMovePlan(movePlan);
      // 玩家跳躍時底邊界對齊
      const maxZ = Number.isFinite(this.player.maxReachedZ) ? this.player.maxReachedZ : 0;
      const catchupZ = (maxZ - 3.0) * CONFIG.GRID_SIZE;
      this.cameraAutoScrollZ = Math.max(this.cameraAutoScrollZ, catchupZ);
      this.player.minAllowedZ = Math.floor(this.cameraAutoScrollZ / CONFIG.GRID_SIZE);

      this.mapGenerator.update(this.player.gridZ);
      this.uiManager.updateScore(this.player.score);
      return 'moved';
    }
  }

  getActiveActors() {
    return [this.player, ...this.bots].filter((actor) => actor && !actor.isDead);
  }

  getActorAtGrid(gridPosition, excludedActors = []) {
    return this.getActiveActors().find((actor) => {
      if (excludedActors.includes(actor)) return false;
      const occupiesGrid = actor.gridX === gridPosition.x && actor.gridZ === gridPosition.z;
      const reservesGrid = actor.isJumping && actor.targetGridX === gridPosition.x && actor.targetGridZ === gridPosition.z;
      return occupiesGrid || reservesGrid;
    }) || null;
  }

  canActorEnter(actor, gridPosition, excludedActors = []) {
    if (Math.abs(gridPosition.x) > CONFIG.MAP_BOUNDS_X) return false;
    if (gridPosition.z < actor.minAllowedZ) return false;
    if (this.physics.checkTreeCollision(gridPosition, this.mapGenerator.getActiveRows())) return false;
    return !this.getActorAtGrid(gridPosition, [actor, ...excludedActors]);
  }

  planActorMove(actor, direction, distance = 1) {
    if (actor.isJumping || actor.isDead || actor.isRespawning || actor.stunTimer > 0) return { canMove: false };

    const chain = [actor];
    let target = actor.getTargetGridPosition(direction, distance);
    while (true) {
      const occupant = this.getActorAtGrid(target, chain);
      if (!occupant) break;
      // 目的格已被跳躍預約（包含同向離開）時不能穿插；玩家意圖會在落地後重判。
      if (occupant.isJumping) return { canMove: false, waitForActor: occupant };
      // 休閒賽可整列推進；仍限制於目前活躍名單，避免循環占位。
      if (chain.length >= this.getActiveActors().length) return { canMove: false };
      chain.push(occupant);
      target = occupant.getTargetGridPosition(direction);
    }

    // 推擠必須整鏈可主動移動；否則倒序啟動會造成前方角色先移、後方失敗的半套狀態。
    if (chain.some((chainActor) => (
      chainActor.isJumping || chainActor.isDead || chainActor.isRespawning || chainActor.stunTimer > 0
    ))) return { canMove: false };

    // 原子式：所有角色目的格均先通過邊界、樹木、占位與預約檢查，才開始任一跳躍；
    // 道路、鐵路、河面與動態洞仍沿用既有落地後危險／復活流程。
    const destinations = chain.map((chainActor, index) => (
      index === 0
        ? chainActor.getTargetGridPosition(direction, distance)
        : chainActor.getTargetGridPosition(direction)
    ));
    if (!destinations.every((destination, index) => this.canActorEnter(chain[index], destination, chain))) {
      return { canMove: false };
    }
    return { canMove: true, chain, direction, distance };
  }

  startActorMovePlan(plan) {
    // 先讓最前方角色預約終點，再依序啟動後方，避免同幀中被其他決策插隊。
    if (plan.chain.some((chainActor) => (
      chainActor.isJumping || chainActor.isDead || chainActor.isRespawning || chainActor.stunTimer > 0
    ))) return false;
    for (let index = plan.chain.length - 1; index >= 0; index--) {
      const chainActor = plan.chain[index];
      const stepDistance = index === 0 ? plan.distance : 1;
      if (!chainActor.move(plan.direction, stepDistance)) return false;
    }
    return true;
  }

  tryMoveActor(actor, direction, distance = 1) {
    const plan = this.planActorMove(actor, direction, distance);
    return plan.canMove && this.startActorMovePlan(plan);
  }

  canMoveActor(actor, direction, distance = 1) {
    return this.planActorMove(actor, direction, distance).canMove;
  }

  createCasualBots() {
    const botSpawns = [
      { x: -2, z: 0, aggression: 0.48, name: '青蛙・滑步', color: 0x4ade80 },
      { x: -1, z: 0, aggression: 0.58, name: '柴犬・搶分', color: 0xfb923c },
      { x: 1, z: 0, aggression: 0.69, name: '青蛙・埋伏', color: 0xc084fc },
      { x: 2, z: 0, aggression: 0.78, name: '刺客・壞壞', color: 0xf87171 }
    ];
    const shuffledVariants = [...AI_CHARACTER_VARIANTS];
    for (let index = shuffledVariants.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffledVariants[index], shuffledVariants[randomIndex]] = [shuffledVariants[randomIndex], shuffledVariants[index]];
    }
    const activeSpawns = botSpawns.slice(0, Math.max(0, CASUAL_PLAYER_COUNT - 1));
    const selectedVariants = activeSpawns.map((_, index) => shuffledVariants[index % shuffledVariants.length]);

    this.bots = activeSpawns.map((spawn, index) => {
      const variant = selectedVariants[index];
      const mesh = variant.createMesh();
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.5), new THREE.MeshBasicMaterial({ color: spawn.color }));
      marker.position.y = 0.08;
      mesh.add(marker);
      this.scene.add(mesh);
      return new AIBot(mesh, spawn.name, spawn.x, spawn.z, spawn.aggression);
    });
  }

  clearBots() {
    this.bots.forEach((bot) => this.scene.remove(bot.mesh));
    this.bots = [];
  }

  refreshLeaderboard() {
    if (this.currentMode !== 'casual') return;
    const entries = [
      { name: '玩家', score: this.player.gridZ, isPlayer: true, order: 0 },
      ...this.bots.map((bot, index) => ({ name: bot.botName, score: bot.gridZ, isPlayer: false, order: index + 1 }))
    ];
    this.uiManager.updateLeaderboard(entries);
  }

  handlePlayerLanded() {
    if (!this.isGameStarted || this.isGameOver) return;
    if (this.currentMode === 'casual' && this.mapGenerator.isDynamicHoleActiveAt(this.player)) {
      if (!this.player.isRespawning) this.uiManager.showCombatAnnouncement('⚠️ 地面崩塌！正在等待安全重生格');
      this.respawnAtCasualCheckpoint('fall');
      return;
    }
    this.mapGenerator.update(this.player.gridZ);
    this.collectScoreItem(this.player);
    this.collectSpringPunchItem(this.player);
    this.collectLeaderStrikeItem(this.player);
    this.uiManager.updateScore(this.player.score);

    if (this.currentMode !== 'casual') return;
    if (this.mapGenerator.isSafeCheckpointRow(this.player) && this.player.gridZ > this.casualCheckpoint.z) {
      this.casualCheckpoint = { x: this.player.gridX, z: this.player.gridZ };
    }
  }

  handleBotLanded(bot) {
    if (this.currentMode === 'casual' && this.mapGenerator.isDynamicHoleActiveAt(bot)) {
      this.respawnBotAtCheckpoint(bot, 'fall');
      return;
    }
    this.collectScoreItem(bot);
    this.collectSpringPunchItem(bot);
    this.collectLeaderStrikeItem(bot);
    if (this.mapGenerator.isSafeCheckpointRow(bot)) bot.updateCheckpoint();
  }

  collectScoreItem(actor) {
    if (!this.scoreItemsPrototypeEnabled) return false;
    const item = this.mapGenerator.collectScoreItemAt({ x: actor.gridX, z: actor.gridZ });
    if (!item) return false;
    actor.addItemScore(item.points);
    this.showScoreReward(actor, item.points);
    if (actor === this.player) this.uiManager.pulseScoreReward();
    return true;
  }

  collectSpringPunchItem(actor) {
    if (!this.springPunchPrototypeEnabled) return false;
    if (this.currentMode !== 'casual' || !this.partyItems.canReceive(actor)) return false;
    const item = this.mapGenerator.collectSpringPunchItemAt({ x: actor.gridX, z: actor.gridZ });
    if (!item) return false;
    this.beginPartyRoulette(actor);
    return true;
  }

  getLeaderStrikeTarget(owner) {
    return getHighestOtherLeaderStrikeTarget(owner, this.getActiveActors());
  }

  getActorName(actor) {
    return actor === this.player ? '玩家' : actor.botName || '角色';
  }

  collectLeaderStrikeItem(actor) {
    if (!this.leaderStrikePrototypeEnabled) return false;
    if (this.currentMode !== 'casual' || !this.partyItems.canReceive(actor)) return false;
    const item = this.mapGenerator.collectLeaderStrikeItemAt({ x: actor.gridX, z: actor.gridZ });
    if (!item) return false;
    this.beginPartyRoulette(actor);
    return true;
  }

  startGlobalLightning(actor) {
    const targets = this.getActiveActors().filter((target) => target !== actor && !target.isRespawning && !target.isDead);
    if (!targets.length) {
      this.uiManager.showCombatAnnouncement(`${this.getActorName(actor)} 發動「全圖落雷」但沒有可攻擊目標`);
      this.showSpringPunchEffect(actor, '全圖落雷：無可攻擊目標', 0x9bdcff);
      return true;
    }
    this.uiManager.showCombatAnnouncement(`⚡ ${this.getActorName(actor)} 發動「全圖落雷」：所有對手暈眩 1.5 秒！`);
    this.uiManager.flashGlobalStrike?.();
    targets.forEach((target) => {
      const warning = this.createLeaderStrikeWarning(target);
      this.leaderStrikes.push({ owner: actor, target, timer: CONFIG.LEADER_STRIKE.WARNING_DURATION, warning });
    });
    return true;
  }

  beginPartyRoulette(actor) {
    return this.partyItems.beginRoulette(actor);
  }

  updatePartyItems(deltaTime) {
    if (this.currentMode === 'casual') this.partyItems.update(deltaTime);
  }

  showItemFeedback(actor, type) {
    this.partyItems.showFeedback(actor, type);
  }

  createLeaderStrikeWarning(target) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.055, 8, 16), new THREE.MeshBasicMaterial({ color: 0xbcefff, transparent: true, opacity: 0.9 }));
    ring.rotation.x = Math.PI / 2;
    const lockRing = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.025, 6, 18), new THREE.MeshBasicMaterial({ color: 0x4dcfff, transparent: true, opacity: 0.65 }));
    lockRing.rotation.x = Math.PI / 2;
    const label = this.createEffectLabel('全圖落雷！', '#eafaff', '#12528a');
    this.scene.add(ring, lockRing, label.sprite);
    return { ring, lockRing, ...label };
  }

  createEffectLabel(label, fillStyle, strokeStyle) {
    const canvas = document.createElement('canvas');
    const isCountdownDigit = /^\d$/.test(label);
    const measureContext = canvas.getContext('2d');
    measureContext.font = 'bold 24px sans-serif';
    canvas.width = isCountdownDigit ? 56 : Math.max(220, Math.ceil(measureContext.measureText(label).width + 36));
    canvas.height = 56;
    const context = canvas.getContext('2d');
    context.font = isCountdownDigit ? 'bold 42px sans-serif' : 'bold 24px sans-serif';
    context.textAlign = 'center';
    context.fillStyle = fillStyle;
    context.strokeStyle = strokeStyle;
    context.lineWidth = 5;
    const center = canvas.width / 2;
    context.strokeText(label, center, isCountdownDigit ? 43 : 36);
    context.fillText(label, center, isCountdownDigit ? 43 : 36);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(Math.max(1.7, canvas.width / 128), 0.44, 1);
    return { sprite, texture };
  }

  updateLeaderStrikes(deltaTime) {
    this.leaderStrikes = this.leaderStrikes.filter((strike) => {
      const { target, warning } = strike;
      if (target.isDead || target.isRespawning) {
        this.disposeLeaderStrikeWarning(warning);
        return false;
      }
      strike.timer -= deltaTime;
      warning.ring.position.copy(target.position).add(new THREE.Vector3(0, 0.08, 0));
      warning.lockRing.position.copy(warning.ring.position);
      warning.sprite.position.copy(target.position).add(new THREE.Vector3(0, 1.32, 0));
      const pulse = 0.86 + Math.sin(performance.now() * 0.024) * 0.14;
      warning.ring.scale.setScalar(pulse);
      warning.lockRing.scale.setScalar(1.1 - (pulse - 0.86) * 0.55);
      warning.lockRing.material.opacity = 0.38 + pulse * 0.32;
      if (strike.timer > 0) return true;
      this.disposeLeaderStrikeWarning(warning);
      this.resolveLeaderStrike(target);
      return false;
    });
  }

  disposeLeaderStrikeWarning(warning) {
    this.scene.remove(warning.ring, warning.lockRing, warning.sprite);
    warning.ring.geometry.dispose();
    warning.ring.material.dispose();
    warning.lockRing.geometry.dispose();
    warning.lockRing.material.dispose();
    warning.sprite.material.dispose();
    warning.texture.dispose();
  }

  resolveLeaderStrike(target) {
    const applied = this.partyItems ? this.partyItems.hit(target, 'lightning', CONFIG.LEADER_STRIKE.STUN_DURATION) : target.applyStun(CONFIG.LEADER_STRIKE.STUN_DURATION);
    this.createLeaderStrikeBolt(target.position);
    this.showSpringPunchEffect(target, applied ? '落雷暈眩 1.5 秒！' : '落雷被抵抗！', applied ? 0x9ce7ff : 0xaeeaff);
  }

  createLeaderStrikeBolt(position) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.95 });
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, 3.4, 6), material);
    bolt.position.y = 1.65;
    const impact = new THREE.Mesh(new THREE.CircleGeometry(0.56, 16), new THREE.MeshBasicMaterial({ color: 0x75d7ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    impact.rotation.x = -Math.PI / 2;
    impact.position.y = 0.03;
    const shock = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.62, 16), new THREE.MeshBasicMaterial({ color: 0xc5f5ff, transparent: true, opacity: 0.78, side: THREE.DoubleSide }));
    shock.rotation.x = -Math.PI / 2;
    shock.position.y = 0.05;
    group.add(bolt, impact, shock);
    // 體素式分叉閃電與少量碎屑，數量固定避免 VFX 堆積。
    [-0.26, 0.26].forEach((x, index) => {
      const branch = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.2, 0.055), material.clone());
      branch.position.set(x, 1.12 + index * 0.14, 0.04);
      branch.rotation.z = index ? -0.42 : 0.42;
      group.add(branch);
    });
    for (let index = 0; index < 8; index++) {
      const debris = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: index % 2 ? 0x8ce8ff : 0xffffff, transparent: true, opacity: 0.9 }));
      const angle = (Math.PI * 2 * index) / 8;
      debris.position.set(Math.cos(angle) * 0.35, 0.12 + (index % 2) * 0.12, Math.sin(angle) * 0.35);
      debris.userData.velocity = new THREE.Vector3(Math.cos(angle) * 1.6, 1 + (index % 3) * 0.25, Math.sin(angle) * 1.6);
      group.add(debris);
    }
    group.position.copy(position);
    this.scene.add(group);
    this.leaderStrikeEffects.push({ group, age: 0 });
  }

  updateLeaderStrikeEffects(deltaTime) {
    this.leaderStrikeEffects = this.leaderStrikeEffects.filter((effect) => {
      effect.age += deltaTime;
      effect.group.children.forEach((child) => {
        if (child.material) child.material.opacity = Math.max(0, 1 - effect.age / 0.32);
        if (child.userData.velocity) child.position.addScaledVector(child.userData.velocity, deltaTime);
      });
      effect.group.scale.setScalar(1 + effect.age * 0.65);
      if (effect.age < 0.32) return true;
      this.scene.remove(effect.group);
      effect.group.traverse((node) => { node.geometry?.dispose(); node.material?.dispose(); });
      return false;
    });
  }

  directionVectorFromActor(actor) {
    const angle = actor.targetRotationY;
    if (Math.abs(angle - Math.PI / 2) < 0.1) return new THREE.Vector3(1, 0, 0);
    if (Math.abs(angle + Math.PI / 2) < 0.1) return new THREE.Vector3(-1, 0, 0);
    if (Math.abs(Math.abs(angle) - Math.PI) < 0.1) return new THREE.Vector3(0, 0, -1);
    return new THREE.Vector3(0, 0, 1);
  }

  createSpringPunchProjectile(punch) {
    const mesh = new THREE.Group();
    const gloveMaterial = new THREE.MeshBasicMaterial({ color: 0xffc92f });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.38), gloveMaterial);
    palm.position.y = 0;
    mesh.add(palm);
    [-0.12, 0, 0.12].forEach((x) => { const finger = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.18), gloveMaterial); finger.position.set(x, 0.03, 0.27); mesh.add(finger); });
    // 拳套後方是清楚可辨的伸展彈簧線圈，與黃色拖尾分開呈現方向與射程。
    const coils = [];
    for (let index = 0; index < 5; index++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 10), new THREE.MeshBasicMaterial({ color: 0xfff4a8 }));
      coil.position.set(0, 0, -0.12 - index * 0.12);
      mesh.add(coil);
      coils.push(coil);
    }
    mesh.userData.coils = coils;
    const trail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.7 }));
    this.scene.add(mesh, trail);
    punch.mesh = mesh;
    punch.trail = trail;
  }

  createSpringPunchWindup(actor) {
    const direction = this.directionVectorFromActor(actor);
    const group = new THREE.Group();
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.78), new THREE.MeshBasicMaterial({ color: 0xffdd32, transparent: true, opacity: 0.85 }));
    const compressedSpring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 10), new THREE.MeshBasicMaterial({ color: 0xfff4a8 }));
    compressedSpring.rotation.x = Math.PI / 2;
    group.add(line, compressedSpring);
    group.position.copy(actor.position).addScaledVector(direction, 0.52).add(new THREE.Vector3(0, 0.54, 0));
    group.rotation.y = Math.atan2(direction.x, direction.z);
    this.scene.add(group);
    return group;
  }

  updateSpringPunches(deltaTime) {
    this.springPunches = this.springPunches.filter((punch) => {
      if (punch.windup > 0) {
        punch.windup -= deltaTime;
        const direction = this.directionVectorFromActor(punch.owner);
        punch.windupVisual.position.copy(punch.owner.position).addScaledVector(direction, 0.52).add(new THREE.Vector3(0, 0.54, 0));
        punch.windupVisual.rotation.y = Math.atan2(direction.x, direction.z);
        punch.windupVisual.scale.z = 0.7 + (CONFIG.SPRING_PUNCH.WINDUP - Math.max(0, punch.windup)) / CONFIG.SPRING_PUNCH.WINDUP * 0.55;
        if (punch.windup > 0) return true;
        this.disposeSpringPunchWindup(punch);
        punch.position.copy(punch.owner.position);
        punch.direction = this.directionVectorFromActor(punch.owner);
        this.createSpringPunchProjectile(punch);
      }
      const previous = punch.position.clone();
      const step = Math.min(CONFIG.SPRING_PUNCH.SPEED * deltaTime, CONFIG.SPRING_PUNCH.RANGE - punch.distance);
      punch.position.addScaledVector(punch.direction, step);
      punch.distance += step;
      const hit = this.getFirstSpringPunchHit(punch, previous);
      if (hit) this.resolveSpringPunchHit(punch, hit);
      if (hit || punch.distance >= CONFIG.SPRING_PUNCH.RANGE) {
        this.disposeSpringPunch(punch);
        return false;
      }
      punch.mesh.position.copy(punch.position).add(new THREE.Vector3(0, 0.55, 0));
      punch.mesh.rotation.y = Math.atan2(punch.direction.x, punch.direction.z);
      const stretch = 0.12 + Math.min(0.12, punch.distance / CONFIG.SPRING_PUNCH.RANGE * 0.12);
      punch.mesh.userData.coils?.forEach((coil, index) => { coil.position.z = -0.12 - index * stretch; });
      punch.trail.position.copy(punch.position).addScaledVector(punch.direction, -0.3).add(new THREE.Vector3(0, 0.55, 0));
      punch.trail.rotation.y = punch.mesh.rotation.y;
      return true;
    });
  }

  getFirstSpringPunchHit(punch, start) {
    return this.getActiveActors().filter((actor) => actor !== punch.owner && !actor.isRespawning).map((actor) => {
      const relative = actor.position.clone().sub(start);
      const along = relative.dot(punch.direction);
      const lateral = relative.clone().sub(punch.direction.clone().multiplyScalar(along)).length();
      return { actor, along, lateral };
    }).filter(({ along, lateral }) => along >= 0 && along <= CONFIG.SPRING_PUNCH.SPEED * 0.1 + CONFIG.SPRING_PUNCH.HIT_RADIUS && lateral <= CONFIG.SPRING_PUNCH.HIT_RADIUS)
      .sort((a, b) => a.along - b.along)[0]?.actor || null;
  }

  resolveSpringPunchHit(punch, target) {
    if (target.applySpringPunchStun()) this.showSpringPunchEffect(target, '暈眩！', 0xffe16b);
    else this.showSpringPunchEffect(target, '抵抗！', 0xaeeaff);
  }

  disposeSpringPunch(punch) {
    this.disposeSpringPunchWindup(punch);
    for (const mesh of [punch.mesh, punch.trail]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.traverse?.((node) => { node.geometry?.dispose(); node.material?.dispose(); });
      mesh.geometry?.dispose();
      mesh.material?.dispose();
    }
  }

  disposeSpringPunchWindup(punch) {
    if (!punch.windupVisual) return;
    this.scene.remove(punch.windupVisual);
    punch.windupVisual.traverse((node) => { node.geometry?.dispose(); node.material?.dispose(); });
    punch.windupVisual = null;
  }

  showSpringPunchEffect(actor, label, color) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 6, 12), new THREE.MeshBasicMaterial({ color, transparent: true }));
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(actor.position).add(new THREE.Vector3(0, 0.8, 0));
    const { sprite, texture } = this.createEffectLabel(label, '#fff7b0', '#533300');
    this.scene.add(ring, sprite);
    this.springPunchEffects.push({ actor, ring, sprite, texture, age: 0 });
  }

  updateSpringPunchEffects(deltaTime) {
    this.springPunchEffects = this.springPunchEffects.filter((effect) => {
      effect.age += deltaTime;
      effect.ring.position.copy(effect.actor.position).add(new THREE.Vector3(0, 0.8 + effect.age * 0.25, 0));
      effect.sprite.position.copy(effect.actor.position).add(new THREE.Vector3(0, 1.3 + effect.age * 0.32, 0));
      effect.ring.material.opacity = Math.max(0, 1 - effect.age / 1);
      effect.sprite.material.opacity = Math.max(0, 1 - effect.age / 0.85);
      if (effect.age < 1) return true;
      this.scene.remove(effect.ring);
      this.scene.remove(effect.sprite);
      effect.ring.geometry.dispose();
      effect.ring.material.dispose();
      effect.sprite.material.dispose();
      effect.texture.dispose();
      return false;
    });
  }

  showScoreReward(actor, points) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.font = 'bold 42px sans-serif';
    context.textAlign = 'center';
    context.lineWidth = 7;
    context.strokeStyle = '#5b3300';
    context.strokeText(`+${points}`, 64, 45);
    context.fillStyle = '#fff4a3';
    context.fillText(`+${points}`, 64, 45);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(0.9, 0.45, 1);
    sprite.position.copy(actor.position).add(new THREE.Vector3(0, 1.15, 0));
    this.scene.add(sprite);
    this.scoreRewardEffects.push({ sprite, texture, age: 0 });
  }

  updateScoreRewardEffects(deltaTime) {
    this.scoreRewardEffects = this.scoreRewardEffects.filter((effect) => {
      effect.age += deltaTime;
      effect.sprite.position.y += deltaTime * 1.2;
      effect.sprite.material.opacity = Math.max(0, 1 - effect.age / 0.65);
      if (effect.age < 0.65) return true;
      this.scene.remove(effect.sprite);
      effect.sprite.material.dispose();
      effect.texture.dispose();
      return false;
    });
  }

  respawnBotAtCheckpoint(bot, reason = 'impact') {
    return this.scheduleCasualDeath(bot, reason);
  }

  updateCasualBotHazards(bot, activeRows, deltaTime) {
    if (bot.isJumping || bot.isDead || bot.isRespawning) return;

    if (this.mapGenerator.isDynamicHoleActiveAt(bot)) {
      this.respawnBotAtCheckpoint(bot, 'fall');
      return;
    }

    const hitObstacle = this.physics.checkObstacleCollision(bot, activeRows);
    if (hitObstacle && !bot.isInvulnerable) {
      this.respawnBotAtCheckpoint(bot);
      return;
    }

    const riverStatus = this.physics.checkRiverStatus(bot, activeRows);
    if (!riverStatus.inRiver) return;
    if (!riverStatus.onLog) {
      this.respawnBotAtCheckpoint(bot, 'fall');
      return;
    }

    bot.position.x += riverStatus.logSpeed * deltaTime;
    bot.gridX = Math.round(bot.position.x / CONFIG.GRID_SIZE);
    if (Math.abs(bot.position.x) > (CONFIG.MAP_BOUNDS_X + 1.2) * CONFIG.GRID_SIZE) {
      this.respawnBotAtCheckpoint(bot, 'fall');
    }
  }

  clearRuntimeEffects() {
    this.partyItems?.clear();
    this.casualRecovery?.clear();
    this.partyItemStates?.clear();
    this.uiManager.updateItemHUD?.([], null);
    this.scoreRewardEffects.forEach((effect) => {
      this.scene.remove(effect.sprite);
      effect.sprite.material.dispose();
      effect.texture.dispose();
    });
    this.scoreRewardEffects = [];
    this.uiManager.hideOverlays();
    this.springPunches.forEach((punch) => this.disposeSpringPunch(punch));
    this.springPunches = [];
    this.springPunchEffects.forEach((effect) => {
      this.scene.remove(effect.ring, effect.sprite);
      effect.ring.geometry.dispose();
      effect.ring.material.dispose();
      effect.sprite.material.dispose();
      effect.texture.dispose();
    });
    this.springPunchEffects = [];
    this.leaderStrikes.forEach((strike) => this.disposeLeaderStrikeWarning(strike.warning));
    this.leaderStrikes = [];
    this.leaderStrikeEffects.forEach((effect) => {
      this.scene.remove(effect.group);
      effect.group.traverse((node) => { node.geometry?.dispose(); node.material?.dispose(); });
    });
    this.leaderStrikeEffects = [];
  }

  startGame(mode = 'casual') {
    if (mode === 'casual') {
      this.beginCasualMatching();
      return;
    }
    this.launchGame(mode);
  }

  beginCasualMatching() {
    if (this.matchState === 'matching' || this.matchState === 'countdown' || this.matchState === 'started') return;
    this.matchState = 'matching';
    this.isGameStarted = false;
    this.isGameOver = false;
    this.clearRuntimeEffects();
    this.pendingRespawns.clear();
    this.clearBots();
    this.player.reset();
    this.casualTimeRemaining = this.casualDuration;
    this.uiManager.setMode('casual');
    this.uiManager.updateScore(0);
    this.uiManager.updateTimer(this.casualTimeRemaining);
    this.uiManager.updateLeaderboard([]);
    this.uiManager.hideOverlays();
    this.uiManager.showMatching(1, '正在以本機 BOT 補位配對…');
    let seats = 1;
    const fillSeat = () => {
      if (this.matchState !== 'matching') return;
      seats += 1;
      this.uiManager.showMatching(seats, seats < CASUAL_PLAYER_COUNT ? `已找到 ${seats}/${CASUAL_PLAYER_COUNT} 位選手，BOT 正在補位…` : '配對完成，準備同步開跑');
      if (seats < CASUAL_PLAYER_COUNT) {
        this.matchTimer = setTimeout(fillSeat, CONFIG.MATCH.FILL_MS);
        return;
      }
      this.uiManager.hideMatching();
      this.launchGame('casual', false);
      this.matchState = 'countdown';
      let count = CONFIG.MATCH.COUNTDOWN_START;
      const countdown = () => {
        if (this.matchState !== 'countdown') return;
        this.uiManager.showRaceCountdown?.(count);
        if (count-- > 0) {
          this.matchTimer = setTimeout(countdown, CONFIG.MATCH.COUNTDOWN_MS);
          return;
        }
        this.matchState = 'started';
        this.isGameStarted = true;
        this.uiManager.setGameSettingsAvailable(true);
        this.uiManager.showRaceCountdown?.('GO');
        setTimeout(() => this.uiManager.hideRaceCountdown?.(), CONFIG.MATCH.GO_DISPLAY_MS);
      };
      countdown();
    };
    this.matchTimer = setTimeout(fillSeat, CONFIG.MATCH.INITIAL_FILL_MS);
  }

  cancelCasualMatching() {
    if (this.matchTimer) clearTimeout(this.matchTimer);
    this.matchTimer = null;
    this.matchState = 'idle';
    this.isGameStarted = false;
    this.isPaused = false;
    this.pendingRespawns.clear();
    this.clearBots();
    this.uiManager.hideMatching();
    this.uiManager.showLobby();
  }

  launchGame(mode = 'casual', startImmediately = true) {
    if (this.matchTimer) clearTimeout(this.matchTimer);
    this.matchTimer = null;
    this.matchState = mode === 'casual' ? (startImmediately ? 'started' : 'countdown') : 'idle';
    this.clearRuntimeEffects();
    this.pendingRespawns.clear();

    this.currentMode = mode || 'casual';
    this.mapGenerator.springPunchItemsEnabled = this.currentMode === 'casual';
    this.mapGenerator.leaderStrikeItemsEnabled = this.currentMode === 'casual';
    this.uiManager.selectedMode = this.currentMode;
    this.isGameStarted = startImmediately;
    this.isGameOver = false;
    this.isPaused = false;
    this.uiManager.hideGameSettings();
    this.uiManager.setGameSettingsAvailable(startImmediately);

    this.cameraScrollZ = CONFIG.CAMERA.START_Z * CONFIG.GRID_SIZE;
    this.idleTimer = 0;
    this.lastPlayerZ = 0;
    this.cancelEagleAttack();
    this.casualTimeRemaining = this.casualDuration;
    this.casualCheckpoint = { x: 0, z: 0 };
    this.lastLandedZ = 0;

    if (this.eagleMesh) {
      this.scene.remove(this.eagleMesh);
      this.eagleMesh = null;
    }

    this.player.reset();
    this.clearBots();
    this.uiManager.setMode(this.currentMode);
    this.uiManager.updateHealth(this.player.hp);
    this.mapGenerator.setDynamicHolesEnabled(this.currentMode === 'casual' && this.dynamicHolesPrototypeEnabled);
    this.mapGenerator.initMap();
    if (this.currentMode === 'casual') {
      // 五位選手固定同列起跑，全部佔用不同格，避免推擠與重生重疊。
      this.player.respawnAt(CASUAL_START_SLOTS[0], 0, 0.1);
      this.casualCheckpoint = { x: CASUAL_START_SLOTS[0], z: 0 };
    }
    this.sceneSetup.resetCamera();
    this.uiManager.updateScore(0);
    this.uiManager.updateTimer(this.casualTimeRemaining);
    if (this.currentMode === 'casual') {
      this.createCasualBots();
      this.refreshLeaderboard();
      if (!startImmediately) this.uiManager.showRaceCountdown?.(3);
    }
  }

  restartGame(mode) {
    this.startGame(mode || this.currentMode);
  }

  returnLobby() {
    if (this.matchTimer) clearTimeout(this.matchTimer);
    this.matchTimer = null;
    this.cancelEagleAttack();
    this.matchState = 'idle';
    this.isGameStarted = false;
    this.isGameOver = false;
    this.isPaused = false;
    this.clearRuntimeEffects();
    this.pendingRespawns.clear();
    this.clearBots();
    this.uiManager.showLobby();
  }

  openGameSettings() {
    if (!this.isGameStarted || this.isGameOver) return;
    this.isPaused = this.currentMode === 'challenge';
    this.uiManager.showGameSettings(this.currentMode);
  }

  resumeGame() {
    this.isPaused = false;
    this.uiManager.hideGameSettings();
    this.uiManager.btnGameSettings?.focus();
  }

  leaveGame() {
    this.isPaused = false;
    this.uiManager.hideGameSettings();
    this.returnLobby();
  }

  cancelEagleAttack() {
    if (this.eagleAttackTimer) clearInterval(this.eagleAttackTimer);
    this.eagleAttackTimer = null;
    this.isEagleAttacking = false;
    if (this.eagleMesh) {
      this.scene.remove(this.eagleMesh);
      this.eagleMesh = null;
    }
    if (this.player?.mesh) this.player.mesh.visible = true;
  }

  triggerEagleAttack() {
    if (this.isEagleAttacking || this.isGameOver) return;
    this.isEagleAttacking = true;

    this.eagleMesh = createEagle();
    const pX = this.player.position.x;
    const pZ = this.player.position.z;
    this.eagleMesh.position.set(pX - 10, 18, pZ - 10);
    this.scene.add(this.eagleMesh);

    const startPos = this.eagleMesh.position.clone();
    const targetPos = new THREE.Vector3(pX, 0.4, pZ);

    let progress = 0;
    const attackInterval = setInterval(() => {
      if (this.eagleAttackTimer !== attackInterval || this.isPaused || !this.isGameStarted || this.isGameOver) return;
      progress += 16 / (CONFIG.EAGLE.CHALLENGE_CARRY_SECONDS * 1000);
      if (progress < 0.6) {
        this.eagleMesh.position.lerpVectors(startPos, targetPos, progress / 0.6);
      } else if (progress < 1.0) {
        if (this.player.mesh) this.player.mesh.visible = false;
        const exitPos = new THREE.Vector3(pX + 15, 20, pZ + 15);
        this.eagleMesh.position.lerpVectors(targetPos, exitPos, (progress - 0.6) / 0.4);
      } else {
        clearInterval(attackInterval);
        this.eagleAttackTimer = null;
        if (this.eagleMesh) {
          this.scene.remove(this.eagleMesh);
          this.eagleMesh = null;
        }
        this.gameOver('發呆時間過長，被空中老鷹捕捉抓走！');
      }
    }, 16);
    this.eagleAttackTimer = attackInterval;
  }

  gameOver(reason = '被車撞飛了！') {
    this.isGameOver = true;
    if (this.currentMode === 'casual') {
      this.matchState = 'finished';
      this.pendingRespawns.clear();
      this.getActiveActors().forEach((actor) => { actor.isJumping = false; actor.inputBuffer = []; });
      const entries = [this.player, ...this.bots].map((actor, order) => ({
        name: this.getActorName(actor), isPlayer: actor === this.player, order,
        distance: Math.max(0, actor.gridZ), maxDistance: Math.max(0, actor.maxReachedZ),
        itemScore: actor.itemScore || 0, deaths: actor.deathCount || 0
      })).sort((a, b) => b.distance - a.distance || a.order - b.order);
      let rank = 0; let lastDistance = null;
      entries.forEach((entry, index) => { if (entry.distance !== lastDistance) rank = index + 1; entry.rank = rank; lastDistance = entry.distance; });
      this.uiManager.showMultiplayerResults?.({ entries, playerRank: entries.find((entry) => entry.isPlayer)?.rank, duration: this.casualDuration });
      return;
    }
    this.uiManager.showGameOver(this.player.score, reason);
  }

  findCasualRespawnPosition(actor, checkpoint) {
    if (!checkpoint) return null;
    const rows = this.mapGenerator.getActiveRows();
    const rowOrder = [checkpoint.z, checkpoint.z - 1, checkpoint.z - 2, checkpoint.z + 1, checkpoint.z - 3, checkpoint.z + 2];
    const offsets = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6];
    for (const z of rowOrder) {
      // 只用當前已生成、被確認為安全 checkpoint 的草地列；不存在的 row 絕不當安全格。
      if (!rows.get(z) || !this.mapGenerator.isSafeCheckpointRow({ x: checkpoint.x, z })) continue;
      for (const offset of offsets) {
        const candidate = { x: checkpoint.x + offset, z };
        if (Math.abs(candidate.x) > CONFIG.MAP_BOUNDS_X) continue;
        if (this.getActorAtGrid(candidate, [actor])) continue;
        if (this.physics.checkTreeCollision(candidate, rows)) continue;
        if (this.mapGenerator.isDynamicHoleUnsafe?.(candidate, 0) || this.mapGenerator.isDynamicHoleActiveAt(candidate)) continue;
        if (this.mapGenerator.hasPartyItemAt?.(candidate)) continue;
        return candidate;
      }
    }
    return null;
  }

  requestCasualRespawn(actor, checkpoint) {
    const position = this.findCasualRespawnPosition(actor, checkpoint);
    if (!position) {
      actor.isRespawning = true;
      this.pendingRespawns.set(actor, checkpoint);
      return false;
    }
    actor.respawnAt(position.x, position.z);
    this.pendingRespawns.delete(actor);
    return true;
  }

  retryPendingRespawns() {
    this.pendingRespawns.forEach((checkpoint, actor) => this.requestCasualRespawn(actor, checkpoint));
  }

  scheduleCasualDeath(actor, reason = 'impact') {
    return this.casualRecovery.schedule(actor, reason);
  }

  updateCasualDeaths(deltaTime) {
    this.casualRecovery.update(deltaTime);
  }

  respawnAtCasualCheckpoint(reason = 'impact') {
    return this.scheduleCasualDeath(this.player, reason);
  }

  animate() {
    requestAnimationFrame(this.animate);

    try {
      const rawDelta = this.clock.getDelta();
      const deltaTime = Number.isFinite(rawDelta) && rawDelta > 0 ? Math.min(rawDelta, 0.1) : 0.016;
      if (this.isPaused) {
        this.sceneSetup.render();
        return;
      }
      const activeRows = this.mapGenerator.getActiveRows();
      if (this.isGameStarted && this.currentMode === 'casual' && !this.isGameOver) this.updateCasualDeaths(deltaTime);

      // 1. 主角動態更新
      const wasJumping = this.player.isJumping;
      if (this.isGameStarted && !this.isGameOver) {
        this.player.update(deltaTime);
        if (wasJumping && !this.player.isJumping) this.handlePlayerLanded();
      }

      // 玩家暫存的推擠意圖先於 BOT 決策重判：BOT 落地後不會在同一 tick 搶回空格。
      if (!this.player.isJumping && this.player.inputBuffer.length > 0) {
        const nextInput = this.player.inputBuffer[0];
        const inputResult = this.handlePlayerMove(nextInput.direction, nextInput.distance, true);
        if (inputResult !== 'waiting') this.player.inputBuffer.shift();
      }

      if (this.isGameStarted && !this.isGameOver && this.currentMode === 'casual') {
        this.bots.forEach((bot) => {
          const wasBotJumping = bot.isJumping;
          bot.updateAI(
            deltaTime,
            activeRows,
            this.physics,
            (actor, direction) => this.tryMoveActor(actor, direction),
            (actor, direction) => this.canMoveActor(actor, direction),
            this.scoreItemsPrototypeEnabled ? [...this.mapGenerator.scoreItems.values()] : [],
            (actor, gridPosition) => this.canActorEnter(actor, gridPosition),
            (gridPosition, landingPrediction) => this.mapGenerator.isDynamicHoleUnsafe(gridPosition, landingPrediction),
            (gridPosition) => this.mapGenerator.getDynamicHoleRepairTime(gridPosition),
            [...this.mapGenerator.springPunchItems.values(), ...this.mapGenerator.leaderStrikeItems.values()],
            [],
            this.partyItems.rockets,
            this.getActiveActors(),
            (gridPosition) => this.mapGenerator.isDynamicHoleActiveAt(gridPosition)
          );
          bot.update(deltaTime);
          if (wasBotJumping && !bot.isJumping) this.handleBotLanded(bot);
          this.updateCasualBotHazards(bot, activeRows, deltaTime);
        });
        this.refreshLeaderboard();
      }

      // 🎥 經典 Crossy Road 競品 1:1 相機自主恆速推進系統 (對齊競品 7~8 秒老鷹抓走時間)
      const pZ = Number.isFinite(this.player.position.z) ? this.player.position.z : (this.player.gridZ * CONFIG.GRID_SIZE);
      const pX = Number.isFinite(this.player.position.x) ? this.player.position.x : (this.player.gridX * CONFIG.GRID_SIZE);

      if (this.isGameStarted && !this.isGameOver) {
        if (this.currentMode === 'casual') {
          this.casualTimeRemaining = Math.max(0, this.casualTimeRemaining - deltaTime);
          this.uiManager.updateTimer(this.casualTimeRemaining);
          if (this.casualTimeRemaining <= 0) {
            this.gameOver('時間到！本局最遠距離已結算。');
          }
        }
        if (this.currentMode === 'challenge') {
          // 🏆 挑戰模式：相機無間斷自主向前推進 (0.45格/秒) 與 7.5 秒發呆老鷹抓走淘汰
          this.cameraScrollZ += CONFIG.CAMERA.CHALLENGE_SCROLL_SPEED * deltaTime * CONFIG.GRID_SIZE;

          // 主角跳躍超越相機時，相機順暢跟進
          if (pZ > this.cameraScrollZ) {
            this.cameraScrollZ = THREE.MathUtils.lerp(this.cameraScrollZ, pZ, CONFIG.CAMERA.CHALLENGE_CATCHUP_LERP);
          }

          // 當主角發呆 7.5 秒滑出螢幕底邊界 -> 觸發老鷹俯衝抓走淘汰
          const captureBehind = CONFIG.CAMERA.CHALLENGE_SCROLL_SPEED * CONFIG.EAGLE.CHALLENGE_TRIGGER_SECONDS * CONFIG.GRID_SIZE;
          const distanceBehind = this.cameraScrollZ - pZ;
          if (distanceBehind >= captureBehind && !this.isEagleAttacking) {
            this.triggerEagleAttack();
          }

          const playerGridZ = Math.max(this.player.gridZ, Math.floor(this.cameraScrollZ / CONFIG.GRID_SIZE));
          this.mapGenerator.update(playerGridZ);
          this.player.minAllowedZ = Math.floor((this.cameraScrollZ - captureBehind) / CONFIG.GRID_SIZE);
        } else {
          // 🍃 休閒模式：相機平滑跟隨主角 (剔除後方邊界推進，剔除發呆老鷹抓走)
          this.cameraScrollZ = THREE.MathUtils.lerp(this.cameraScrollZ, pZ, CONFIG.CAMERA.CASUAL_FOLLOW_LERP);
          this.mapGenerator.update(this.player.gridZ);
          this.player.minAllowedZ = this.player.gridZ - CONFIG.CAMERA.CASUAL_BACK_ROWS;
        }
      }

      // 5. 馬路車輛 / 河流浮木 / 鐵道火車動態
      if (this.isGameStarted && !this.isGameOver) {
        this.mapGenerator.animateObstacles(deltaTime);
        this.updateScoreRewardEffects(deltaTime);
        this.updateSpringPunches(deltaTime);
        this.updateSpringPunchEffects(deltaTime);
        this.updatePartyItems(deltaTime);
        this.updateLeaderStrikes(deltaTime);
        this.updateLeaderStrikeEffects(deltaTime);
      }

      // 推擠與跳躍完成後才判定地形，讓被推入洞與主動落洞走同一條休閒復活流程。
      if (this.isGameStarted && !this.isGameOver && this.currentMode === 'casual') {
        if (!this.player.isDead && !this.player.isRespawning && !this.player.isJumping && this.mapGenerator.isDynamicHoleActiveAt(this.player)) {
          if (!this.player.isRespawning) this.uiManager.showCombatAnnouncement('⚠️ 地面崩塌！正在等待安全重生格');
          this.respawnAtCasualCheckpoint('fall');
          return;
        }
        this.bots.forEach((bot) => {
          if (!bot.isDead && !bot.isRespawning && !bot.isJumping && this.mapGenerator.isDynamicHoleActiveAt(bot)) this.respawnBotAtCheckpoint(bot, 'fall');
        });
      }

      // 6. 即時更新相機 3D 視角位置 (主角保持於螢幕下半部偏後區域，視角與競品 100% 對齊)
      const targetCameraZ = (this.isGameStarted ? this.cameraScrollZ : pZ) + CONFIG.CAMERA.TARGET_AHEAD * CONFIG.GRID_SIZE;
      this.sceneSetup.updateCamera({ x: pX, z: targetCameraZ, playerZ: pZ });

      // 5. 碰撞判定 (車輛 / 火車 / 落水)
      if (this.isGameStarted && !this.isGameOver && !this.isEagleAttacking && !this.player.isDead && !this.player.isRespawning) {
        const hitObstacle = this.physics.checkObstacleCollision(this.player, activeRows);
        if (hitObstacle && !this.player.isInvulnerable) {
          if (this.currentMode === 'casual') {
            this.respawnAtCasualCheckpoint();
            return;
          }
          const damage = hitObstacle.type === 'train' ? CONFIG.TRAFFIC.TRAIN_DAMAGE : Math.min(CONFIG.TRAFFIC.CAR_DAMAGE_CAP, Math.round(hitObstacle.speed * CONFIG.TRAFFIC.CAR_DAMAGE_SPEED_SCALE + CONFIG.TRAFFIC.CAR_DAMAGE_BASE));
          const isFatal = this.player.takeDamage(damage);
          this.uiManager.updateHealth(this.player.hp);

          if (isFatal) {
            this.player.triggerFlattenAnimation();
            this.gameOver(hitObstacle.type === 'train' ? '慘遭音速火車輾過！' : '被車輛重撞飛了！');
          }
        }

        const riverStatus = this.physics.checkRiverStatus(this.player, activeRows);
        if (riverStatus.inRiver) {
          if (riverStatus.onLog) {
            this.player.position.x += riverStatus.logSpeed * deltaTime;
            this.player.gridX = Math.round(this.player.position.x / CONFIG.GRID_SIZE);

            if (Math.abs(this.player.position.x) > (CONFIG.MAP_BOUNDS_X + 1.2) * CONFIG.GRID_SIZE) {
              if (this.currentMode === 'casual') {
                this.respawnAtCasualCheckpoint('fall');
                return;
              }
              this.player.triggerDrownAnimation();
              this.gameOver('漂流過遠，掉出邊界外！');
            }
          } else {
            if (this.currentMode === 'casual') {
              this.respawnAtCasualCheckpoint('fall');
              return;
            }
            this.player.triggerDrownAnimation();
            this.gameOver('噗通！落水淹死！');
          }
        }
      }
    } catch (err) {
      console.error('Render loop error:', err);
    }

    // 6. 3D 渲染
    this.sceneSetup.render();
  }
}

// 啟動前先載入 YAML，確保所有建構階段都使用同一份設定。
async function bootstrapGame() {
  const status = await loadGameConfig('./docs/game-config.yaml');
  window.gameConfig = CONFIG;
  window.gameConfigStatus = status;
  document.documentElement.dataset.gameConfigSource = status.source;
  document.documentElement.dataset.gameConfigOk = String(status.ok);
  document.documentElement.dataset.gameConfigErrors = status.errors.join(' | ');
  window.game = new Game();
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootstrapGame, { once: true });
  } else {
    bootstrapGame();
  }
}
