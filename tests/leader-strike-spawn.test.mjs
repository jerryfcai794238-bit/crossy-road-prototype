import assert from 'node:assert/strict';
import { MapGenerator } from '../src/mechanics/MapGenerator.js';

const makeLcg = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const makeScene = () => ({ add() {}, remove() {} });
const generator = new MapGenerator(makeScene(), makeLcg(91));
generator.leaderStrikeItemsEnabled = true;
generator.leaderStrikeReferenceX = () => 0;
generator.leaderStrikeCellBlocked = () => false;
generator.initMap();
assert.ok([...generator.getActiveRows().values()]
  .filter((row) => row.z >= 0 && row.z <= 7)
  .every((row) => !row.leaderStrikeItem), 'z0-7 initial rows must not spawn an item');

const spawned = [];
let firstItem = null;
for (let z = generator.highestZGenerated + 1; z <= 180; z++) {
  generator.highestZGenerated = z;
  generator.generateRow(z, generator.getNextRowType(z));
  assert.ok(generator.leaderStrikeItems.size <= 1, `z=${z}: more than one leader item`);
  const item = [...generator.leaderStrikeItems.values()][0];
  if (item && item !== firstItem) {
    firstItem = item;
    spawned.push({ ...item });
    const row = generator.getActiveRows().get(item.z);
    assert.ok(!row.dynamicHoleCluster, `block ${item.blockIndex}: item placed on dynamic-hole row`);
    assert.equal(item.blockIndex % 3, 0, `block ${item.blockIndex}: invalid spawn cadence`);
    generator.collectLeaderStrikeItemAt({ x: item.x, z: item.z });
    assert.equal(generator.leaderStrikeItems.size, 0, 'pickup must not immediately replace the item');
    firstItem = null;
  }
}
assert.ok(spawned.length >= 3, 'expected multiple scheduled leader-strike spawns');
assert.equal(spawned[0].blockIndex, 3, 'first item must use block 3');
assert.ok(spawned.every((item) => item.blockIndex % 3 === 0), 'spawns must be at 3/6/9 cadence');
assert.ok(spawned.every((item) => item.z > 7), 'leader-strike boxes must stay beyond the initial z0-7 safety area');

const missed = new MapGenerator(makeScene(), makeLcg(91));
missed.leaderStrikeItemsEnabled = true;
missed.leaderStrikeReferenceX = () => 0;
missed.leaderStrikeCellBlocked = () => false;
missed.initMap();
while (!missed.leaderStrikeItems.size && missed.highestZGenerated < 100) {
  missed.highestZGenerated++;
  missed.generateRow(missed.highestZGenerated, missed.getNextRowType(missed.highestZGenerated));
}
const oldItem = [...missed.leaderStrikeItems.values()][0];
assert.ok(oldItem, 'expected a scheduled item to test missed-item persistence');
const missedEndZ = missed.highestZGenerated + 40;
for (let z = missed.highestZGenerated + 1; z <= missedEndZ; z++) {
  missed.highestZGenerated = z;
  missed.generateRow(z, missed.getNextRowType(z));
}
assert.equal([...missed.leaderStrikeItems.values()][0], oldItem, 'missed item must not move or respawn before despawn');

console.log(JSON.stringify({ initialItems: 0, spawnedBlocks: spawned.map((item) => item.blockIndex), missedItemBlock: oldItem.blockIndex, failures: 0 }));
