export const GAME_MODES = {
  CHALLENGE: 'challenge',
  CASUAL: 'casual'
};

export class GameModes {
  constructor() {
    this.currentMode = GAME_MODES.CHALLENGE;

    this.maxEnergy = 5;
    this.energyRecoveryInterval = 30; // 30 秒恢復 1 點能量

    // 從 localStorage 讀取或初始化能量
    const savedEnergy = parseInt(localStorage.getItem('crossy_energy'), 10);
    const savedTime = parseInt(localStorage.getItem('crossy_energy_timestamp'), 10);

    this.energy = isNaN(savedEnergy) ? 5 : Math.min(5, savedEnergy);
    this.lastEnergyTime = isNaN(savedTime) ? Date.now() : savedTime;

    this.updateEnergyFromOffline();
  }

  updateEnergyFromOffline() {
    if (this.energy >= this.maxEnergy) {
      this.lastEnergyTime = Date.now();
      this.saveToStorage();
      return;
    }

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - this.lastEnergyTime) / 1000);
    const recoveredCount = Math.floor(elapsedSeconds / this.energyRecoveryInterval);

    if (recoveredCount > 0) {
      this.energy = Math.min(this.maxEnergy, this.energy + recoveredCount);
      this.lastEnergyTime = now - ((elapsedSeconds % this.energyRecoveryInterval) * 1000);
      this.saveToStorage();
    }
  }

  update(deltaTime) {
    if (this.energy >= this.maxEnergy) {
      this.lastEnergyTime = Date.now();
      return;
    }

    const now = Date.now();
    const elapsedSeconds = (now - this.lastEnergyTime) / 1000;

    if (elapsedSeconds >= this.energyRecoveryInterval) {
      this.energy = Math.min(this.maxEnergy, this.energy + 1);
      this.lastEnergyTime = now;
      this.saveToStorage();
    }
  }

  getTimeToNextEnergy() {
    if (this.energy >= this.maxEnergy) return 0;
    const now = Date.now();
    const elapsedSeconds = (now - this.lastEnergyTime) / 1000;
    return Math.max(0, Math.ceil(this.energyRecoveryInterval - elapsedSeconds));
  }

  useEnergy() {
    this.updateEnergyFromOffline();
    if (this.energy > 0) {
      this.energy--;
      this.lastEnergyTime = Date.now();
      this.saveToStorage();
      return true;
    }
    return false;
  }

  saveToStorage() {
    localStorage.setItem('crossy_energy', this.energy.toString());
    localStorage.setItem('crossy_energy_timestamp', this.lastEnergyTime.toString());
  }

  setMode(mode) {
    if (Object.values(GAME_MODES).includes(mode)) {
      this.currentMode = mode;
    }
  }
}
