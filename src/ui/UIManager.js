export class UIManager {
  constructor() {
    this.currentScoreEl = document.getElementById('current-score');
    this.highScoreEl = document.getElementById('high-score');
    this.leaderboardListEl = document.getElementById('leaderboard-list');

    this.energyCountEl = document.getElementById('energy-count');
    this.energyTimerEl = document.getElementById('energy-timer');

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

  init(onStart, onRestart, onFastRespawn, onTriggerSkill, onReturnLobby) {
    this.btnStart.addEventListener('click', () => onStart(this.selectedMode));
    this.btnRestart.addEventListener('click', () => onRestart(this.selectedMode));
    this.btnFastRespawn.addEventListener('click', () => onFastRespawn());

    if (this.btnLobby) {
      this.btnLobby.addEventListener('click', () => {
        if (onReturnLobby) onReturnLobby();
        this.showLobby();
      });
    }

    // 綁定技能按鈕
    const skillBtns = document.querySelectorAll('.skill-btn');
    skillBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const skillType = btn.getAttribute('data-skill');
        if (onTriggerSkill) onTriggerSkill(skillType);
      });
    });
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

  updateIndependentCooldowns(cooldownRatios, cooldownTimes) {
    for (const [type, ratio] of Object.entries(cooldownRatios)) {
      const btn = document.getElementById(`btn-skill-${type}`);
      if (!btn) continue;

      const overlay = btn.querySelector('.skill-cd-overlay');
      const textEl = btn.querySelector('.skill-cd-text');

      if (overlay) {
        overlay.style.height = `${ratio * 100}%`;
      }

      if (textEl) {
        if (ratio > 0) {
          textEl.innerText = `${cooldownTimes[type].toFixed(1)}s`;
          textEl.style.color = '#a0aec0';
        } else {
          textEl.innerText = 'READY';
          textEl.style.color = '#38bdf8';
        }
      }
    }
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
