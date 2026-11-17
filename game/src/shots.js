import { STEP } from './config.js'; import { MAX_POST_LEVEL, POST_UPGRADE_COST } from './config.js';
import { LANTERN_POSTS } from './garden.js';
import { PHASE_BUILD, PHASE_LOST, PHASE_WAVE, PHASE_WON } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js'; const MAX_SECONDS = 1200;
function autopilot(world) {
  const state = world.state;
  if (state.draft !== null) { world.pickRelic(0); return; }
  if (state.phase !== PHASE_BUILD) return; const plots = world.plots;
  const active = () => world.towers.towers.filter((t) => t.active);
  const bestEmpty = () => plots.find((p) => p.tower === null);
  function tryPlace(type) {
    const plot = bestEmpty(); if (plot === undefined) return false;
    const index = plots.indexOf(plot); return world.placeTower(index, type) !== 0;
  }
  function bestPost() {
    let bestIndex = -1; let bestCount = -1;
    for (let i = 0; i < LANTERN_POSTS.length; i += 1) {
      let count = 0;
      for (const tower of active()) {
        if (Math.hypot(tower.x - LANTERN_POSTS[i].x, tower.y - LANTERN_POSTS[i].y) <= 170) count += 1;
      }
      if (count > bestCount) { bestCount = count; bestIndex = i; }
    }
    return bestIndex;
  }
  const mochi = active().find((t) => t.type === 'mochi');
  if (mochi !== undefined && mochi.level === 1 && state.wave >= 2 && state.coins >= 50) {
    world.upgradeTower(mochi);
  }
  if (active().find((t) => t.type === 'fish') === undefined && state.coins >= 100) tryPlace('fish');
  if (active().find((t) => t.type === 'sleepy') === undefined && state.coins >= 80) tryPlace('sleepy');
  if (active().find((t) => t.type === 'star') === undefined && state.coins >= 120) tryPlace('star');
  if (active().find((t) => t.type === 'frosty') === undefined && state.coins >= 90) tryPlace('frosty');
  while (active().filter((t) => t.type === 'yarn').length < 4 && state.coins >= 50) {
    if (!tryPlace('yarn')) break;
  }
  const post = bestPost();
  if (post >= 0 && state.postLevels[post] < 2 && state.coins >= POST_UPGRADE_COST[0]) {
    world.upgradePost(post);
  }
  const fish = active().find((t) => t.type === 'fish'); const star = active().find((t) => t.type === 'star');
  const frosty = active().find((t) => t.type === 'frosty');
  const sleepy = active().find((t) => t.type === 'sleepy');
  const yarns = active().filter((t) => t.type === 'yarn');
  const hero = active().find((t) => t.type === 'mochi');
  if (fish !== undefined && fish.level === 1 && state.coins >= 80) world.upgradeTower(fish);
  for (const yarn of yarns) {
    if (yarn.level === 1 && state.coins >= 40) world.upgradeTower(yarn);
  }
  if (frosty !== undefined && frosty.level === 1 && state.coins >= 70) world.upgradeTower(frosty);
  if (sleepy !== undefined && sleepy.level === 1 && state.coins >= 60) world.upgradeTower(sleepy);
  if (star !== undefined && star.level === 1 && state.coins >= 90) world.upgradeTower(star);
  if (hero !== undefined && hero.level === 2 && state.coins >= 110) world.upgradeTower(hero);
  if (fish !== undefined && fish.level === 2 && state.coins >= 140) world.upgradeTower(fish);
  if (star !== undefined && star.level === 2 && state.coins >= 160) world.upgradeTower(star);
  if (frosty !== undefined && frosty.level === 2 && state.coins >= 120) world.upgradeTower(frosty);
  if (sleepy !== undefined && sleepy.level === 2 && state.coins >= 110) world.upgradeTower(sleepy);
  for (const yarn of active().filter((t) => t.type === 'yarn')) {
    if (yarn.level === 2 && state.coins >= 70) world.upgradeTower(yarn);
  }
  while (state.coins >= 50) {
    if (!tryPlace('yarn')) break;
  }
  for (const yarn of active().filter((t) => t.type === 'yarn')) {
    if (yarn.level === 1 && state.coins >= 40) world.upgradeTower(yarn);
  }
  if (post >= 0 && state.postLevels[post] < MAX_POST_LEVEL && state.coins >= POST_UPGRADE_COST[1]) {
    world.upgradePost(post);
  }
  world.startWave();
}
function countAlive(world) {
  let n = 0; for (const enemy of world.enemies.list) if (enemy.active) n += 1;
  return n;
}
function bossOf(world) {
  for (const enemy of world.enemies.list) {
    if (enemy.active && enemy.type === 'boss') return enemy;
  }
  return null;
}
function countTowers(world) {
  let n = 0; for (const tower of world.towers.towers) if (tower.active) n += 1;
  return n;
}
function runUntil(world, done) {
  const limit = Math.floor(MAX_SECONDS / STEP);
  for (let i = 0; i < limit; i += 1) {
    autopilot(world); world.step(STEP, false);
    if (done(world.state)) return true;
  }
  return false;
}
function demoProfile() {
  return {
    v: 2, best: 20880, wins: 2, games: 5,
    feats: { firstwin: true, relic3: true, combo5: true },
    runs: [
      { s: 20880, k: 214, w: 10, win: true, d: 'normal', g: 'A', seed: 1 },
      { s: 16400, k: 180, w: 9, win: false, d: 'normal', g: 'B', seed: 2 },
      { s: 19230, k: 201, w: 10, win: true, d: 'easy', g: 'A', seed: 3 },
    ],
    seen: ['wick', 'bell', 'jar'],
  };
}
export function stageShot(name, world) {
  world.reset();
  if (name === 'title') {
    world.state.coins = 1000; const plots = world.plots;
    const picks = [0, 1, 2, 3]; const types = ['yarn', 'fish', 'sleepy', 'star'];
    for (let i = 0; i < picks.length; i += 1) {
      world.placeTower(picks[i], types[i]);
    }
    world.state.coins = 150; world.startWave();
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, true); world.state.festival = 1;
    return { screen: SCREEN_TITLE, best: 20880, profile: demoProfile() };
  }
  if (name === 'draft') {
    runUntil(world, (state) => state.draft !== null); world.state.draftHover = 1;
    world.state.festival = 0.6; for (let i = 0; i < 0.3 / STEP; i += 1) world.step(STEP, true);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'play') {
    runUntil(world, (state) => {
      if (state.phase !== PHASE_WAVE || state.wave !== 10) return false; const boss = bossOf(world);
      return boss !== null && boss.phase >= 2 && boss.x >= 350 && countAlive(world) >= 4 && countTowers(world) >= 7;
    }); const stageBoss = bossOf(world); world.state.message = stageBoss !== null && stageBoss.phase === 3 ? 'Phase 3 — it flies! Only fish & star cats can hit it!' : 'Phase 2 — the Moth grows angry!';
    world.state.messageTimer = 3; world.state.festival = 1;
    for (let i = 0; i < 0.15 / STEP; i += 1) world.step(STEP, true);
    if (world.state.phase === PHASE_WAVE) world.useAbility('flare'); const boss = bossOf(world);
    const live = world.fx.texts.some((t) => t.active && t.text === '★ STARFALL!');
    if (!live && boss !== null) {
      world.fx.spawnBeam(boss.x, 0, boss.y, 34, '#ffe9a8', 0.9);
      world.fx.spawnBurst(boss.x, boss.y, '#ffd166', 26, 200, 1.0, 4.5);
      world.fx.spawnBurst(boss.x, boss.y, '#fff6d8', 14, 130, 0.8, 3);
      world.fx.spawnRing(boss.x, boss.y, 190, '#ffd166');
      world.fx.spawnText(Math.min(1140, boss.x + 240), 240, '★ STARFALL!', '#ffd166', 48);
    }
    for (let i = 0; i < 0.12 / STEP; i += 1) world.step(STEP, true);
    const over = world.state.phase === PHASE_LOST;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  runUntil(world, (state) => state.phase === PHASE_WON || state.phase === PHASE_LOST);
  world.state.festival = 1; for (let i = 0; i < 0.6 / STEP; i += 1) world.step(STEP, true);
  world.fx.spawnBurst(115, 560, '#ffd166', 64, 220, 0.9, 9);
  world.fx.spawnBurst(200, 580, '#ffd166', 36, 140, 0.9, 6);
  world.fx.spawnBurst(1130, 140, '#ff9ec6', 11, 140, 0.9, 4);
  for (let i = 0; i < 0.25 / STEP; i += 1) world.step(STEP, true);
  const won = world.state.phase === PHASE_WON;
  return { screen: won ? SCREEN_WIN : SCREEN_OVER, best: world.state.score, profile: demoProfile(), runFeats: ['firstwin', 'relic3', 'bossslayer'] };
}
