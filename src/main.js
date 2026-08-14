import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SceneSetup } from './graphics/SceneSetup.js';
import { AI_CHARACTER_VARIANTS, createChicken, createEagle } from './graphics/VoxelModels.js';
import { Player } from './mechanics/Player.js';
import { AIBot } from './mechanics/AIBot.js';
import { MapGenerator } from './mechanics/MapGenerator.js';
import { Physics } from './mechanics/Physics.js';
import { UIManager } from './ui/UIManager.js';

class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.uiManager = new UIManager();

    // 1. 3D 場景
    this.sceneSetup = new SceneSetup(this.container);
    this.scene = this.sceneSetup.scene;

    // 2. 地圖與物理
    this.mapGenerator = new MapGenerator(this.scene);
    this.physics = new Physics();

    // 3. 狀態
    this.isGameStarted = false;
    this.isGameOver = false;

    // 身後老鷹底邊界推進 (0.35格/秒)
    this.cameraAutoScrollZ = -3.0 * CONFIG.GRID_SIZE;

    this.idleTimer = 0;
    this.lastPlayerZ = 0;
    this.eagleMesh = null;
    this.isEagleAttacking = false;
    this.casualDuration = 120;
    this.casualTimeRemaining = this.casualDuration;
    this.casualCheckpoint = { x: 0, z: 0 };
    this.lastLandedZ = 0;

    // 4. 小雞主角
    this.chickenMesh = createChicken();
    this.scene.add(this.chickenMesh);
    this.player = new Player(this.chickenMesh);
    this.bots = [];

    this.clock = new THREE.Clock();

    // 5. 初始化輸入與地圖 (修復模式參數 mode 傳遞)
    this.setupInputListeners();
    this.uiManager.init(
      (mode) => this.startGame(mode),
      (mode) => this.restartGame(mode),
      () => this.returnLobby()
    );

    this.mapGenerator.initMap();

    // 啟動動畫迴圈
    this.animate = this.animate.bind(this);
    this.animate();
  }

  setupInputListeners() {
    window.addEventListener('keydown', (e) => {
      if (!this.isGameStarted || this.isGameOver) return;
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
      if (!this.isGameStarted || this.isGameOver) return;
      this.handlePlayerInput('UP');
    });
  }

  handlePlayerInput(direction, distance = 1) {
    if (!this.isGameStarted || this.isGameOver) return;

    if (this.player.isJumping) {
      this.player.queueInput(direction, distance);
      return;
    }

    this.handlePlayerMove(direction, distance);
  }

  handlePlayerMove(direction, distance = 1) {
    if (!this.isGameStarted || this.isGameOver) return;

    if (!this.tryMoveActor(this.player, direction, distance)) {
      this.player.setFacingDirection(direction);
      this.player.inputBuffer = [];
    } else {
      // 玩家跳躍時底邊界對齊
      const maxZ = Number.isFinite(this.player.maxReachedZ) ? this.player.maxReachedZ : 0;
      const catchupZ = (maxZ - 3.0) * CONFIG.GRID_SIZE;
      this.cameraAutoScrollZ = Math.max(this.cameraAutoScrollZ, catchupZ);
      this.player.minAllowedZ = Math.floor(this.cameraAutoScrollZ / CONFIG.GRID_SIZE);

      this.mapGenerator.update(this.player.gridZ);
      this.uiManager.updateScore(this.player.score);
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

  tryMoveActor(actor, direction, distance = 1) {
    if (actor.isJumping || actor.isDead) return false;
    const targetPos = actor.getTargetGridPosition(direction, distance);
    if (Math.abs(targetPos.x) > CONFIG.MAP_BOUNDS_X || targetPos.z < actor.minAllowedZ) return false;
    if (this.physics.checkTreeCollision(targetPos, this.mapGenerator.getActiveRows())) return false;

    const pushedActor = this.getActorAtGrid(targetPos, [actor]);
    if (pushedActor) {
      if (pushedActor.isJumping || !this.tryPushActor(pushedActor, direction, actor)) return false;
    }

    return actor.move(direction, distance);
  }

  canMoveActor(actor, direction, distance = 1) {
    if (actor.isJumping || actor.isDead) return false;
    const targetPos = actor.getTargetGridPosition(direction, distance);
    if (Math.abs(targetPos.x) > CONFIG.MAP_BOUNDS_X || targetPos.z < actor.minAllowedZ) return false;
    if (this.physics.checkTreeCollision(targetPos, this.mapGenerator.getActiveRows())) return false;

    const pushedActor = this.getActorAtGrid(targetPos, [actor]);
    if (!pushedActor) return true;
    if (pushedActor.isJumping) return false;
    const pushTarget = pushedActor.getTargetGridPosition(direction);
    return this.canActorEnter(pushedActor, pushTarget, [actor]);
  }

  tryPushActor(actor, direction, pushingActor) {
    const pushTarget = actor.getTargetGridPosition(direction);
    if (!this.canActorEnter(actor, pushTarget, [pushingActor])) return false;
    return actor.move(direction);
  }

  createCasualBots() {
    const botSpawns = [
      { x: -1, z: 0, aggression: 0.42 },
      { x: 1, z: 0, aggression: 0.48 },
      { x: 3, z: 0, aggression: 0.54 }
    ];
    const shuffledVariants = [...AI_CHARACTER_VARIANTS];
    for (let index = shuffledVariants.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffledVariants[index], shuffledVariants[randomIndex]] = [shuffledVariants[randomIndex], shuffledVariants[index]];
    }
    const selectedVariants = shuffledVariants.slice(0, botSpawns.length);

    this.bots = botSpawns.map((spawn, index) => {
      const variant = selectedVariants[index];
      const mesh = variant.createMesh();
      this.scene.add(mesh);
      return new AIBot(mesh, variant.name, spawn.x, spawn.z, spawn.aggression);
    });
  }

  clearBots() {
    this.bots.forEach((bot) => this.scene.remove(bot.mesh));
    this.bots = [];
  }

  refreshLeaderboard() {
    if (this.currentMode !== 'casual') return;
    const entries = [
      { name: '玩家', score: this.player.score, isPlayer: true, order: 0 },
      ...this.bots.map((bot, index) => ({ name: bot.botName, score: bot.score, isPlayer: false, order: index + 1 }))
    ];
    this.uiManager.updateLeaderboard(entries);
  }

  handlePlayerLanded() {
    if (!this.isGameStarted || this.isGameOver) return;
    this.mapGenerator.update(this.player.gridZ);
    this.uiManager.updateScore(this.player.score);

    if (this.currentMode !== 'casual') return;
    const landedRow = this.mapGenerator.getActiveRows().get(this.player.gridZ);
    if (landedRow?.type === CONFIG.ROW_TYPES.GRASS && this.player.gridZ > this.casualCheckpoint.z) {
      this.casualCheckpoint = { x: this.player.gridX, z: this.player.gridZ };
    }
  }

  handleBotLanded(bot) {
    const landedRow = this.mapGenerator.getActiveRows().get(bot.gridZ);
    if (landedRow?.type === CONFIG.ROW_TYPES.GRASS) bot.updateCheckpoint();
  }

  respawnBotAtCheckpoint(bot) {
    bot.respawnAt(bot.checkpoint.x, bot.checkpoint.z);
  }

  updateCasualBotHazards(bot, activeRows, deltaTime) {
    if (bot.isJumping || bot.isDead) return;

    const hitObstacle = this.physics.checkObstacleCollision(bot, activeRows);
    if (hitObstacle && !bot.isInvulnerable) {
      this.respawnBotAtCheckpoint(bot);
      return;
    }

    const riverStatus = this.physics.checkRiverStatus(bot, activeRows);
    if (!riverStatus.inRiver) return;
    if (!riverStatus.onLog) {
      this.respawnBotAtCheckpoint(bot);
      return;
    }

    bot.position.x += riverStatus.logSpeed * deltaTime;
    bot.gridX = Math.round(bot.position.x / CONFIG.GRID_SIZE);
    if (Math.abs(bot.position.x) > (CONFIG.MAP_BOUNDS_X + 1.2) * CONFIG.GRID_SIZE) {
      this.respawnBotAtCheckpoint(bot);
    }
  }

  startGame(mode = 'casual') {
    this.uiManager.hideOverlays();

    this.currentMode = mode || 'casual';
    this.uiManager.selectedMode = this.currentMode;
    this.isGameStarted = true;
    this.isGameOver = false;

    this.cameraScrollZ = 0;
    this.idleTimer = 0;
    this.lastPlayerZ = 0;
    this.isEagleAttacking = false;
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
    this.mapGenerator.initMap();
    if (this.currentMode === 'casual') {
      // 四個角色在同一條起跑線排列，避免開局出現前後錯位。
      this.player.respawnAt(-3, 0, 0.1);
      this.casualCheckpoint = { x: -3, z: 0 };
    }
    this.sceneSetup.resetCamera();
    this.uiManager.updateScore(0);
    this.uiManager.updateTimer(this.casualTimeRemaining);
    if (this.currentMode === 'casual') {
      this.createCasualBots();
      this.refreshLeaderboard();
    }
  }

  restartGame(mode) {
    this.startGame(mode || this.currentMode);
  }

  returnLobby() {
    this.isGameStarted = false;
    this.isGameOver = false;
    this.clearBots();
    this.uiManager.showLobby();
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
      progress += 0.04;
      if (progress < 0.6) {
        this.eagleMesh.position.lerpVectors(startPos, targetPos, progress / 0.6);
      } else if (progress < 1.0) {
        if (this.player.mesh) this.player.mesh.visible = false;
        const exitPos = new THREE.Vector3(pX + 15, 20, pZ + 15);
        this.eagleMesh.position.lerpVectors(targetPos, exitPos, (progress - 0.6) / 0.4);
      } else {
        clearInterval(attackInterval);
        if (this.eagleMesh) {
          this.scene.remove(this.eagleMesh);
          this.eagleMesh = null;
        }
        this.gameOver('發呆時間過長，被空中老鷹捕捉抓走！');
      }
    }, 16);
  }

  gameOver(reason = '被車撞飛了！') {
    this.isGameOver = true;
    this.uiManager.showGameOver(this.player.score, reason);
  }

  respawnAtCasualCheckpoint() {
    this.player.respawnAt(this.casualCheckpoint.x, this.casualCheckpoint.z);
    this.cameraScrollZ = Math.max(0, this.casualCheckpoint.z * CONFIG.GRID_SIZE);
    this.mapGenerator.update(this.casualCheckpoint.z);
  }

  animate() {
    requestAnimationFrame(this.animate);

    try {
      const rawDelta = this.clock.getDelta();
      const deltaTime = Number.isFinite(rawDelta) && rawDelta > 0 ? Math.min(rawDelta, 0.1) : 0.016;
      const activeRows = this.mapGenerator.getActiveRows();

      // 1. 主角動態更新
      const wasJumping = this.player.isJumping;
      this.player.update(deltaTime);
      if (wasJumping && !this.player.isJumping) this.handlePlayerLanded();

      if (this.isGameStarted && !this.isGameOver && this.currentMode === 'casual') {
        this.bots.forEach((bot) => {
          const wasBotJumping = bot.isJumping;
          bot.updateAI(
            deltaTime,
            activeRows,
            this.physics,
            (actor, direction) => this.tryMoveActor(actor, direction),
            (actor, direction) => this.canMoveActor(actor, direction)
          );
          bot.update(deltaTime);
          if (wasBotJumping && !bot.isJumping) this.handleBotLanded(bot);
          this.updateCasualBotHazards(bot, activeRows, deltaTime);
        });
        this.refreshLeaderboard();
      }

      // 安全消耗連續跳躍緩衝隊列 (100% 通過 checkTreeCollision 嚴格碰撞檢測，徹底根除穿樹 Bug)
      if (!this.player.isJumping && this.player.inputBuffer.length > 0) {
        const nextInput = this.player.inputBuffer.shift();
        this.handlePlayerMove(nextInput.direction, nextInput.distance);
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
          this.cameraScrollZ += 0.45 * deltaTime * CONFIG.GRID_SIZE;

          // 主角跳躍超越相機時，相機順暢跟進
          if (pZ > this.cameraScrollZ) {
            this.cameraScrollZ = THREE.MathUtils.lerp(this.cameraScrollZ, pZ, 0.18);
          }

          // 當主角發呆 7.5 秒滑出螢幕底邊界 -> 觸發老鷹俯衝抓走淘汰
          const distanceBehind = this.cameraScrollZ - pZ;
          if (distanceBehind >= 3.4 * CONFIG.GRID_SIZE && !this.isEagleAttacking) {
            this.triggerEagleAttack();
          }

          const playerGridZ = Math.max(this.player.gridZ, Math.floor(this.cameraScrollZ / CONFIG.GRID_SIZE));
          this.mapGenerator.update(playerGridZ);
          this.player.minAllowedZ = Math.floor((this.cameraScrollZ - 3.4 * CONFIG.GRID_SIZE) / CONFIG.GRID_SIZE);
        } else {
          // 🍃 休閒模式：相機平滑跟隨主角 (剔除後方邊界推進，剔除發呆老鷹抓走)
          this.cameraScrollZ = THREE.MathUtils.lerp(this.cameraScrollZ, pZ, 0.12);
          this.mapGenerator.update(this.player.gridZ);
          this.player.minAllowedZ = this.player.gridZ - 15;
        }
      }

      // 5. 馬路車輛 / 河流浮木 / 鐵道火車動態
      this.mapGenerator.animateObstacles(deltaTime);

      // 6. 即時更新相機 3D 視角位置 (主角保持於螢幕下半部偏後區域，視角與競品 100% 對齊)
      const targetCameraZ = (this.isGameStarted ? this.cameraScrollZ : pZ) + 2.2 * CONFIG.GRID_SIZE;
      this.sceneSetup.updateCamera({ x: pX, z: targetCameraZ });

      // 5. 碰撞判定 (車輛 / 火車 / 落水)
      if (this.isGameStarted && !this.isGameOver && !this.isEagleAttacking) {
        const hitObstacle = this.physics.checkObstacleCollision(this.player, activeRows);
        if (hitObstacle && !this.player.isInvulnerable) {
          if (this.currentMode === 'casual') {
            this.respawnAtCasualCheckpoint();
            return;
          }
          const damage = hitObstacle.type === 'train' ? 70 : Math.min(60, Math.round(hitObstacle.speed * 8 + 10));
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
                this.respawnAtCasualCheckpoint();
                return;
              }
              this.player.triggerDrownAnimation();
              this.gameOver('漂流過遠，掉出邊界外！');
            }
          } else {
            if (this.currentMode === 'casual') {
              this.respawnAtCasualCheckpoint();
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

// 啟動遊戲
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
