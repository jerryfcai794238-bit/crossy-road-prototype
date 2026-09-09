import { TutorialSceneRenderer } from './TutorialSceneRenderer.js';
import { ITEM_META, itemIconDataUrl } from './ItemIcons.js';
import { CONFIG } from '../config.js';
import { CASUAL_PLAYER_COUNT } from '../config.js';

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
    this.combatAnnouncement = document.getElementById('combat-announcement');
    this.combatAnnouncementTimer = null;
    this.matchingOverlay = document.getElementById('matching-overlay');
    this.matchingStatus = document.getElementById('matching-status');
    this.matchingSeats = document.getElementById('matching-seats');
    this.btnCancelMatching = document.getElementById('btn-cancel-matching');
    this.btnGameSettings = document.getElementById('btn-game-settings');
    this.gameSettingsOverlay = document.getElementById('game-settings-overlay');
    this.settingsModeLabel = document.getElementById('settings-mode-label');
    this.btnResumeGame = document.getElementById('btn-resume-game');
    this.btnLeaveGame = document.getElementById('btn-leave-game');
    this.raceCountdown = document.getElementById('race-countdown');
    this.raceCountdownValue = document.getElementById('race-countdown-value');
    this.respawnCountdown = document.getElementById('respawn-countdown');
    this.respawnCountdownValue = document.getElementById('respawn-countdown-value');
    this.respawnCountdownNote = document.getElementById('respawn-countdown-note');
    this.globalStrikeFlash = document.getElementById('global-strike-flash');
    this.soloResults = document.getElementById('solo-results');
    this.multiplayerResults = document.getElementById('multiplayer-results');
    this.itemHud = document.getElementById('item-hud');
    this.itemSlots = document.getElementById('item-slots');
    this.itemHudKey = null;

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

  init(onStart, onRestart, onReturnLobby, onCancelMatching = null, onOpenSettings = null, onResumeGame = null, onLeaveGame = null) {
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
    if (this.btnCancelMatching && onCancelMatching) this.btnCancelMatching.addEventListener('click', onCancelMatching);
    if (this.btnGameSettings && onOpenSettings) this.btnGameSettings.addEventListener('click', onOpenSettings);
    if (this.btnResumeGame && onResumeGame) this.btnResumeGame.addEventListener('click', onResumeGame);
    if (this.btnLeaveGame && onLeaveGame) this.btnLeaveGame.addEventListener('click', onLeaveGame);
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
    this.currentMode = mode;
    const isCasual = mode === 'casual';
    if (this.itemHud) this.itemHud.hidden = !isCasual;
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

  showMatching(seats, status) {
    if (this.matchingStatus) this.matchingStatus.textContent = status;
    if (this.matchingSeats) {
      this.matchingSeats.replaceChildren();
      for (let index = 0; index < CASUAL_PLAYER_COUNT; index++) {
        const seat = document.createElement('span');
        seat.className = `matching-seat${index < seats ? ' filled' : ''}${index === 0 ? ' player-seat' : ''}`;
        seat.textContent = index === 0 ? '你' : index < seats ? 'BOT' : '…';
        this.matchingSeats.append(seat);
      }
    }
    if (this.matchingOverlay) {
      this.matchingOverlay.classList.remove('hidden');
      this.matchingOverlay.style.display = 'flex';
    }
  }

  hideMatching() {
    if (!this.matchingOverlay) return;
    this.matchingOverlay.classList.add('hidden');
    this.matchingOverlay.style.display = 'none';
  }

  showRaceCountdown(value) {
    if (!this.raceCountdown) return;
    this.hideMatching();
    this.raceCountdown.hidden = false;
    this.raceCountdown.classList.toggle('race-go', value === 'GO');
    this.raceCountdownValue.textContent = value === 'GO' ? '衝啊！' : String(value);
    this.raceCountdownValue.classList.remove('countdown-pop');
    void this.raceCountdownValue.offsetWidth;
    this.raceCountdownValue.classList.add('countdown-pop');
  }

  hideRaceCountdown() {
    if (this.raceCountdown) this.raceCountdown.hidden = true;
  }

  updateRespawnCountdown(seconds, phase = 'countdown') {
    if (!this.respawnCountdown) return;
    this.respawnCountdown.hidden = seconds === null || seconds === undefined;
    if (this.respawnCountdown.hidden) return;
    const travelling = phase === 'dying' || phase === 'returning';
    this.respawnCountdown.classList.toggle('respawn-travelling', travelling);
    const title = document.getElementById('respawn-countdown-title');
    if (title) title.textContent = travelling ? '失誤了！' : '回到安全點 · 準備再出發';
    if (travelling) {
      this.respawnCountdownValue.textContent = phase === 'dying' ? '哎呀！' : '返回中';
      this.respawnCountdownNote.textContent = phase === 'dying' ? '即將返回上一個安全點' : '抵達安全點後開始倒數';
      return;
    }
    const count = Math.max(0, Math.ceil(seconds));
    const text = count > 0 ? String(count) : '…';
    if (this.respawnCountdownValue.textContent !== text) this.respawnCountdownValue.textContent = text;
    this.respawnCountdownNote.textContent = count > 0 ? '倒數結束後恢復移動' : '正在等待安全空位';
  }

  updateItemHUD(slots = [], time = 0) {
    if (!this.itemHud || !this.itemSlots) return;
    this.itemHud.hidden = this.currentMode !== 'casual';
    const normalizedSlots = Array.from({ length: CONFIG.ITEMS.SLOT_COUNT }, (_, index) => slots[index] || null);
    const key = normalizedSlots.map((slot) => {
      if (!slot) return 'empty';
      if (slot.roulette) return `rolling:${slot.roulette.preview}:${Math.ceil(slot.roulette.remaining * 10)}`;
      return `${slot.type}:${slot.expiresAt ? Math.ceil(slot.expiresAt - time) : 'ready'}`;
    }).join('|');
    if (key !== this.itemHudKey) {
      this.itemHudKey = key;
      this.itemSlots.replaceChildren();
      for (let index = 0; index < CONFIG.ITEMS.SLOT_COUNT; index++) {
        const entry = normalizedSlots[index];
        const type = entry?.roulette?.preview || entry?.type;
        const meta = ITEM_META[type];
        const slot = document.createElement('div');
        const rolling = Boolean(entry?.roulette);
        slot.className = `item-slot ${rolling ? 'item-slot-rolling' : meta ? 'item-slot-held' : 'item-slot-empty'}`;
        slot.dataset.item = type || '';
        if (meta) {
          slot.style.setProperty('--item-color', meta.color);
          slot.title = meta.hint;
          const icon = document.createElement('img'); icon.src = itemIconDataUrl(type); icon.alt = ''; icon.width = 58; icon.height = 58;
          const name = document.createElement('strong'); name.textContent = meta.name;
          const status = document.createElement('span');
          if (rolling) status.textContent = `抽取中 ${Math.ceil(entry.roulette.remaining * 10) / 10}s`;
          else if (entry.type === 'shield') status.textContent = `護盾 ${Math.max(0, Math.ceil(entry.expiresAt - time))}秒`;
          else status.textContent = '待命';
          slot.append(icon, name, status);
        } else {
          const mark = document.createElement('span'); mark.className = 'empty-slot-mark'; mark.textContent = '?';
          const label = document.createElement('span'); label.textContent = '空槽';
          slot.append(mark, label);
        }
        this.itemSlots.append(slot);
      }
    }
    const hint = document.getElementById('item-hud-hint');
    const hasRolling = normalizedSlots.some((slot) => slot?.roulette);
    const hasHeld = normalizedSlots.some((slot) => slot?.type);
    if (hint) hint.textContent = hasRolling ? '道具正在各自抽取！' : hasHeld ? '條件符合時自動使用' : '碰問號箱，抽取道具';
  }

  flashGlobalStrike() {
    if (!this.globalStrikeFlash) return;
    this.globalStrikeFlash.classList.remove('global-strike-active');
    void this.globalStrikeFlash.offsetWidth;
    this.globalStrikeFlash.classList.add('global-strike-active');
  }

  clearMatchFeedback() {
    this.hideRaceCountdown();
    this.updateRespawnCountdown(null);
    this.globalStrikeFlash?.classList.remove('global-strike-active');
  }

  showCombatAnnouncement(message) {
    if (!this.combatAnnouncement) return;
    if (this.combatAnnouncementTimer) clearTimeout(this.combatAnnouncementTimer);
    this.combatAnnouncement.textContent = message;
    this.combatAnnouncement.classList.remove('combat-announcement-hidden', 'combat-announcement-show');
    // 強制重播 CSS animation，讓連續攻擊每次都有完整公告時間。
    void this.combatAnnouncement.offsetWidth;
    this.combatAnnouncement.classList.add('combat-announcement-show');
    this.combatAnnouncementTimer = setTimeout(() => {
      this.combatAnnouncement.classList.remove('combat-announcement-show');
      this.combatAnnouncement.classList.add('combat-announcement-hidden');
      this.combatAnnouncementTimer = null;
    }, 3000);
  }

  clearCombatAnnouncement() {
    if (this.combatAnnouncementTimer) clearTimeout(this.combatAnnouncementTimer);
    this.combatAnnouncementTimer = null;
    if (!this.combatAnnouncement) return;
    this.combatAnnouncement.classList.remove('combat-announcement-show');
    this.combatAnnouncement.classList.add('combat-announcement-hidden');
    this.combatAnnouncement.textContent = '';
  }

  setGameSettingsAvailable(isAvailable) {
    if (this.btnGameSettings) this.btnGameSettings.hidden = !isAvailable;
  }

  showGameSettings(mode) {
    if (!this.gameSettingsOverlay) return;
    const isChallenge = mode === 'challenge';
    if (this.settingsModeLabel) this.settingsModeLabel.textContent = isChallenge ? '挑戰模式 · 已暫停' : '休閒模式 · 對局持續中';
    this.gameSettingsOverlay.classList.remove('hidden');
    this.gameSettingsOverlay.style.display = 'flex';
    this.gameSettingsOverlay.setAttribute('aria-hidden', 'false');
    this.btnResumeGame?.focus();
  }

  hideGameSettings() {
    if (!this.gameSettingsOverlay) return;
    this.gameSettingsOverlay.classList.add('hidden');
    this.gameSettingsOverlay.style.display = 'none';
    this.gameSettingsOverlay.setAttribute('aria-hidden', 'true');
  }

  showLobby() {
    this.hideGameSettings();
    this.setGameSettingsAvailable(false);
    if (this.itemHud) this.itemHud.hidden = true;
    this.clearMatchFeedback();
    this.hideMatching();
    this.clearCombatAnnouncement();
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
    this.hideGameSettings();
    this.setGameSettingsAvailable(false);
    this.clearMatchFeedback();
    this.hideMatching();
    this.clearCombatAnnouncement();
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
    this.hideGameSettings();
    this.setGameSettingsAvailable(false);
    if (this.itemHud) this.itemHud.hidden = true;
    this.clearMatchFeedback();
    if (this.soloResults) this.soloResults.hidden = false;
    if (this.multiplayerResults) this.multiplayerResults.hidden = true;
    this.gameoverOverlay?.querySelector('.gameover-card')?.classList.remove('multiplayer-card');
    if (this.btnRestart) this.btnRestart.textContent = '再試一次';
    this.clearCombatAnnouncement();
    if (this.finalScoreEl) this.finalScoreEl.innerText = score;
    if (this.finalBestEl) this.finalBestEl.innerText = this.highScore;
    if (this.deathReasonEl) this.deathReasonEl.innerText = reason;

    if (this.gameoverOverlay) {
      this.gameoverOverlay.classList.remove('hidden');
      this.gameoverOverlay.style.display = 'flex';
    }
  }

  showMultiplayerResults({ entries = [], playerRank, duration = 120 } = {}) {
    this.hideGameSettings();
    this.setGameSettingsAvailable(false);
    if (this.itemHud) this.itemHud.hidden = true;
    if (!this.multiplayerResults || !this.gameoverOverlay) return;
    this.clearCombatAnnouncement();
    this.clearMatchFeedback();
    if (this.soloResults) this.soloResults.hidden = true;
    this.multiplayerResults.hidden = false;
    this.gameoverOverlay.querySelector('.gameover-card')?.classList.add('multiplayer-card');
    const standings = entries.slice().sort((a, b) => b.distance - a.distance || a.order - b.order);
    const player = standings.find((entry) => entry.isPlayer);
    const rank = player?.rank ?? playerRank ?? standings.indexOf(player) + 1;
    const tied = standings.filter((entry) => entry.rank === rank).length > 1;
    document.getElementById('results-title').textContent = rank === 1 ? (tied ? '並列冠軍！' : '你是本局冠軍！') : `本局第 ${rank} 名`;
    document.getElementById('results-subtitle').textContent = `${duration} 秒對決完成 · ${standings.length} 位選手的最終戰績`;
    const makeText = (tag, className, text) => {
      const element = document.createElement(tag);
      element.className = className;
      element.textContent = text;
      return element;
    };
    const avatar = (entry) => entry.isPlayer ? '🐔' : entry.name.includes('青蛙') ? '🐸' : entry.name.includes('柴犬') ? '🐕' : '🦆';
    const podium = document.getElementById('results-podium');
    podium.replaceChildren();
    [1, 0, 2].forEach((index) => {
      const entry = standings[index];
      if (!entry) return;
      const place = makeText('div', `podium-place podium-${index + 1}${entry.isPlayer ? ' podium-you' : ''}`, '');
      place.append(
        makeText('span', 'podium-medal', entry.rank === 1 ? '👑' : `第 ${entry.rank} 名`),
        makeText('span', 'podium-avatar', avatar(entry)),
        makeText('strong', 'podium-name', entry.isPlayer ? `${entry.name}（你）` : entry.name),
        makeText('span', 'podium-distance', `${entry.distance} 格`)
      );
      podium.append(place);
    });
    const personal = document.getElementById('results-personal');
    personal.replaceChildren();
    if (player) {
      for (const [label, value] of [['你的名次', `${tied ? '並列 ' : ''}${rank} / ${standings.length}`], ['最遠紀錄', `${player.maxDistance} 格`], ['失誤次數', `${player.deaths} 次`]]) {
        const stat = makeText('div', 'result-stat', '');
        stat.append(makeText('span', '', label), makeText('strong', '', value));
        personal.append(stat);
      }
    }
    const rows = document.getElementById('results-rows');
    rows.replaceChildren();
    standings.forEach((entry) => {
      const row = document.createElement('tr');
      if (entry.isPlayer) row.className = 'result-player-row';
      [entry.rank, entry.isPlayer ? `${entry.name}（你）` : entry.name, entry.distance, entry.itemScore, entry.deaths].forEach((value, index) => {
        const cell = makeText(index === 1 ? 'th' : 'td', '', String(value));
        if (index === 1) cell.scope = 'row';
        row.append(cell);
      });
      rows.append(row);
    });
    if (this.btnRestart) this.btnRestart.textContent = '再配一場';
    this.gameoverOverlay.classList.remove('hidden');
    this.gameoverOverlay.style.display = 'flex';
    this.btnRestart?.focus();
  }
}
