import assert from 'node:assert/strict';
import { Game } from '../src/main.js';

let leaderboard = null;
const game = {
  currentMode: 'casual',
  player: { gridZ: -3 },
  bots: [{ botName: '青蛙・滑步', gridZ: -4 }, { botName: '刺客・壞壞', gridZ: 13 }],
  uiManager: { updateLeaderboard: (entries) => { leaderboard = entries; } }
};

Game.prototype.refreshLeaderboard.call(game);
assert.deepEqual(leaderboard.map((entry) => entry.score), [0, 0, 13], 'live leaderboard distance must never display a negative score');
assert.deepEqual(leaderboard.map((entry) => entry.name), ['玩家', '青蛙・滑步', '刺客・壞壞'], 'clamp must preserve actor ordering and labels');

console.log('leaderboard score clamp regression: passed');
