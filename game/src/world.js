// Rules and state, no drawing, no browser: step() advances one fixed step.
// After wave 10 the garden is won; the Long Night is endless with mutators.
import { ABILITIES, ABILITY_ORDER, BOSS_COUNTDOWN, BUILD_SECONDS, DIFFICULTIES, EARLY_CALL_CAP, EARLY_CALL_PER_SEC, FLARE_DAMAGE, FLARE_RADIUS, FLARE_SLOW, FLARE_SLOW_DUR, MAX_POST_LEVEL, MAX_WAVE, MUTATORS, POST_UPGRADE_COST, PURR_DUR, PURR_SLOW, START_COINS, START_LIVES, SURGE_BONUS, SURGE_DUR, TARGET_LABELS, TARGET_MODES } from './config.js';
import { buildDecor, buildPlots, distanceToPath, glowBonusAt, LANTERN, LANTERN_POSTS } from './garden.js';
import { createTowers, TOWER_TYPES, upgradeCost } from './towers.js';
import { createEnemies } from './enemies.js';
import { mutatorForWave, spawnIntervalFor, wavePreview, waveQueue } from './waves.js';
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
export const EVENT_ABILITY = 4096;

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
    clearBonus: '',
    clearBonusTimer: 0,
    bossSpawned: false,
    difficulty: 'normal',
    endless: false,
    mutator: 'none',
    postLevels: [1, 1, 1, 1],
    /** Lantern Festival flare, 0..1 — the garden blazes; decays with sim time. */
    festival: 0,
    /** Seconds until the next Festival Cascade firework. */
    cascadeTimer: 0,
    /** Active abilities: cooldown left per key; surge/purr buff timers. */
    abilities: { flare: { cd: 0 }, surge: { cd: 0 }, purr: { cd: 0 } },
    surgeTimer: 0,
    purrTimer: 0,
    /** Wave-10 warning countdown before the boss spawns (0 = not counting). */
    bossCountdown: 0,
  };
  /** The cascade's own tiny PRNG, so firework positions never churn the main
   * random stream the enemy spawns draw from. Reset with the world. */
  let cascadeSeed = 987654321;
  function cascadeRandom() {
    cascadeSeed = (cascadeSeed * 1103515245 + 12345) & 0x7fffffff;
    return cascadeSeed / 0x7fffffff;
  }
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
    state.clearBonus = '';
    state.clearBonusTimer = 0;
    state.bossSpawned = false;
    state.endless = false;
    state.mutator = 'none';
    state.postLevels = [1, 1, 1, 1];
    state.festival = 0;
    state.cascadeTimer = 0;
    state.abilities = { flare: { cd: 0 }, surge: { cd: 0 }, purr: { cd: 0 } };
    state.surgeTimer = 0;
    state.purrTimer = 0;
    state.bossCountdown = 0;
    cascadeSeed = 987654321;
    towers.resetCombo();
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

  function triggerFestival(message) {
    state.festival = 1;
    fx.triggerFlash(0.7);
    fx.addTrauma(0.5);
    for (const post of LANTERN_POSTS) {
      fx.spawnBurst(post.x, post.y - 18, '#ffd166', 16, 130, 0.8, 3.5);
      fx.spawnBurst(post.x, post.y - 18, '#fff6d8', 8, 90, 0.6, 2.5);
    }
    fx.spawnBurst(LANTERN.x, LANTERN.y - 6, '#ffd166', 20, 150, 0.9, 4);
    for (let n = 0; n < 12; n += 1) {
      fx.spawnBurst(40 + random() * 1200, 80 + random() * 520, n % 2 === 0 ? '#ffd166' : '#fff6d8', 3, 60, 0.9, 2.5);
    }
    if (message !== null) {
      state.message = message;
      state.messageTimer = 3;
    }
  }

  function startWave() {
    if (state.phase !== PHASE_BUILD) return false;
    const earlyBonus = Math.min(EARLY_CALL_CAP, Math.max(0, Math.ceil(state.buildTimer)) * EARLY_CALL_PER_SEC);
    if (earlyBonus > 0) {
      state.coins += earlyBonus;
      state.earned += earlyBonus;
    }
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
    if (earlyBonus > 0) state.message += ` · Early call +${earlyBonus}`;
    state.messageTimer = 3;
    if (state.wave === MAX_WAVE && !state.endless) {
      state.bossCountdown = BOSS_COUNTDOWN;
      state.message = `⚠ BOSS INCOMING — the Shadow Moth arrives in ${BOSS_COUNTDOWN}s!`;
      state.messageTimer = BOSS_COUNTDOWN;
    }
    if (state.wave % 5 === 0) triggerFestival(`🎆 Lantern Festival! ${label} — the garden blazes with light!`);
    return true;
  }

  /** Cycle a tower's targeting mode; returns the new mode's label. */
  function cycleTarget(tower) {
    if (tower === null || !tower.active) return null;
    const modes = TARGET_MODES;
    const next = modes[(modes.indexOf(tower.targetMode ?? 'first') + 1) % modes.length];
    tower.targetMode = next;
    return TARGET_LABELS[next];
  }

  function useAbility(key) {
    const def = ABILITIES[key];
    if (def === undefined || state.phase !== PHASE_WAVE) return 0;
    const slot = state.abilities[key];
    if (slot === undefined || slot.cd > 0) return 0;
    slot.cd = def.cd;
    let events = EVENT_ABILITY;
    if (key === 'flare') {
      fx.spawnRing(LANTERN.x, LANTERN.y, FLARE_RADIUS, '#ffd166');
      fx.spawnBurst(LANTERN.x, LANTERN.y, '#ffd166', 24, 180, 0.9, 4);
      fx.spawnBurst(LANTERN.x, LANTERN.y, '#fff6d8', 14, 120, 0.8, 3);
      fx.triggerFlash(0.4);
      fx.addTrauma(0.4);
      fx.spawnText(LANTERN.x, LANTERN.y - 60, '✦ FLARE BURST!', '#ffd166', 28);
      const before = towers.killed.length;
      for (const enemy of enemies.list) {
        if (!enemy.active) continue;
        if (Math.hypot(enemy.x - LANTERN.x, enemy.y - LANTERN.y) > FLARE_RADIUS + enemy.radius) continue;
        enemy.slowUntil = state.elapsed + FLARE_SLOW_DUR;
        enemy.slowFactor = Math.min(enemy.slowFactor, FLARE_SLOW);
        towers.damage(enemy, FLARE_DAMAGE, false);
      }
      events |= rewardKills(towers.killed.slice(before));
      towers.killed.length = before;
    } else if (key === 'surge') {
      state.surgeTimer = SURGE_DUR;
      fx.triggerFlash(0.35);
      fx.addTrauma(0.3);
      for (const post of LANTERN_POSTS) fx.spawnBurst(post.x, post.y - 18, '#ffd166', 12, 120, 0.8, 3.5);
      fx.spawnText(LANTERN.x, LANTERN.y - 60, '☀ LANTERN SURGE!', '#ffd166', 24);
    } else if (key === 'purr') {
      state.purrTimer = PURR_DUR;
      fx.spawnRing(LANTERN.x, LANTERN.y, 420, '#b8a7d9');
      fx.spawnBurst(LANTERN.x, LANTERN.y, '#c9a7f2', 20, 150, 0.8, 3);
      fx.spawnText(LANTERN.x, LANTERN.y - 60, '♪ PURR WAVE!', '#c9a7f2', 24);
    }
    return events;
  }

  /** Reward kills made outside a sim step (abilities): coins, score, count. */
  function rewardKills(killed) {
    let events = 0;
    for (const enemy of killed) {
      state.kills += 1;
      state.coins += enemy.reward;
      state.earned += enemy.reward;
      state.score += enemy.reward * 10 + state.wave * 2;
      events |= EVENT_KILL;
      fx.spawnBurst(enemy.x, enemy.y, '#c9a7f2', 6, 70, 0.4, 2.5);
      fx.spawnText(enemy.x, enemy.y - enemy.radius - 14, `+${enemy.reward}`, '#ffd166', 20);
    }
    return events;
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
    if (tower.level === 3) {
      fx.spawnBeam(tower.x, 56, tower.y, 26, '#ffd166', 0.9);
      fx.spawnText(tower.x, tower.y - 52, 'FINAL FORM!', '#ffd166', 20);
      fx.triggerFlash(0.25);
      fx.addTrauma(0.25);
    }
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
    towers.resetCombo();
    state.clearBonus = `Wave clear! +${bonus + extra}`;
    state.clearBonusTimer = 4;
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

  function step(dt, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer = Math.max(0, state.messageTimer - dt);
    if (state.clearBonusTimer > 0) state.clearBonusTimer = Math.max(0, state.clearBonusTimer - dt);
    if (state.festival > 0) state.festival = Math.max(0, state.festival - dt * 0.12);
    for (const slot of Object.values(state.abilities)) {
      slot.cd = Math.max(0, slot.cd - dt);
      if (slot.cd < 1e-9) slot.cd = 0;
    }
    if (state.surgeTimer > 0) state.surgeTimer = Math.max(0, state.surgeTimer - dt);
    if (state.purrTimer > 0) state.purrTimer = Math.max(0, state.purrTimer - dt);
    if (state.festival > 0.25) {
      state.cascadeTimer -= dt;
      if (state.cascadeTimer <= 0) {
        state.cascadeTimer = 0.45;
        const colors = ['#ffd166', '#ff9ec6', '#c9a7f2'];
        const cx = 80 + cascadeRandom() * 1120;
        const cy = 120 + cascadeRandom() * 420;
        fx.spawnBurst(cx, cy, colors[Math.floor(cascadeRandom() * 3)], 18, 130, 0.9, 3.5);
        if (cascadeRandom() < 0.4) fx.spawnRing(cx, cy, 90, '#ffd166');
      }
    }
    fx.update(dt);

    if (state.phase === PHASE_BUILD) {
      state.buildTimer -= dt;
      if (state.buildTimer <= 0) startWave();
    }

    if (state.phase === PHASE_WAVE) {
      if (state.bossCountdown > 0) {
        const was = state.bossCountdown;
        state.bossCountdown = Math.max(0, state.bossCountdown - dt);
        state.message = `⚠ BOSS INCOMING — the Shadow Moth arrives in ${Math.ceil(state.bossCountdown)}s!`;
        state.messageTimer = 1;
        if (was > 0 && state.bossCountdown === 0) {
          state.message = 'The Shadow Moth arrives!';
          state.messageTimer = 2;
        }
      } else if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          const type = state.spawnQueue.shift();
          const enemy = enemies.spawn(type, state.wave, DIFFICULTIES[state.difficulty], mutatorMods(state.mutator));
          if (enemy !== null && type === 'boss') {
            state.bossSpawned = true;
            events |= EVENT_BOSS;
            fx.spawnBurst(enemy.x, enemy.y, '#b48ae0', 24, 160, 0.9, 5);
            fx.spawnBurst(enemy.x, enemy.y, '#ffd166', 12, 120, 0.7, 4);
            fx.spawnRing(enemy.x, enemy.y, 180, '#ffd166');
            fx.triggerFlash(0.35);
            fx.spawnText(enemy.x, enemy.y - 70, 'THE SHADOW MOTH!', '#ffd166', 28);
            fx.addTrauma(0.6);
          }
          state.spawnTimer += spawnIntervalFor(type, state.wave);
        }
      }
      if (state.purrTimer > 0) {
        for (const enemy of enemies.list) {
          if (!enemy.active) continue;
          enemy.slowUntil = Math.max(enemy.slowUntil, state.elapsed + 0.1);
          enemy.slowFactor = Math.min(enemy.slowFactor, PURR_SLOW);
        }
      }
      const leaked = enemies.update(dt, state.elapsed, state.wave, DIFFICULTIES[state.difficulty], mutatorMods(state.mutator));
      for (let i = 0; i < enemies.phaseEvents.length; i += 1) {
        const { enemy, phase } = enemies.phaseEvents[i];
        events |= EVENT_BOSS_PHASE;
        state.message = phase === 3
          ? 'Phase 3 — it flies! Only fish & star cats can hit it!'
          : 'Phase 2 — the Moth grows angry!';
        state.messageTimer = 3;
        state.festival = 1;
        fx.triggerFlash(0.5);
        fx.addTrauma(0.7);
        fx.triggerHitStop(0.12);
        fx.spawnBurst(enemy.x, enemy.y, '#ffd166', 36, 180, 0.9, 4);
        fx.spawnBurst(enemy.x, enemy.y, '#c9a7f2', 16, 120, 0.8, 3.5);
        fx.spawnRing(enemy.x, enemy.y, 200, '#ffd166');
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
      const killed = towers.update(dt, enemies.list, enemies.list.length, state.elapsed, { ...mutatorMods(state.mutator), surge: state.surgeTimer > 0 ? SURGE_BONUS : 0, wave: state.wave });
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
        fx.spawnText(enemy.x, enemy.y - enemy.radius - 14, `+${enemy.reward}`, '#ffd166', 20);
        if (enemy.type === 'boss') {
          fx.triggerFlash(0.6);
          fx.spawnBurst(enemy.x, enemy.y, '#ffd166', 24, 180, 0.9, 4);
          fx.spawnText(enemy.x, enemy.y - enemy.radius - 30, 'THE MOTH FALLS!', '#ffd166', 26);
        }
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
    setDifficulty, startEndless, waveLabel, useAbility, cycleTarget,
  };
}
