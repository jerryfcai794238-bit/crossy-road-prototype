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

    let savedHighScore = 0;
    try {
      savedHighScore = parseInt(localStorage.getItem('crossy_highscore') || '0', 10);
    } catch (e) {
      // file:/// 安全處理
    }
    this.selectedMode = 'casual'; // 預設第一順位：休閒模式
    this.setupModeSelection();
  }

  setupModeSelection() {
    const modeCards = document.querySelectorAll('.mode-card');
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
    }
    if (this.gameoverOverlay) {
      this.gameoverOverlay.classList.add('hidden');
    }
  }

  hideOverlays() {
    if (this.startOverlay) {
      this.startOverlay.classList.add('hidden');
      this.startOverlay.classList.remove('active');
    }
    if (this.gameoverOverlay) {
      this.gameoverOverlay.classList.add('hidden');
    }
  }

  updateScore(score) {
    if (this.currentScoreEl) this.currentScoreEl.innerText = score;
    if (score > this.highScore) {
      this.highScore = score;
      if (this.highScoreEl) this.highScoreEl.innerText = this.highScore;
      try {
        localStorage.setItem('crossy_highscore', this.highScore.toString());
      } catch (e) {
        // file:/// 安全處理
      }
    }
  }

  showGameOver(score, reason = '被車撞飛了！') {
    if (this.finalScoreEl) this.finalScoreEl.innerText = score;
    if (this.finalBestEl) this.finalBestEl.innerText = this.highScore;
    if (this.deathReasonEl) this.deathReasonEl.innerText = reason;

    if (this.gameoverOverlay) {
      this.gameoverOverlay.classList.remove('hidden');
    }
  }
}
