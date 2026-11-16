// The game's rules and state, with no drawing and no browser in it: coins, lives and
// score, the build phase and the waves, tower placement and upgrades, enemies marching
// the path, and the lantern light that dims as lives are lost. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react — sounds,
// announcements — without the world knowing about screens or sound. Nothing here
// allocates after createWorld returns, except the small reused event lists.
//
// Three difficulties (Easy, Normal, Hard) scale the bugs and the starting purse.
// After wave 10 the garden is won — and the Long Night begins, an endless stream
// with a twist (a mutator) on every night from wave 6 on and a Moth Queen every
// fifth night. Lantern posts can be upgraded to widen their glow and deepen its bonus.
import { BUILD_SECONDS, DIFFICULTIES, MAX_POST_LEVEL, MAX_WAVE, MUTATORS, POST_UPGRADE_COST, START_COINS, START_LIVES } from './config.js';
import { buildDecor, buildPlots, distanceToPath, glowBonusAt, LANTERN, LANTERN_POSTS } from './garden.js';
import { createTowers, TOWER_TYPES, upgradeCost } from './towers.js';
import { createEnemies } from './enemies.js';
import { mutatorForWave, SPAWN_INTERVAL, wavePreview, waveQueue } from './waves.js';
import { interest, sellValue, waveClearBonus } from './economy.js';
import { createEffects } from './effects.js';

export const PHASE_BUILD = 'build';
export const PHASE_WAVE = 'wave';
export const PHASE_WON = 'won';
export const PHASE_LOST = 'lost';

export const EVENT_KILL = 1;
export const EVENT_LEAK = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_PLACE = 32;
export const EVENT_UPGRADE = 64;
export const EVENT_SELL = 128;
export const EVENT_BOSS = 256;
export const EVENT_MUTATOR = 512;
export const EVENT_BOSS_PHASE = 1024;
export const EVENT_POST = 2048;

/** The night's mutator as the sim's multipliers (0-effect entries omitted). */
export function mutatorMods(key) {
  switch (key) {
    case 'fog': return { range: 0.85, mothSpeed: 0.8 };
    case 'speedy': return { speed: 1.25, rewardBonus: 2 };
    case 'armored': return { armor: 3, rewardBonus: 3 };
    case 'bounty': return { hp: 1.15, rewardMul: 1.5 };
    default: return {};
  }
}

