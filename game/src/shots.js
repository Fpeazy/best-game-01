import { STEP } from './config.js';
import { MAX_POST_LEVEL, POST_UPGRADE_COST } from './config.js';
import { LANTERN_POSTS } from './garden.js';
import { PHASE_BUILD, PHASE_LOST, PHASE_WAVE, PHASE_WON } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** The longest a scene may run, in sim seconds — a stuck scene stops, never hangs. */
const MAX_SECONDS = 1200;

/** The autopilot's shopping list, in priority order, at every build phase. */
function autopilot(world) {
  const state = world.state;
  if (state.phase !== PHASE_BUILD) return;
  const plots = world.plots;
  const active = () => world.towers.towers.filter((t) => t.active);
  const bestEmpty = () => plots.find((p) => p.tower === null);

  function tryPlace(type) {
    const plot = bestEmpty();
    if (plot === undefined) return false;
    const index = plots.indexOf(plot);
    return world.placeTower(index, type) !== 0;
  }

  /** The post with the most towers in its glow — the best one to feed. */
  function bestPost() {
    let bestIndex = -1;
    let bestCount = -1;
    for (let i = 0; i < LANTERN_POSTS.length; i += 1) {
      let count = 0;
      for (const tower of active()) {
        if (Math.hypot(tower.x - LANTERN_POSTS[i].x, tower.y - LANTERN_POSTS[i].y) <= 170) count += 1;
      }
      if (count > bestCount) { bestCount = count; bestIndex = i; }
    }
    return bestIndex;
  }

  // 1. The hero grows up first.
  const mochi = active().find((t) => t.type === 'mochi');
  if (mochi !== undefined && mochi.level === 1 && state.wave >= 2 && state.coins >= 50) {
    world.upgradeTower(mochi);
  }
  // 2. One of each specialist: fish for the long lanes and the flying moths,
  // sleepy to slow the stream, star to snipe, frosty to chill.
  if (active().find((t) => t.type === 'fish') === undefined && state.coins >= 100) tryPlace('fish');
  if (active().find((t) => t.type === 'sleepy') === undefined && state.coins >= 80) tryPlace('sleepy');
  if (active().find((t) => t.type === 'star') === undefined && state.coins >= 120) tryPlace('star');
  if (active().find((t) => t.type === 'frosty') === undefined && state.coins >= 90) tryPlace('frosty');
  // 3. Yarnballs on the best plots.
  while (active().filter((t) => t.type === 'yarn').length < 4 && state.coins >= 50) {
    if (!tryPlace('yarn')) break;
  }
  // 4. Feed the best lantern post once the core is on the field.
  const post = bestPost();
  if (post >= 0 && state.postLevels[post] < 2 && state.coins >= POST_UPGRADE_COST[0]) {
    world.upgradePost(post);
  }
  // 5. Upgrades, cheapest first — re-read the live towers, because the ones just
  // placed are the ones that need levelling.
  const fish = active().find((t) => t.type === 'fish');
  const star = active().find((t) => t.type === 'star');
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
  // 6. Fill the garden, then level the new yarns too while the coins last.
  while (state.coins >= 50) {
    if (!tryPlace('yarn')) break;
  }
  for (const yarn of active().filter((t) => t.type === 'yarn')) {
    if (yarn.level === 1 && state.coins >= 40) world.upgradeTower(yarn);
  }
  // 7. A third post level if the purse allows.
  if (post >= 0 && state.postLevels[post] < MAX_POST_LEVEL && state.coins >= POST_UPGRADE_COST[1]) {
    world.upgradePost(post);
  }
  world.startWave();
}

function countAlive(world) {
  let n = 0;
  for (const enemy of world.enemies.list) if (enemy.active) n += 1;
  return n;
}

function bossOf(world) {
  for (const enemy of world.enemies.list) {
    if (enemy.active && enemy.type === 'boss') return enemy;
  }
  return null;
}

function countTowers(world) {
  let n = 0;
  for (const tower of world.towers.towers) if (tower.active) n += 1;
  return n;
}

