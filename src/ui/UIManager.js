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

    // 道具 HUD 元件
    this.btnUseItem = document.getElementById('btn-use-item');
    this.itemIcon = document.getElementById('item-icon');
    this.itemCooldownText = document.getElementById('item-cooldown-text');
    this.cooldownOverlay = document.getElementById('cooldown-overlay');
    this.itemSelectBtns = document.querySelectorAll('.item-select-btn');

    this.highScore = parseInt(localStorage.getItem('crossy_road_high_score') || '0', 10);
    this.updateHighScoreDisplay();
  }

  init(onStart, onRestart, onRespawn, onUseItem, onSelectItem) {
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

    this.btnUseItem?.addEventListener('click', () => {
      onUseItem();
    });

    this.itemSelectBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const itemType = e.target.getAttribute('data-item');
        this.setActiveItemUI(itemType);
        onSelectItem(itemType);
      });
    });
  }

  setActiveItemUI(itemType) {
    this.itemSelectBtns.forEach((b) => {
      if (b.getAttribute('data-item') === itemType) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    if (itemType === 'shield') this.itemIcon.textContent = '🛡️';
    else if (itemType === 'rocket') this.itemIcon.textContent = '🚀';
    else if (itemType === 'time_slow') this.itemIcon.textContent = '⏳';
  }

  updateItemCooldown(ratio, remainingSeconds) {
    if (!this.cooldownOverlay || !this.itemCooldownText) return;

    if (ratio > 0) {
      this.cooldownOverlay.style.height = `${ratio * 100}%`;
      this.itemCooldownText.textContent = `${remainingSeconds.toFixed(1)}s`;
    } else {
      this.cooldownOverlay.style.height = '0%';
      this.itemCooldownText.textContent = 'READY';
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

  showGameOver(finalScore, reason = '撞車了！') {
    this.finalScoreElement.textContent = finalScore;
    this.modalHighScoreElement.textContent = this.highScore;
    this.deathReasonElement.textContent = reason;

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
