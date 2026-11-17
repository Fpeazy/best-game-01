import { POOL } from './config.js';
export const TOWER_TYPES = {
  mochi: {
    key: 'mochi', name: 'Mochi', cost: 0, range: 120, damage: 7, rate: 1.25,
    color: '#f5a65b', ear: '#e08a3c', belly: '#ffe3b3', hat: 'none',
    desc: 'Hero cat, swats bugs', melee: true, canFly: false,
    upgrade: [50, 110],
  },
  yarn: {
    key: 'yarn', name: 'Yarnball Kitten', cost: 50, range: 155, damage: 9, rate: 0.9,
    color: '#f7d9e0', ear: '#e8a7bd', belly: '#fff0f4', hat: 'bow',
    desc: 'Lobs yarn balls', proj: 'yarn', projSpeed: 340, canFly: false,
    upgrade: [40, 70],
  },
  fish: {
    key: 'fish', name: 'Fish Tosser', cost: 100, range: 215, damage: 24, rate: 0.45,
    splash: 45, color: '#7ba7c9', ear: '#5a8ab0', belly: '#d8ecf7', hat: 'cap',
    desc: 'Throws fish, splash', proj: 'fish', projSpeed: 430, canFly: true,
    upgrade: [80, 140],
  },
  sleepy: {
    key: 'sleepy', name: 'Sleepy Guard', cost: 80, range: 135, damage: 2, rate: 2.0,
    slow: 0.6, aura: true, color: '#b8a7d9', ear: '#9a86c2', belly: '#e6ddf5', hat: 'nightcap',
    desc: 'Purrs, slows bugs', canFly: false,
    upgrade: [60, 110],
  },
  star: {
    key: 'star', name: 'Star Gazer', cost: 120, range: 260, damage: 55, rate: 0.35,
    color: '#ffd166', ear: '#e8a94e', belly: '#fff3c9', hat: 'wizard',
    desc: 'Snipes far, crits', proj: 'star', projSpeed: 600, canFly: true,
    upgrade: [90, 160],
  },
  frosty: {
    key: 'frosty', name: 'Frosty Kitten', cost: 90, range: 170, damage: 6, rate: 1.0,
    chill: 0.7, chillDur: 2.5, color: '#bfe3f2', ear: '#8ec9e0', belly: '#eaf7ff', hat: 'earmuffs',
    desc: 'Chills bugs, slows', proj: 'frost', projSpeed: 380, canFly: false,
    upgrade: [70, 120],
  },
}; export const MAX_LEVEL = 3;
export const TOWER_DAMAGE_MULT = 1.2; export const COMBO_WINDOW = 1.5;
export const STARFALL_DAMAGE = 150; export const STARFALL_PER_WAVE = 20;
export function towerStats(type, level) {
  const def = TOWER_TYPES[type]; const boost = 1 + 0.4 * (level - 1);
  const stats = {
    range: def.range * (1 + 0.12 * (level - 1)),
    damage: def.damage * boost * TOWER_DAMAGE_MULT,
    rate: def.rate * (1 + 0.12 * (level - 1)),
    splash: def.splash ?? 0,
    slow: def.slow ?? 0,
    chill: def.chill ?? 0,
    chillDur: def.chillDur ?? 0,
  };
  if (level >= 3) {
    if (type === 'fish') stats.splash *= 1.6; if (type === 'sleepy') stats.slow = 0.5;
    if (type === 'mochi') { stats.damage *= 1.5; stats.range *= 1.15; }
    if (type === 'frosty') { stats.chill = 0.35; stats.chillDur = 1.5; }
  }
  return stats;
}
export function upgradeCost(type, level) {
  const def = TOWER_TYPES[type]; if (level >= MAX_LEVEL) return null;
  return def.upgrade[level - 1];
}
export function canHit(tower, enemy) {
  if (!enemy.flying) return true; const def = TOWER_TYPES[tower.type];
  return def.canFly || tower.level >= 2;
}
export function damageAfterArmor(damage, armor) {
  return Math.max(1, Math.round(damage - armor));
}
export function createTowers(random, fx, glowAt) {
  const towers = [];
  for (let i = 0; i < 24; i += 1) {
    towers.push({ active: false, type: 'yarn', level: 1, x: 0, y: 0, cooldown: 0, squash: 0, invested: 0, glow: false, glowBonus: 0, kills: 0, auraTimer: 0, targetMode: 'first' });
  }
  const projectiles = [];
  for (let i = 0; i < POOL.projectiles; i += 1) {
    projectiles.push({
      active: false, kind: 'yarn', x: 0, y: 0, target: null, lx: 0, ly: 0, speed: 0,
      damage: 0, splash: 0, color: '#f2a7c3', chill: 0, chillDur: 0, crit: false,
    });
  }
  const killed = []; let combo = 0;
  let comboTimer = 0; let starfalls = 0;
  let cur = { rate: 1, range: 1, coins: 1, crit: 2, chain: false, bell: 0, starfall: 5, veil: false, comboMult: 1 };
  let curNow = 0; let curList = null;
  let curCount = 0;
  function triggerStarfall(enemies, count, wave) {
    let target = null;
    for (let i = 0; i < count; i += 1) {
      const enemy = enemies[i]; if (!enemy.active) continue;
      if (target === null || enemy.hp > target.hp) target = enemy;
    }
    if (target === null) return false; starfalls += 1;
    fx.spawnBeam(target.x, 0, target.y, 34, '#ffe9a8', 0.9);
    fx.spawnBurst(target.x, target.y, '#ffd166', 26, 200, 1.0, 4.5);
    fx.spawnBurst(target.x, target.y, '#fff6d8', 14, 130, 0.8, 3);
    fx.spawnRing(target.x, target.y, 190, '#ffd166');
    fx.spawnText(Math.min(1140, target.x + 240), 240, '★ STARFALL!', '#ffd166', 48); fx.triggerFlash(0.45);
    fx.triggerHitStop(0.15); fx.addTrauma(0.5);
    if (hitEnemy(target, STARFALL_DAMAGE + STARFALL_PER_WAVE * ((wave ?? 1) - 1), false)) killed.push(target);
    return true;
  }
  function resetCombo() {
    combo = 0; comboTimer = 0;
  }
  function freeTower() {
    for (let i = 0; i < towers.length; i += 1) if (!towers[i].active) return towers[i]; return null;
  }
  function freeProjectile() {
    for (let i = 0; i < projectiles.length; i += 1) if (!projectiles[i].active) return projectiles[i];
    return null;
  }
  function place(type, x, y, invested) {
    const tower = freeTower(); if (tower === null) return null;
    tower.active = true; tower.type = type;
    tower.level = 1; tower.x = x;
    tower.y = y; tower.cooldown = 0;
    tower.squash = 0; tower.invested = invested;
    tower.glowBonus = glowAt(x, y); tower.glow = tower.glowBonus > 0;
    tower.kills = 0; tower.auraTimer = 0;
    tower.targetMode = 'first'; return tower;
  }
  function remove(tower) {
    tower.active = false;
  }
  function acquire(tower, range, enemies, count) {
    let best = null; let bestBoss = null;
    let bestBossProgress = -1;
    for (let i = 0; i < count; i += 1) {
      const enemy = enemies[i]; if (!enemy.active || !canHit(tower, enemy)) continue;
      const dx = enemy.x - tower.x; const dy = enemy.y - tower.y;
      if (dx * dx + dy * dy > range * range) continue;
      if (enemy.type === 'boss' || enemy.type === 'queen') {
        if (enemy.progress > bestBossProgress) {
          bestBossProgress = enemy.progress; bestBoss = enemy;
        }
        continue;
      }
      if (best === null) { best = enemy; continue; }
      const mode = tower.targetMode ?? 'first'; if (mode === 'strongest' && enemy.hp > best.hp) best = enemy;
      else if (mode === 'weakest' && enemy.hp < best.hp) best = enemy;
      else if (mode === 'closest' && (dx * dx + dy * dy) < ((best.x - tower.x) ** 2 + (best.y - tower.y) ** 2)) best = enemy;
      else if (mode === 'last' && enemy.progress < best.progress) best = enemy;
      else if (mode === 'first' && enemy.progress > best.progress) best = enemy;
    }
    return bestBoss ?? best;
  }
  function hitEnemy(enemy, damage, crit, fromX) {
    if (!enemy.active) return false; let dealt = damage;
    if (cur.bell > 0 && curNow < enemy.slowUntil) dealt += cur.bell;
    if (cur.comboMult > 1) dealt = Math.round(dealt * cur.comboMult);
    const n = damageAfterArmor(dealt, enemy.armor); enemy.hp -= n;
    const nx = enemy.x + (fromX === undefined ? 0 : enemy.x >= fromX ? 36 : -36);
    if (crit) {
      fx.spawnText(nx, enemy.y - enemy.radius - 6, String(n), '#ffd166', 36);
      fx.spawnText(nx, enemy.y - enemy.radius - 34, 'CRIT!', '#ffd166', 22); fx.triggerHitStop(0.09);
      fx.addTrauma(0.3);
    } else {
      const size = n >= 100 ? 34 : n >= 50 ? 28 : n >= 25 ? 22 : n >= 10 ? 18 : 11;
      fx.spawnText(nx, enemy.y - enemy.radius - 6, String(n), n === 1 ? '#b8a67e' : '#fff6e8', size);
    }
    if (enemy.hp <= 0) {
      enemy.active = false; killed.push(enemy);
      if (cur.chain && curList !== null) {
        let near = null; let nd = 90;
        for (let i = 0; i < curCount; i += 1) {
          const e = curList[i]; if (!e.active || e === enemy) continue;
          const d = Math.hypot(e.x - enemy.x, e.y - enemy.y);
          if (d < nd) { nd = d; near = e; }
        }
        if (near !== null) {
          const c = damageAfterArmor(Math.round(dealt * 0.5), near.armor); near.hp -= c;
          fx.spawnText(near.x, near.y - near.radius - 6, String(c), '#c9a7f2', 18);
          fx.spawnText(near.x, near.y - near.radius - 30, 'CHAIN!', '#c9a7f2', 16);
          if (near.hp <= 0) { near.active = false; killed.push(near); }
        }
      }
      return true;
    }
    return false;
  }
  function fireProjectile(tower, target, stats) {
    const proj = freeProjectile(); if (proj === null) return;
    const def = TOWER_TYPES[tower.type]; proj.active = true;
    proj.kind = def.proj; proj.x = tower.x;
    proj.y = tower.y - 14; proj.tx = tower.x;
    proj.target = target; proj.lx = target.x;
    proj.ly = target.y; proj.speed = def.projSpeed;
    proj.damage = stats.damage; proj.splash = stats.splash;
    proj.chill = stats.chill; proj.chillDur = stats.chillDur;
    proj.crit = tower.type === 'star' && tower.level >= 3 && random() < 0.3;
    if (proj.crit) proj.damage *= cur.crit;
    proj.color = def.proj === 'fish' ? '#9ecfff' : def.proj === 'star' ? '#ffd166' : def.proj === 'frost' ? '#bfe3f2' : '#f2a7c3';
    tower.squash = 0.16;
  }
  function applyChill(enemy, proj, now) {
    if (proj.chill <= 0) return; enemy.slowUntil = now + proj.chillDur;
    enemy.slowFactor = proj.chill;
  }
  function updateProjectiles(dt, enemies, count, now) {
    for (let i = 0; i < projectiles.length; i += 1) {
      const proj = projectiles[i]; if (!proj.active) continue;
      if (proj.target !== null && proj.target.active) {
        proj.lx = proj.target.x; proj.ly = proj.target.y;
      }
      const dx = proj.lx - proj.x; const dy = proj.ly - proj.y;
      const dist = Math.hypot(dx, dy); const stepLen = proj.speed * dt;
      if (dist <= stepLen + 4) {
        proj.active = false;
        if (proj.splash > 0) {
          fx.spawnBurst(proj.lx, proj.ly, proj.color, 8, 90, 0.4, 3);
          for (let j = 0; j < count; j += 1) {
            const enemy = enemies[j]; if (!enemy.active) continue;
            if (Math.hypot(enemy.x - proj.lx, enemy.y - proj.ly) <= proj.splash + enemy.radius) hitEnemy(enemy, proj.damage, proj.crit, proj.tx);
          }
        } else if (proj.target !== null && proj.target.active) {
          fx.spawnBurst(proj.lx, proj.ly, proj.color, 4, 60, 0.3, 2.5); applyChill(proj.target, proj, now);
          if (hitEnemy(proj.target, proj.damage, proj.crit, proj.tx)) {
          }
        }
      } else {
        proj.x += (dx / dist) * stepLen; proj.y += (dy / dist) * stepLen;
      }
    }
  }
  function update(dt, enemies, count, now, mods) {
    killed.length = 0; cur = mods?.relic ?? cur;
    cur.comboMult = combo >= 2 ? Math.min(1.2, 1 + 0.05 * (combo - 1)) : 1; curNow = now;
    curList = enemies; curCount = count;
    const rangeMul = mods?.range ?? 1;
    for (let i = 0; i < towers.length; i += 1) {
      const tower = towers[i]; if (!tower.active) continue;
      if (tower.squash > 0) tower.squash = Math.max(0, tower.squash - dt);
      const def = TOWER_TYPES[tower.type]; const stats = towerStats(tower.type, tower.level);
      const range = stats.range * (1 + tower.glowBonus) * rangeMul * cur.range;
      const damage = stats.damage * (1 + tower.glowBonus) * (1 + (mods?.surge ?? 0));
      if (def.aura) {
        tower.auraTimer -= dt;
        if (tower.auraTimer <= 0) {
          tower.auraTimer += 1 / (stats.rate * cur.rate); let purred = false;
          for (let j = 0; j < count; j += 1) {
            const enemy = enemies[j]; if (!enemy.active) continue;
            if (Math.hypot(enemy.x - tower.x, enemy.y - tower.y) > range + enemy.radius) continue;
            enemy.slowUntil = now + 0.7; enemy.slowFactor = stats.slow;
            purred = true; if (hitEnemy(enemy, damage, false, tower.x)) tower.kills += 1;
          }
          if (purred) fx.spawnRing(tower.x, tower.y, range, def.color);
        }
        continue;
      }
      tower.cooldown -= dt; if (tower.cooldown > 0) continue;
      const target = acquire(tower, range, enemies, count);
      if (target === null) {
        tower.cooldown = 0; continue;
      }
      tower.cooldown += 1 / (stats.rate * cur.rate);
      if (def.melee) {
        tower.squash = 0.18;
        fx.spawnArc(tower.x, tower.y, Math.atan2(target.y - tower.y, target.x - tower.x));
        if (hitEnemy(target, damage, false, tower.x)) tower.kills += 1;
        if (tower.level >= 3 && target.active && hitEnemy(target, damage, false, tower.x)) tower.kills += 1;
      } else {
        fireProjectile(tower, target, { damage, splash: stats.splash, chill: stats.chill, chillDur: stats.chillDur });
        if (tower.type === 'yarn' && tower.level >= 3) fireProjectile(tower, target, { damage, splash: stats.splash, chill: stats.chill, chillDur: stats.chillDur });
      }
    }
    updateProjectiles(dt, enemies, count, now);
    if (comboTimer > 0) {
      comboTimer -= dt; if (comboTimer <= 0) combo = 0;
    }
    for (let k = 0; k < killed.length; k += 1) {
      combo = comboTimer > 0 ? combo + 1 : 1; comboTimer = COMBO_WINDOW;
      if (combo >= cur.starfall) {
        if (triggerStarfall(enemies, count, mods?.wave ?? 1)) {
          combo = 0; comboTimer = 0;
        } else {
          combo = cur.starfall - 1;
        }
        break;
      }
    }
    return killed;
  }
  return {
    towers, projectiles, place, remove, update, killed, resetCombo,
    damage: hitEnemy,
    get combo() { return combo; },
    get comboMult() { return cur.comboMult; },
    get starfalls() { return starfalls; },
  };
}
