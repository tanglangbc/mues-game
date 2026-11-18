// Every tuning number and colour in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends
// on the screen size.

export const FIELD = { width: 1280, height: 720, margin: 48 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** How many waves of pearls before the Crown Pearl appears. */
export const FINAL_WAVE = 6;

export const PLAYER = {
  radius: 18,
  speed: 340,
  dashSpeed: 920,
  dashTime: 0.18,
  dashCooldown: 1.2,
  invulnerable: 1.6,
};

export const LIVES = 3;

export const PEARL = {
  radius: 13,
  lifetime: 11,
  basePoints: 10,
  /** The combo multiplier caps at 8, so one long chain cannot run away. */
  maxCombo: 8,
  /** Pearls in a wave: 4 + wave, so wave 1 has 5 and wave 6 has 10. */
  perWave: 4,
};

export const WISP = {
  radius: 20,
  baseSpeed: 64,
  speedPerWave: 11,
  maxCount: 7,
  /** A wisp that touches the player knocks it this far away. */
  knockback: 260,
};

export const WAVE_BONUS = 50;

/** Seconds the wave banner shows between waves. */
export const BANNER_SECONDS = 1.6;

export const PALETTE = {
  backdrop: '#070a1c',
  waterTop: '#0e1a3d',
  waterBottom: '#0a2e3f',
  reef: '#123a4d',
  sand: '#1b3a4a',
  player: '#ffb347',
  playerCore: '#fff3c4',
  pearl: '#ffd166',
  pearlRing: '#ffe9a8',
  crown: '#ffdf5e',
  wisp: '#7c5cff',
  wispEye: '#e6e0ff',
  danger: '#ff5d73',
  heart: '#ff6b81',
  panel: '#101736',
  panelEdge: '#2c3a6e',
  text: '#f4f1ff',
  muted: '#aab3d6',
  accent: '#5eead4',
  gold: '#ffd166',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'glowkeep.best';
