import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { getHighestOtherLeaderStrikeTarget } from '../src/mechanics/LeaderStrikeTargeting.js';
import { AIBot } from '../src/mechanics/AIBot.js';

const actor = (gridZ, extra = {}) => ({ gridZ, isDead: false, isRespawning: false, stunTimer: 0, controlImmunityTimer: 0, ...extra });
const owner = actor(9);
const second = actor(7);
const first = actor(11);
assert.equal(getHighestOtherLeaderStrikeTarget(owner, [owner, second]), second, 'first-place owner must target second place');
assert.equal(getHighestOtherLeaderStrikeTarget(second, [owner, second, first]), first, 'middle owner must target first place');
const tiedHighA = actor(11);
const tiedHighB = actor(11);
assert.equal(getHighestOtherLeaderStrikeTarget(owner, [owner, tiedHighA, tiedHighB], () => 0), tiedHighA, 'tie must select only the highest other group');
assert.equal(getHighestOtherLeaderStrikeTarget(owner, [owner, tiedHighA, tiedHighB], () => 0.99), tiedHighB, 'tie random selection must remain within highest other group');

const bot = new AIBot(null, 'BOT', 0, 11);
const botSecond = actor(7);
assert.equal(bot.getLeaderStrikeTarget([bot, botSecond]), botSecond, 'highest BOT must be able to lock second place');
const controlledLeader = actor(12, { stunTimer: 1 });
const lowerFreeTarget = actor(10);
bot.gridZ = 7;
assert.equal(bot.getLeaderStrikeTarget([bot, controlledLeader, lowerFreeTarget]), null, 'BOT must not skip a controlled highest target for a lower one');

const dom = new JSDOM('<div id="combat-announcement" class="combat-announcement-hidden" role="status" aria-live="polite"></div>', { url: 'http://localhost' });
globalThis.document = dom.window.document;
const { UIManager } = await import('../src/ui/UIManager.js');
const timers = [];
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
globalThis.setTimeout = (callback, delay) => { const timer = { callback, delay, cleared: false }; timers.push(timer); return timer; };
globalThis.clearTimeout = (timer) => { if (timer) timer.cleared = true; };
try {
  const ui = new UIManager();
  ui.showCombatAnnouncement('⚡ 玩家 發動「高分追擊落雷」攻擊 BOT！');
  ui.showCombatAnnouncement('⚡ BOT 發動「高分追擊落雷」攻擊 玩家！');
  const announcement = document.getElementById('combat-announcement');
  assert.equal(announcement.textContent, '⚡ BOT 發動「高分追擊落雷」攻擊 玩家！');
  assert.ok(announcement.classList.contains('combat-announcement-show'));
  assert.equal(timers.length, 2);
  assert.equal(timers[0].cleared, true, 'replay must clear the prior timer');
  assert.equal(timers[1].delay, 3000);
  ui.hideOverlays();
  assert.ok(announcement.classList.contains('combat-announcement-hidden'));
  assert.equal(announcement.textContent, '');
  assert.equal(ui.combatAnnouncementTimer, null);
  assert.equal(timers[1].cleared, true, 'hideOverlays must cancel the active timer');
  ui.showCombatAnnouncement('⚡ 玩家 發動「高分追擊落雷」攻擊 BOT！');
  const lobbyTimer = timers.at(-1);
  ui.showLobby();
  assert.ok(announcement.classList.contains('combat-announcement-hidden'));
  assert.equal(ui.combatAnnouncementTimer, null);
  assert.equal(lobbyTimer.cleared, true, 'showLobby must cancel the active timer');
} finally {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  delete globalThis.document;
}

console.log('leader strike targeting and announcement PASS');
