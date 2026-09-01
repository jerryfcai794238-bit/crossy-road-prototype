import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MapGenerator } from '../src/mechanics/MapGenerator.js';
import { CONFIG } from '../src/config.js';

const makeLcg = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const makeScene = () => ({ add() {}, remove() {} });
const generateThrough = (generator, maxZ) => {
  generator.initMap();
  while (generator.highestZGenerated < maxZ) {
    generator.highestZGenerated++;
    const rowType = generator.getNextRowType(generator.highestZGenerated);
    generator.generateRow(generator.highestZGenerated, rowType);
  }
};
const playableXs = new Set(Array.from({ length: CONFIG.MAP_BOUNDS_X * 2 - 1 }, (_, i) => i - CONFIG.MAP_BOUNDS_X + 1));
const coverage = new Map();
const repairXs = new Set();
const treeLayouts = new Set();
let repairs = 0;

const seedCount = Number.parseInt(process.env.MAP_REACHABILITY_SEEDS || '500', 10);
const seedStart = Number.parseInt(process.env.MAP_REACHABILITY_START || '1', 10);
for (let seed = seedStart; seed < seedStart + seedCount; seed++) {
  const generator = new MapGenerator(makeScene(), makeLcg(seed));
  generateThrough(generator, 120);

  for (const row of generator.getActiveRows().values()) {
    if (row.z < 0 || row.z > 120) continue;
    assert.ok(row.reachableXs?.length, `seed ${seed}: Z=${row.z} has no reachable cell`);
    assert.ok(row.reachableXs.every((x) => playableXs.has(x)), `seed ${seed}: Z=${row.z} escaped playable bounds`);

    const kind = row.type === CONFIG.ROW_TYPES.RIVER && row.isPureLilyPadRow ? 'lily-river'
      : row.type === CONFIG.ROW_TYPES.RIVER ? 'moving-river' : row.type;
    coverage.set(kind, (coverage.get(kind) || 0) + 1);
    if (row.dynamicHoleRole) {
      const dynamicRole = `dynamic-hole-${row.dynamicHoleRole}`;
      coverage.set(dynamicRole, (coverage.get(dynamicRole) || 0) + 1);
    }
    if (row.type === CONFIG.ROW_TYPES.RIVER) {
      assert.ok(row.carrierFrontier?.length, `seed ${seed}: river Z=${row.z} lacks a carrier frontier`);
      for (const state of row.carrierFrontier) {
        const log = row.logs[state.logIndex];
        assert.ok(log && generator.carrierSupportsGridX(log, row, state.x, state.time), `seed ${seed}: unsupported carrier at Z=${row.z}`);
        if (row.carrierInputFrontier?.length) {
          assert.ok(row.carrierInputFrontier.some((source) => (
            source.x === state.x
            && Math.abs(source.time + CONFIG.JUMP_DURATION - state.time) < 1e-6
          )), `seed ${seed}: disconnected carrier transition at Z=${row.z}`);
        }
      }
    }
    if (kind === 'moving-river') {
      assert.ok(row.logs.some((log) => !log.isStationary), `seed ${seed}: Z=${row.z} moving river has no moving log`);
    } else if (kind === 'lily-river') {
      assert.ok(row.logs.some((log) => log.isStationary), `seed ${seed}: Z=${row.z} lily river has no platform`);
    }
    if (row.type === CONFIG.ROW_TYPES.GRASS) {
      treeLayouts.add(row.trees.filter((tree) => Math.abs(tree.gridX) < CONFIG.MAP_BOUNDS_X).map((tree) => tree.gridX).join(','));
    }
    if (row.reachabilityRepair) {
      repairs++;
      repairXs.add(row.reachabilityRepair.x);
    }
  }
}

// Historical reported seed smoke; the stable legacy failure proof below does
// not depend on a random stream whose mapping can change with unrelated features.
const regression = new MapGenerator(makeScene(), makeLcg(91));
generateThrough(regression, 120);
for (const row of regression.getActiveRows().values()) {
  if (row.z >= 0 && row.z <= 120) assert.ok(row.reachableXs.length, `regression seed 91 failed at Z=${row.z}`);
}

