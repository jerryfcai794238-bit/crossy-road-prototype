import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gameSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

assert.match(
  gameSource,
  /const SCORE_ITEM_PROTOTYPE_ENABLED = false;/,
  '地圖積分道具的功能開關必須維持關閉'
);
assert.match(
  gameSource,
  /this\.mapGenerator\.scoreItemsEnabled = this\.scoreItemsPrototypeEnabled;/,
  '地圖生成器必須繼承積分道具功能開關'
);
assert.match(
  gameSource,
  /if \(!this\.scoreItemsPrototypeEnabled\) return false;/,
  '關閉時不得拾取積分道具'
);

console.log('score item removal regression: passed');
