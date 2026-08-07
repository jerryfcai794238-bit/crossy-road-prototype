import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SceneSetup } from './graphics/SceneSetup.js';
import { createChicken, createEagle } from './graphics/VoxelModels.js';
import { Player } from './mechanics/Player.js';
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

    // 4. 小雞主角
    this.chickenMesh = createChicken();
    this.scene.add(this.chickenMesh);
    this.player = new Player(this.chickenMesh);

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
      if (e.target.closest('#hud') || e.target.closest('#leaderboard') || e.target.closest('#mobile-controls') || e.target.closest('.overlay')) return;
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

    const targetPos = this.player.getTargetGridPosition(direction, distance);

    if (this.physics.checkTreeCollision(targetPos, this.mapGenerator.getActiveRows())) {
      this.player.setFacingDirection(direction);
      this.player.inputBuffer = [];
      return;
    }

    const moved = this.player.move(direction, distance);
    if (moved) {
      // 玩家跳躍時底邊界對齊
      const maxZ = Number.isFinite(this.player.maxReachedZ) ? this.player.maxReachedZ : 0;
      const catchupZ = (maxZ - 3.0) * CONFIG.GRID_SIZE;
      this.cameraAutoScrollZ = Math.max(this.cameraAutoScrollZ, catchupZ);
      this.player.minAllowedZ = Math.floor(this.cameraAutoScrollZ / CONFIG.GRID_SIZE);

      this.mapGenerator.update(this.player.gridZ);
      this.uiManager.updateScore(this.player.score);
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

    if (this.eagleMesh) {
      this.scene.remove(this.eagleMesh);
      this.eagleMesh = null;
    }

    this.player.reset();
    this.uiManager.updateHealth(this.player.hp);
    this.mapGenerator.initMap();
    this.sceneSetup.resetCamera();
    this.uiManager.updateScore(0);
  }

  restartGame(mode) {
    this.startGame(mode || this.currentMode);
  }

  returnLobby() {
    this.isGameStarted = false;
    this.isGameOver = false;
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

  animate() {
    requestAnimationFrame(this.animate);

    try {
      const rawDelta = this.clock.getDelta();
      const deltaTime = Number.isFinite(rawDelta) && rawDelta > 0 ? Math.min(rawDelta, 0.1) : 0.016;
      const activeRows = this.mapGenerator.getActiveRows();

      // 1. 主角動態更新
      this.player.update(deltaTime);

      // 安全消耗連續跳躍緩衝隊列 (100% 通過 checkTreeCollision 嚴格碰撞檢測，徹底根除穿樹 Bug)
      if (!this.player.isJumping && this.player.inputBuffer.length > 0) {
        const nextInput = this.player.inputBuffer.shift();
        this.handlePlayerMove(nextInput.direction, nextInput.distance);
      }

      // 🎥 經典 Crossy Road 競品 1:1 相機自主恆速推進系統 (對齊競品 7~8 秒老鷹抓走時間)
      const pZ = Number.isFinite(this.player.position.z) ? this.player.position.z : (this.player.gridZ * CONFIG.GRID_SIZE);
      const pX = Number.isFinite(this.player.position.x) ? this.player.position.x : (this.player.gridX * CONFIG.GRID_SIZE);

      if (this.isGameStarted && !this.isGameOver) {
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
              this.player.triggerDrownAnimation();
              this.gameOver('漂流過遠，掉出邊界外！');
            }
          } else {
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
