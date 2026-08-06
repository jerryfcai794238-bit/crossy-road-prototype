export const CONFIG = {
  GRID_SIZE: 1.2,
  MAP_BOUNDS_X: 6,       // 可移動範圍 -6 ~ +6
  GENERATION_AHEAD: 35,  // 前方預先生成網格數
  DESPAWN_BEHIND: 25,    // 身後保留網格數

  JUMP_DURATION: 0.16,   // 跳躍時間 (秒)
  JUMP_HEIGHT: 0.5,      // 跳躍高度

  ROW_TYPES: {
    GRASS: 'grass',
    ROAD: 'road',
    RIVER: 'river',
    RAILROAD: 'railroad'
  },

  COLORS: {
    GRASS_PRIMARY: 0x5dbb63,
    GRASS_SECONDARY: 0x52a457,
    ROAD: 0x34495e,
    ROAD_LINE: 0xf1c40f,
    RIVER: 0x3498db,
    RAILROAD_GRAVEL: 0x7f8c8d,
    RAILROAD_TIE: 0x5d4037,
    RAILROAD_RAIL: 0xbdc3c7,

    CHICKEN: 0xffffff,
    COMB: 0xe74c3c,
    BEAK: 0xe67e22,

    TREE_TRUNK: 0x5d4037,
    TREE_LEAVES: [0x27ae60, 0x2ecc71, 0x1e8449],

    CAR_COLORS: [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c],
    TRUCK_CAB: 0xe67e22,
    TRUCK_CARGO: 0xecf0f1,
    WHEEL: 0x2c3e50,
    LOG: 0x8d6e63
  }
};
