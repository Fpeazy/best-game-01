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
    ? 1 + 0.30 * (wave - 1)
    : 2.80 + 0.12 * (wave - MAX_WAVE);
  const speedScale = wave <= MAX_WAVE
    ? Math.min(1.25, 1 + 0.02 * (wave - 1))
    : Math.min(1.45, 1.25 + 0.01 * (wave - MAX_WAVE)); const d = diff ?? { hp: 1, speed: 1 };
  const m = mods ?? {}; let speed = def.speed * speedScale * d.speed * (m.speed ?? 1);
  if (def.flying) speed *= m.mothSpeed ?? 1;
  return {
    hp: Math.round(def.hp * hpScale * d.hp * (m.hp ?? 1)),
    speed,
    armor: def.armor + (m.armor ?? 0),
    reward: Math.round(def.reward * (m.rewardMul ?? 1)) + (m.rewardBonus ?? 0),
  };
}
export function bossPhaseOf(e) {
  if (e.type !== 'boss') return 0; const ratio = e.hp / e.maxHp;
  if (ratio <= 1 / 3) return 3; if (ratio <= 2 / 3) return 2;
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
  const total = pathLength(); const leaked = [];
  const phaseEvents = [];
  function freeEnemy() {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i]; return null;
  }
  function spawn(type, wave, diff, mods) {
    const e = freeEnemy(); if (e === null) return null;
    const def = ENEMY_TYPES[type]; const stats = enemyStats(type, wave, diff, mods);
    e.active = true; e.type = type;
    e.hp = stats.hp; e.maxHp = stats.hp;
    e.speed = stats.speed; e.radius = def.radius;
    e.armor = stats.armor; e.reward = stats.reward;
    e.lives = def.lives; e.slowUntil = 0;
    e.slowFactor = 1; e.wobble = random() * Math.PI * 2;
    e.spawnTimer = type === 'queen' ? 5 : 8; e.flying = def.flying;
    e.phase = 1; e.progressBase = 0;
    if (def.flying) {
      e.fromX = PATH_POINTS[0].x; e.fromY = PATH_POINTS[0].y + 30 + random() * 40;
      e.x = e.fromX; e.y = e.fromY;
      e.totalDist = Math.hypot(LANTERN.x - e.fromX, LANTERN.y - e.fromY);
      e.angle = Math.atan2(LANTERN.y - e.fromY, LANTERN.x - e.fromX); e.dist = 0;
      e.progress = 0;
    } else {
      e.dist = 0; e.progress = 0;
      const p = pointAlongPath(0); e.x = p.x;
      e.y = p.y; e.angle = p.angle;
      e.totalDist = total;
    }
    return e;
  }
  function spawnEscorts(e, wave, diff, mods) {
    let kind = null; let count = 0;
    let interval = 6;
    if (e.type === 'boss') {
      if (e.phase === 3) { kind = 'moth'; count = 2; interval = 4; }
      else if (e.phase === 2) { kind = 'zip'; count = 2; interval = 5; }
      else { kind = 'mite'; count = 3; interval = 6; }
    } else if (e.type === 'queen') {
      kind = 'moth'; count = 2; interval = 5;
    }
    if (kind === null) return interval;
    for (let n = 0; n < count; n += 1) {
      const child = spawn(kind, wave, diff, mods); if (child === null) break;
      if (kind === 'moth') continue; child.dist = Math.max(0, e.dist - 30 - n * 24);
      const p = pointAlongPath(child.dist); child.x = p.x;
      child.y = p.y; child.progress = child.dist / total;
    }
    return interval;
  }
  function update(dt, now, wave, diff, mods) {
    leaked.length = 0; phaseEvents.length = 0;
    for (let i = 0; i < list.length; i += 1) {
      const e = list[i]; if (!e.active) continue;
      e.wobble += dt * 6;
      if (e.type === 'boss') {
        const phase = bossPhaseOf(e);
        if (phase !== e.phase) {
          e.phase = phase;
          if (phase === 3 && !e.flying) {
            e.progressBase = e.progress; e.fromX = e.x;
            e.fromY = e.y; e.totalDist = Math.hypot(LANTERN.x - e.x, LANTERN.y - e.y);
            e.angle = Math.atan2(LANTERN.y - e.y, LANTERN.x - e.x); e.dist = 0;
            e.flying = true;
          }
          phaseEvents.push({ enemy: e, phase });
        }
      }
      const slowed = now < e.slowUntil; let speed = e.speed * (slowed ? e.slowFactor : 1);
      if (e.type === 'boss') speed *= e.phase === 3 ? 1.8 : e.phase === 2 ? 1.4 : 1; e.dist += speed * dt;
      if (e.flying) {
        e.x = e.fromX + Math.cos(e.angle) * e.dist; e.y = e.fromY + Math.sin(e.angle) * e.dist;
        e.progress = e.progressBase + (1 - e.progressBase) * (e.dist / e.totalDist);
      } else {
        const p = pointAlongPath(Math.min(e.dist, total)); e.x = p.x;
        e.y = p.y; e.angle = p.angle;
        e.progress = e.dist / total;
      }
      if (e.dist >= e.totalDist - e.radius * 0.5) {
        e.active = false; leaked.push(e);
        continue;
      }
      if (ENEMY_TYPES[e.type].spawns) {
        e.spawnTimer -= dt;
        if (e.spawnTimer <= 0) {
          e.spawnTimer += spawnEscorts(e, wave, diff, mods);
        }
      }
    }
    return leaked;
  }
  return { list, spawn, update, leaked, total, phaseEvents };
}
