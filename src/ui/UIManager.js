export class UIManager {
  constructor() {
    this.currentScoreEl = document.getElementById('current-score');
    this.highScoreEl = document.getElementById('high-score');
    this.leaderboardListEl = document.getElementById('leaderboard-list');

    this.energyCountEl = document.getElementById('energy-count');
    this.energyTimerEl = document.getElementById('energy-timer');

    // 🟥 紅色長血條 DOM
    this.healthBarFillEl = document.getElementById('health-bar-fill');
    this.healthBarTextEl = document.getElementById('health-bar-text');

    // 🔥 Combo 與 Rating 特效 DOM
    this.comboContainerEl = document.getElementById('combo-container');
    this.ratingTextEl = document.getElementById('rating-text');
    this.comboCountEl = document.getElementById('combo-count');

    // 🐌 休閒模式金幣減速按鈕
    this.btnCasualSlowdown = document.getElementById('btn-casual-slowdown');
    this.slowdownTextEl = document.getElementById('slowdown-text');

    this.startOverlay = document.getElementById('start-overlay');
    this.gameoverOverlay = document.getElementById('gameover-overlay');

    this.btnStart = document.getElementById('btn-start');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnFastRespawn = document.getElementById('btn-fast-respawn');
    this.btnLobby = document.getElementById('btn-lobby');

    this.finalScoreEl = document.getElementById('final-score');
    this.finalBestEl = document.getElementById('final-best');
    this.deathReasonEl = document.getElementById('death-reason');

    this.highScore = parseInt(localStorage.getItem('crossy_highscore') || '0', 10);
    this.highScoreEl.innerText = this.highScore;

    this.selectedMode = 'challenge'; // 預設選擇挑戰模式
    this.setupModeSelection();
  }

  setupModeSelection() {
    const modeCards = document.querySelectorAll('.mode-card');
    modeCards.forEach((card) => {
      card.addEventListener('click', () => {
        modeCards.forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedMode = card.getAttribute('data-mode');
      });
    });
  }

  init(onStart, onRestart, onFastRespawn, onReturnLobby, onCasualSlowdown) {
    this.btnStart.addEventListener('click', () => onStart(this.selectedMode));
    this.btnRestart.addEventListener('click', () => onRestart(this.selectedMode));
    
    // 點擊空投復活：自動隱藏 Game Over 彈窗 Popup 並呼叫復活
    this.btnFastRespawn.addEventListener('click', () => {
      this.hideOverlays();
      if (onFastRespawn) onFastRespawn();
    });

    if (this.btnLobby) {
      this.btnLobby.addEventListener('click', () => {
        if (onReturnLobby) onReturnLobby();
        this.showLobby();
      });
    }

    if (this.btnCasualSlowdown) {
      this.btnCasualSlowdown.addEventListener('click', () => {
        if (onCasualSlowdown) onCasualSlowdown();
      });
    }
  }

  updateEnergyUI(energy, maxEnergy, timeToNext) {
    if (this.energyCountEl) {
      this.energyCountEl.innerText = `${energy}/${maxEnergy}`;
    }
    if (this.energyTimerEl) {
      if (energy >= maxEnergy) {
        this.energyTimerEl.innerText = '已滿';
        this.energyTimerEl.style.color = '#2ed573';
      } else {
        this.energyTimerEl.innerText = `恢復倒數: ${timeToNext}s`;
        this.energyTimerEl.style.color = '#ffcc00';
      }
    }
  }

  // 🟥 更新 100 HP 紅色長血條
  updateHealthUI(hp, maxHp = 100) {
    if (this.healthBarFillEl) {
      const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
      this.healthBarFillEl.style.width = `${pct}%`;
    }
    if (this.healthBarTextEl) {
      this.healthBarTextEl.innerText = `${Math.max(0, Math.ceil(hp))}/${maxHp}`;
    }
  }

  // 🔥 彈出 PERFECT!! / GREAT! / GOOD 評分與 Combo
  showRating(rating, combo) {
    if (!this.comboContainerEl || !this.ratingTextEl || !this.comboCountEl) return;

    this.ratingTextEl.className = '';
    if (rating === 'PERFECT') {
      this.ratingTextEl.innerText = 'PERFECT!!';
      this.ratingTextEl.classList.add('rating-perfect');
    } else if (rating === 'GREAT') {
      this.ratingTextEl.innerText = 'GREAT!';
      this.ratingTextEl.classList.add('rating-great');
    } else {
      this.ratingTextEl.innerText = 'GOOD';
      this.ratingTextEl.classList.add('rating-good');
    }

    this.comboCountEl.innerText = `🔥 ${combo} COMBO`;
    this.comboContainerEl.classList.remove('combo-hidden');

    clearTimeout(this.ratingTimer);
    this.ratingTimer = setTimeout(() => {
      this.comboContainerEl.classList.add('combo-hidden');
    }, 1200);
  }

  // 🐌 休閒模式專屬減速按鈕 UI 更新
  updateCasualSlowdownUI(isCasual, stack, isGrass) {
    if (!this.btnCasualSlowdown) return;

    if (!isCasual) {
      this.btnCasualSlowdown.classList.add('hidden');
      return;
    }

    this.btnCasualSlowdown.classList.remove('hidden');

    if (stack >= 3 || !isGrass) {
      this.btnCasualSlowdown.classList.add('disabled');
      this.slowdownTextEl.innerText = stack >= 3 ? '減速已達上限 (-45%)' : '請在安全草地使用減速';
    } else {
      this.btnCasualSlowdown.classList.remove('disabled');
      const currentPct = (stack + 1) * 15;
      this.slowdownTextEl.innerText = `🐌 減速輔助 (-${currentPct}%, 剩 ${3 - stack} 次)`;
    }
  }

  showLobby() {
    this.startOverlay.classList.remove('hidden');
    this.startOverlay.classList.add('active');
    this.gameoverOverlay.classList.add('hidden');
  }

  hideOverlays() {
    this.startOverlay.classList.add('hidden');
    this.startOverlay.classList.remove('active');
    this.gameoverOverlay.classList.add('hidden');
  }

  updateScore(score) {
    this.currentScoreEl.innerText = score;
    if (score > this.highScore) {
      this.highScore = score;
      this.highScoreEl.innerText = this.highScore;
      localStorage.setItem('crossy_highscore', this.highScore.toString());
    }
  }

  updateLeaderboard(runnersData) {
    if (!this.leaderboardListEl) return;

    // 按得分由高到低排序
    const sorted = [...runnersData].sort((a, b) => b.score - a.score);

    this.leaderboardListEl.innerHTML = '';
    sorted.forEach((runner, index) => {
      const row = document.createElement('div');
      row.className = `lb-row ${runner.isPlayer ? 'player-row' : ''} ${runner.isDead ? 'dead-row' : ''}`;

      const rankBadge = index === 0 ? '👑' : `${index + 1}.`;
      row.innerHTML = `
        <span class="lb-rank">${rankBadge}</span>
        <span class="lb-name">${runner.name}</span>
        <span class="lb-score">${runner.score}分</span>
      `;
      this.leaderboardListEl.appendChild(row);
    });
  }

  showGameOver(score, reason = '被車撞飛了！', allowRespawn = true) {
    this.finalScoreEl.innerText = score;
    this.finalBestEl.innerText = this.highScore;
    this.deathReasonEl.innerText = reason;

    if (this.btnFastRespawn) {
      this.btnFastRespawn.style.display = allowRespawn ? 'block' : 'none';
    }

    this.gameoverOverlay.classList.remove('hidden');
  }
}
