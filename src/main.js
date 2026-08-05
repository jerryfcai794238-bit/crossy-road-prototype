import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SceneSetup } from './graphics/SceneSetup.js';
import { createChicken, createDuck, createFrog, createShiba } from './graphics/VoxelModels.js';
import { Player } from './mechanics/Player.js';
import { AIBot } from './mechanics/AIBot.js';
import { MapGenerator } from './mechanics/MapGenerator.js';
import { Physics } from './mechanics/Physics.js';
import { ItemSystem, ITEM_TYPES } from './mechanics/ItemSystem.js';
import { UIManager } from './ui/UIManager.js';

class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.uiManager = new UIManager();

    // 初始化 3D 場景 (對齊正版 Crossy Road 視角)
    this.sceneSetup = new SceneSetup(this.container);
    this.scene = this.sceneSetup.scene;

    // 遊戲狀態
    this.isGameStarted = false;
    this.isGameOver = false;

    // 畫面自動慢速推進 baseline Z
    this.cameraAutoScrollZ = 0;

    // 1. 建立主角小雞 (Chicken)
    this.chickenMesh = createChicken();
    this.scene.add(this.chickenMesh);
    this.player = new Player(this.chickenMesh);

    // 2. 建立 3 隻不同動物造型的 AI 競速機器人 (Duck, Frog, Shiba)
    this.duckMesh = createDuck();
    this.frogMesh = createFrog();
    this.shibaMesh = createShiba();
    this.scene.add(this.duckMesh, this.frogMesh, this.shibaMesh);

    this.aiBots = [
      new AIBot(this.duckMesh, '黃色小鴨', -2, 0, 0.42),
      new AIBot(this.frogMesh, '綠色青蛙', 2, 0, 0.32),
      new AIBot(this.shibaMesh, '體素柴犬', 4, 0, 0.38)
    ];

    // 所有 4 名參賽選手
    this.allRunners = [this.player, ...this.aiBots];

    // 遊戲元件初始化
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

    if (skillType === ITEM_TYPES.ROCKET) {
      const targetPos = this.player.getTargetGridPosition('UP', 3);
      this.physics.destroyTreesInArea(targetPos, 1, this.mapGenerator.getActiveRows());
    }

    this.itemSystem.useItem(skillType);
  }

  handlePlayerMove(direction) {
    if (!this.isGameStarted || this.isGameOver) return;

    const targetPos = this.player.getTargetGridPosition(direction);

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
    this.cameraAutoScrollZ = 0;
    this.itemSystem.reset();
    this.resetAllRunners();
    this.clock.start();
  }

  restartGame() {
    this.mapGenerator.initMap();
    this.itemSystem.reset();
    this.uiManager.updateScore(0);
    this.cameraAutoScrollZ = 0;
    this.isGameOver = false;
    this.isGameStarted = true;
    this.resetAllRunners();
    this.clock.start();
  }

  resetAllRunners() {
    this.player.reset();
    this.aiBots.forEach(bot => {
      this.scene.add(bot.mesh);
    });
    this.aiBots[0].resetAt(-2, 0); // 黃色小鴨
    this.aiBots[1].resetAt(2, 0);  // 綠色青蛙
    this.aiBots[2].resetAt(4, 0);  // 體素柴犬
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

  gameOver(reason, allowRespawn = true) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.uiManager.showGameOver(this.player.score, reason, allowRespawn);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const deltaTime = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();
    const activeRows = this.mapGenerator.getActiveRows();

    // 1. 更新主角狀態與跳躍
    this.player.update(deltaTime);

    // 2. 更新 3 隻 AI 動物決策與跳躍
    if (this.isGameStarted && !this.isGameOver) {
      this.aiBots.forEach((bot) => {
        if (!bot.isRespawning) {
          bot.updateAI(deltaTime, activeRows, this.physics);
          bot.update(deltaTime);
        }
      });
    }

    // 3. 處理 4 人 1x1 網格 Bump 推擠碰撞
    this.physics.resolveGridBump(this.allRunners);

    // 4. 更新 3 大技能獨立 CD 與 UI
    this.itemSystem.update(deltaTime);
    this.uiManager.updateIndependentCooldowns(
      this.itemSystem.getCooldownRatios(),
      this.itemSystem.cooldowns
    );

    // 5. 超感時空減速倍率 (0.35x)
    const speedMultiplier = this.player.isReflexHyper ? 0.35 : 1.0;

    // 6. 更新馬路車輛 / 河流浮木 / 鐵路火車位置
    this.mapGenerator.animateObstacles(deltaTime, elapsedTime, speedMultiplier);

    // 7. 畫面動態推進機制
    if (this.isGameStarted && !this.isGameOver) {
      this.cameraAutoScrollZ += 0.45 * deltaTime * CONFIG.GRID_SIZE;
      
      const effectiveTargetZ = Math.max(this.cameraAutoScrollZ, this.player.position.z);
      this.sceneSetup.updateCamera({ x: this.player.position.x, z: effectiveTargetZ });

      // 檢查主角是否落後被捲出視角外
      const maxDistanceBehind = 6.5 * CONFIG.GRID_SIZE;
      if (this.player.position.z < this.cameraAutoScrollZ - maxDistanceBehind && !this.player.isRespawning) {
        this.gameOver('已被推離視角外淘汰！(地形已被回收無法復活)', false);
      }
    } else {
      this.sceneSetup.updateCamera(this.player.position);
    }

    // 8. 主角碰撞與落水判定
    if (this.isGameStarted && !this.isGameOver && !this.player.isRespawning) {
      // 車輛 / 火車撞擊判定
      const hitObstacle = this.physics.checkObstacleCollision(this.player, activeRows);
      if (hitObstacle && !this.player.isShielded) {
        this.player.triggerFlattenAnimation();
        this.gameOver(hitObstacle.type === 'train' ? '慘遭高速火車輾過！' : '被車輛撞飛了！');
      }

      // 河流與木塊落水判定
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

    // 9. 更新 AI 對手的撞車、河流漂木隨波流動與落水淘汰判定 (修復圖 1)
    if (this.isGameStarted && !this.isGameOver) {
      this.aiBots.forEach((bot) => {
        if (bot.isRespawning) return;

        // AI 撞車/火車淘汰
        const botHit = this.physics.checkObstacleCollision(bot, activeRows);
        if (botHit && !bot.isShielded) {
          bot.triggerFlattenAnimation();
          bot.isRespawning = true;
          setTimeout(() => { this.scene.remove(bot.mesh); }, 600);
        }

        // AI 河流漂流與落水淹死淘汰
        const botRiver = this.physics.checkRiverStatus(bot, activeRows);
        if (botRiver.inRiver && !bot.isShielded) {
          if (botRiver.onLog) {
            bot.position.x += botRiver.logSpeed * speedMultiplier * deltaTime;
            bot.gridX = Math.round(bot.position.x / CONFIG.GRID_SIZE);
            
            const drownBoundaryX = (CONFIG.MAP_BOUNDS_X + 3.8) * CONFIG.GRID_SIZE;
            if (Math.abs(bot.position.x) > drownBoundaryX) {
              bot.triggerDrownAnimation();
              bot.isRespawning = true;
              setTimeout(() => { this.scene.remove(bot.mesh); }, 600);
            }
          } else {
            bot.triggerDrownAnimation();
            bot.isRespawning = true;
            setTimeout(() => { this.scene.remove(bot.mesh); }, 600);
          }
        }
      });
    }

    // 10. 渲染 Three.js 畫面
    this.sceneSetup.render();
  }
}

// 頁面載入後啟動遊戲
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
