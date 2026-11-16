// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// Mochi's Lantern Garden: a cute tower defense. Shadow bugs walk a winding garden path
// toward the big paper lantern; cat towers on the plots beside it stop them.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The three difficulties, picked on the title screen (Easy, Normal or Hard). */
export const DIFFICULTIES = {
  easy: { name: 'Easy', desc: 'Relaxed — a cosy evening', hp: 0.8, speed: 0.9, coins: 200, lives: 12, interest: 0.12, build: 18 },
  normal: { name: 'Normal', desc: 'The garden as intended', hp: 1, speed: 1, coins: 150, lives: 10, interest: 0.1, build: 15 },
  hard: { name: 'Hard', desc: 'The bugs are hungry', hp: 1.25, speed: 1.08, coins: 120, lives: 8, interest: 0.08, build: 12 },
};

export const START_COINS = 150;
export const START_LIVES = 10;
export const MAX_WAVE = 10;
export const BUILD_SECONDS = 15;
export const SELL_REFUND = 0.7;
export const INTEREST_RATE = 0.1;
export const INTEREST_CAP = 30;

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'mochi-lantern-garden.best';

/** Lantern-light bonus for towers standing inside a lantern's glow, per post level. */
export const LIGHT = { radius: 150, rangeBonus: 0.25, damageBonus: 0.25 };
export const POST_LEVELS = [
  { radius: 150, rangeBonus: 0.25, damageBonus: 0.25 },
  { radius: 170, rangeBonus: 0.35, damageBonus: 0.35 },
  { radius: 190, rangeBonus: 0.5, damageBonus: 0.5 },
];
export const POST_UPGRADE_COST = [25, 50];
export const MAX_POST_LEVEL = 3;

/** One twist per wave from wave 6 on (and every Long Night wave), picked by wave number. */
export const MUTATORS = {
  none: { name: 'Calm Night', short: 'Calm', icon: '🌙', desc: 'No twist tonight' },
  fog: { name: 'Thick Fog', short: 'Fog', icon: '🌫', desc: 'Towers see 15% less far; moths fly slower' },
  speedy: { name: 'Speedy Bugs', short: 'Speedy', icon: '💨', desc: 'Bugs 25% faster, +2 coins each' },
  armored: { name: 'Armored Swarm', short: 'Armored', icon: '🛡', desc: 'Bugs +3 armour, +3 coins each' },
  bounty: { name: 'Bountiful Night', short: 'Bounty', icon: '✨', desc: 'Bugs +50% reward, +15% health' },
};
export const MUTATOR_KEYS = ['fog', 'speedy', 'armored', 'bounty'];

/** How many enemies, projectiles and particles can exist at once; pools are allocated once. */
export const POOL = { enemies: 128, projectiles: 160, particles: 256, texts: 48 };

export const PALETTE = {
  backdrop: '#1c1830',
  skyTop: '#2b2440',
  skyBottom: '#4a3560',
  moon: '#ffe9b0',
  star: '#fff6d8',
  grass: '#5da273',
  grassDark: '#4d8f63',
  grassLight: '#79b984',
  flower: '#f2a7c3',
  flower2: '#ffd166',
  path: '#e8d5a8',
  pathEdge: '#c9ae7d',
  plot: '#6b9e75',
  plotEdge: '#4a7c59',
  panel: 'rgba(28, 24, 48, 0.88)',
  panelEdge: '#6b5a8e',
  text: '#fff6e8',
  muted: '#c9b8e8',
  gold: '#ffd166',
  heart: '#ff6b81',
  shadow: '#3a2b4a',
  shadowEye: '#ff5a6e',
  boss: '#2c1f3d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Layout of the HUD: top bar, bottom shop bar, and the play area between them. */
export const LAYOUT = {
  topBar: { x: 0, y: 0, width: 1280, height: 56 },
  shopBar: { x: 0, y: 628, width: 1280, height: 92 },
  play: { x: 0, y: 56, width: 1280, height: 572 },
  cardWidth: 148,
  cardHeight: 76,
  cardGap: 8,
};
