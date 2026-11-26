// Sky Courier: Island Run — configuration.
// One clear job: every tunable number of the game lives here, so a balance
// change never touches the flight model, the world or the HUD.
export const CONFIG = {
  worldSeed: 7,
  worldSize: 4000, // ocean plane spans -2000..2000 on x and z
  islandRadius: 820,
  secondIsland: { x: 1250, z: -650, radius: 430 },
  maxTerrainHeight: 85,
  seaLevel: 0,

  // Runway: a flattened strip on the main island, along the x axis.
  runway: { x: -80, z: 330, length: 320, width: 26, height: 4.5 },

  plane: {
    maxSpeed: 115, // m/s at full throttle
    minSpeed: 18, // m/s at idle
    stallSpeed: 34, // below this the nose drops and lift fades
    climbRate: 0.55, // how strongly pitch converts speed into climb
    turnRate: 0.55, // heading change per second at full bank
    maxRoll: 1.05, // radians, about 60 degrees
    maxPitch: 0.55, // radians, about 31 degrees
    throttleRate: 0.45, // throttle change per second
    accelRate: 14, // m/s^2 towards the throttle's target speed
    crashSpeed: 26, // hitting ground faster than this is a crash
    safeLandingSpeed: 48, // landing below this on the runway is safe
  },

  rings: {
    count: 8,
    radius: 19,
    score: 100,
    courseBonus: 500,
  },

  fuel: {
    start: 100,
    drainPerSecond: 0.55, // base drain
    drainPerThrottle: 1.15, // extra drain at full throttle
    lowWarning: 25,
  },

  sortie: {
    durationSeconds: 300,
    lives: 3,
    landingScore: 50,
  },

  camera: {
    chaseDistance: 24,
    chaseHeight: 4.5,
    minDistance: 9,
    maxDistance: 30,
  },
};

// The ring course: hand-placed gates over recognisable landmarks so the
// pilot always has something to aim at — the runway, the peak, the bay,
// the second island and back home.
export const RING_COURSE = [
  { x: 120, y: 70, z: -80, label: 'Harbour Gate' },
  { x: 420, y: 95, z: -380, label: 'Peak Gate' },
  { x: 760, y: 80, z: -120, label: 'East Cliff Gate' },
  { x: 980, y: 70, z: -560, label: 'Twin Island Gate' },
  { x: 1250, y: 90, z: -650, label: 'Palm Gate' },
  { x: 620, y: 110, z: 620, label: 'South Bay Gate' },
  { x: 120, y: 60, z: 520, label: 'Runway Gate' },
  { x: -80, y: 55, z: 330, label: 'Home Gate' },
];
