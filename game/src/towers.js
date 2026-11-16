// The cat towers: definitions, per-level stats, targeting, firing and projectiles.
// A tower's job is to watch its patch of garden and swat, lob or toss at the first bug
// in range — the one furthest along the path. Towers inside a lantern's glow fight
// 25% better (the Lantern Light mechanic).
import { LIGHT, POOL } from './config.js';
import { inLanternGlow } from './garden.js';

export const TOWER_TYPES = {
  mochi: {
    key: 'mochi', name: 'Mochi', cost: 0, range: 95, damage: 7, rate: 1.25,
    color: '#f5a65b', ear: '#e08a3c', belly: '#ffe3b3',
    desc: 'Hero cat, swats bugs', melee: true, canFly: false,
    upgrade: [50, 110],
  },
  yarn: {
    key: 'yarn', name: 'Yarnball Kitten', cost: 50, range: 155, damage: 9, rate: 0.9,
    color: '#f7e8c8', ear: '#e8d5a8', belly: '#fff8e0',
    desc: 'Lobs yarn balls', proj: 'yarn', projSpeed: 340, canFly: false,
    upgrade: [40, 70],
  },
  fish: {
    key: 'fish', name: 'Fish Tosser', cost: 100, range: 215, damage: 24, rate: 0.45,
    splash: 45, color: '#7ba7c9', ear: '#5a8ab0', belly: '#d8ecf7',
    desc: 'Throws fish, splash', proj: 'fish', projSpeed: 430, canFly: true,
    upgrade: [80, 140],
  },
  sleepy: {
    key: 'sleepy', name: 'Sleepy Guard', cost: 80, range: 135, damage: 2, rate: 2.0,
    slow: 0.6, aura: true, color: '#b8a7d9', ear: '#9a86c2', belly: '#e6ddf5',
    desc: 'Purrs, slows bugs', canFly: false,
    upgrade: [60, 110],
  },
};

export const MAX_LEVEL = 3;

/** Stats of a tower at a level, before the lantern-light bonus. */
export function towerStats(type, level) {
  const def = TOWER_TYPES[type];
  const boost = 1 + 0.4 * (level - 1);
  return {
    range: def.range * (1 + 0.12 * (level - 1)),
    damage: def.damage * boost,
    rate: def.rate * (1 + 0.12 * (level - 1)),
    splash: def.splash ?? 0,
    slow: def.slow ?? 0,
  };
}

/** Coins to raise a tower from `level` to the next; null at max level. */
export function upgradeCost(type, level) {
  const def = TOWER_TYPES[type];
  if (level >= MAX_LEVEL) return null;
  return def.upgrade[level - 1];
}

/** Whether this tower can hit this enemy: flyers need a fish tosser or a level-2+ tower. */
export function canHit(tower, enemy) {
  if (!enemy.flying) return true;
  const def = TOWER_TYPES[tower.type];
  return def.canFly || tower.level >= 2;
}

/** Damage one hit does after armour (always at least 1). */
export function damageAfterArmor(damage, armor) {
  return Math.max(1, Math.round(damage - armor));
}

