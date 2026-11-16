// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one, doubled at 2x speed),
// and the renderer paints what is there. Five screens: title, play, paused,
// win and game over.
//
// ?seed=N fixes the bug pattern. ?shot=title|play|boss|win (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BOSS, EVENT_BOSS_PHASE, EVENT_KILL, EVENT_LEAK, EVENT_MUTATOR, EVENT_OVER,
  EVENT_PLACE, EVENT_POST, EVENT_SELL, EVENT_UPGRADE, EVENT_WAVE_CLEAR, EVENT_WIN,
  EVENT_ABILITY, PHASE_BUILD, createWorld,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_LONGNIGHT, ACTION_MUTE, ACTION_PAUSE, ACTION_SELL, ACTION_SPEED,
  ACTION_TOWER_1, ACTION_TOWER_2, ACTION_TOWER_3, ACTION_TOWER_4, ACTION_TOWER_5,
  ACTION_TOWER_6, ACTION_UPGRADE, ACTION_ABILITY_FLARE, ACTION_ABILITY_SURGE,
  ACTION_ABILITY_PURR, ACTION_TARGET_CYCLE, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { DIFF_BUTTONS, LONGNIGHT_BUTTON, OVER_BUTTON, TITLE_BUTTON, WIN_BUTTON, drawOver, drawPaused, drawTitle, drawWin } from './screens.js';
