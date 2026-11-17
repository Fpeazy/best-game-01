import { MAX_WAVE, POOL } from './config.js';
import { LANTERN, PATH_POINTS, pathLength, pointAlongPath } from './garden.js';

export const ENEMY_TYPES = {
  mite: { name: 'Dust Mite', hp: 24, speed: 60, reward: 4, lives: 1, radius: 11, armor: 0, flying: false },
  zip: { name: 'Zip Bug', hp: 16, speed: 112, reward: 5, lives: 1, radius: 9, armor: 0, flying: false },
  beetle: { name: 'Shell Beetle', hp: 120, speed: 36, reward: 10, lives: 1, radius: 15, armor: 4, flying: false },
  moth: { name: 'Flutter Moth', hp: 38, speed: 76, reward: 7, lives: 1, radius: 12, armor: 0, flying: true },
  boss: { name: 'Shadow Moth', hp: 2400, speed: 30, reward: 120, lives: 3, radius: 56, armor: 2, flying: false, spawns: true },
  queen: { name: 'Moth Queen', hp: 1200, speed: 40, reward: 80, lives: 2, radius: 30, armor: 1, flying: true, spawns: true },
};

export function enemyStats(type, wave, diff, mods) {
  const def = ENEMY_TYPES[type];
  const hpScale = wave <= MAX_WAVE
    ? 1 + 0.20 * (wave - 1)
    : 2.80 + 0.12 * (wave - MAX_WAVE);
  const speedScale = wave <= MAX_WAVE
    ? Math.min(1.25, 1 + 0.02 * (wave - 1))
    : Math.min(1.45, 1.25 + 0.01 * (wave - MAX_WAVE));
  const d = diff ?? { hp: 1, speed: 1 };
  const m = mods ?? {};
  let speed = def.speed * speedScale * d.speed * (m.speed ?? 1);
  if (def.flying) speed *= m.mothSpeed ?? 1;
  return {
    hp: Math.round(def.hp * hpScale * d.hp * (m.hp ?? 1)),
    speed,
    armor: def.armor + (m.armor ?? 0),
    reward: Math.round(def.reward * (m.rewardMul ?? 1)) + (m.rewardBonus ?? 0),
  };
}

/** The boss's phase from its remaining health: 1 whole, 2 angry, 3 flying enrage. */
export function bossPhaseOf(enemy) {
  if (enemy.type !== 'boss') return 0;
  const ratio = enemy.hp / enemy.maxHp;
  if (ratio <= 1 / 3) return 3;
  if (ratio <= 2 / 3) return 2;
  return 1;
}

