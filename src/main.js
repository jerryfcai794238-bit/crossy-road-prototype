import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SceneSetup } from './graphics/SceneSetup.js';
import { createChicken, createDuck, createFrog, createShiba, createEagle } from './graphics/VoxelModels.js';
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

    // 初始化 3D 場景 (鏡頭距離拉近至 d=4.0)
    this.sceneSetup = new SceneSetup(this.container);
    this.scene = this.sceneSetup.scene;

    // 遊戲狀態
    this.isGameStarted = false;
    this.isGameOver = false;

    // 單向前進相機歷史最高值 Z 座標
    this.maxCameraZ = 0;

    // 身後底邊界 (0.45格/秒平滑推進，發呆7秒追上小雞)
    this.cameraAutoScrollZ = -3.15 * CONFIG.GRID_SIZE;

    // 老鷹與攻擊狀態
    this.idleTimer = 0;
    this.lastPlayerZ = 0;
    this.eagleMesh = null;
    this.isEagleAttacking = false;

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

    // 綁定 UI 與 3 大獨立技能獨立按鈕
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
      if (e.target.closest('#hud') || e.target.closest('#skill-bar') || e.target.closest('#leaderboard') || e.target.closest('#mobile-controls') || e.target.closest('.overlay')) return;
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
      // 玩家向前跳躍時，底邊界自動同步向前補進對齊 (-3.15格)
      const catchupZ = (this.player.maxReachedZ - 3.15) * CONFIG.GRID_SIZE;
      this.cameraAutoScrollZ = Math.max(this.cameraAutoScrollZ, catchupZ);
      this.player.minAllowedZ = Math.floor(this.cameraAutoScrollZ / CONFIG.GRID_SIZE);

      this.mapGenerator.update(this.player.gridZ);
      this.uiManager.updateScore(this.player.score);
    }
  }

  startGame() {
    this.isGameStarted = true;
    this.isGameOver = false;
    this.maxCameraZ = 0;
    this.idleTimer = 0;
    this.lastPlayerZ = 0;
    this.isEagleAttacking = false;

    if (this.eagleMesh) {
      this.scene.remove(this.eagleMesh);
      this.eagleMesh = null;
    }

    // 先重置玩家與 AI 選手狀態
    this.resetAllRunners();

    // 歸零並精準設定底邊界為 -3.15 格 (7 秒空間)
    this.cameraAutoScrollZ = -3.15 * CONFIG.GRID_SIZE;
    this.player.minAllowedZ = Math.floor(this.cameraAutoScrollZ / CONFIG.GRID_SIZE);

    // 0 延遲重置相機 (焦點向前推進 +1.6 格，使主角置於畫面下 25%)
    this.sceneSetup.resetCamera();
    this.itemSystem.reset();
    this.clock.start();
  }

  restartGame() {
    this.mapGenerator.initMap();
    this.itemSystem.reset();
    this.uiManager.updateScore(0);
    this.isGameOver = false;
    this.isGameStarted = true;
    this.maxCameraZ = 0;
    this.idleTimer = 0;
    this.lastPlayerZ = 0;
    this.isEagleAttacking = false;

    if (this.eagleMesh) {
      this.scene.remove(this.eagleMesh);
      this.eagleMesh = null;
    }

    // 1. 先重置選手網格與物理座標
    this.resetAllRunners();

    // 2. 徹底歸零底邊界 (-3.15 格)
    this.cameraAutoScrollZ = -3.15 * CONFIG.GRID_SIZE;
    this.player.minAllowedZ = Math.floor(this.cameraAutoScrollZ / CONFIG.GRID_SIZE);

    // 3. 相機焦點 0 延遲完全閃回對齊起點
    this.sceneSetup.resetCamera();

    this.clock.start();
  }

  resetAllRunners() {
    this.player.reset();
    this.aiBots.forEach(bot => {
      bot.isDead = false;
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

    this.idleTimer = 0;
    this.player.respawn(safeX, safeZ);
    this.cameraAutoScrollZ = (safeZ - 3.15) * CONFIG.GRID_SIZE;
    this.player.minAllowedZ = Math.floor(this.cameraAutoScrollZ / CONFIG.GRID_SIZE);
    this.isGameOver = false;
    this.isGameStarted = true;
    this.clock.start();
  }

  gameOver(reason, allowRespawn = true) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.uiManager.showGameOver(this.player.score, reason, allowRespawn);
  }

  // 觸發正版老鷹極速 0.4 秒俯衝抓走動畫
  triggerEagleAttack() {
    if (this.isEagleAttacking) return;
    this.isEagleAttacking = true;

    this.eagleMesh = createEagle();
    const startX = this.player.position.x;
    const startZ = this.player.position.z - 5.5 * CONFIG.GRID_SIZE;
    this.eagleMesh.position.set(startX, 8.0, startZ);
    this.scene.add(this.eagleMesh);

    let progress = 0;
    const playerTarget = this.player.position.clone();

    const animateEagle = () => {
      progress += 0.08;
      if (progress < 0.5) {
        const t = progress / 0.5;
        this.eagleMesh.position.x = THREE.MathUtils.lerp(startX, playerTarget.x, t);
        this.eagleMesh.position.z = THREE.MathUtils.lerp(startZ, playerTarget.z, t);
        this.eagleMesh.position.y = THREE.MathUtils.lerp(8.0, 0.4, t);
        requestAnimationFrame(animateEagle);
      } else if (progress < 1.0) {
        const t = (progress - 0.5) / 0.5;
        this.eagleMesh.position.x = THREE.MathUtils.lerp(playerTarget.x, playerTarget.x + 3, t);
        this.eagleMesh.position.z = THREE.MathUtils.lerp(playerTarget.z, playerTarget.z + 10, t);
        this.eagleMesh.position.y = THREE.MathUtils.lerp(0.4, 16.0, t);

        if (this.player.mesh) {
          this.player.mesh.position.copy(this.eagleMesh.position);
          this.player.mesh.position.y -= 0.5;
        }

        requestAnimationFrame(animateEagle);
      } else {
        if (this.player.mesh) this.player.mesh.visible = false;
        if (this.eagleMesh) this.scene.remove(this.eagleMesh);
        this.gameOver('停太久發呆，慘遭老鷹抓走了！', false);
      }
    };

    requestAnimationFrame(animateEagle);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const deltaTime = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();
    const activeRows = this.mapGenerator.getActiveRows();

    // 1. 更新主角狀態與跳躍
    this.player.update(deltaTime);

    // 2. 底邊界以 0.45 格/秒 穩定向前平滑推進
    if (this.isGameStarted && !this.isGameOver) {
      this.cameraAutoScrollZ += 0.45 * deltaTime * CONFIG.GRID_SIZE;
      this.player.minAllowedZ = Math.floor(this.cameraAutoScrollZ / CONFIG.GRID_SIZE);

      // 若發呆 7 秒不前進，底邊界追上小雞，立即召喚老鷹俯衝
      if (this.player.position.z <= this.cameraAutoScrollZ + 0.05 * CONFIG.GRID_SIZE && !this.player.isRespawning && !this.isEagleAttacking) {
        this.triggerEagleAttack();
      }
    }

    // 3. 更新 3 隻 AI 動物決策與跳躍
    if (this.isGameStarted && !this.isGameOver) {
      this.aiBots.forEach((bot) => {
        if (!bot.isDead && !bot.isRespawning) {
          bot.updateAI(deltaTime, activeRows, this.physics);
          bot.update(deltaTime);
        }
      });
    }

    // 4. 處理 4 人 1x1 網格 Bump 推擠碰撞
    this.physics.resolveGridBump(this.allRunners);

    // 5. 更新 3 大技能獨立 CD 與 UI
    this.itemSystem.update(deltaTime);
    this.uiManager.updateIndependentCooldowns(
      this.itemSystem.getCooldownRatios(),
      this.itemSystem.cooldowns
    );

    // 6. 實時刷新右上角 4 人競速排行榜
    const runnersData = [
      { name: '主角小雞', score: this.player.score, isPlayer: true, isDead: this.isGameOver },
      { name: this.aiBots[0].botName, score: this.aiBots[0].score, isPlayer: false, isDead: this.aiBots[0].isDead },
      { name: this.aiBots[1].botName, score: this.aiBots[1].score, isPlayer: false, isDead: this.aiBots[1].isDead },
      { name: this.aiBots[2].botName, score: this.aiBots[2].score, isPlayer: false, isDead: this.aiBots[2].isDead }
    ];
    this.uiManager.updateLeaderboard(runnersData);

    // 7. 超感時空減速倍率 (0.35x)
    const speedMultiplier = this.player.isReflexHyper ? 0.35 : 1.0;

    // 8. 更新馬路車輛 / 河流浮木 / 鐵路火車位置
    this.mapGenerator.animateObstacles(deltaTime, elapsedTime, speedMultiplier);

    // 9. 精準視口相機跟隨 (相機焦點前移 +1.6 格對齊圖 1 競品構圖，0 秒起同步 +4.75 即刻平滑推進)
    const targetCameraZ = Math.max(
      this.player.position.z + 1.6 * CONFIG.GRID_SIZE,
      this.cameraAutoScrollZ + 4.75 * CONFIG.GRID_SIZE
    );
    this.sceneSetup.updateCamera({ x: this.player.position.x, z: targetCameraZ });

    // 10. 主角碰撞與落水判定
    if (this.isGameStarted && !this.isGameOver && !this.player.isRespawning && !this.isEagleAttacking) {
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

    // 11. 更新 AI 對手的撞車、河流漂木隨波流動與落水淘汰判定
    if (this.isGameStarted && !this.isGameOver) {
      this.aiBots.forEach((bot) => {
        if (bot.isDead || bot.isRespawning) return;

        // AI 撞車/火車淘汰
        const botHit = this.physics.checkObstacleCollision(bot, activeRows);
        if (botHit && !bot.isShielded) {
          bot.triggerFlattenAnimation();
          bot.isDead = true;
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
              bot.isDead = true;
              setTimeout(() => { this.scene.remove(bot.mesh); }, 600);
            }
          } else {
            bot.triggerDrownAnimation();
            bot.isDead = true;
            setTimeout(() => { this.scene.remove(bot.mesh); }, 600);
          }
        }
      });
    }

    // 12. 渲染 Three.js 畫面
    this.sceneSetup.render();
  }
}

// 頁面載入後啟動遊戲
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
