export const FIELD = { width: 1280, height: 720 }; export const STEP = 1 / 60;
export const DIFFICULTIES = {
  easy: { name: 'Easy', desc: 'Relaxed — a cosy evening', hp: 0.8, speed: 0.9, coins: 200, lives: 12, interest: 0.12, build: 18 },
  normal: { name: 'Normal', desc: 'The garden as intended', hp: 1, speed: 1, coins: 150, lives: 10, interest: 0.1, build: 15 },
  hard: { name: 'Hard', desc: 'The bugs are hungry', hp: 1.25, speed: 1.08, coins: 120, lives: 8, interest: 0.08, build: 12 },
}; export const START_COINS = 150;
export const START_LIVES = 10; export const MAX_WAVE = 10;
export const BUILD_SECONDS = 15; export const SELL_REFUND = 0.7;
export const INTEREST_RATE = 0.1; export const INTEREST_CAP = 30;
export const BEST_KEY = 'mochi-lantern-garden.best';
export const LIGHT = { radius: 150, rangeBonus: 0.25, damageBonus: 0.25 };
export const POST_LEVELS = [
  { radius: 150, rangeBonus: 0.25, damageBonus: 0.25 },
  { radius: 170, rangeBonus: 0.35, damageBonus: 0.35 },
  { radius: 190, rangeBonus: 0.5, damageBonus: 0.5 },
]; export const POST_UPGRADE_COST = [25, 50];
export const MAX_POST_LEVEL = 3;
export const MUTATORS = {
  none: { name: 'Calm Night', short: 'Calm', icon: '🌙', desc: 'No twist tonight' },
  fog: { name: 'Thick Fog', short: 'Fog', icon: '🌫', desc: 'Towers see 15% less far; moths fly slower' },
  speedy: { name: 'Speedy Bugs', short: 'Speedy', icon: '💨', desc: 'Bugs 25% faster, +2 coins each' },
  armored: { name: 'Armored Swarm', short: 'Armored', icon: '🛡', desc: 'Bugs +3 armour, +3 coins each' },
  bounty: { name: 'Bountiful Night', short: 'Bounty', icon: '✨', desc: 'Bugs +50% reward, +15% health' },
}; export const MUTATOR_KEYS = ['fog', 'speedy', 'armored', 'bounty'];
export const POOL = { enemies: 128, projectiles: 160, particles: 256, texts: 64 };
export const ABILITIES = {
  flare: { key: 'flare', name: 'Flare Burst', hotkey: 'Q', icon: '✦', cd: 25, desc: 'A burst of lantern light around the big lantern: 120 damage + slow' },
  surge: { key: 'surge', name: 'Lantern Surge', hotkey: 'E', icon: '☀', cd: 30, desc: 'Every tower +50% damage for 6s — the garden blazes' },
  purr: { key: 'purr', name: 'Purr Wave', hotkey: 'R', icon: '♪', cd: 20, desc: 'Sleepy Guard purrs across the garden: all bugs slowed 50% for 4s' },
}; export const ABILITY_ORDER = ['flare', 'surge', 'purr'];
export const FLARE_DAMAGE = 120; export const FLARE_RADIUS = 230;
export const FLARE_SLOW = 0.5; export const FLARE_SLOW_DUR = 3;
export const SURGE_BONUS = 0.5; export const SURGE_DUR = 6;
export const PURR_SLOW = 0.5; export const PURR_DUR = 4;
export const TARGET_MODES = ['first', 'strongest', 'weakest', 'closest', 'last'];
export const TARGET_LABELS = {
  first: 'First', strongest: 'Strongest', weakest: 'Weakest', closest: 'Closest', last: 'Last',
}; export const EARLY_CALL_PER_SEC = 1;
export const EARLY_CALL_CAP = 10; export const BOSS_COUNTDOWN = 5;
export const PALETTE = {
  backdrop: '#0b0c1a',
  skyTop: '#0b0c1a',
  skyBottom: '#241c44',
  moon: '#ffe9b0',
  star: '#fff6d8',
  grass: '#2a5240',
  grassDark: '#1d3d2e',
  grassLight: '#3f7a56',
  flower: '#f2a7c3',
  flower2: '#ffd166',
  path: '#d9c48f',
  pathEdge: '#a8895f',
  plot: '#2f5d43',
  plotEdge: '#1d3d2e',
  panel: 'rgba(16, 14, 32, 0.92)',
  panelEdge: '#6b5a8e',
  text: '#fff6e8',
  muted: '#c9b8e8',
  gold: '#ffd166',
  heart: '#ff6b81',
  shadow: '#3a2b4a',
  shadowEye: '#ff5a6e',
  boss: '#2c1f3d',
}; export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const LAYOUT = {
  topBar: { x: 0, y: 0, width: 1280, height: 56 },
  shopBar: { x: 0, y: 628, width: 1280, height: 92 },
  play: { x: 0, y: 56, width: 1280, height: 572 },
  cardWidth: 148,
  cardHeight: 76,
  cardGap: 8,
};
