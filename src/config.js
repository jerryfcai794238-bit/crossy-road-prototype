// Runtime tuning is loaded from docs/game-config.yaml before Game starts.
const BASE = {
  'casual.playerCount': 5, 'casual.durationSeconds': 120, 'casual.countdownStart': 3, 'casual.matchFillMs': 230, 'casual.initialFillMs': 180, 'casual.countdownMs': 1000, 'casual.goDisplayMs': 550,
  'movement.gridSize': 1.2, 'movement.boundsX': 6, 'movement.jumpDuration': .16, 'movement.jumpHeight': .5,
  'respawn.deathAnimationSeconds': .65, 'respawn.penaltySeconds': 3, 'respawn.finishInvulnerabilitySeconds': 1,
  'camera.startZ': -3, 'camera.challengeScrollSpeed': .45, 'camera.targetAhead': 2.2, 'camera.orthoSize': 4.2, 'camera.near': 1, 'camera.far': 1000, 'camera.offsetX': -10, 'camera.offsetY': 14, 'camera.offsetZ': -10, 'camera.pixelRatioMax': 2, 'camera.challengeCatchupLerp': .18, 'camera.casualFollowLerp': .12, 'camera.casualBackRows': 15,
  'player.maxHp': 100, 'player.damageInvulnerabilitySeconds': 2, 'traffic.carDamageBase': 10, 'traffic.carDamageSpeedScale': 8, 'traffic.carDamageCap': 60, 'traffic.trainDamage': 70,
  'bot.decisionMin': .10, 'bot.decisionMax': .22, 'bot.decisionJitter': .03, 'bot.aggressionScale': 1, 'bot.interferenceThreshold': .46, 'bot.pressureChanceScale': .18, 'bot.itemSearchDepth': 5, 'bot.pathSearchDepth': 10, 'bot.repairWaitSeconds': .7, 'bot.vehicleSafetyDistance': 2.2, 'bot.actionRateBase': .93, 'bot.actionRateAggression': .08,
  'map.generationAhead': 35, 'map.despawnBehind': 25, 'map.roadSpeedMin': 2, 'map.roadSpeedMax': 4.2, 'map.roadSpeedRangeMin': 1.2, 'map.roadSpeedRangeMax': 2.3, 'map.riverSpeedMin': 1.5, 'map.riverSpeedMax': 3.2, 'map.riverSpeedJitter': 1, 'map.trainSpeed': 38, 'map.trainWarningSeconds': 2,
  'items.pool': ['rocket', 'shield', 'eagle', 'lightning'], 'items.slotCount': 2, 'items.rouletteSeconds': 1.1, 'items.roulettePreviewRate': 15, 'items.triggerInterval': .75,
  'rocket.speed': 10, 'rocket.stunSeconds': 1.5, 'rocket.impactSeconds': .72, 'rocket.hitRadius': .24, 'lightning.warningSeconds': .8, 'lightning.stunSeconds': 1.5,
  'shield.durationSeconds': 10, 'shield.blocks': 1, 'shield.finalFlashSeconds': 2, 'shield.flashRate': 8,
  'eagle.warningSeconds': 1.25, 'eagle.partyRespawnPenaltySeconds': 0, 'eagle.challengeTriggerSeconds': 7.5, 'eagle.challengeCarrySeconds': .4,
  'holes.warningSeconds': 1.2, 'holes.activeSeconds': 2.2, 'holes.repairSeconds': .6, 'holes.intervalSeconds': .8, 'holes.safetyBufferSeconds': .15, 'holes.fireballHeight': 5,
  'boxes.safeEndZ': 7, 'boxes.batchMin': 2, 'boxes.batchMax': 3, 'boxes.rowSpacing': 3, 'boxes.regenSeconds': 2,
  'vfx.feedbackSeconds': .75, 'vfx.stunStarRadius': .35
};
export const DEFAULT_GAME_CONFIG = Object.freeze({ ...BASE });
export let CASUAL_PLAYER_COUNT = BASE['casual.playerCount'];
export const CONFIG = {
  GRID_SIZE: 1.2, MAP_BOUNDS_X: 6, GENERATION_AHEAD: 35, DESPAWN_BEHIND: 25, JUMP_DURATION: .16, JUMP_HEIGHT: .5,
  MATCH: { CASUAL_DURATION: 120, COUNTDOWN_START: 3, FILL_MS: 230, INITIAL_FILL_MS: 180, COUNTDOWN_MS: 1000, GO_DISPLAY_MS: 550 },
  RESPAWN: { DEATH_ANIMATION: .65, PENALTY: 3, INVULNERABILITY: 1 },
  CAMERA: { START_Z: -3, CHALLENGE_SCROLL_SPEED: .45, TARGET_AHEAD: 2.2, ORTHO_SIZE: 4.2, NEAR: 1, FAR: 1000, OFFSET_X: -10, OFFSET_Y: 14, OFFSET_Z: -10, PIXEL_RATIO_MAX: 2, CHALLENGE_CATCHUP_LERP: .18, CASUAL_FOLLOW_LERP: .12, CASUAL_BACK_ROWS: 15 },
  PLAYER: { MAX_HP: 100, DAMAGE_INVULNERABILITY: 2 }, TRAFFIC: { CAR_DAMAGE_BASE: 10, CAR_DAMAGE_SPEED_SCALE: 8, CAR_DAMAGE_CAP: 60, TRAIN_DAMAGE: 70 },
  BOT: { DECISION_MIN: .10, DECISION_MAX: .22, DECISION_JITTER: .03, AGGRESSION_SCALE: 1, INTERFERENCE_THRESHOLD: .46, PRESSURE_CHANCE_SCALE: .18, ITEM_SEARCH_DEPTH: 5, PATH_SEARCH_DEPTH: 10, REPAIR_WAIT_SECONDS: .7, VEHICLE_SAFETY_DISTANCE: 2.2, ACTION_RATE_BASE: .93, ACTION_RATE_AGGRESSION: .08 },
  MAP: { ROAD_SPEED_MIN: 2, ROAD_SPEED_MAX: 4.2, ROAD_SPEED_RANGE_MIN: 1.2, ROAD_SPEED_RANGE_MAX: 2.3, RIVER_SPEED_MIN: 1.5, RIVER_SPEED_MAX: 3.2, RIVER_SPEED_JITTER: 1, TRAIN_SPEED: 38, TRAIN_WARNING_SECONDS: 2 },
  ITEMS: { POOL: ['rocket', 'shield', 'eagle', 'lightning'], SLOT_COUNT: 2, ROULETTE_SECONDS: 1.1, ROULETTE_PREVIEW_RATE: 15, TRIGGER_INTERVAL: .75 },
  ROCKET: { SPEED: 10, STUN_DURATION: 1.5, IMPACT_DURATION: .72, HIT_RADIUS: .24 }, LEADER_STRIKE: { WARNING_DURATION: .8, STUN_DURATION: 1.5 },
  SHIELD: { DURATION: 10, BLOCKS: 1, FINAL_FLASH: 2, FLASH_RATE: 8 }, EAGLE: { WARNING_DURATION: 1.25, PARTY_RESPAWN_PENALTY_SECONDS: 0, CHALLENGE_TRIGGER_SECONDS: 7.5, CHALLENGE_CARRY_SECONDS: .4 },
  HOLES: { WARNING_DURATION: 1.2, HOLE_DURATION: 2.2, REPAIR_DURATION: .6, WAVE_COOLDOWN: .8, WARNING_SAFETY_BUFFER: .15, FIREBALL_HEIGHT: 5 }, BOXES: { SAFE_END_Z: 7, BATCH_MIN: 2, BATCH_MAX: 3, ROW_SPACING: 3, REGEN_SECONDS: 2 }, VFX: { FEEDBACK_SECONDS: .75, STUN_STAR_RADIUS: .35 },
  SPRING_PUNCH: { WINDUP: .30, SPEED: 7.2, RANGE: 7.2, HIT_RADIUS: .504, STUN_DURATION: 1, IMMUNITY_DURATION: 1 }, ROW_TYPES: { GRASS: 'grass', ROAD: 'road', RIVER: 'river', RAILROAD: 'railroad' },
  COLORS: { GRASS_PRIMARY: 0x5dbb63, GRASS_SECONDARY: 0x52a457, ROAD: 0x34495e, ROAD_LINE: 0xf1c40f, RIVER: 0x3498db, RAILROAD_GRAVEL: 0x7f8c8d, RAILROAD_TIE: 0x5d4037, RAILROAD_RAIL: 0xbdc3c7, CHICKEN: 0xffffff, COMB: 0xe74c3c, BEAK: 0xe67e22, TREE_TRUNK: 0x5d4037, TREE_LEAVES: [0x27ae60, 0x2ecc71, 0x1e8449], CAR_COLORS: [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c], TRUCK_CAB: 0xe67e22, TRUCK_CARGO: 0xecf0f1, WHEEL: 0x2c3e50, LOG: 0x8d6e63 }
};
export const PATHS = {
  "casual.playerCount": [
    "CASUAL_PLAYER_COUNT"
  ],
  "casual.durationSeconds": [
    "MATCH",
    "CASUAL_DURATION"
  ],
  "casual.countdownStart": [
    "MATCH",
    "COUNTDOWN_START"
  ],
  "casual.matchFillMs": [
    "MATCH",
    "FILL_MS"
  ],
  "casual.initialFillMs": [
    "MATCH",
    "INITIAL_FILL_MS"
  ],
  "casual.countdownMs": [
    "MATCH",
    "COUNTDOWN_MS"
  ],
  "casual.goDisplayMs": [
    "MATCH",
    "GO_DISPLAY_MS"
  ],
  "movement.gridSize": [
    "GRID_SIZE"
  ],
  "movement.boundsX": [
    "MAP_BOUNDS_X"
  ],
  "movement.jumpDuration": [
    "JUMP_DURATION"
  ],
  "movement.jumpHeight": [
    "JUMP_HEIGHT"
  ],
  "respawn.deathAnimationSeconds": [
    "RESPAWN",
    "DEATH_ANIMATION"
  ],
  "respawn.penaltySeconds": [
    "RESPAWN",
    "PENALTY"
  ],
  "respawn.finishInvulnerabilitySeconds": [
    "RESPAWN",
    "INVULNERABILITY"
  ],
  "camera.startZ": [
    "CAMERA",
    "START_Z"
  ],
  "camera.challengeScrollSpeed": [
    "CAMERA",
    "CHALLENGE_SCROLL_SPEED"
  ],
  "camera.targetAhead": [
    "CAMERA",
    "TARGET_AHEAD"
  ],
  "camera.orthoSize": [
    "CAMERA",
    "ORTHO_SIZE"
  ],
  "camera.near": [
    "CAMERA",
    "NEAR"
  ],
  "camera.far": [
    "CAMERA",
    "FAR"
  ],
  "camera.offsetX": [
    "CAMERA",
    "OFFSET_X"
  ],
  "camera.offsetY": [
    "CAMERA",
    "OFFSET_Y"
  ],
  "camera.offsetZ": [
    "CAMERA",
    "OFFSET_Z"
  ],
  "camera.pixelRatioMax": [
    "CAMERA",
    "PIXEL_RATIO_MAX"
  ],
  "camera.challengeCatchupLerp": [
    "CAMERA",
    "CHALLENGE_CATCHUP_LERP"
  ],
  "camera.casualFollowLerp": [
    "CAMERA",
    "CASUAL_FOLLOW_LERP"
  ],
  "camera.casualBackRows": [
    "CAMERA",
    "CASUAL_BACK_ROWS"
  ],
  "player.maxHp": [
    "PLAYER",
    "MAX_HP"
  ],
  "player.damageInvulnerabilitySeconds": [
    "PLAYER",
    "DAMAGE_INVULNERABILITY"
  ],
  "traffic.carDamageBase": [
    "TRAFFIC",
    "CAR_DAMAGE_BASE"
  ],
  "traffic.carDamageSpeedScale": [
    "TRAFFIC",
    "CAR_DAMAGE_SPEED_SCALE"
  ],
  "traffic.carDamageCap": [
    "TRAFFIC",
    "CAR_DAMAGE_CAP"
  ],
  "traffic.trainDamage": [
    "TRAFFIC",
    "TRAIN_DAMAGE"
  ],
  "bot.decisionMin": [
    "BOT",
    "DECISION_MIN"
  ],
  "bot.decisionMax": [
    "BOT",
    "DECISION_MAX"
  ],
  "bot.decisionJitter": [
    "BOT",
    "DECISION_JITTER"
  ],
  "bot.aggressionScale": [
    "BOT",
    "AGGRESSION_SCALE"
  ],
  "bot.interferenceThreshold": [
    "BOT",
    "INTERFERENCE_THRESHOLD"
  ],
  "bot.pressureChanceScale": [
    "BOT",
    "PRESSURE_CHANCE_SCALE"
  ],
  "bot.itemSearchDepth": [
    "BOT",
    "ITEM_SEARCH_DEPTH"
  ],
  "bot.pathSearchDepth": [
    "BOT",
    "PATH_SEARCH_DEPTH"
  ],
  "bot.repairWaitSeconds": [
    "BOT",
    "REPAIR_WAIT_SECONDS"
  ],
  "bot.vehicleSafetyDistance": [
    "BOT",
    "VEHICLE_SAFETY_DISTANCE"
  ],
  "bot.actionRateBase": [
    "BOT",
    "ACTION_RATE_BASE"
  ],
  "bot.actionRateAggression": [
    "BOT",
    "ACTION_RATE_AGGRESSION"
  ],
  "map.generationAhead": [
    "GENERATION_AHEAD"
  ],
  "map.despawnBehind": [
    "DESPAWN_BEHIND"
  ],
  "map.roadSpeedMin": [
    "MAP",
    "ROAD_SPEED_MIN"
  ],
  "map.roadSpeedMax": [
    "MAP",
    "ROAD_SPEED_MAX"
  ],
  "map.roadSpeedRangeMin": [
    "MAP",
    "ROAD_SPEED_RANGE_MIN"
  ],
  "map.roadSpeedRangeMax": [
    "MAP",
    "ROAD_SPEED_RANGE_MAX"
  ],
  "map.riverSpeedMin": [
    "MAP",
    "RIVER_SPEED_MIN"
  ],
  "map.riverSpeedMax": [
    "MAP",
    "RIVER_SPEED_MAX"
  ],
  "map.riverSpeedJitter": [
    "MAP",
    "RIVER_SPEED_JITTER"
  ],
  "map.trainSpeed": [
    "MAP",
    "TRAIN_SPEED"
  ],
  "map.trainWarningSeconds": [
    "MAP",
    "TRAIN_WARNING_SECONDS"
  ],
  "items.pool": [
    "ITEMS",
    "POOL"
  ],
  "items.slotCount": [
    "ITEMS",
    "SLOT_COUNT"
  ],
  "items.rouletteSeconds": [
    "ITEMS",
    "ROULETTE_SECONDS"
  ],
  "items.roulettePreviewRate": [
    "ITEMS",
    "ROULETTE_PREVIEW_RATE"
  ],
  "items.triggerInterval": [
    "ITEMS",
    "TRIGGER_INTERVAL"
  ],
  "rocket.speed": [
    "ROCKET",
    "SPEED"
  ],
  "rocket.stunSeconds": [
    "ROCKET",
    "STUN_DURATION"
  ],
  "rocket.impactSeconds": [
    "ROCKET",
    "IMPACT_DURATION"
  ],
  "rocket.hitRadius": [
    "ROCKET",
    "HIT_RADIUS"
  ],
  "lightning.warningSeconds": [
    "LEADER_STRIKE",
    "WARNING_DURATION"
  ],
  "lightning.stunSeconds": [
    "LEADER_STRIKE",
    "STUN_DURATION"
  ],
  "shield.durationSeconds": [
    "SHIELD",
    "DURATION"
  ],
  "shield.blocks": [
    "SHIELD",
    "BLOCKS"
  ],
  "shield.finalFlashSeconds": [
    "SHIELD",
    "FINAL_FLASH"
  ],
  "shield.flashRate": [
    "SHIELD",
    "FLASH_RATE"
  ],
  "eagle.warningSeconds": [
    "EAGLE",
    "WARNING_DURATION"
  ],
  "eagle.partyRespawnPenaltySeconds": [
    "EAGLE",
    "PARTY_RESPAWN_PENALTY_SECONDS"
  ],
  "eagle.challengeTriggerSeconds": [
    "EAGLE",
    "CHALLENGE_TRIGGER_SECONDS"
  ],
  "eagle.challengeCarrySeconds": [
    "EAGLE",
    "CHALLENGE_CARRY_SECONDS"
  ],
  "holes.warningSeconds": [
    "HOLES",
    "WARNING_DURATION"
  ],
  "holes.activeSeconds": [
    "HOLES",
    "HOLE_DURATION"
  ],
  "holes.repairSeconds": [
    "HOLES",
    "REPAIR_DURATION"
  ],
  "holes.intervalSeconds": [
    "HOLES",
    "WAVE_COOLDOWN"
  ],
  "holes.safetyBufferSeconds": [
    "HOLES",
    "WARNING_SAFETY_BUFFER"
  ],
  "holes.fireballHeight": [
    "HOLES",
    "FIREBALL_HEIGHT"
  ],
  "boxes.safeEndZ": [
    "BOXES",
    "SAFE_END_Z"
  ],
  "boxes.batchMin": [
    "BOXES",
    "BATCH_MIN"
  ],
  "boxes.batchMax": [
    "BOXES",
    "BATCH_MAX"
  ],
  "boxes.rowSpacing": [
    "BOXES",
    "ROW_SPACING"
  ],
  "boxes.regenSeconds": [
    "BOXES",
    "REGEN_SECONDS"
  ],
  "vfx.feedbackSeconds": [
    "VFX",
    "FEEDBACK_SECONDS"
  ],
  "vfx.stunStarRadius": [
    "VFX",
    "STUN_STAR_RADIUS"
  ]
};