export function createEnemies(random) {
  const list = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    list.push({
      active: false, type: 'mite', hp: 1, maxHp: 1, speed: 0, x: 0, y: 0,
      dist: 0, progress: 0, progressBase: 0, radius: 11, armor: 0, reward: 0, lives: 1,
      slowUntil: 0, slowFactor: 1, wobble: 0, spawnTimer: 0, flying: false,
      fromX: 0, fromY: 0, totalDist: 1, angle: 0, phase: 1,
    });
  }
  const total = pathLength();
  const leaked = [];
  const phaseEvents = [];

  function freeEnemy() {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function spawn(type, wave, diff, mods) {
    const enemy = freeEnemy();
    if (enemy === null) return null;
    const def = ENEMY_TYPES[type];
    const stats = enemyStats(type, wave, diff, mods);
    enemy.active = true;
    enemy.type = type;
    enemy.hp = stats.hp;
    enemy.maxHp = stats.hp;
    enemy.speed = stats.speed;
    enemy.radius = def.radius;
    enemy.armor = stats.armor;
    enemy.reward = stats.reward;
    enemy.lives = def.lives;
    enemy.slowUntil = 0;
    enemy.slowFactor = 1;
    enemy.wobble = random() * Math.PI * 2;
    enemy.spawnTimer = type === 'queen' ? 5 : 8;
    enemy.flying = def.flying;
    enemy.phase = 1;
    enemy.progressBase = 0;
    if (def.flying) {
      enemy.fromX = PATH_POINTS[0].x;
      enemy.fromY = PATH_POINTS[0].y + 30 + random() * 40;
      enemy.x = enemy.fromX;
      enemy.y = enemy.fromY;
      enemy.totalDist = Math.hypot(LANTERN.x - enemy.fromX, LANTERN.y - enemy.fromY);
      enemy.angle = Math.atan2(LANTERN.y - enemy.fromY, LANTERN.x - enemy.fromX);
      enemy.dist = 0;
      enemy.progress = 0;
    } else {
      enemy.dist = 0;
      enemy.progress = 0;
      const p = pointAlongPath(0);
      enemy.x = p.x;
      enemy.y = p.y;
      enemy.angle = p.angle;
      enemy.totalDist = total;
    }
    return enemy;
  }

  /** What a spawner sheds, and how often: the boss's phase decides its escort. */
  function spawnEscorts(enemy, wave, diff, mods) {
    let kind = null;
    let count = 0;
    let interval = 6;
    if (enemy.type === 'boss') {
      if (enemy.phase === 3) { kind = 'moth'; count = 2; interval = 4; }
      else if (enemy.phase === 2) { kind = 'zip'; count = 2; interval = 5; }
      else { kind = 'mite'; count = 3; interval = 6; }
    } else if (enemy.type === 'queen') {
      kind = 'moth'; count = 2; interval = 5;
    }
    if (kind === null) return interval;
    for (let n = 0; n < count; n += 1) {
      const child = spawn(kind, wave, diff, mods);
      if (child === null) break;
      if (kind === 'moth') continue;
      child.dist = Math.max(0, enemy.dist - 30 - n * 24);
      const p = pointAlongPath(child.dist);
      child.x = p.x;
      child.y = p.y;
      child.progress = child.dist / total;
    }
    return interval;
  }

  function update(dt, now, wave, diff, mods) {
    leaked.length = 0;
    phaseEvents.length = 0;
    for (let i = 0; i < list.length; i += 1) {
      const enemy = list[i];
      if (!enemy.active) continue;
      enemy.wobble += dt * 6;
      if (enemy.type === 'boss') {
        const phase = bossPhaseOf(enemy);
        if (phase !== enemy.phase) {
          enemy.phase = phase;
          if (phase === 3 && !enemy.flying) {
            enemy.progressBase = enemy.progress;
            enemy.fromX = enemy.x;
            enemy.fromY = enemy.y;
            enemy.totalDist = Math.hypot(LANTERN.x - enemy.x, LANTERN.y - enemy.y);
            enemy.angle = Math.atan2(LANTERN.y - enemy.y, LANTERN.x - enemy.x);
            enemy.dist = 0;
            enemy.flying = true;
          }
          phaseEvents.push({ enemy, phase });
        }
      }
      const slowed = now < enemy.slowUntil;
      let speed = enemy.speed * (slowed ? enemy.slowFactor : 1);
      if (enemy.type === 'boss') speed *= enemy.phase === 3 ? 1.8 : enemy.phase === 2 ? 1.4 : 1;
      enemy.dist += speed * dt;
      if (enemy.flying) {
        enemy.x = enemy.fromX + Math.cos(enemy.angle) * enemy.dist;
        enemy.y = enemy.fromY + Math.sin(enemy.angle) * enemy.dist;
        enemy.progress = enemy.progressBase + (1 - enemy.progressBase) * (enemy.dist / enemy.totalDist);
      } else {
        const p = pointAlongPath(Math.min(enemy.dist, total));
        enemy.x = p.x;
        enemy.y = p.y;
        enemy.angle = p.angle;
        enemy.progress = enemy.dist / total;
      }
      if (enemy.dist >= enemy.totalDist - enemy.radius * 0.5) {
        enemy.active = false;
        leaked.push(enemy);
        continue;
      }
      if (ENEMY_TYPES[enemy.type].spawns) {
        enemy.spawnTimer -= dt;
        if (enemy.spawnTimer <= 0) {
          enemy.spawnTimer += spawnEscorts(enemy, wave, diff, mods);
        }
      }
    }
    return leaked;
  }

  return { list, spawn, update, leaked, total, phaseEvents };
}
