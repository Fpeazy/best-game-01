// The deterministic screenshot scenes behind ?shot=title|play|boss|win. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (buy the best plots first, upgrade the hero, start every wave), so
// the frame is what a real game looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
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

  // 1. The hero grows up first.
  const mochi = active().find((t) => t.type === 'mochi');
  if (mochi !== undefined && mochi.level === 1 && state.wave >= 2 && state.coins >= 50) {
    world.upgradeTower(mochi);
  }
  // 2. One fish tosser for the long lanes and the flying moths.
  if (active().find((t) => t.type === 'fish') === undefined && state.coins >= 100) tryPlace('fish');
  // 3. One sleepy guard to slow the stream.
  if (active().find((t) => t.type === 'sleepy') === undefined && state.coins >= 80) tryPlace('sleepy');
  // 4. Yarnballs on the best plots.
  while (active().filter((t) => t.type === 'yarn').length < 4 && state.coins >= 50) {
    if (!tryPlace('yarn')) break;
  }
  // 5. Upgrades, cheapest first — re-read the live towers, because the ones just
  // placed are the ones that need levelling.
  const fish = active().find((t) => t.type === 'fish');
  const yarns = active().filter((t) => t.type === 'yarn');
  const hero = active().find((t) => t.type === 'mochi');
  if (fish !== undefined && fish.level === 1 && state.coins >= 80) world.upgradeTower(fish);
  for (const yarn of yarns) {
    if (yarn.level === 1 && state.coins >= 40) world.upgradeTower(yarn);
  }
  if (hero !== undefined && hero.level === 2 && state.coins >= 110) world.upgradeTower(hero);
  if (fish !== undefined && fish.level === 2 && state.coins >= 140) world.upgradeTower(fish);
  // 6. Fill the garden, then level the new yarns too while the coins last.
  while (state.coins >= 50) {
    if (!tryPlace('yarn')) break;
  }
  for (const yarn of active().filter((t) => t.type === 'yarn')) {
    if (yarn.level === 1 && state.coins >= 40) world.upgradeTower(yarn);
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
    // A lively backdrop behind the title panel: three cats, one wave, no stakes.
    const plots = world.plots;
    const picks = [0, 1, 2];
    const types = ['yarn', 'fish', 'sleepy'];
    for (let i = 0; i < picks.length; i += 1) {
      world.placeTower(picks[i], types[i]);
    }
    world.state.coins = 150;
    world.startWave();
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    runUntil(world, (state) => state.phase === PHASE_WAVE && state.wave === 5 && countAlive(world) >= 5 && leadProgress(world) > 0.25);
    const over = world.state.phase === PHASE_LOST;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    runUntil(world, () => {
      const boss = bossOf(world);
      return boss !== null && boss.progress > 0.3 && countAlive(world) >= 4;
    });
    const over = world.state.phase === PHASE_LOST;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  // win
  runUntil(world, (state) => state.phase === PHASE_WON || state.phase === PHASE_LOST);
  const won = world.state.phase === PHASE_WON;
  return { screen: won ? SCREEN_WIN : SCREEN_OVER, best: world.state.score };
}
