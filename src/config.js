import * as THREE from 'three';

export const CONFIG = {
  GRID_SIZE: 1.2,
  MAP_BOUNDS_X: 8, // 可移動的 X 軸邊界範圍 (-8 ~ +8，共 17 格)
  INITIAL_SAFE_ROWS: 6, // 遊戲開始時的初始安全草地列數
  GENERATION_AHEAD: 25, // 玩家前方維持動態生成的列數
  DESPAWN_BEHIND: 12, // 玩家後方回收刪除的列數

  // 路段類型定義
  ROW_TYPES: {
    GRASS: 'GRASS',
    ROAD: 'ROAD',
    RIVER: 'RIVER',
    RAILROAD: 'RAILROAD'
  },

  // 主題色彩設定 (體素風格)
  COLORS: {
    GRASS_PRIMARY: 0x7ec850,
    GRASS_SECONDARY: 0x73bd45,
    ROAD: 0x3d3d45,
    ROAD_LINE: 0xf1c40f,
    RIVER: 0x3498db,
    RIVER_FOAM: 0x7ecef4,
    RAILROAD_GRAVEL: 0x5a5a60,
    RAILROAD_RAIL: 0xb0b0b8,
    RAILROAD_TIE: 0x6e4726,
    TREE_LEAVES: [0x27ae60, 0x2ecc71, 0x1e8449],
    TREE_TRUNK: 0x795548,
    CAR_COLORS: [0xe74c3c, 0x9b59b6, 0x34495e, 0xe67e22, 0x16a085],
    TRUCK_COLORS: [0x2980b9, 0xd35400, 0x27ae60],
    LOG: 0x8d5524,
    LOG_END: 0xa06735,
    TRAIN: 0xd32f2f,
    SIGNAL_OFF: 0x222222,
    SIGNAL_RED: 0xff1744
  },

  // 玩家跳躍與物理參數
  PLAYER: {
    JUMP_DURATION: 0.18, // 單次網格跳躍動畫時間 (秒)
    JUMP_HEIGHT: 0.65, // 跳躍弧形最高高度
    COLLISION_RADIUS: 0.35 // 玩家碰撞檢測半徑
  },

  // 障礙物與載面速度設定
  OBSTACLES: {
    CAR: {
      SPEED_MIN: 3.0,
      SPEED_MAX: 6.0,
      WIDTH: 1.6,
      DEPTH: 1.0
    },
    TRUCK: {
      SPEED_MIN: 2.2,
      SPEED_MAX: 4.2,
      WIDTH: 2.8,
      DEPTH: 1.1
    },
    LOG: {
      SPEED_MIN: 2.0,
      SPEED_MAX: 4.5,
      MIN_LENGTH: 2,
      MAX_LENGTH: 4
    },
    TRAIN: {
      SPEED: 32.0, // 高速通過速度
      WARNING_TIME: 1.5, // 火車抵達前號誌燈閃爍預警時間 (秒)
      INTERVAL_MIN: 5.0,
      INTERVAL_MAX: 10.0,
      LENGTH: 22.0
    }
  }
};
