import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SceneSetup } from './graphics/SceneSetup.js';
import { createChicken } from './graphics/VoxelModels.js';
import { Player } from './mechanics/Player.js';
import { MapGenerator } from './mechanics/MapGenerator.js';
import { Physics } from './mechanics/Physics.js';
import { ItemSystem } from './mechanics/ItemSystem.js';
import { UIManager } from './ui/UIManager.js';

class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.uiManager = new UIManager();

    // 初始化 3D 場景
    this.sceneSetup = new SceneSetup(this.container);
    this.scene = this.sceneSetup.scene;

    // 遊戲狀態
    this.isGameStarted = false;
    this.isGameOver = false;

    // 建立小雞角色模型
    this.chickenMesh = createChicken();
    this.scene.add(this.chickenMesh);

    // 遊戲元件初始化
    this.player = new Player(this.chickenMesh);
    this.mapGenerator = new MapGenerator(this.scene);
    this.physics = new Physics();
    this.itemSystem = new ItemSystem(this.scene, this.player);

    this.clock = new THREE.Clock();

    // 綁定 UI 與 控制器
    this.uiManager.init(
      () => this.startGame(),
      () => this.restartGame(),
      () => this.fastRespawn(),
      () => this.useItem(),
      (itemType) => this.itemSystem.selectItem(itemType)
    );

    this.setupInputListeners();
    
    // 首頁產生初始地圖
    this.mapGenerator.initMap();

    // 啟動主渲染迴圈
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupInputListeners() {
    // 鍵盤控制 (含道具快捷鍵)
    window.addEventListener('keydown', (e) => {
      if (!this.isGameStarted || this.isGameOver) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.handlePlayerMove('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.handlePlayerMove('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.handlePlayerMove('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.handlePlayerMove('RIGHT');
          break;
        case ' ':
        case 'e':
        case 'E':
          this.useItem();
          break;
      }
    });

    // 虛擬 D-Pad (行動裝置)
    document.getElementById('btn-up')?.addEventListener('click', () => this.handlePlayerMove('UP'));
    document.getElementById('btn-down')?.addEventListener('click', () => this.handlePlayerMove('DOWN'));
    document.getElementById('btn-left')?.addEventListener('click', () => this.handlePlayerMove('LEFT'));
    document.getElementById('btn-right')?.addEventListener('click', () => this.handlePlayerMove('RIGHT'));

    // 螢幕 Touch / Click 往前跳
    this.container.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#hud') || e.target.closest('#item-hud') || e.target.closest('#mobile-controls') || e.target.closest('.overlay')) return;
      if (!this.isGameStarted || this.isGameOver) return;
      this.handlePlayerMove('UP');
    });
  }

  useItem() {
    if (!this.isGameStarted || this.isGameOver) return;
    this.itemSystem.useItem();
  }

  handlePlayerMove(direction) {
    if (!this.isGameStarted || this.isGameOver) return;

    const targetPos = this.player.getTargetGridPosition(direction);

    // 檢查是否有樹木阻擋
    if (this.physics.checkTreeCollision(targetPos, this.mapGenerator.getActiveRows())) {
      this.player.setFacingDirection(direction);
      return;
    }

    const moved = this.player.move(direction);
    if (moved) {
      this.mapGenerator.update(this.player.gridZ);
      this.uiManager.updateScore(this.player.score);
    }
  }

  startGame() {
    this.isGameStarted = true;
    this.isGameOver = false;
    this.itemSystem.reset();
    this.clock.start();
  }

  restartGame() {
    this.player.reset();
    this.mapGenerator.reset();
    this.itemSystem.reset();
    this.uiManager.updateScore(0);
    this.isGameOver = false;
    this.isGameStarted = true;
    this.clock.start();
  }

  // 1 秒快速空投重生
  fastRespawn() {
    const safeZ = Math.max(0, this.player.gridZ - 2);
    this.player.respawn(safeZ);
    this.isGameOver = false;
    this.isGameStarted = true;
    this.clock.start();
  }

  gameOver(reason) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.uiManager.showGameOver(this.player.score, reason);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const deltaTime = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 更新角色狀態與跳躍動畫
    this.player.update(deltaTime);

    // 更新道具系統 CD 與 VFX
    this.itemSystem.update(deltaTime);
    this.uiManager.updateItemCooldown(
      this.itemSystem.getCooldownRatio(),
      this.itemSystem.cooldownTimer
    );

    // 更新馬路車輛 / 河流浮木 / 鐵路火車位置
    this.mapGenerator.animateObstacles(deltaTime, elapsedTime);

    // 鏡頭平滑跟隨小雞
    this.sceneSetup.updateCamera(this.player.position);

    // 遊戲進行中的碰撞與判定
    if (this.isGameStarted && !this.isGameOver && !this.player.isRespawning) {
      const activeRows = this.mapGenerator.getActiveRows();
      
      // 1. 車輛 / 火車撞擊判定 (已整合護盾無敵穿透)
      const hitObstacle = this.physics.checkObstacleCollision(this.player, activeRows);
      if (hitObstacle && !this.player.isShielded) {
        this.player.triggerFlattenAnimation();
        this.gameOver(hitObstacle.type === 'train' ? '慘遭高速火車輾過！' : '被車輛撞飛了！');
      }

      // 2. 河流與木塊落水判定 (已整合護盾防護)
      const riverStatus = this.physics.checkRiverStatus(this.player, activeRows);
      if (riverStatus.inRiver && !this.player.isShielded) {
        if (riverStatus.onLog) {
          this.player.position.x += riverStatus.logSpeed * deltaTime;
          this.player.gridX = Math.round(this.player.position.x / CONFIG.GRID_SIZE);
          
          if (Math.abs(this.player.position.x) > CONFIG.MAP_BOUNDS_X * CONFIG.GRID_SIZE) {
            this.player.triggerDrownAnimation();
            this.gameOver('漂流過遠，掉出邊界外！');
          }
        } else {
          this.player.triggerDrownAnimation();
          this.gameOver('噗通！落水淹死了！');
        }
      }
    }

    // 渲染 Three.js 畫面
    this.sceneSetup.render();
  }
}

// 頁面載入後啟動遊戲
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
