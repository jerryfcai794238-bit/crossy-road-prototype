import { TutorialSceneRenderer } from './TutorialSceneRenderer.js';

export class UIManager {
  constructor() {
    this.currentScoreEl = document.getElementById('current-score');
    this.highScoreEl = document.getElementById('high-score');
    this.startOverlay = document.getElementById('start-overlay');
    this.gameoverOverlay = document.getElementById('gameover-overlay');

    this.btnStart = document.getElementById('btn-start');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnLobby = document.getElementById('btn-lobby');
    this.btnCasualGuide = document.getElementById('btn-casual-guide');
    this.casualGuideOverlay = document.getElementById('casual-guide-overlay');
    this.guideActions = document.querySelector('[data-guide-actions]');
    this.btnGuideBack = document.getElementById('btn-guide-back');
    this.btnGuideNext = document.getElementById('btn-guide-next');
    this.guideSlides = Array.from(document.querySelectorAll('[data-guide-card]'));
    this.guideDots = Array.from(document.querySelectorAll('[data-guide-progress]'));

    this.finalScoreEl = document.getElementById('final-score');
    this.finalBestEl = document.getElementById('final-best');
    this.deathReasonEl = document.getElementById('death-reason');

    this.healthBarFill = document.getElementById('health-bar-fill');
    this.healthBarText = document.getElementById('health-bar-text');
    this.healthBarContainer = document.getElementById('health-bar-container');
    this.timerCard = document.getElementById('timer-card');
    this.timeRemainingEl = document.getElementById('time-remaining');
    this.leaderboard = document.getElementById('leaderboard');
    this.leaderboardList = document.getElementById('leaderboard-list');

    let savedHighScore = 0;
    try {
      savedHighScore = parseInt(localStorage.getItem('crossy_highscore') || '0', 10);
    } catch (e) {
      // file:/// 安全處理
    }
    this.highScore = isNaN(savedHighScore) ? 0 : savedHighScore;
    if (this.highScoreEl) this.highScoreEl.innerText = this.highScore;

    this.selectedMode = 'casual'; // 預設第一順位：休閒模式
    this.casualGuideSeen = this.readCasualGuideSeen();
    this.activeGuideCard = 0;
    this.tutorialSceneRenderer = new TutorialSceneRenderer();
    this.setupModeSelection();
  }

  readCasualGuideSeen() {
    try {
      return localStorage.getItem('crossy_casual_guide_seen_v1') === '1';
    } catch (e) {
      return false;
    }
  }