import { hitTest } from './ui.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
// Exposed for headless playtests (and curious players): the live game state.
window.__world = world;
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, 1);
    if (scene.screen === SCREEN_TITLE) drawTitle(renderer.context, renderer.text, renderer.drawCat, world, scene.best);
    else if (scene.screen === SCREEN_WIN) drawWin(renderer.context, renderer.text, world, scene.best);
    else if (scene.screen === SCREEN_OVER) drawOver(renderer.context, renderer.text, world, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toField);
  const audio = createAudio();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let speed = 1;
  let accumulator = 0;
  let last = performance.now();
  let lastHitSound = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Protect the lantern through 10 waves.');
  }

  function startLongNight() {
    world.startEndless();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('The Long Night begins. How many nights can the cats hold?');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `You win! Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleEvents(events) {
    const now = performance.now();
    if (events & EVENT_KILL && now - lastHitSound > 120) {
      lastHitSound = now;
      audio.hit();
      audio.coin();
    }
    if (events & EVENT_LEAK) audio.leak();
    if (events & EVENT_WAVE_CLEAR) audio.waveClear();
    if (events & EVENT_WIN) {
      audio.win();
      endGame(true);
    } else if (events & EVENT_OVER) {
      audio.lose();
      endGame(false);
    }
    if (events & EVENT_BOSS) audio.boss();
    if (events & EVENT_BOSS_PHASE) audio.phase();
    if (events & EVENT_MUTATOR) audio.mutator();
    if (events & EVENT_ABILITY) audio.ability();
    if (events & EVENT_PLACE) audio.place();
    if (events & EVENT_UPGRADE) audio.upgrade();
    if (events & EVENT_POST) audio.upgrade();
    if (events & EVENT_SELL) audio.sell();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_SPEED && screen === SCREEN_PLAY) {
      speed = speed === 1 ? 2 : 1;
      announce(`Speed ${speed}x.`);
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_LONGNIGHT && screen === SCREEN_WIN) {
      audio.unlock();
      startLongNight();
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    const towerKeys = [ACTION_TOWER_1, ACTION_TOWER_2, ACTION_TOWER_3, ACTION_TOWER_4, ACTION_TOWER_5, ACTION_TOWER_6];
    const towerTypes = ['yarn', 'fish', 'sleepy', 'star', 'frosty', 'mochi'];
    const difficulties = ['easy', 'normal', 'hard'];
    if (screen === SCREEN_TITLE) {
      // Keys 1-3 pick a difficulty on the title screen.
      for (let i = 0; i < 3; i += 1) {
        if (actions & towerKeys[i]) {
          world.setDifficulty(difficulties[i]);
          announce(`Difficulty: ${difficulties[i]}.`);
        }
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_ABILITY_FLARE) handleEvents(world.useAbility('flare'));
    if (actions & ACTION_ABILITY_SURGE) handleEvents(world.useAbility('surge'));
    if (actions & ACTION_ABILITY_PURR) handleEvents(world.useAbility('purr'));
    if (actions & ACTION_TARGET_CYCLE && world.state.selected !== null) {
      const label = world.cycleTarget(world.state.selected);
      if (label !== null) announce(`Target: ${label}.`);
    }
    for (let i = 0; i < towerKeys.length; i += 1) {
      if (actions & towerKeys[i]) {
        world.state.placing = world.state.placing === towerTypes[i] ? null : towerTypes[i];
        world.state.selected = null;
        world.state.selectedPost = null;
      }
    }
    if (actions & ACTION_UPGRADE && world.state.selected !== null) {
      handleEvents(world.upgradeTower(world.state.selected));
    }
    if (actions & ACTION_SELL && world.state.selected !== null) {
      handleEvents(world.sellTower(world.state.selected));
    }
  }

  function inside(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }

  function handleClick() {
    const click = input.takeClick();
    if (click === null) return;
    audio.unlock();
    if (screen === SCREEN_TITLE) {
      for (const buttonDef of DIFF_BUTTONS) {
        if (inside(click.x, click.y, buttonDef.rect)) {
          world.setDifficulty(buttonDef.key);
          audio.click();
          return;
        }
      }
      if (inside(click.x, click.y, TITLE_BUTTON)) startGame();
      return;
    }
    if (screen === SCREEN_WIN) {
      if (inside(click.x, click.y, WIN_BUTTON)) startGame();
      else if (inside(click.x, click.y, LONGNIGHT_BUTTON)) startLongNight();
      return;
    }
    if (screen === SCREEN_OVER) {
      if (inside(click.x, click.y, OVER_BUTTON)) startGame();
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const hit = hitTest(click.x, click.y, world);
    if (hit === null) {
      world.state.placing = null;
      world.state.selected = null;
      world.state.selectedPost = null;
      return;
    }
    if (hit.kind === 'button') {
      if (hit.name === 'pause') screen = SCREEN_PAUSED;
      else if (hit.name === 'speed') speed = speed === 1 ? 2 : 1;
      else if (hit.name === 'mute') audio.toggleMute();
      return;
    }
    if (hit.kind === 'ability') {
      handleEvents(world.useAbility(hit.key));
      return;
    }
    if (hit.kind === 'target' && world.state.selected !== null) {
      const label = world.cycleTarget(world.state.selected);
      if (label !== null) announce(`Target: ${label}.`);
      return;
    }
    if (hit.kind === 'startWave') {
      world.startWave();
      return;
    }
    if (hit.kind === 'shop') {
      if (hit.type === 'mochi') {
        world.state.placing = null;
        announce('Mochi is already on the field — the hero cat cannot be bought.');
        return;
      }
      world.state.placing = world.state.placing === hit.type ? null : hit.type;
      world.state.selected = null;
      world.state.selectedPost = null;
      return;
    }
    if (hit.kind === 'plot') {
      if (world.state.placing !== null) {
        const events = world.placeTower(hit.index, world.state.placing);
        handleEvents(events);
        if (events !== 0) world.state.placing = null;
      }
      return;
    }
    if (hit.kind === 'tower') {
      world.state.selected = hit.tower;
      world.state.selectedPost = null;
      world.state.placing = null;
      return;
    }
    if (hit.kind === 'post') {
      world.state.selectedPost = hit.index;
      world.state.selected = null;
      world.state.placing = null;
      return;
    }
    if (hit.kind === 'postUpgrade' && world.state.selectedPost !== null) {
      handleEvents(world.upgradePost(world.state.selectedPost));
      return;
    }
    if (hit.kind === 'upgrade' && world.state.selected !== null) {
      handleEvents(world.upgradeTower(world.state.selected));
      return;
    }
    if (hit.kind === 'sell' && world.state.selected !== null) {
      handleEvents(world.sellTower(world.state.selected));
    }
  }

  function updateHover() {
    const pointer = input.pointer;
    world.state.hoverPlot = -1;
    world.state.hoverTower = null;
    if (pointer.x < 0 || screen !== SCREEN_PLAY) return;
    for (let i = 0; i < world.plots.length; i += 1) {
      const plot = world.plots[i];
      if (Math.hypot(pointer.x - plot.x, pointer.y - plot.y) <= plot.radius + 6) {
        world.state.hoverPlot = i;
        world.state.hoverTower = plot.tower;
        return;
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, true);
      return;
    }
    const events = world.step(STEP, false);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const realDt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handleClick();
    updateHover();
    // Hit-stop (game-feel, large tier): the sim freezes for a beat on crits and
    // boss phase changes, while the shake trauma decays on real time so the
    // camera never freezes off-centre. Input still registers through it.
    if (world.fx.hitStop > 0) {
      world.fx.hitStop = Math.max(0, world.fx.hitStop - realDt);
      world.fx.decayTrauma(realDt);
      accumulator = 0;
    } else if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      accumulator += realDt * speed;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best, speed);
    if (screen === SCREEN_TITLE) drawTitle(renderer.context, renderer.text, renderer.drawCat, world, best);
    else if (screen === SCREEN_PAUSED) drawPaused(renderer.context, renderer.text);
    else if (screen === SCREEN_WIN) drawWin(renderer.context, renderer.text, world, best);
    else if (screen === SCREEN_OVER) drawOver(renderer.context, renderer.text, world, best);
  }

  // Leaving the tab pauses a running game rather than letting bugs march unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce("Mochi's Lantern Garden. Press Space or click to start.");
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
