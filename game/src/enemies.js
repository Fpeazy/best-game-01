// The shadow bugs: definitions, per-wave scaling, movement along the path (or, for the
// flutter moths, straight through the air at the lantern), and the boss's mite spawns.
// Movement is waypoint steering on the garden path — no pathfinding needed, the path is
// fixed — with a stuck guard: an enemy that cannot advance leaks and is removed.
import { POOL } from './config.js';
import { LANTERN, PATH_POINTS, pathLength, pointAlongPath } from './garden.js';

export const ENEMY_TYPES = {
  mite: { name: 'Dust Mite', hp: 24, speed: 60, reward: 4, lives: 1, radius: 11, armor: 0, flying: false },
  zip: { name: 'Zip Bug', hp: 16, speed: 112, reward: 5, lives: 1, radius: 9, armor: 0, flying: false },
  beetle: { name: 'Shell Beetle', hp: 120, speed: 36, reward: 10, lives: 1, radius: 15, armor: 4, flying: false },
  moth: { name: 'Flutter Moth', hp: 38, speed: 76, reward: 7, lives: 1, radius: 12, armor: 0, flying: true },
  boss: { name: 'Shadow Moth', hp: 2400, speed: 30, reward: 120, lives: 3, radius: 30, armor: 2, flying: false, spawns: true },
};

/** An enemy's stats at a wave: health grows 25% a wave, speed a little. */
export function enemyStats(type, wave) {
  const def = ENEMY_TYPES[type];
  return {
    hp: Math.round(def.hp * (1 + 0.25 * (wave - 1))),
    speed: def.speed * Math.min(1.25, 1 + 0.02 * (wave - 1)),
  };
}

export function createEnemies(random) {
  const list = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    list.push({
      active: false, type: 'mite', hp: 1, maxHp: 1, speed: 0, x: 0, y: 0,
      dist: 0, progress: 0, radius: 11, armor: 0, reward: 0, lives: 1,
      slowUntil: 0, slowFactor: 1, wobble: 0, spawnTimer: 0, flying: false,
      fromX: 0, fromY: 0, totalDist: 1, angle: 0,
    });
  }
  const total = pathLength();
  const leaked = [];

  function freeEnemy() {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function spawn(type, wave) {
    const enemy = freeEnemy();
    if (enemy === null) return null;
    const def = ENEMY_TYPES[type];
    const stats = enemyStats(type, wave);
    enemy.active = true;
    enemy.type = type;
    enemy.hp = stats.hp;
    enemy.maxHp = stats.hp;
    enemy.speed = stats.speed;
    enemy.radius = def.radius;
    enemy.armor = def.armor;
    enemy.reward = def.reward;
    enemy.lives = def.lives;
    enemy.slowUntil = 0;
    enemy.slowFactor = 1;
    enemy.wobble = random() * Math.PI * 2;
    enemy.spawnTimer = 8;
    enemy.flying = def.flying;
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

  /**
   * One fixed step. Returns the enemies that reached the lantern this step (a reused
   * array — read it before the next update). `now` is the world's sim time.
   */
  function update(dt, now) {
    leaked.length = 0;
    for (let i = 0; i < list.length; i += 1) {
      const enemy = list[i];
      if (!enemy.active) continue;
      enemy.wobble += dt * 6;
      const slowed = now < enemy.slowUntil;
      const speed = enemy.speed * (slowed ? enemy.slowFactor : 1);
      enemy.dist += speed * dt;
      if (enemy.flying) {
        enemy.x = enemy.fromX + Math.cos(enemy.angle) * enemy.dist;
        enemy.y = enemy.fromY + Math.sin(enemy.angle) * enemy.dist;
        enemy.progress = enemy.dist / enemy.totalDist;
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
      // The boss sheds dust mites as it lumbers along.
      if (ENEMY_TYPES[enemy.type].spawns) {
        enemy.spawnTimer -= dt;
        if (enemy.spawnTimer <= 0) {
          enemy.spawnTimer += 6;
          for (let n = 0; n < 3; n += 1) {
            const mite = spawn('mite', 10);
            if (mite !== null) {
              mite.dist = Math.max(0, enemy.dist - 30 - n * 24);
              const p = pointAlongPath(mite.dist);
              mite.x = p.x;
              mite.y = p.y;
              mite.progress = mite.dist / total;
            }
          }
        }
      }
    }
    return leaked;
  }

  return { list, spawn, update, leaked, total };
}