export function createTowers(random, fx) {
  const towers = [];
  for (let i = 0; i < 24; i += 1) {
    towers.push({ active: false, type: 'yarn', level: 1, x: 0, y: 0, cooldown: 0, squash: 0, invested: 0, glow: false, kills: 0, auraTimer: 0 });
  }
  const projectiles = [];
  for (let i = 0; i < POOL.projectiles; i += 1) {
    projectiles.push({ active: false, kind: 'yarn', x: 0, y: 0, target: null, lx: 0, ly: 0, speed: 0, damage: 0, splash: 0, color: '#f2a7c3' });
  }
  const killed = [];

  function freeTower() {
    for (let i = 0; i < towers.length; i += 1) if (!towers[i].active) return towers[i];
    return null;
  }

  function freeProjectile() {
    for (let i = 0; i < projectiles.length; i += 1) if (!projectiles[i].active) return projectiles[i];
    return null;
  }

  function place(type, x, y, invested) {
    const tower = freeTower();
    if (tower === null) return null;
    tower.active = true;
    tower.type = type;
    tower.level = 1;
    tower.x = x;
    tower.y = y;
    tower.cooldown = 0;
    tower.squash = 0;
    tower.invested = invested;
    tower.glow = inLanternGlow(x, y, LIGHT.radius);
    tower.kills = 0;
    tower.auraTimer = 0;
    return tower;
  }

  function remove(tower) {
    tower.active = false;
  }

  /** The enemy furthest along the path inside this tower's range (and hittable). */
  function acquire(tower, range, enemies, count) {
    let best = null;
    let bestProgress = -1;
    for (let i = 0; i < count; i += 1) {
      const enemy = enemies[i];
      if (!enemy.active || !canHit(tower, enemy)) continue;
      const dx = enemy.x - tower.x;
      const dy = enemy.y - tower.y;
      if (dx * dx + dy * dy > range * range) continue;
      if (enemy.progress > bestProgress) {
        bestProgress = enemy.progress;
        best = enemy;
      }
    }
    return best;
  }

  function hitEnemy(enemy, damage) {
    if (!enemy.active) return false;
    enemy.hp -= damageAfterArmor(damage, enemy.armor);
    fx.spawnText(enemy.x, enemy.y - enemy.radius - 6, String(damageAfterArmor(damage, enemy.armor)), '#fff6e8');
    if (enemy.hp <= 0) {
      enemy.active = false;
      killed.push(enemy);
      return true;
    }
    return false;
  }

  function fireProjectile(tower, target, stats) {
    const proj = freeProjectile();
    if (proj === null) return;
    const def = TOWER_TYPES[tower.type];
    proj.active = true;
    proj.kind = def.proj;
    proj.x = tower.x;
    proj.y = tower.y - 14;
    proj.target = target;
    proj.lx = target.x;
    proj.ly = target.y;
    proj.speed = def.projSpeed;
    proj.damage = stats.damage;
    proj.splash = stats.splash;
    proj.color = def.proj === 'fish' ? '#9ecfff' : '#f2a7c3';
    tower.squash = 0.16;
  }

  function updateProjectiles(dt, enemies, count) {
    for (let i = 0; i < projectiles.length; i += 1) {
      const proj = projectiles[i];
      if (!proj.active) continue;
      if (proj.target !== null && proj.target.active) {
        proj.lx = proj.target.x;
        proj.ly = proj.target.y;
      }
      const dx = proj.lx - proj.x;
      const dy = proj.ly - proj.y;
      const dist = Math.hypot(dx, dy);
      const stepLen = proj.speed * dt;
      if (dist <= stepLen + 4) {
        proj.active = false;
        if (proj.splash > 0) {
          fx.spawnBurst(proj.lx, proj.ly, '#9ecfff', 8, 90, 0.4, 3);
          for (let j = 0; j < count; j += 1) {
            const enemy = enemies[j];
            if (!enemy.active) continue;
            if (Math.hypot(enemy.x - proj.lx, enemy.y - proj.ly) <= proj.splash + enemy.radius) hitEnemy(enemy, proj.damage);
          }
        } else if (proj.target !== null && proj.target.active) {
          fx.spawnBurst(proj.lx, proj.ly, '#f2a7c3', 4, 60, 0.3, 2.5);
          hitEnemy(proj.target, proj.damage);
        }
      } else {
        proj.x += (dx / dist) * stepLen;
        proj.y += (dy / dist) * stepLen;
      }
    }
  }

  /**
   * One fixed step. Returns the enemies killed this step (a reused array — read it
   * before the next update). `now` is the world's sim time, for slow timers.
   */
  function update(dt, enemies, count, now) {
    killed.length = 0;
    for (let i = 0; i < towers.length; i += 1) {
      const tower = towers[i];
      if (!tower.active) continue;
      if (tower.squash > 0) tower.squash = Math.max(0, tower.squash - dt);
      const def = TOWER_TYPES[tower.type];
      const stats = towerStats(tower.type, tower.level);
      const range = stats.range * (tower.glow ? 1 + LIGHT.rangeBonus : 1);
      const damage = stats.damage * (tower.glow ? 1 + LIGHT.damageBonus : 1);
      if (def.aura) {
        tower.auraTimer -= dt;
        if (tower.auraTimer <= 0) {
          tower.auraTimer += 1 / stats.rate;
          let purred = false;
          for (let j = 0; j < count; j += 1) {
            const enemy = enemies[j];
            if (!enemy.active) continue;
            if (Math.hypot(enemy.x - tower.x, enemy.y - tower.y) > range + enemy.radius) continue;
            enemy.slowUntil = now + 0.7;
            enemy.slowFactor = stats.slow;
            purred = true;
            if (hitEnemy(enemy, damage)) tower.kills += 1;
          }
          if (purred) fx.spawnRing(tower.x, tower.y, range, def.color);
        }
        continue;
      }
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;
      const target = acquire(tower, range, enemies, count);
      if (target === null) continue;
      tower.cooldown += 1 / stats.rate;
      if (def.melee) {
        tower.squash = 0.18;
        fx.spawnArc(tower.x, tower.y, Math.atan2(target.y - tower.y, target.x - tower.x));
        if (hitEnemy(target, damage)) tower.kills += 1;
      } else {
        fireProjectile(tower, target, { damage, splash: stats.splash });
      }
    }
    updateProjectiles(dt, enemies, count);
    return killed;
  }

  return { towers, projectiles, place, remove, update, killed };
}
