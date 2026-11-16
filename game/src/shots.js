// The deterministic screenshot scenes behind ?shot=title|play|boss|win. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (buy the best plots first, upgrade the hero, start every wave), so
// the frame is what a real game looks like and the same seed always gives the same frame.
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

/** How far along the path the furthest living bug has got (0..1). */
function leadProgress(world) {
  let best = 0;
  for (const enemy of world.enemies.list) {
    if (enemy.active && enemy.progress > best) best = enemy.progress;
  }
  return best;
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

/**
 * Set `world` to the named scene (title, play, boss or win; any other name is title)
 * and return the screen to draw over it and the best score to show.
 */
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
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Wave 7, with a mutator running and a full garden: the busiest, brightest frame.
    runUntil(world, (state) => state.phase === PHASE_WAVE && state.wave === 7 && countAlive(world) >= 8 && leadProgress(world) > 0.2 && countTowers(world) >= 7);
    const over = world.state.phase === PHASE_LOST;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    // The boss in its angry second phase, mid-field in the lantern light.
    runUntil(world, () => {
      const boss = bossOf(world);
      return boss !== null && boss.phase >= 2 && boss.progress > 0.15 && countAlive(world) >= 3;
    });
    const over = world.state.phase === PHASE_LOST;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  // win
  runUntil(world, (state) => state.phase === PHASE_WON || state.phase === PHASE_LOST);
  const won = world.state.phase === PHASE_WON;
  return { screen: won ? SCREEN_WIN : SCREEN_OVER, best: world.state.score };
}