  markCasualGuideSeen() {
    this.casualGuideSeen = true;
    try {
      localStorage.setItem('crossy_casual_guide_seen_v1', '1');
    } catch (e) {
      // file:/// 或隱私模式下，保留本次 session 的已讀狀態。
    }
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
        this.updateCasualGuideAvailability(true);
      });
    });
  }

  init(onStart, onRestart, onReturnLobby) {
    if (this.btnStart) {
      this.btnStart.addEventListener('click', () => {
        if (this.isCasualGuideOpen()) return;
        if (this.selectedMode === 'casual' && !this.casualGuideSeen) {
          this.openCasualGuide();
          return;
        }
        onStart(this.selectedMode);
      });
    }
    if (this.btnRestart) this.btnRestart.addEventListener('click', () => onRestart(this.selectedMode));
    if (this.btnLobby) this.btnLobby.addEventListener('click', () => onReturnLobby());
    this.setupCasualGuide(onStart);
    this.updateCasualGuideAvailability(true);
  }

  setupCasualGuide(onStart) {
    if (this.btnCasualGuide) {
      this.btnCasualGuide.addEventListener('click', () => this.openCasualGuide());
    }
    if (this.btnGuideNext) {
      this.btnGuideNext.addEventListener('click', () => {
        if (this.activeGuideCard < this.guideSlides.length - 1) {
          this.showGuideCard(this.activeGuideCard + 1);
          return;
        }
        this.markCasualGuideSeen();
        this.closeCasualGuide();
        onStart('casual');
      });
    }
    if (this.btnGuideBack) {
      this.btnGuideBack.addEventListener('click', () => {
        if (this.activeGuideCard > 0) this.showGuideCard(this.activeGuideCard - 1);
      });
    }
    document.addEventListener('keydown', (event) => {
      if (!this.isCasualGuideOpen()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        const focusable = this.getGuideFocusableElements();
        if (!focusable.length) return;
        const currentIndex = focusable.indexOf(document.activeElement);
        const nextIndex = event.shiftKey
          ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
          : (currentIndex === -1 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
        focusable[nextIndex].focus();
      }
    }, true);
  }

  updateCasualGuideAvailability(openIfUnread = false) {
    const isCasual = this.selectedMode === 'casual';
    if (this.btnCasualGuide) this.btnCasualGuide.hidden = !isCasual;
    if (!isCasual) {
      this.closeCasualGuide();
      return;
    }
    if (openIfUnread && !this.casualGuideSeen) this.openCasualGuide();
  }

  openCasualGuide() {
    if (this.selectedMode !== 'casual' || !this.casualGuideOverlay) return;
    this.showGuideCard(0);
    this.casualGuideOverlay.classList.remove('hidden');
    this.casualGuideOverlay.style.display = 'flex';
    this.casualGuideOverlay.setAttribute('aria-hidden', 'false');
    this.setLobbyGuideInert(true);
    this.tutorialSceneRenderer.setActive(['move', 'push', 'respawn'][this.activeGuideCard]);
    if (this.btnGuideNext) this.btnGuideNext.focus();
  }

  closeCasualGuide() {
    if (!this.casualGuideOverlay) return;
    this.casualGuideOverlay.classList.add('hidden');
    this.casualGuideOverlay.style.display = 'none';
    this.casualGuideOverlay.setAttribute('aria-hidden', 'true');
    this.setLobbyGuideInert(false);
    this.tutorialSceneRenderer.stop();
  }

  setLobbyGuideInert(isInert) {
    if (!this.startOverlay) return;
    this.startOverlay.toggleAttribute('inert', isInert);
  }

  isCasualGuideOpen() {
    return Boolean(this.casualGuideOverlay && !this.casualGuideOverlay.classList.contains('hidden'));
  }

  getGuideFocusableElements() {
    return [this.btnGuideBack, this.btnGuideNext].filter((button) => button && !button.hidden && !button.disabled);
  }

  showGuideCard(index) {
    const target = Math.max(0, Math.min(this.guideSlides.length - 1, index));
    this.activeGuideCard = target;
    this.guideSlides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === target;
      slide.classList.toggle('active', isActive);
      slide.hidden = !isActive;
    });
    this.guideDots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === target;
      dot.classList.toggle('active', isActive);
      dot.setAttribute('aria-current', isActive ? 'step' : 'false');
    });
    if (this.btnGuideNext) {
      this.btnGuideNext.textContent = target === this.guideSlides.length - 1 ? '開始遊戲' : '下一步';
    }
    if (this.btnGuideBack) this.btnGuideBack.hidden = target === 0;
    if (this.guideActions) this.guideActions.classList.toggle('is-single-action', target === 0);
    if (this.isCasualGuideOpen()) this.tutorialSceneRenderer.setActive(['move', 'push', 'respawn'][target]);
  }

  setMode(mode) {
    const isCasual = mode === 'casual';
    if (this.healthBarContainer) this.healthBarContainer.style.display = isCasual ? 'none' : 'flex';
    if (this.timerCard) this.timerCard.style.display = isCasual ? 'flex' : 'none';
    if (this.leaderboard) this.leaderboard.style.display = isCasual ? 'block' : 'none';
  }

  updateTimer(seconds) {
    if (this.timeRemainingEl) this.timeRemainingEl.innerText = Math.max(0, Math.ceil(seconds)).toString();
  }

  updateLeaderboard(entries) {
    if (!this.leaderboardList) return;
    this.leaderboardList.replaceChildren();
    entries
      .slice()
      .sort((left, right) => right.score - left.score || left.order - right.order)
      .forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = `lb-row${entry.isPlayer ? ' player-row' : ''}`;
        const rank = document.createElement('span');
        rank.className = 'lb-rank';
        rank.textContent = `${index + 1}`;
        const name = document.createElement('span');
        name.className = 'lb-name';
        name.textContent = entry.name;
        const score = document.createElement('span');
        score.className = 'lb-score';
        score.textContent = entry.score.toString();
        row.append(rank, name, score);
        this.leaderboardList.append(row);
      });
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

  pulseScoreReward() {
    if (!this.currentScoreEl) return;
    this.currentScoreEl.classList.remove('score-pulse');
    void this.currentScoreEl.offsetWidth;
    this.currentScoreEl.classList.add('score-pulse');
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
