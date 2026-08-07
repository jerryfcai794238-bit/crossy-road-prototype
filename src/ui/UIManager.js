export class UIManager {
  constructor() {
    this.currentScoreEl = document.getElementById('current-score');
    this.highScoreEl = document.getElementById('high-score');
    this.startOverlay = document.getElementById('start-overlay');
    this.gameoverOverlay = document.getElementById('gameover-overlay');

    this.btnStart = document.getElementById('btn-start');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnLobby = document.getElementById('btn-lobby');

    this.finalScoreEl = document.getElementById('final-score');
    this.finalBestEl = document.getElementById('final-best');
    this.deathReasonEl = document.getElementById('death-reason');

    this.healthBarFill = document.getElementById('health-bar-fill');
    this.healthBarText = document.getElementById('health-bar-text');

    let savedHighScore = 0;
    try {
      savedHighScore = parseInt(localStorage.getItem('crossy_highscore') || '0', 10);
    } catch (e) {
      // file:/// 安全處理
    }
    this.highScore = isNaN(savedHighScore) ? 0 : savedHighScore;
    if (this.highScoreEl) this.highScoreEl.innerText = this.highScore;

    this.selectedMode = 'casual'; // 預設第一順位：休閒模式
    this.setupModeSelection();
  }

  setupModeSelection() {
    const modeCards = document.querySelectorAll('.mode-card');
    const initialSelectedCard = document.querySelector('.mode-card.selected');
    if (initialSelectedCard) {
      this.selectedMode = initialSelectedCard.getAttribute('data-mode') || 'casual';
    }

    modeCards.forEach((card) => {
      card.addEventListener('click', () => {
        modeCards.forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedMode = card.getAttribute('data-mode') || 'casual';
      });
    });
  }

  init(onStart, onRestart, onReturnLobby) {
    if (this.btnStart) this.btnStart.addEventListener('click', () => onStart(this.selectedMode));
    if (this.btnRestart) this.btnRestart.addEventListener('click', () => onRestart(this.selectedMode));
    if (this.btnLobby) this.btnLobby.addEventListener('click', () => onReturnLobby());
  }

  showLobby() {
    if (this.startOverlay) {
      this.startOverlay.classList.remove('hidden');
      this.startOverlay.classList.add('active');
      this.startOverlay.style.display = 'flex';
    }
    if (this.gameoverOverlay) {
      this.gameoverOverlay.classList.add('hidden');
      this.gameoverOverlay.style.display = 'none';
    }
  }

  hideOverlays() {
    if (this.startOverlay) {
      this.startOverlay.classList.add('hidden');
      this.startOverlay.classList.remove('active');
      this.startOverlay.style.display = 'none';
    }
    if (this.gameoverOverlay) {
      this.gameoverOverlay.classList.add('hidden');
      this.gameoverOverlay.style.display = 'none';
    }
  }

  updateScore(score) {
    if (this.currentScoreEl) this.currentScoreEl.innerText = score;
    if (score > this.highScore) {
      this.highScore = score;
      try {
        localStorage.setItem('crossy_highscore', this.highScore.toString());
      } catch (e) {
        // file:/// 安全處理
      }
    }
    if (this.highScoreEl) this.highScoreEl.innerText = this.highScore;
  }

  updateHealth(hp, maxHp = 100) {
    const currentHp = Math.max(0, Math.min(maxHp, hp));
    const percentage = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
    if (this.healthBarFill) {
      this.healthBarFill.style.width = `${percentage}%`;
    }
    if (this.healthBarText) {
      this.healthBarText.innerText = `${Math.round(currentHp)}/${maxHp}`;
    }
  }

  showGameOver(score, reason = '被車撞飛了！') {
    if (this.finalScoreEl) this.finalScoreEl.innerText = score;
    if (this.finalBestEl) this.finalBestEl.innerText = this.highScore;
    if (this.deathReasonEl) this.deathReasonEl.innerText = reason;

    if (this.gameoverOverlay) {
      this.gameoverOverlay.classList.remove('hidden');
      this.gameoverOverlay.style.display = 'flex';
    }
  }
}
