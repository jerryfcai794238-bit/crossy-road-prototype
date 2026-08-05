import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SceneSetup } from './graphics/SceneSetup.js';
import { createChicken } from './graphics/VoxelModels.js';
import { Player } from './mechanics/Player.js';
import { MapGenerator } from './mechanics/MapGenerator.js';
import { Physics } from './mechanics/Physics.js';
import { ItemSystem, ITEM_TYPES } from './mechanics/ItemSystem.js';
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

    // 綁定 UI 與 3 大技能獨立按鈕
    this.uiManager.init(
      () => this.startGame(),
      () => this.restartGame(),
      () => this.fastRespawn(),
      (skillType) => this.triggerSkill(skillType)
    );

    this.setupInputListeners();
    
    // 首頁產生初始地圖
    this.mapGenerator.initMap();

    // 啟動主渲染迴圈
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupInputListeners() {
    // 鍵盤控制：W/A/D/S 移動，1/2/3 直接觸發對應技能
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
        case '1':
          this.triggerSkill(ITEM_TYPES.SHIELD);
          break;
        case '2':
          this.triggerSkill(ITEM_TYPES.ROCKET);
          break;
        case '3':
          this.triggerSkill(ITEM_TYPES.TIME_SLOW);
          break;
      }
    });

    // 虛擬 D-Pad
    document.getElementById('btn-up')?.addEventListener('click', () => this.handlePlayerMove('UP'));
    document.getElementById('btn-down')?.addEventListener('click', () => this.handlePlayerMove('DOWN'));
    document.getElementById('btn-left')?.addEventListener('click', () => this.handlePlayerMove('LEFT'));
    document.getElementById('btn-right')?.addEventListener('click', () => this.handlePlayerMove('RIGHT'));

    // 螢幕 Touch / Click 往前跳
    this.container.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#hud') || e.target.closest('#skill-bar') || e.target.closest('#mobile-controls') || e.target.closest('.overlay')) return;
      if (!this.isGameStarted || this.isGameOver) return;
      this.handlePlayerMove('UP');
    });
  }

  triggerSkill(skillType) {
    if (!this.isGameStarted || this.isGameOver) return;

    // 若為火箭跳躍，先檢測並爆破落腳點處的樹木，避免塞在樹幹內
    if (skillType === ITEM_TYPES.ROCKET) {
      const targetPos = this.player.getTargetGridPosition('UP', 3);
      this.physics.destroyTreeAt(targetPos, this.mapGenerator.getActiveRows());
    }

    this.itemSystem.useItem(skillType);
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
    this.mapGenerator.initMap();
    this.itemSystem.reset();
    this.uiManager.updateScore(0);
    this.isGameOver = false;
    this.isGameStarted = true;
    this.clock.start();
  }

  // 3 秒快速空投復活
  fastRespawn() {
    const activeRows = this.mapGenerator.getActiveRows();
    let safeZ = Math.max(0, this.player.gridZ - 1);
    
    while (safeZ > 0) {
      const row = activeRows.get(safeZ);
      if (row && row.type === CONFIG.ROW_TYPES.GRASS) {
        break;
      }
      safeZ--;
    }

    const row = activeRows.get(safeZ);
    let safeX = 0;
    if (row && Array.isArray(row.trees)) {
      for (let x = 0; x <= CONFIG.MAP_BOUNDS_X; x++) {
        if (!row.trees.some((t) => t.gridX === x)) {
          safeX = x;
          break;
        }
        if (!row.trees.some((t) => t.gridX === -x)) {
          safeX = -x;
          break;
        }
      }
    }

    this.player.respawn(safeX, safeZ);
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

    // 更新 3 大技能獨立 CD 與 UI
    this.itemSystem.update(deltaTime);
    this.uiManager.updateIndependentCooldowns(
      this.itemSystem.getCooldownRatios(),
      this.itemSystem.cooldowns
    );

    // 計算時空減速效果倍率 (若觸發超感時空減速，車輛與浮木速度降為 35%)
    const speedMultiplier = this.player.isReflexHyper ? 0.35 : 1.0;

    // 更新馬路車輛 / 河流浮木 / 鐵路火車位置 (全場減速)
    this.mapGenerator.animateObstacles(deltaTime, elapsedTime, speedMultiplier);

    // 鏡頭平滑跟隨小雞
    this.sceneSetup.updateCamera(this.player.position);

    // 遊戲進行中的碰撞與判定
    if (this.isGameStarted && !this.isGameOver && !this.player.isRespawning) {
      const activeRows = this.mapGenerator.getActiveRows();
      
      // 1. 車輛 / 火車撞擊判定
      const hitObstacle = this.physics.checkObstacleCollision(this.player, activeRows);
      if (hitObstacle && !this.player.isShielded) {
        this.player.triggerFlattenAnimation();
        this.gameOver(hitObstacle.type === 'train' ? '慘遭高速火車輾過！' : '被車輛撞飛了！');
      }

      // 2. 河流與木塊落水判定
      const riverStatus = this.physics.checkRiverStatus(this.player, activeRows);
      if (riverStatus.inRiver && !this.player.isShielded) {
        if (riverStatus.onLog) {
          this.player.position.x += riverStatus.logSpeed * speedMultiplier * deltaTime;
          this.player.gridX = Math.round(this.player.position.x / CONFIG.GRID_SIZE);
          
          const drownBoundaryX = (CONFIG.MAP_BOUNDS_X + 3.8) * CONFIG.GRID_SIZE;
          if (Math.abs(this.player.position.x) > drownBoundaryX) {
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
