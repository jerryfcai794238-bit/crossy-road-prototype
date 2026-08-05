import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SceneSetup } from './graphics/SceneSetup.js';
import { createChicken, createDuck, createFrog, createShiba, createEagle, createCrown } from './graphics/VoxelModels.js';
import { Player } from './mechanics/Player.js';
import { AIBot } from './mechanics/AIBot.js';
import { MapGenerator } from './mechanics/MapGenerator.js';
import { Physics } from './mechanics/Physics.js';
import { GameModes, GAME_MODES } from './mechanics/GameModes.js';
import { UIManager } from './ui/UIManager.js';

class Game {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.uiManager = new UIManager();

    // 遊戲模式與能量系統 (30 秒恢復 1 點)
    this.gameModes = new GameModes();

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

    // 👑 體素金黃皇冠 3D 模型
    this.crownMesh = createCrown();
    this.scene.add(this.crownMesh);

    // 1. 建立主角小雞 (Chicken)
    this.chickenMesh = createChicken();
    this.scene.add(this.chickenMesh);
    this.player = new Player(this.chickenMesh);

    // 綁定觸地 0ms 佇列連跳處理
    this.player.onBufferedMoveRequested = (direction, distance) => {
      this.handlePlayerMove(direction, distance);
    };

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

    this.clock = new THREE.Clock();

    // 休閒模式專屬：上一個安全草地 Z 座標
    this.lastSafeGrassZ = 0;

    // 綁定 UI 大廳與雙模式選擇
    this.uiManager.init(
      (mode) => this.startGame(mode),
      (mode) => this.restartGame(mode),
      () => this.fastRespawn(),
      () => this.returnToLobby(),
      () => this.triggerCasualSlowdown()
    );

    this.setupInputListeners();
    
    // 首頁產生初始地圖
    this.mapGenerator.initMap();