export function createWorld(random) {
  const plots = buildPlots();
  const decor = buildDecor(random);
  const fx = createEffects(random);
  const state = {
    coins: START_COINS,
    lives: START_LIVES,
    maxLives: START_LIVES,
    score: 0,
    wave: 1,
    phase: PHASE_BUILD,
    buildTimer: BUILD_SECONDS,
    spawnQueue: [],
    spawnTimer: 0,
    elapsed: 0,
    kills: 0,
    leaked: 0,
    earned: 0,
    selected: null,
    selectedPost: null,
    placing: null,
    hoverPlot: -1,
    hoverTower: null,
    message: '',
    messageTimer: 0,
    bossSpawned: false,
    difficulty: 'normal',
    endless: false,
    mutator: 'none',
    postLevels: [1, 1, 1, 1],
  };
  const glowAt = (x, y) => glowBonusAt(x, y, state.postLevels);
  const towers = createTowers(random, fx, glowAt);
  const enemies = createEnemies(random);

  function reset() {
    for (const plot of plots) plot.tower = null;
    for (const tower of towers.towers) tower.active = false;
    for (const enemy of enemies.list) enemy.active = false;
    for (const proj of towers.projectiles) proj.active = false;
    const diff = DIFFICULTIES[state.difficulty];
    state.coins = diff.coins;
    state.lives = diff.lives;
    state.maxLives = diff.lives;
    state.score = 0;
    state.wave = 1;
    state.phase = PHASE_BUILD;
    state.buildTimer = diff.build;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.elapsed = 0;
    state.kills = 0;
    state.leaked = 0;
    state.earned = 0;
    state.selected = null;
    state.selectedPost = null;
    state.placing = null;
    state.hoverPlot = -1;
    state.hoverTower = null;
    state.message = '';
    state.messageTimer = 0;
    state.bossSpawned = false;
    state.endless = false;
    state.mutator = 'none';
    state.postLevels = [1, 1, 1, 1];
    // Mochi, the hero cat, is already on the field: the best-covered plot she can
    // actually swat from (her range is short, so the plot must hug the path).
    const mochiRange = TOWER_TYPES.mochi.range;
    let mochiPlot = null;
    for (const plot of plots) {
      if (distanceToPath(plot.x, plot.y) > mochiRange) continue;
      if (mochiPlot === null || plot.coverage > mochiPlot.coverage) mochiPlot = plot;
    }
    if (mochiPlot === null) mochiPlot = plots[0];
    const mochi = towers.place('mochi', mochiPlot.x, mochiPlot.y, 0);
    mochiPlot.tower = mochi;
  }

  /** Pick a difficulty (title screen); it applies at the next reset. */
  function setDifficulty(key) {
    if (DIFFICULTIES[key] === undefined) return;
    state.difficulty = key;
  }

  function lightLevel() {
    return state.lives / state.maxLives;
  }

  /** The label for the wave counter: "Wave 5/10", or "Night 3" in the Long Night. */
  function waveLabel() {
    if (state.endless) return `Night ${state.wave - MAX_WAVE}`;
    return `Wave ${Math.min(state.wave, MAX_WAVE)}/${MAX_WAVE}`;
  }

  function startWave() {
    if (state.phase !== PHASE_BUILD) return false;
    state.spawnQueue = waveQueue(state.wave);
    state.spawnTimer = 0.5;
    state.phase = PHASE_WAVE;
    state.bossSpawned = false;
    state.mutator = mutatorForWave(state.wave);
    const mut = MUTATORS[state.mutator];
    const label = state.endless ? `Night ${state.wave - MAX_WAVE}` : `Wave ${state.wave}`;
    state.message = state.mutator === 'none'
      ? `${label} — ${wavePreview(state.wave)}`
      : `${label} — ${wavePreview(state.wave)} · ${mut.icon} ${mut.name}`;
    state.messageTimer = 3;
    return true;
  }

  /** Enter the Long Night after the campaign win: endless waves, nights counted. */
  function startEndless() {
    state.endless = true;
    state.wave = MAX_WAVE + 1;
    state.phase = PHASE_BUILD;
    state.buildTimer = DIFFICULTIES[state.difficulty].build;
    state.message = 'The Long Night begins — how many nights can the cats hold?';
    state.messageTimer = 4;
    return true;
  }

  function placeTower(plotIndex, type) {
    const plot = plots[plotIndex];
    const def = TOWER_TYPES[type];
    if (plot === undefined || plot.tower !== null || def === undefined) return 0;
    if (type === 'mochi') return 0;
    if (state.coins < def.cost) return 0;
    state.coins -= def.cost;
    const tower = towers.place(type, plot.x, plot.y, def.cost);
    if (tower === null) {
      state.coins += def.cost;
      return 0;
    }
    plot.tower = tower;
    fx.spawnBurst(plot.x, plot.y, '#ffd166', 10, 80, 0.5, 3);
    return EVENT_PLACE;
  }

  function upgradeTower(tower) {
    if (tower === null || !tower.active) return 0;
    const cost = upgradeCost(tower.type, tower.level);
    if (cost === null || state.coins < cost) return 0;
    state.coins -= cost;
    tower.level += 1;
    tower.invested += cost;
    fx.spawnBurst(tower.x, tower.y - 10, '#ffd166', 12, 90, 0.5, 3);
    fx.spawnText(tower.x, tower.y - 34, 'LEVEL UP!', '#ffd166');
    return EVENT_UPGRADE;
  }

  function sellTower(tower) {
    if (tower === null || !tower.active) return 0;
    if (tower.type === 'mochi') return 0;
    const refund = sellValue(tower.invested);
    state.coins += refund;
    for (const plot of plots) {
      if (plot.tower === tower) plot.tower = null;
    }
    if (state.selected === tower) state.selected = null;
    towers.remove(tower);
    fx.spawnText(tower.x, tower.y - 30, `+${refund}`, '#ffd166');
    return EVENT_SELL;
  }

  /** Raise a lantern post's level: a wider glow and a deeper bonus for every tower in it. */
  function upgradePost(index) {
    const level = state.postLevels[index];
    if (level === undefined || level >= MAX_POST_LEVEL) return 0;
    const cost = POST_UPGRADE_COST[level - 1];
    if (state.coins < cost) return 0;
    state.coins -= cost;
    state.postLevels[index] = level + 1;
    const post = LANTERN_POSTS[index];
    for (const tower of towers.towers) {
      if (!tower.active) continue;
      tower.glowBonus = glowAt(tower.x, tower.y);
      tower.glow = tower.glowBonus > 0;
    }
    fx.spawnBurst(post.x, post.y - 18, '#ffd166', 14, 100, 0.6, 3);
    fx.spawnText(post.x, post.y - 44, `Lantern Lv ${level + 1}!`, '#ffd166');
    return EVENT_POST;
  }

  function clearWave() {
    const bonus = waveClearBonus(state.wave);
    const extra = interest(state.coins, DIFFICULTIES[state.difficulty].interest);
    state.coins += bonus + extra;
    state.earned += bonus + extra;
    state.score += bonus * 5;
    fx.spawnText(LANTERN.x - 40, LANTERN.y - 50, `Wave clear! +${bonus + extra}`, '#ffd166');
    if (state.wave >= MAX_WAVE && !state.endless) {
      state.phase = PHASE_WON;
      return EVENT_WAVE_CLEAR | EVENT_WIN;
    }
    state.wave += 1;
    state.phase = PHASE_BUILD;
    state.buildTimer = DIFFICULTIES[state.difficulty].build;
    const label = state.endless ? `Night ${state.wave - MAX_WAVE}` : `Wave ${state.wave}`;
    state.message = `${label} coming — ${wavePreview(state.wave)}`;
    state.messageTimer = 3;
    return EVENT_WAVE_CLEAR;
  }

  /**
   * One fixed step. With `harmless` set (the title screen's backdrop) bugs march and
   * towers shoot, but nothing leaks, scores or ends the game.
   */
  function step(dt, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer = Math.max(0, state.messageTimer - dt);
    fx.update(dt);

    if (state.phase === PHASE_BUILD) {
      state.buildTimer -= dt;
      if (state.buildTimer <= 0) startWave();
    }

    if (state.phase === PHASE_WAVE) {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          const type = state.spawnQueue.shift();
          const enemy = enemies.spawn(type, state.wave, DIFFICULTIES[state.difficulty], mutatorMods(state.mutator));
          if (enemy !== null && type === 'boss') {
            state.bossSpawned = true;
            events |= EVENT_BOSS;
            fx.addTrauma(0.6);
          }
          state.spawnTimer += SPAWN_INTERVAL[type] ?? 0.85;
        }
      }
      const leaked = enemies.update(dt, state.elapsed, state.wave, DIFFICULTIES[state.difficulty], mutatorMods(state.mutator));
      for (let i = 0; i < enemies.phaseEvents.length; i += 1) {
        const { phase } = enemies.phaseEvents[i];
        events |= EVENT_BOSS_PHASE;
        state.message = phase === 3
          ? 'The Shadow Moth takes flight! Only fish tossers, star gazers and veteran cats can reach it!'
          : 'The Shadow Moth grows angry — it moves faster and sheds more bugs!';
        state.messageTimer = 3;
        fx.addTrauma(0.7);
      }
      for (let i = 0; i < leaked.length; i += 1) {
        const enemy = leaked[i];
        if (harmless) continue;
        state.lives -= enemy.lives;
        state.leaked += 1;
        events |= EVENT_LEAK;
        fx.addTrauma(enemy.type === 'boss' ? 0.8 : 0.35);
        fx.spawnBurst(LANTERN.x, LANTERN.y, '#ff6b81', 14, 110, 0.5, 3);
        if (state.lives <= 0) {
          state.lives = 0;
          state.phase = PHASE_LOST;
          events |= EVENT_OVER;
        }
      }
      const killed = towers.update(dt, enemies.list, enemies.list.length, state.elapsed, mutatorMods(state.mutator));
      for (let i = 0; i < killed.length; i += 1) {
        const enemy = killed[i];
        state.kills += 1;
        if (!harmless) {
          state.coins += enemy.reward;
          state.earned += enemy.reward;
          state.score += enemy.reward * 10 + state.wave * 2;
        }
        events |= EVENT_KILL;
        fx.spawnBurst(enemy.x, enemy.y, '#c9a7f2', 6, 70, 0.4, 2.5);
        fx.spawnText(enemy.x, enemy.y - enemy.radius - 14, `+${enemy.reward}`, '#ffd166');
      }
      if (!harmless && state.phase === PHASE_WAVE && state.spawnQueue.length === 0) {
        let anyAlive = false;
        for (let i = 0; i < enemies.list.length; i += 1) {
          if (enemies.list[i].active) { anyAlive = true; break; }
        }
        if (!anyAlive) events |= clearWave();
      }
    }
    return events;
  }

  reset();
  return {
    state, plots, decor, fx, towers, enemies, reset, step,
    lightLevel, startWave, placeTower, upgradeTower, sellTower, upgradePost,
    setDifficulty, startEndless, waveLabel,
  };
}