/** Step the world forward until `done(state)` or the step cap, running the autopilot. */
function runUntil(world, done) {
  const limit = Math.floor(MAX_SECONDS / STEP);
  for (let i = 0; i < limit; i += 1) {
    autopilot(world);
    world.step(STEP, false);
    if (done(world.state)) return true;
  }
  return false;
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'title') {
    // A lively backdrop behind the title panel: four cats, one wave, no stakes.
    world.state.coins = 1000;
    const plots = world.plots;
    const picks = [0, 1, 2, 3];
    const types = ['yarn', 'fish', 'sleepy', 'star'];
    for (let i = 0; i < picks.length; i += 1) {
      world.placeTower(picks[i], types[i]);
    }
    world.state.coins = 150;
    world.startWave();
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, true);
    // Full festival flare behind the panel (Nemotron Stage 5): the title
    // backdrop must glow, not sit dim behind the panel.
    world.state.festival = 1;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Boss centre-left, festival up, escorts dense (FIX-ALL probe).
    runUntil(world, (state) => {
      if (state.phase !== PHASE_WAVE || state.wave !== 10) return false;
      const boss = bossOf(world);
      return boss !== null && boss.phase >= 2 && boss.x >= 350 && state.festival > 0.25 && countAlive(world) >= 6 && countTowers(world) >= 7;
    });
    // The phase banner expired on the walk here, so re-show it (staging, as
    // the title/win scenes already stage their festival): same real message.
    world.state.message = 'Phase 2 — the Moth grows angry!';
    world.state.messageTimer = 3;
    // Festival faded by the capture, so re-ignite it and step 0.15s for fresh
    // bursts — short enough that the STARFALL! text is still full-alpha.
    world.state.festival = 1;
    for (let i = 0; i < 0.15 / STEP; i += 1) world.step(STEP, true);
    // Fire the Flare Burst for the cover: a gold burst at the lantern, big
    // damage numbers in the air — the frame must read as a battle.
    if (world.state.phase === PHASE_WAVE) world.useAbility('flare');
    // STARFALL! rarely lands in this exact window (probe: 10 fired in the
    // run, none in the capture window), so stage one at the boss if none is
    // live — same staging as the flare, visuals only, no damage.
    const boss = bossOf(world);
    const live = world.fx.texts.some((t) => t.active && t.text === '★ STARFALL!');
    if (!live && boss !== null) {
      world.fx.spawnBeam(boss.x, 0, boss.y, 34, '#ffe9a8', 0.9);
      world.fx.spawnBurst(boss.x, boss.y, '#ffd166', 26, 200, 1.0, 4.5);
      world.fx.spawnBurst(boss.x, boss.y, '#fff6d8', 14, 130, 0.8, 3);
      world.fx.spawnRing(boss.x, boss.y, 190, '#ffd166');
      world.fx.spawnText(boss.x, boss.y - boss.radius - 70, '★ STARFALL!', '#ffd166', 28);
    }
    // Let the bursts spread before the frame freezes, or they read as dots
    // clustered at the spawn point.
    for (let i = 0; i < 0.12 / STEP; i += 1) world.step(STEP, true);
    const over = world.state.phase === PHASE_LOST;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    // The boss in its final, flying phase: red eyes, crown, straight at the
    // lantern with its moth escort — the most dramatic single moment.
    runUntil(world, () => {
      const boss = bossOf(world);
      return boss !== null && boss.phase === 3 && boss.progress > 0.1 && countAlive(world) >= 2;
    });
    // Lantern Surge for the boss shot: every tower blazing gold as the Moth flies.
    if (world.state.phase === PHASE_WAVE) world.useAbility('surge');
    const over = world.state.phase === PHASE_LOST;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  // win
  runUntil(world, (state) => state.phase === PHASE_WON || state.phase === PHASE_LOST);
  world.state.festival = 1;
  for (let i = 0; i < 0.6 / STEP; i += 1) world.step(STEP, true);
  // Gold enlarged again (56/220/9 + second cluster 28/140/6) and pink
  // softened (16/140/5) so gold finally reads as strong as pink.
  world.fx.spawnBurst(115, 560, '#ffd166', 56, 220, 0.9, 9);
  world.fx.spawnBurst(200, 580, '#ffd166', 28, 140, 0.9, 6);
  world.fx.spawnBurst(1130, 140, '#ff9ec6', 16, 140, 0.9, 5);
  // Let the bursts spread before the frame freezes, or they read as dots.
  for (let i = 0; i < 0.25 / STEP; i += 1) world.step(STEP, true);
  const won = world.state.phase === PHASE_WON;
  return { screen: won ? SCREEN_WIN : SCREEN_OVER, best: world.state.score };
}