    // 啟動主渲染迴圈
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupInputListeners() {
    // 鍵盤控制：W/A/D/S 移動
    window.addEventListener('keydown', (e) => {
      if (!this.isGameStarted || this.isGameOver) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.handlePlayerInput('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.handlePlayerInput('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.handlePlayerInput('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.handlePlayerInput('RIGHT');
          break;
      }
    });

    // 虛擬 D-Pad
    document.getElementById('btn-up')?.addEventListener('click', () => this.handlePlayerInput('UP'));
    document.getElementById('btn-down')?.addEventListener('click', () => this.handlePlayerInput('DOWN'));
    document.getElementById('btn-left')?.addEventListener('click', () => this.handlePlayerInput('LEFT'));
    document.getElementById('btn-right')?.addEventListener('click', () => this.handlePlayerInput('RIGHT'));

    // 螢幕 Touch / Click 往前跳
    this.container.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#hud') || e.target.closest('#health-bar-container') || e.target.closest('#leaderboard') || e.target.closest('#mobile-controls') || e.target.closest('.overlay') || e.target.closest('#energy-bar') || e.target.closest('.casual-slowdown-btn')) return;
      if (!this.isGameStarted || this.isGameOver) return;
      this.handlePlayerInput('UP');
    });
  }

  handlePlayerInput(direction, distance = 1) {
    if (!this.isGameStarted || this.isGameOver) return;

    if (this.player.isJumping) {
      // 空中連點：放入佇列緩衝
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
      this.player.inputBuffer = []; // 撞樹清空佇列
      return;
    }

    const moved = this.player.move(direction, distance);
    if (moved) {
      // 玩家向前跳躍時，底邊界自動同步向前補進對齊 (-3.15格)
      const catchupZ = (this.player.maxReachedZ - 3.15) * CONFIG.GRID_SIZE;
      this.cameraAutoScrollZ = Math.max(this.cameraAutoScrollZ, catchupZ);
      this.player.minAllowedZ = Math.floor(this.cameraAutoScrollZ / CONFIG.GRID_SIZE);

      // 音速 4 級判定與 Combo 計數 (PERFECT >1.2格 / GREAT / GOOD <=0.45格)
      const activeRows = this.mapGenerator.getActiveRows();
      const rating = this.physics.evaluateHopRating(this.player, activeRows);
      this.player.addCombo();
      this.uiManager.showRating(rating, this.player.combo);

      // 休閒模式：若腳步踩到下一個安全草地，重置減速次數！
      const currentRow = activeRows.get(this.player.gridZ);
      if (currentRow && currentRow.type === CONFIG.ROW_TYPES.GRASS && this.player.gridZ > this.lastSafeGrassZ) {
        this.lastSafeGrassZ = this.player.gridZ;
        this.player.slowdownStack = 0; // 重置減速次數
      }

      this.mapGenerator.update(this.player.gridZ);

      // FEVER 狂熱狀態 3x 得分加成
      const multiplier = this.player.isFever ? 3 : 1;
      this.uiManager.updateScore(this.player.score * multiplier);
    }
  }

  // 🐌 休閒模式專屬：觸發金幣減速輔助 (最多 3 次，每次-15%)
  triggerCasualSlowdown() {
    if (this.gameModes.currentMode !== GAME_MODES.CASUAL || !this.isGameStarted || this.isGameOver) return;

    const activeRows = this.mapGenerator.getActiveRows();
    const currentRow = activeRows.get(this.player.gridZ);
    const isGrass = currentRow && currentRow.type === CONFIG.ROW_TYPES.GRASS;

    if (!isGrass || this.player.slowdownStack >= 3) return;

    this.player.slowdownStack++;
  }

  startGame(mode = GAME_MODES.CHALLENGE) {
    // 檢查並消耗能量
    if (!this.gameModes.useEnergy()) {
      alert(`能量不足！目前能量：${this.gameModes.energy}/5，請等待 30 秒恢復倒數！`);
      return;
    }

    this.gameModes.setMode(mode);
    this.uiManager.hideOverlays();

    this.isGameStarted = true;
    this.isGameOver = false;
    this.maxCameraZ = 0;
    this.idleTimer = 0;
    this.lastPlayerZ = 0;
    this.lastSafeGrassZ = 0;
    this.isEagleAttacking = false;

    if (this.eagleMesh) {
      this.scene.remove(this.eagleMesh);
      this.eagleMesh = null;
    }

    // 重置選手與地圖
    this.resetAllRunners();

    this.cameraAutoScrollZ = -3.15 * CONFIG.GRID_SIZE;
    this.player.minAllowedZ = Math.floor(this.cameraAutoScrollZ / CONFIG.GRID_SIZE);

    this.sceneSetup.resetCamera();
    this.clock.start();
  }

  restartGame(mode = GAME_MODES.CHALLENGE) {
    if (!this.gameModes.useEnergy()) {
      alert(`能量不足！目前能量：${this.gameModes.energy}/5，請等待 30 秒恢復倒數！`);
      this.returnToLobby();
      return;
    }

    this.gameModes.setMode(mode);
    this.uiManager.hideOverlays();

    this.mapGenerator.initMap();
    this.uiManager.updateScore(0);
    this.isGameOver = false;
    this.isGameStarted = true;
    this.maxCameraZ = 0;
    this.idleTimer = 0;
    this.lastPlayerZ = 0;
    this.lastSafeGrassZ = 0;
    this.isEagleAttacking = false;

    if (this.eagleMesh) {
      this.scene.remove(this.eagleMesh);
      this.eagleMesh = null;
    }

    this.resetAllRunners();

    this.cameraAutoScrollZ = -3.15 * CONFIG.GRID_SIZE;
    this.player.minAllowedZ = Math.floor(this.cameraAutoScrollZ / CONFIG.GRID_SIZE);

    this.sceneSetup.resetCamera();
    this.clock.start();
  }

  returnToLobby() {
    this.isGameStarted = false;
    this.isGameOver = false;
    this.uiManager.showLobby();
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
    this.uiManager.hideOverlays();

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

    // 清理周圍樹木，確保著陸點安全
    this.physics.destroyTreesInArea({ x: safeX, z: safeZ }, 1, activeRows);

    this.idleTimer = 0;
    this.player.respawn(safeX, safeZ);
    this.player.maxReachedZ = safeZ;

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

  // 觸發老鷹 0.75 秒飛行俯衝抓走動畫
  triggerEagleAttack() {
    if (this.isEagleAttacking) return;

    // 休閒模式完全停用老鷹發呆淘汰死
    if (this.gameModes.currentMode === GAME_MODES.CASUAL) {
      return;
    }

    this.isEagleAttacking = true;

    this.eagleMesh = createEagle();
    const startX = this.player.position.x;
    const startZ = this.player.position.z - 5.5 * CONFIG.GRID_SIZE;
    this.eagleMesh.position.set(startX, 8.0, startZ);
    this.scene.add(this.eagleMesh);

    let progress = 0;
    const playerTarget = this.player.position.clone();

    const animateEagle = () => {
      progress += 0.045; // ~0.75 秒俯衝，具備滿滿威壓感
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

    // 0. 更新 30 秒能量與 100 HP 紅色長血條 UI
    this.gameModes.update(deltaTime);
    const energyStatus = {
      energy: this.gameModes.energy,
      maxEnergy: this.gameModes.maxEnergy,
      timeToNext: this.gameModes.getTimeToNextEnergy()
    };
    this.uiManager.updateEnergyUI(energyStatus.energy, energyStatus.maxEnergy, energyStatus.timeToNext);

    if (this.isGameStarted) {
      this.uiManager.updateHealthUI(this.player.hp, this.player.maxHp);

      const currentRow = activeRows.get(this.player.gridZ);
      const isGrass = currentRow && currentRow.type === CONFIG.ROW_TYPES.GRASS;
      this.uiManager.updateCasualSlowdownUI(
        this.gameModes.currentMode === GAME_MODES.CASUAL,
        this.player.slowdownStack,
        isGrass
      );
    }

    // 1. 更新主角狀態與跳躍 (觸地自動觸發緩衝佇列連跳)
    this.player.update(deltaTime);

    // 2. 挑戰模式下：底邊界以 0.45 格/秒 穩定向前平滑推進
    if (this.isGameStarted && !this.isGameOver) {
      if (this.gameModes.currentMode === GAME_MODES.CHALLENGE) {
        this.cameraAutoScrollZ += 0.45 * deltaTime * CONFIG.GRID_SIZE;
        this.player.minAllowedZ = Math.floor(this.cameraAutoScrollZ / CONFIG.GRID_SIZE);

        // 若發呆 7 秒不前進，底邊界追上小雞，拋出老鷹俯衝
        if (this.player.position.z <= this.cameraAutoScrollZ + 0.05 * CONFIG.GRID_SIZE && !this.player.isRespawning && !this.isEagleAttacking) {
          this.triggerEagleAttack();
        }
      }
    }

    // 3. 更新 3 隻高智商高競爭性 AI 動物決策與跳躍 (0.22s 決策)
    if (this.isGameStarted && !this.isGameOver) {
      this.aiBots.forEach((bot) => {
        if (!bot.isDead && !bot.isRespawning) {
          bot.updateAI(deltaTime, activeRows, this.physics);
          bot.update(deltaTime);
        }
      });
    }

    // 4. 👑 計算 4 人 Z 軸得分，即時將 3D 體素皇冠飛至第 1 名頭頂
    const allLivingRunners = [this.player, ...this.aiBots].filter(r => !r.isDead && !r.isRespawning);
    if (allLivingRunners.length > 0 && this.crownMesh) {
      const topLeader = allLivingRunners.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));
      if (topLeader && topLeader.mesh) {
        this.crownMesh.position.copy(topLeader.mesh.position);
        this.crownMesh.position.y += 0.85;
        this.crownMesh.rotation.y += deltaTime * 2.0; // 皇冠金色旋轉
      }
    }

    // 5. 處理 4 人 1x1 網格 Bump 推擠碰撞
    this.physics.resolveGridBump(this.allRunners);

    // 6. 實時刷新右上角 4 人競速排行榜
    const runnersData = [
      { name: '主角小雞', score: this.player.score, isPlayer: true, isDead: this.isGameOver },
      { name: this.aiBots[0].botName, score: this.aiBots[0].score, isPlayer: false, isDead: this.aiBots[0].isDead },
      { name: this.aiBots[1].botName, score: this.aiBots[1].score, isPlayer: false, isDead: this.aiBots[1].isDead },
      { name: this.aiBots[2].botName, score: this.aiBots[2].score, isPlayer: false, isDead: this.aiBots[2].isDead }
    ];
    this.uiManager.updateLeaderboard(runnersData);

    // 7. 休閒模式金幣減速倍率 (10/20/40金幣減速：-15%, -30%, -45%)
    const slowdownMultiplier = 1.0 - (this.player.slowdownStack * 0.15);

    // 8. 更新馬路車輛 / 河流浮木 / 鐵路火車位置
    this.mapGenerator.animateObstacles(deltaTime, elapsedTime, slowdownMultiplier);

    // 9. 精準視口相機跟隨
    const targetCameraZ = Math.max(
      this.player.position.z + 1.6 * CONFIG.GRID_SIZE,
      this.cameraAutoScrollZ + 4.75 * CONFIG.GRID_SIZE
    );
    this.sceneSetup.updateCamera({ x: this.player.position.x, z: targetCameraZ });

    // 10. 主角碰撞與 100 HP 扣血判定
    if (this.isGameStarted && !this.isGameOver && !this.player.isRespawning && !this.isEagleAttacking) {
      // 車輛 / 火車撞擊判定
      const hitObstacle = this.physics.checkObstacleCollision(this.player, activeRows);
      if (hitObstacle) {
        const safeZ = this.physics.findNearestSafeZ(this.player, activeRows);
        const isDead = this.player.takeDamage(hitObstacle.damage, safeZ);

        if (isDead) {
          this.player.triggerFlattenAnimation();
          this.gameOver(hitObstacle.type === 'train' ? '慘遭高速火車輾過，HP 歸零！' : '被車輛撞擊，HP 歸零！');
        }
      }

      // 河流與木塊落水判定
      const riverStatus = this.physics.checkRiverStatus(this.player, activeRows);
      if (riverStatus.inRiver) {
        if (riverStatus.onLog) {
          this.player.position.x += riverStatus.logSpeed * slowdownMultiplier * deltaTime;
          this.player.gridX = Math.round(this.player.position.x / CONFIG.GRID_SIZE);
          
          const drownBoundaryX = (CONFIG.MAP_BOUNDS_X + 3.8) * CONFIG.GRID_SIZE;
          if (Math.abs(this.player.position.x) > drownBoundaryX) {
            const safeZ = this.physics.findNearestSafeZ(this.player, activeRows);
            const isDead = this.player.takeDamage(20, safeZ);
            if (isDead) {
              this.player.triggerDrownAnimation();
              this.gameOver('漂流過遠，掉出邊界外，HP 歸零！');
            }
          }
        } else {
          // 落水扣 20 HP 並彈回身後安全草地
          const safeZ = this.physics.findNearestSafeZ(this.player, activeRows);
          const isDead = this.player.takeDamage(20, safeZ);
          if (isDead) {
            this.player.triggerDrownAnimation();
            this.gameOver('噗通！落水淹死，HP 歸零！');
          }
        }
      }
    }

    // 11. 更新 AI 對手的撞車與淘汰判定
    if (this.isGameStarted && !this.isGameOver) {
      this.aiBots.forEach((bot) => {
        if (bot.isDead || bot.isRespawning) return;

        const botHit = this.physics.checkObstacleCollision(bot, activeRows);
        if (botHit) {
          bot.triggerFlattenAnimation();
          bot.isDead = true;
          setTimeout(() => { this.scene.remove(bot.mesh); }, 600);
        }

        const botRiver = this.physics.checkRiverStatus(bot, activeRows);
        if (botRiver.inRiver) {
          if (botRiver.onLog) {
            bot.position.x += botRiver.logSpeed * slowdownMultiplier * deltaTime;
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
