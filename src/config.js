// Central tunables. Gameplay values here are game-design numbers, not real-world measurements.

export const CONFIG = {
  mapUrl: 'data/onitsha_core.json',

  player: {
    radius: 0.32,
    walkSpeed: 1.75,      // m/s
    runSpeed: 5.4,        // m/s
    accel: 10,
    turnRate: 12,
    jumpVelocity: 4.6,
    gravity: 14,
  },

  camera: {
    distance: 4.6,
    minDistance: 1.8,
    maxDistance: 9,
    height: 1.55,         // look-at height above feet
    fov: 60,
    sensitivity: 0.0026,
    touchSensitivity: 0.0055,
    minPitch: -0.45,
    maxPitch: 1.05,
  },

  clock: {
    startMinutes: 9 * 60,   // 09:00
    minutesPerSecond: 1,    // 1 real second = 1 in-game minute → 24-minute day
  },

  world: {
    floorHeight: 3.1,
    shopFloorHeight: 3.5,
    shadowRange: 70,
  },

  quality: {
    low:    { pixelRatio: 1.75, shadows: false, shadowMap: 1024, drawDistance: 260, props: 0.5 }, // v0.54.3: sharp on phones (was 1: blurry)
    medium: { pixelRatio: 1.5, shadows: true,  shadowMap: 2048, drawDistance: 420, props: 1 },
    high:   { pixelRatio: 2,   shadows: true,  shadowMap: 4096, drawDistance: 700, props: 1 },
  },
};

// OSM name fixes for DISPLAY only — the map data keeps the original OSM spelling.
export const ROAD_DISPLAY_NAMES = {
  'Bright Streer': 'Bright Street',
};
