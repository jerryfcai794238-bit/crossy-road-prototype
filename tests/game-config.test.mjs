import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CONFIG, CASUAL_PLAYER_COUNT, DEFAULT_GAME_CONFIG, PATHS, parseGameConfigYaml, applyGameConfig, loadGameConfig, resetGameConfig } from '../src/config.js';

const actualYaml = fs.readFileSync(new URL('../docs/game-config.yaml', import.meta.url), 'utf8');
const actualParsed = parseGameConfigYaml(actualYaml);
assert.deepEqual(actualParsed.errors, [], 'checked-in YAML must be fully valid');
assert.equal(Object.keys(actualParsed.labels).length, 88, 'all settings have labels');
assert.ok(Object.values(actualParsed.labels).every((label) => label.trim().length > 0), 'labels are non-empty');
assert.equal(applyGameConfig(actualParsed.values).ok, true);
const actualLoaded = await loadGameConfig('/docs/game-config.yaml', async () => ({ ok: true, text: async () => actualYaml }));
assert.equal(actualLoaded.source, 'yaml');
assert.equal(actualLoaded.ok, true);
assert.deepEqual(actualLoaded.labels, actualParsed.labels, 'loader exposes labels without changing runtime reads');
const invalid = parseGameConfigYaml('rocket.speed:\n  value: nope\n  label: 火箭速度\n');
assert.ok(invalid.errors.length > 0, 'incomplete document and invalid number are rejected');
assert.equal(Object.keys(PATHS).length, Object.keys(DEFAULT_GAME_CONFIG).length, 'every public key has an explicit runtime path');
for (const [key, target] of Object.entries(PATHS)) {
  let node = CONFIG;
  if (target[0] === 'CASUAL_PLAYER_COUNT') node = { CASUAL_PLAYER_COUNT };
  for (const segment of target) assert.ok(Object.hasOwn(node, segment), `${key} target ${target.join('.')} exists`), node = node[segment];
}
const alternate = (key, original) => {
  if (Array.isArray(original)) return [...original].reverse();
  if (key === 'casual.playerCount') return 4;
  if (key === 'items.slotCount') return 1;
  if (key === 'boxes.batchMin') return 1;
  if (key === 'boxes.batchMax') return 4;
  if (key.endsWith('Min')) return original / 2;
  if (key.endsWith('Max')) return original + 1;
  if (key === 'camera.startZ') return original - 1;
  if (key.startsWith('camera.offset') || key === 'camera.targetAhead') return original + 1;
  if (Number.isInteger(original)) return original + 1;
  return original * .9;
};
for (const [key, original] of Object.entries(DEFAULT_GAME_CONFIG)) {
  resetGameConfig();
  const changed = alternate(key, original);
  const result = applyGameConfig({ [key]: changed });
  assert.equal(result.ok, true, `${key} accepts a legal alternate`);
  const target = PATHS[key];
  let node = target[0] === 'CASUAL_PLAYER_COUNT' ? { CASUAL_PLAYER_COUNT } : CONFIG;
  for (const segment of target) node = node[segment];
  assert.deepEqual(node, changed, `${key} applies to its explicit runtime target`);
}
assert.equal(applyGameConfig({ 'camera.startZ': -4 }).ok, true, 'camera start supports negative world rows');
assert.equal(applyGameConfig({ 'items.pool': ['rocket', 'rocket'] }).ok, false);
assert.equal(applyGameConfig({ 'bot.decisionMin': .3, 'bot.decisionMax': .2 }).ok, false);
const fallback = await loadGameConfig('/missing.yaml', async () => ({ ok: false, status: 404 }));
assert.equal(fallback.source, 'defaults');
assert.equal(CONFIG.ROCKET.SPEED, 10, 'loader fallback restores defaults');
resetGameConfig();
console.log('game-config parser/loader/wiring: PASS');
