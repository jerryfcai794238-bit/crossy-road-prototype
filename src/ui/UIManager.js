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

    this.highScore = parseInt(localStorage.getItem('crossy_road_high_score') || '0', 10);
    this.updateHighScoreDisplay();
  }

  init(onStart, onRestart) {
    this.btnStart.addEventListener('click', () => {
      this.hideStartScreen();
      onStart();
    });

    this.btnRestart.addEventListener('click', () => {
      this.hideGameOverScreen();
      onRestart();
    });
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
    // 強制重繪觸發動畫
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
