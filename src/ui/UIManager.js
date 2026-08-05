export class UIManager {
  constructor() {
    this.currentScoreElement = document.getElementById('current-score');
    this.highScoreElement = document.getElementById('high-score');
    this.startOverlay = document.getElementById('start-overlay');
    this.gameoverOverlay = document.getElementById('gameover-overlay');
    this.finalScoreElement = document.getElementById('final-score');
    this.modalHighScoreElement = document.getElementById('modal-high-score');
    this.deathReasonElement = document.getElementById('death-reason');
    this.btnStart = document.getElementById('btn-start');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnRespawn = document.getElementById('btn-respawn');

    // 3 大獨立技能按鈕 UI
    this.skillBtns = {
      shield: document.getElementById('btn-skill-shield'),
      rocket: document.getElementById('btn-skill-rocket'),
      time_slow: document.getElementById('btn-skill-time_slow')
    };

    this.highScore = parseInt(localStorage.getItem('crossy_road_high_score') || '0', 10);
    this.updateHighScoreDisplay();
  }

  init(onStart, onRestart, onRespawn, onTriggerSkill) {
    this.btnStart.addEventListener('click', () => {
      this.hideStartScreen();
      onStart();
    });

    this.btnRestart.addEventListener('click', () => {
      this.hideGameOverScreen();
      onRestart();
    });

    this.btnRespawn?.addEventListener('click', () => {
      this.hideGameOverScreen();
      onRespawn();
    });

    // 各技能按鈕獨立點擊事件
    for (const key in this.skillBtns) {
      const btn = this.skillBtns[key];
      btn?.addEventListener('click', () => {
        onTriggerSkill(key);
      });
    }
  }

  updateIndependentCooldowns(cooldownRatios, cooldowns) {
    for (const key in this.skillBtns) {
      const btn = this.skillBtns[key];
      if (!btn) continue;

      const overlay = btn.querySelector('.skill-cd-overlay');
      const cdText = btn.querySelector('.skill-cd-text');
      const ratio = cooldownRatios[key] || 0;
      const remainingSec = cooldowns[key] || 0;

      if (ratio > 0) {
        btn.classList.add('on-cd');
        if (overlay) overlay.style.height = `${ratio * 100}%`;
        if (cdText) cdText.textContent = `${remainingSec.toFixed(1)}s`;
      } else {
        btn.classList.remove('on-cd');
        if (overlay) overlay.style.height = '0%';
        if (cdText) cdText.textContent = 'READY';
      }
    }
  }

  updateScore(score) {
    this.currentScoreElement.textContent = score;
    if (score > this.highScore) {
      this.highScore = score;
      localStorage.setItem('crossy_road_high_score', this.highScore.toString());
      this.updateHighScoreDisplay();
    }
  }

  updateHighScoreDisplay() {
    this.highScoreElement.textContent = this.highScore;
  }

  showStartScreen() {
    this.startOverlay.classList.remove('hidden');
    this.startOverlay.classList.add('active');
  }

  hideStartScreen() {
    this.startOverlay.classList.remove('active');
    setTimeout(() => {
      this.startOverlay.classList.add('hidden');
    }, 300);
  }

  showGameOver(finalScore, reason = '撞車了！', allowRespawn = true) {
    this.finalScoreElement.textContent = finalScore;
    this.modalHighScoreElement.textContent = this.highScore;
    this.deathReasonElement.textContent = reason;

    // 控制是否提供 3 秒原地復活 (若被推離視角外/沒路了，隱藏復活鈕)
    if (this.btnRespawn) {
      this.btnRespawn.style.display = allowRespawn ? 'block' : 'none';
    }

    this.gameoverOverlay.classList.remove('hidden');
    void this.gameoverOverlay.offsetWidth;
    this.gameoverOverlay.classList.add('active');
  }

  hideGameOverScreen() {
    this.gameoverOverlay.classList.remove('active');
    setTimeout(() => {
      this.gameoverOverlay.classList.add('hidden');
    }, 300);
  }
}