function put(key, value) { const target = PATHS[key]; if (target[0] === 'CASUAL_PLAYER_COUNT') { CASUAL_PLAYER_COUNT = value; return; } let node = CONFIG; for (let index = 0; index < target.length - 1; index++) node = node[target[index]]; node[target.at(-1)] = Array.isArray(value) ? [...value] : value; }
export function resetGameConfig() { Object.entries(BASE).forEach(([key, value]) => put(key, value)); return CONFIG; }
export function parseGameConfigYaml(text) {
  const values = {}, labels = {}, errors = [];
  const lines = String(text).split(/\r?\n/);
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) { index++; continue; }
    const heading = lines[index].match(/^([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*):\s*$/i);
    if (!heading) { errors.push(`第${index + 1}行格式錯誤`); index++; continue; }
    const key = heading[1];
    if (!(key in BASE)) errors.push(`第${index + 1}行未知鍵 ${key}`);
    else if (Object.hasOwn(values, key)) errors.push(`第${index + 1}行重複鍵 ${key}`);
    const fields = {};
    for (let fieldIndex = 0; fieldIndex < 2; fieldIndex++) {
      index++;
      const field = lines[index]?.match(/^  (value|label):\s*(\S(?:.*\S)?)\s*$/);
      if (!field) { errors.push(`第${index + 1}行缺少 value 或 label`); continue; }
      if (Object.hasOwn(fields, field[1])) errors.push(`第${index + 1}行重複欄位 ${field[1]}`);
      else fields[field[1]] = field[2];
    }
    if (!Object.hasOwn(fields, 'value') || !Object.hasOwn(fields, 'label')) {
      errors.push(`第${index + 1}行 ${key} 必須同時有 value 與 label`);
    } else if (key in BASE) {
      const value = Array.isArray(BASE[key]) ? fields.value.split(',').map(item => item.trim()).filter(Boolean) : Number(fields.value);
      if (Array.isArray(BASE[key]) ? !value.length : !Number.isFinite(value)) errors.push(`${key} 的 value 無效`);
      else { values[key] = value; labels[key] = fields.label; }
    }
    index++;
  }
  if (Object.keys(values).length !== Object.keys(BASE).length) errors.push('設定鍵數量不完整');
  return { values, labels, errors };
}
const positive = new Set(['casual.durationSeconds','casual.matchFillMs','casual.initialFillMs','casual.countdownMs','movement.gridSize','movement.boundsX','movement.jumpHeight','traffic.carDamageBase','traffic.carDamageSpeedScale','traffic.carDamageCap','traffic.trainDamage','bot.decisionMin','bot.decisionMax','bot.aggressionScale','bot.interferenceThreshold','bot.pressureChanceScale','bot.itemSearchDepth','bot.pathSearchDepth','bot.repairWaitSeconds','bot.vehicleSafetyDistance','map.roadSpeedMin','map.roadSpeedMax','map.roadSpeedRangeMin','map.roadSpeedRangeMax','map.riverSpeedMin','map.riverSpeedMax','map.riverSpeedJitter','holes.fireballHeight','boxes.batchMin','boxes.batchMax','boxes.safeEndZ','movement.gridSize','movement.jumpDuration','respawn.deathAnimationSeconds','respawn.penaltySeconds','respawn.finishInvulnerabilitySeconds','camera.challengeScrollSpeed','camera.orthoSize','camera.near','camera.far','camera.pixelRatioMax','player.maxHp','player.damageInvulnerabilitySeconds','map.generationAhead','map.despawnBehind','map.trainSpeed','map.trainWarningSeconds','items.rouletteSeconds','items.roulettePreviewRate','items.triggerInterval','rocket.speed','rocket.stunSeconds','rocket.impactSeconds','rocket.hitRadius','lightning.warningSeconds','lightning.stunSeconds','shield.durationSeconds','shield.finalFlashSeconds','shield.flashRate','eagle.warningSeconds','eagle.challengeTriggerSeconds','eagle.challengeCarrySeconds','holes.warningSeconds','holes.activeSeconds','holes.repairSeconds','holes.intervalSeconds','boxes.rowSpacing','boxes.regenSeconds','vfx.feedbackSeconds','vfx.stunStarRadius']);
const signed = new Set(['camera.offsetX','camera.offsetY','camera.offsetZ','camera.startZ','camera.targetAhead']);
const integers = new Set(['casual.playerCount','casual.countdownStart','casual.matchFillMs','casual.initialFillMs','casual.countdownMs','casual.goDisplayMs','items.slotCount','items.roulettePreviewRate','shield.blocks','boxes.safeEndZ','boxes.batchMin','boxes.batchMax','boxes.rowSpacing']);
export function applyGameConfig(values) { const errors = []; for (const [key, value] of Object.entries(values || {})) { if (!(key in BASE)) errors.push(`未知鍵 ${key}`); else if (Array.isArray(BASE[key]) ? !Array.isArray(value) || !value.length : typeof value !== 'number' || !Number.isFinite(value)) errors.push(`鍵 ${key} 的值無效`); else if (!Array.isArray(value) && !signed.has(key) && value < 0) errors.push(`鍵 ${key} 不可小於 0`); else if (positive.has(key) && value <= 0) errors.push(`鍵 ${key} 必須大於 0`); else if (integers.has(key) && !Number.isInteger(value)) errors.push(`鍵 ${key} 必須為整數`); }
  const value = (key) => values?.[key] ?? BASE[key];
  if (value('casual.playerCount') < 2 || value('casual.playerCount') > 5) errors.push('casual.playerCount 必須為 2 至 5');
  if (value('items.slotCount') < 1 || value('items.slotCount') > 2) errors.push('items.slotCount 必須為 1 或 2');
  if (value('shield.blocks') < 1) errors.push('shield.blocks 必須大於 0');
  if (value('boxes.batchMin') < 1 || value('boxes.batchMin') > value('boxes.batchMax')) errors.push('boxes batch 範圍無效');
  if (value('bot.decisionMin') > value('bot.decisionMax')) errors.push('bot decision 範圍無效');
  if (value('camera.near') >= value('camera.far')) errors.push('camera near/far 範圍無效');
  if (value('map.roadSpeedMin') > value('map.roadSpeedMax') || value('map.roadSpeedRangeMin') > value('map.roadSpeedRangeMax') || value('map.riverSpeedMin') > value('map.riverSpeedMax')) errors.push('map speed 範圍無效');
  if (values?.['items.pool']) { const allowed = new Set(['rocket','shield','eagle','lightning']); if (new Set(values['items.pool']).size !== values['items.pool'].length || values['items.pool'].some(item => !allowed.has(item))) errors.push('items.pool 必須為不重複的既定道具'); }
  if (errors.length) return { ok: false, errors, config: CONFIG }; Object.entries(values).forEach(([key, value]) => put(key, value)); return { ok: true, errors: [], config: CONFIG }; }
export async function loadGameConfig(url = './docs/game-config.yaml', fetchImpl = globalThis.fetch) { resetGameConfig(); if (typeof fetchImpl !== 'function') return { ok: false, source: 'defaults', errors: ['fetch 不可用'], labels: {}, config: CONFIG }; try { const response = await fetchImpl(url); if (!response?.ok) throw new Error(`HTTP ${response?.status ?? 'error'}`); const parsed = parseGameConfigYaml(await response.text()); if (parsed.errors.length) return { ok: false, source: 'defaults', errors: parsed.errors, labels: {}, config: CONFIG }; const applied = applyGameConfig(parsed.values); return { ...applied, source: applied.ok ? 'yaml' : 'defaults', labels: applied.ok ? parsed.labels : {} }; } catch (error) { return { ok: false, source: 'defaults', errors: [error.message], labels: {}, config: CONFIG }; } }