// Stable legacy topology fixture: the old row-local open/flood rule has no
// entrance from x=0. The generator's minimal repair restores it.
const fixtureGenerator = new MapGenerator(makeScene(), makeLcg(7));
const fixtureRow = { z: 501, type: CONFIG.ROW_TYPES.GRASS, mesh: new THREE.Group(), logs: [], trees: [{ gridX: 0, mesh: new THREE.Group() }] };
fixtureGenerator.reachableXs = new Set([0]);
fixtureGenerator.reachabilityInitialized = true;
const legacyFrontier = fixtureGenerator.floodRowFromEntries(fixtureGenerator.getRowTraversableXs(fixtureRow), fixtureGenerator.reachableXs);
assert.equal(legacyFrontier.size, 0, 'legacy dead-end fixture must be blocked before repair');
fixtureGenerator.updateGeneratedReachability(fixtureRow);
assert.equal(fixtureRow.reachabilityRepair?.type, 'cleared-tree');
assert.ok(fixtureRow.reachableXs.includes(0));

// A moving river without carriers has one stationary fallback added before it
// can be shown. Every retained state is supported at Physics collision width.
const temporalFixture = new MapGenerator(makeScene(), makeLcg(3));
temporalFixture.reachableXs = new Set([1]);
temporalFixture.reachabilityInitialized = true;
const emptyRiver = { z: 502, type: CONFIG.ROW_TYPES.RIVER, mesh: new THREE.Group(), logs: [], trees: [], speed: 3, direction: 1, isPureLilyPadRow: false };
temporalFixture.updateGeneratedReachability(emptyRiver);
assert.equal(emptyRiver.reachabilityRepair?.type, 'added-lily-carrier');
assert.ok(emptyRiver.carrierFrontier.length);
assert.ok(emptyRiver.carrierFrontier.every((state) => temporalFixture.carrierSupportsGridX(emptyRiver.logs[state.logIndex], emptyRiver, state.x, state.time)));

const emptyFrontier = new MapGenerator(makeScene(), makeLcg(1));
emptyFrontier.reachabilityInitialized = true;
emptyFrontier.reachableXs.clear();
assert.throws(() => emptyFrontier.updateGeneratedReachability({ z: 503, type: CONFIG.ROW_TYPES.GRASS, mesh: new THREE.Group(), logs: [], trees: [] }), /frontier was empty/);

// Carrier prediction must use the same snap-and-discard wrap as the runtime,
// in both directions; modulo wrap would leave a false 0.45-unit overshoot here.
const wrapGenerator = new MapGenerator(makeScene(), makeLcg(1));
const wrapBound = (CONFIG.MAP_BOUNDS_X + 5) * CONFIG.GRID_SIZE;
const wrapLog = { mesh: new THREE.Group(), length: 3 };
wrapLog.mesh.position.x = wrapBound - 0.2;
assert.equal(wrapGenerator.getCarrierX(wrapLog, { direction: 1, speed: 6.5 }, 0.1), -wrapBound);
wrapLog.mesh.position.x = -wrapBound + 0.2;
assert.equal(wrapGenerator.getCarrierX(wrapLog, { direction: -1, speed: 6.5 }, 0.1), wrapBound);

for (const required of [CONFIG.ROW_TYPES.GRASS, CONFIG.ROW_TYPES.ROAD, CONFIG.ROW_TYPES.RAILROAD, 'moving-river', 'lily-river', 'dynamic-hole-entry', 'dynamic-hole-floor', 'dynamic-hole-exit']) {
  assert.ok(coverage.get(required), `missing terrain coverage: ${required}`);
}
assert.ok(treeLayouts.size > 50, 'grass tree layouts unexpectedly collapsed to a fixed corridor');
if (seedCount >= 100) {
  assert.ok(repairs > 0 && repairXs.size > 1, 'repairs were not exercised across varied entrances');
}

console.log(JSON.stringify({ seedStart, seeds: seedCount, maxZ: 120, failures: 0, repairs, repairXs: [...repairXs].sort((a, b) => a - b), coverage: Object.fromEntries(coverage), treeLayouts: treeLayouts.size }));
