import { ABILITIES, BOSS_COUNTDOWN, BUILD_SECONDS, DIFFICULTIES, EARLY_CALL_CAP, EARLY_CALL_PER_SEC, FLARE_DAMAGE, FLARE_RADIUS, FLARE_SLOW, FLARE_SLOW_DUR, MAX_POST_LEVEL, MAX_WAVE, MUTATORS, POST_UPGRADE_COST, PURR_DUR, PURR_SLOW, START_COINS, START_LIVES, SURGE_BONUS, SURGE_DUR, TARGET_LABELS, TARGET_MODES } from './config.js';
import { buildDecor, buildPlots, distanceToPath, glowBonusAt, LANTERN, LANTERN_POSTS } from './garden.js';
import { createTowers, TOWER_TYPES, upgradeCost } from './towers.js';
import { createEnemies } from './enemies.js';
import { mutatorForWave, spawnIntervalFor, wavePreview, waveQueue } from './waves.js';
import { interest, sellValue, waveClearBonus } from './economy.js';
import { createEffects } from './effects.js';
import { DRAFT_WAVES, draftChoices, relicMods } from './relics.js'; export const PHASE_BUILD = 'build';
export const PHASE_WAVE = 'wave'; export const PHASE_WON = 'won';
export const PHASE_LOST = 'lost'; export const EVENT_KILL = 1;
export const EVENT_LEAK = 2; export const EVENT_WAVE_CLEAR = 4;
export const EVENT_OVER = 8; export const EVENT_WIN = 16;
export const EVENT_PLACE = 32; export const EVENT_UPGRADE = 64;
export const EVENT_SELL = 128; export const EVENT_BOSS = 256;
export const EVENT_MUTATOR = 512; export const EVENT_BOSS_PHASE = 1024;
export const EVENT_POST = 2048; export const EVENT_ABILITY = 4096;
export function mutatorMods(key) {
  switch (key) {
    case 'fog': return { range: 0.85, mothSpeed: 0.8 };
    case 'speedy': return { speed: 1.25, rewardBonus: 2 };
    case 'armored': return { armor: 3, rewardBonus: 3 };
    case 'bounty': return { hp: 1.15, rewardMul: 1.5 };
    default: return {};
  }
}
export function createWorld(random, seedArg) {
  let seed = seedArg ?? 1; const plots = buildPlots();
  const decor = buildDecor(random); const fx = createEffects(random);
  const st = {
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
    bossSlain: false,
    relics: [],
    draft: null,
    draftWave: 0,
    draftHover: -1,
    run: { bestCombo: 0 },
    difficulty: 'normal',
    endless: false,
    mutator: 'none',
    postLevels: [1, 1, 1, 1],
    festival: 0,
    cascadeTimer: 0,
    abilities: { flare: { cd: 0 }, surge: { cd: 0 }, purr: { cd: 0 } },
    surgeTimer: 0,
    purrTimer: 0,
    bossCountdown: 0,
  }; let cascadeSeed = 987654321;
  function cascadeRandom() {
    cascadeSeed = (cascadeSeed * 1103515245 + 12345) & 0x7fffffff; return cascadeSeed / 0x7fffffff;
  }
  const glowAt = (x, y) => glowBonusAt(x, y, st.postLevels); const towers = createTowers(random, fx, glowAt);
  const enemies = createEnemies(random);
  function reset() {
    for (const plot of plots) plot.tower = null; for (const tower of towers.towers) tower.active = false;
    for (const enemy of enemies.list) enemy.active = false;
    for (const proj of towers.projectiles) proj.active = false; const diff = DIFFICULTIES[st.difficulty];
    st.coins = diff.coins; st.lives = diff.lives;
    st.maxLives = diff.lives; st.score = 0;
    st.wave = 1; st.phase = PHASE_BUILD;
    st.buildTimer = diff.build; st.spawnQueue = [];
    st.spawnTimer = 0; st.elapsed = 0;
    st.kills = 0; st.leaked = 0;
    st.earned = 0; st.selected = null;
    st.selectedPost = null; st.placing = null;
    st.hoverPlot = -1; st.hoverTower = null;
    st.message = ''; st.messageTimer = 0;
    st.clearBonus = ''; st.clearBonusTimer = 0;
    st.bossSpawned = false; st.bossSlain = false;
    st.relics = []; st.draft = null;
    st.draftWave = 0; st.draftHover = -1;
    st.run = { bestCombo: 0 }; st.endless = false;
    st.mutator = 'none'; st.postLevels = [1, 1, 1, 1];
    st.festival = 0; st.cascadeTimer = 0;
    st.abilities = { flare: { cd: 0 }, surge: { cd: 0 }, purr: { cd: 0 } }; st.surgeTimer = 0;
    st.purrTimer = 0; st.bossCountdown = 0;
    cascadeSeed = 987654321; towers.resetCombo();
    const mochiRange = TOWER_TYPES.mochi.range; let mochiPlot = null;
    for (const plot of plots) {
      if (distanceToPath(plot.x, plot.y) > mochiRange) continue;
      if (mochiPlot === null || plot.coverage > mochiPlot.coverage) mochiPlot = plot;
    }
    if (mochiPlot === null) mochiPlot = plots[0];
    const mochi = towers.place('mochi', mochiPlot.x, mochiPlot.y, 0); mochiPlot.tower = mochi;
  }
  function setDifficulty(key) {
    if (DIFFICULTIES[key] === undefined) return; st.difficulty = key;
  }
  function lightLevel() {
    return st.lives / st.maxLives;
  }
  function waveLabel() {
    if (st.endless) return `Night ${st.wave - MAX_WAVE}`;
    return `Wave ${Math.min(st.wave, MAX_WAVE)}/${MAX_WAVE}`;
  }
  function triggerFestival(message) {
    st.festival = 1; fx.triggerFlash(0.7);
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
      st.message = message; st.messageTimer = 3;
    }
  }
  function startWave() {
    if (st.phase !== PHASE_BUILD || st.draft !== null) return false;
    const earlyBonus = Math.min(EARLY_CALL_CAP, Math.max(0, Math.ceil(st.buildTimer)) * EARLY_CALL_PER_SEC);
    if (earlyBonus > 0) {
      st.coins += earlyBonus; st.earned += earlyBonus;
    }
    st.spawnQueue = waveQueue(st.wave); st.spawnTimer = 0.5;
    st.phase = PHASE_WAVE; st.bossSpawned = false;
    st.mutator = mutatorForWave(st.wave); const mut = MUTATORS[st.mutator];
    const label = st.endless ? `Night ${st.wave - MAX_WAVE}` : `Wave ${st.wave}`;
    st.message = st.mutator === 'none'
      ? `${label} — ${wavePreview(st.wave)}`
      : `${label} — ${wavePreview(st.wave)} · ${mut.icon} ${mut.name}`;
    if (earlyBonus > 0) st.message += ` · Early call +${earlyBonus}`; st.messageTimer = 3;
    if (st.wave === MAX_WAVE && !st.endless) {
      st.bossCountdown = BOSS_COUNTDOWN;
      st.message = `⚠ BOSS INCOMING — the Shadow Moth arrives in ${BOSS_COUNTDOWN}s!`;
      st.messageTimer = BOSS_COUNTDOWN;
    }
    if (st.wave % 5 === 0) triggerFestival(`🎆 Lantern Festival! ${label} — the garden blazes with light!`);
    return true;
  }
  function cycleTarget(tower) {
    if (tower === null || !tower.active) return null; const modes = TARGET_MODES;
    const next = modes[(modes.indexOf(tower.targetMode ?? 'first') + 1) % modes.length];
    tower.targetMode = next; return TARGET_LABELS[next];
  }
  function useAbility(key) {
    const def = ABILITIES[key]; if (def === undefined || st.phase !== PHASE_WAVE) return 0;
    const slot = st.abilities[key]; if (slot === undefined || slot.cd > 0) return 0;
    slot.cd = def.cd; let events = EVENT_ABILITY;
    if (key === 'flare') {
      fx.spawnRing(LANTERN.x, LANTERN.y, FLARE_RADIUS, '#ffd166');
      fx.spawnBurst(LANTERN.x, LANTERN.y, '#ffd166', 24, 180, 0.9, 4);
      fx.spawnBurst(LANTERN.x, LANTERN.y, '#fff6d8', 14, 120, 0.8, 3); fx.triggerFlash(0.4);
      fx.addTrauma(0.4); fx.spawnText(LANTERN.x, LANTERN.y - 60, '✦ FLARE BURST!', '#ffd166', 28);
      const before = towers.killed.length;
      for (const enemy of enemies.list) {
        if (!enemy.active) continue;
        if (Math.hypot(enemy.x - LANTERN.x, enemy.y - LANTERN.y) > FLARE_RADIUS + enemy.radius) continue;
        enemy.slowUntil = st.elapsed + FLARE_SLOW_DUR;
        enemy.slowFactor = Math.min(enemy.slowFactor, FLARE_SLOW); towers.damage(enemy, FLARE_DAMAGE, false);
      }
      events |= rewardKills(towers.killed.slice(before)); towers.killed.length = before;
    } else if (key === 'surge') {
      st.surgeTimer = SURGE_DUR; fx.triggerFlash(0.35);
      fx.addTrauma(0.3);
      for (const post of LANTERN_POSTS) fx.spawnBurst(post.x, post.y - 18, '#ffd166', 12, 120, 0.8, 3.5);
      fx.spawnText(LANTERN.x, LANTERN.y - 60, '☀ LANTERN SURGE!', '#ffd166', 24);
    } else if (key === 'purr') {
      st.purrTimer = PURR_DUR; fx.spawnRing(LANTERN.x, LANTERN.y, 420, '#b8a7d9');
      fx.spawnBurst(LANTERN.x, LANTERN.y, '#c9a7f2', 20, 150, 0.8, 3);
      fx.spawnText(LANTERN.x, LANTERN.y - 60, '♪ PURR WAVE!', '#c9a7f2', 24);
    }
    return events;
  }
  function rewardKills(killed) {
    let events = 0; const rm = relicMods(st.relics);
    for (const enemy of killed) {
      st.kills += 1; const coins = Math.round(enemy.reward * rm.coins);
      st.coins += coins; st.earned += coins;
      st.score += enemy.reward * 10 + st.wave * 2; events |= EVENT_KILL;
      fx.spawnBurst(enemy.x, enemy.y, '#c9a7f2', 6, 70, 0.4, 2.5);
      fx.spawnText(enemy.x, enemy.y - enemy.radius - 14, `+${enemy.reward}`, '#ffd166', 20);
    }
    return events;
  }
  function startEndless() {
    st.endless = true; st.wave = MAX_WAVE + 1;
    st.phase = PHASE_BUILD; st.buildTimer = DIFFICULTIES[st.difficulty].build;
    st.message = 'The Long Night begins — how many nights can the cats hold?'; st.messageTimer = 4;
    return true;
  }
  function placeTower(plotIndex, type) {
    const plot = plots[plotIndex]; const def = TOWER_TYPES[type];
    if (plot === undefined || plot.tower !== null || def === undefined) return 0;
    if (type === 'mochi') return 0; if (st.coins < def.cost) return 0;
    st.coins -= def.cost; const tower = towers.place(type, plot.x, plot.y, def.cost);
    if (tower === null) {
      st.coins += def.cost; return 0;
    }
    plot.tower = tower; fx.spawnBurst(plot.x, plot.y, '#ffd166', 10, 80, 0.5, 3);
    return EVENT_PLACE;
  }
  function upgradeTower(tower) {
    if (tower === null || !tower.active) return 0; const cost = upgradeCost(tower.type, tower.level);
    if (cost === null || st.coins < cost) return 0; st.coins -= cost;
    tower.level += 1; tower.invested += cost;
    fx.spawnBurst(tower.x, tower.y - 10, '#ffd166', 12, 90, 0.5, 3);
    fx.spawnText(tower.x, tower.y - 34, 'LEVEL UP!', '#ffd166');
    if (tower.level === 3) {
      fx.spawnBeam(tower.x, 56, tower.y, 26, '#ffd166', 0.9);
      fx.spawnText(tower.x, tower.y - 52, 'FINAL FORM!', '#ffd166', 20); fx.triggerFlash(0.25);
      fx.addTrauma(0.25);
    }
    return EVENT_UPGRADE;
  }
  function sellTower(tower) {
    if (tower === null || !tower.active) return 0; if (tower.type === 'mochi') return 0;
    const refund = sellValue(tower.invested); st.coins += refund;
    for (const plot of plots) {
      if (plot.tower === tower) plot.tower = null;
    }
    if (st.selected === tower) st.selected = null; towers.remove(tower);
    fx.spawnText(tower.x, tower.y - 30, `+${refund}`, '#ffd166'); return EVENT_SELL;
  }
  function upgradePost(index) {
    const level = st.postLevels[index]; if (level === undefined || level >= MAX_POST_LEVEL) return 0;
    const cost = POST_UPGRADE_COST[level - 1]; if (st.coins < cost) return 0;
    st.coins -= cost; st.postLevels[index] = level + 1;
    const post = LANTERN_POSTS[index];
    for (const tower of towers.towers) {
      if (!tower.active) continue; tower.glowBonus = glowAt(tower.x, tower.y);
      tower.glow = tower.glowBonus > 0;
    }
    fx.spawnBurst(post.x, post.y - 18, '#ffd166', 14, 100, 0.6, 3);
    fx.spawnText(post.x, post.y - 44, `Lantern Lv ${level + 1}!`, '#ffd166'); return EVENT_POST;
  }
  function pickRelic(index) {
    if (st.draft === null) return 0; const relic = st.draft[index];
    if (relic === undefined) return 0; st.relics.push(relic.key);
    st.draft = null; st.message = `✦ Relic: ${relic.name} — ${relic.stat}!`;
    st.messageTimer = 4; fx.spawnBurst(LANTERN.x, LANTERN.y - 6, '#ffd166', 20, 150, 0.9, 4);
    fx.triggerFlash(0.3); return EVENT_WAVE_CLEAR;
  }
  function reseed(s) {
    seed = s; if (random.reset) random.reset(s);
    reset();
  }
  function clearWave() {
    const bonus = waveClearBonus(st.wave);
    const extra = interest(st.coins, DIFFICULTIES[st.difficulty].interest); st.coins += bonus + extra;
    st.earned += bonus + extra; st.score += bonus * 5;
    towers.resetCombo(); st.clearBonus = `Wave clear! +${bonus + extra}`;
    st.clearBonusTimer = 4;
    if (relicMods(st.relics).veil) {
      st.maxLives += 1; st.lives = Math.min(st.maxLives, st.lives + 1);
    }
    if (st.wave >= MAX_WAVE && !st.endless) {
      st.phase = PHASE_WON; return EVENT_WAVE_CLEAR | EVENT_WIN;
    }
    if (DRAFT_WAVES.includes(st.wave) && !st.endless) {
      st.draft = draftChoices(st.relics, seed, st.wave); st.draftWave = st.wave;
    }
    st.wave += 1; st.phase = PHASE_BUILD;
    st.buildTimer = DIFFICULTIES[st.difficulty].build;
    const label = st.endless ? `Night ${st.wave - MAX_WAVE}` : `Wave ${st.wave}`;
    st.message = `${label} coming — ${wavePreview(st.wave)}`; st.messageTimer = 3;
    return EVENT_WAVE_CLEAR;
  }
  function step(dt, harmless) {
    let events = 0; st.elapsed += dt;
    if (st.messageTimer > 0) st.messageTimer = Math.max(0, st.messageTimer - dt);
    if (st.clearBonusTimer > 0) st.clearBonusTimer = Math.max(0, st.clearBonusTimer - dt);
    if (st.festival > 0) st.festival = Math.max(0, st.festival - dt * 0.12);
    for (const slot of Object.values(st.abilities)) {
      slot.cd = Math.max(0, slot.cd - dt); if (slot.cd < 1e-9) slot.cd = 0;
    }
    if (st.surgeTimer > 0) st.surgeTimer = Math.max(0, st.surgeTimer - dt);
    if (st.purrTimer > 0) st.purrTimer = Math.max(0, st.purrTimer - dt);
    if (st.festival > 0.25) {
      st.cascadeTimer -= dt;
      if (st.cascadeTimer <= 0) {
        st.cascadeTimer = 0.45; const colors = ['#ffd166', '#ff9ec6', '#c9a7f2'];
        const cx = 80 + cascadeRandom() * 1120; const cy = 120 + cascadeRandom() * 420;
        fx.spawnBurst(cx, cy, colors[Math.floor(cascadeRandom() * 3)], 18, 130, 0.9, 3.5);
        if (cascadeRandom() < 0.4) fx.spawnRing(cx, cy, 90, '#ffd166');
      }
    }
    fx.update(dt);
    if (st.phase === PHASE_BUILD) {
      if (st.draft === null) st.buildTimer -= dt; if (st.buildTimer <= 0) startWave();
    }
    if (st.phase === PHASE_WAVE) {
      if (st.bossCountdown > 0) {
        const was = st.bossCountdown; st.bossCountdown = Math.max(0, st.bossCountdown - dt);
        st.message = `⚠ BOSS INCOMING — the Shadow Moth arrives in ${Math.ceil(st.bossCountdown)}s!`;
        st.messageTimer = 1;
        if (was > 0 && st.bossCountdown === 0) {
          st.message = 'The Shadow Moth arrives!'; st.messageTimer = 2;
        }
      } else if (st.spawnQueue.length > 0) {
        st.spawnTimer -= dt;
        if (st.spawnTimer <= 0) {
          const type = st.spawnQueue.shift();
          const enemy = enemies.spawn(type, st.wave, DIFFICULTIES[st.difficulty], mutatorMods(st.mutator));
          if (enemy !== null && type === 'boss') {
            st.bossSpawned = true; events |= EVENT_BOSS;
            fx.spawnBurst(enemy.x, enemy.y, '#b48ae0', 24, 160, 0.9, 5);
            fx.spawnBurst(enemy.x, enemy.y, '#ffd166', 12, 120, 0.7, 4);
            fx.spawnRing(enemy.x, enemy.y, 180, '#ffd166'); fx.triggerFlash(0.35);
            fx.spawnText(enemy.x, enemy.y - 70, 'THE SHADOW MOTH!', '#ffd166', 28); fx.addTrauma(0.6);
          }
          st.spawnTimer += spawnIntervalFor(type, st.wave);
        }
      }
      if (st.purrTimer > 0) {
        for (const enemy of enemies.list) {
          if (!enemy.active) continue; enemy.slowUntil = Math.max(enemy.slowUntil, st.elapsed + 0.1);
          enemy.slowFactor = Math.min(enemy.slowFactor, PURR_SLOW);
        }
      }
      const leaked = enemies.update(dt, st.elapsed, st.wave, DIFFICULTIES[st.difficulty], mutatorMods(st.mutator));
      for (let i = 0; i < enemies.phaseEvents.length; i += 1) {
        const { enemy, phase } = enemies.phaseEvents[i]; events |= EVENT_BOSS_PHASE;
        st.message = phase === 3
          ? 'Phase 3 — it flies! Only fish & star cats can hit it!'
          : 'Phase 2 — the Moth grows angry!'; st.messageTimer = 3;
        st.festival = 1; fx.triggerFlash(0.5);
        fx.addTrauma(0.7); fx.triggerHitStop(0.12);
        fx.spawnBurst(enemy.x, enemy.y, '#ffd166', 36, 180, 0.9, 4);
        fx.spawnBurst(enemy.x, enemy.y, '#c9a7f2', 16, 120, 0.8, 3.5);
        fx.spawnRing(enemy.x, enemy.y, 200, '#ffd166');
      }
      for (let i = 0; i < leaked.length; i += 1) {
        const enemy = leaked[i]; if (harmless) continue;
        st.lives -= enemy.lives; st.leaked += 1;
        events |= EVENT_LEAK; fx.addTrauma(enemy.type === 'boss' ? 0.8 : 0.35);
        fx.spawnBurst(LANTERN.x, LANTERN.y, '#ff6b81', 14, 110, 0.5, 3);
        if (st.lives <= 0) {
          st.lives = 0; st.phase = PHASE_LOST;
          events |= EVENT_OVER;
        }
      }
      const rm = relicMods(st.relics);
      const killed = towers.update(dt, enemies.list, enemies.list.length, st.elapsed, { ...mutatorMods(st.mutator), surge: st.surgeTimer > 0 ? SURGE_BONUS : 0, wave: st.wave, relic: rm });
      if (towers.combo > st.run.bestCombo) st.run.bestCombo = towers.combo;
      for (let i = 0; i < killed.length; i += 1) {
        const enemy = killed[i]; st.kills += 1;
        if (enemy.type === 'boss') st.bossSlain = true;
        if (!harmless) {
          const coins = Math.round(enemy.reward * rm.coins); st.coins += coins;
          st.earned += coins; st.score += enemy.reward * 10 + st.wave * 2;
        }
        events |= EVENT_KILL; fx.spawnBurst(enemy.x, enemy.y, '#c9a7f2', 6, 70, 0.4, 2.5);
        fx.spawnText(enemy.x, enemy.y - enemy.radius - 14, `+${enemy.reward}`, '#ffd166', 20);
        if (enemy.type === 'boss') {
          fx.triggerFlash(0.6); fx.spawnBurst(enemy.x, enemy.y, '#ffd166', 24, 180, 0.9, 4);
          fx.spawnText(enemy.x, enemy.y - enemy.radius - 30, 'THE MOTH FALLS!', '#ffd166', 26);
        }
      }
      if (!harmless && st.phase === PHASE_WAVE && st.spawnQueue.length === 0) {
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
    state: st, plots, decor, fx, towers, enemies, reset, step,
    lightLevel, startWave, placeTower, upgradeTower, sellTower, upgradePost,
    setDifficulty, startEndless, waveLabel, useAbility, cycleTarget, pickRelic, reseed,
    get seed() { return seed; },
  };
}
