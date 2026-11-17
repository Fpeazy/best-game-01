import { STEP } from './config.js'; import { createRandom } from './random.js';
import {
  EVENT_BOSS, EVENT_BOSS_PHASE, EVENT_KILL, EVENT_LEAK, EVENT_MUTATOR, EVENT_OVER,
  EVENT_PLACE, EVENT_POST, EVENT_SELL, EVENT_UPGRADE, EVENT_WAVE_CLEAR, EVENT_WIN,
  EVENT_ABILITY, createWorld,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_LONGNIGHT, ACTION_MUTE, ACTION_PAUSE, ACTION_SELL, ACTION_SPEED,
  ACTION_TOWER_1, ACTION_TOWER_2, ACTION_TOWER_3, ACTION_TOWER_4, ACTION_TOWER_5,
  ACTION_TOWER_6, ACTION_UPGRADE, ACTION_ABILITY_FLARE, ACTION_ABILITY_SURGE,
  ACTION_ABILITY_PURR, ACTION_TARGET_CYCLE, createInput,
} from './input.js'; import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { DIFF_BUTTONS, LONGNIGHT_BUTTON, OVER_BUTTON, TITLE_BUTTON, WIN_BUTTON, WIN_MENU_BUTTON, WIN_SAMESEED_BUTTON, drawDraft, drawOver, drawPaused, drawTitle, drawWin } from './screens.js';
import { draftCardRects, hitTest } from './ui.js';
import { featsForRun, loadProfile, recordRun, saveProfile } from './profile.js';
import { stageShot } from './shots.js'; const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search); const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const canvas = document.getElementById('game'); const status = document.getElementById('status');
const w = createWorld(createRandom(seed), seed); window.__world = w;
const renderer = createRenderer(canvas);
function runShot(name) {
  const scene = stageShot(name, w); let painted = 0;
  function paint() {
    renderer.draw(w, scene.screen, scene.best, 1);
    if (scene.screen === SCREEN_TITLE) drawTitle(renderer.context, renderer.text, renderer.drawCat, w, scene.best, scene.profile);
    else if (scene.screen === SCREEN_WIN) drawWin(renderer.context, renderer.text, w, scene.best, scene.profile, scene.runFeats);
    else if (scene.screen === SCREEN_OVER) drawOver(renderer.context, renderer.text, w, scene.best, scene.runFeats);
    else if (w.state.draft !== null) drawDraft(renderer.context, renderer.text, w); painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}
function runGame() {
  const input = createInput(canvas, renderer.toField); const audio = createAudio();
  let screen = SCREEN_TITLE; const profile = loadProfile();
  let best = profile.best; let lastRunFeats = [];
  let speed = 1; let accumulator = 0;
  let last = performance.now(); let lastHitSound = 0;
  function announce(message) {
    status.textContent = message;
  }
  function startGame() {
    w.reset(); lastRunFeats = [];
    accumulator = 0; screen = SCREEN_PLAY;
    announce('Playing. Protect the lantern through 10 waves.');
  }
  function startSameSeed() {
    w.reseed(seed); lastRunFeats = [];
    accumulator = 0; screen = SCREEN_PLAY;
    announce(`Same seed ${seed}. The same garden, the same bugs.`);
  }
  function toMenu() {
    w.reset(); screen = SCREEN_TITLE;
    announce("Mochi's Lantern Garden. Press Space or click to start.");
  }
  function startLongNight() {
    w.startEndless(); accumulator = 0;
    screen = SCREEN_PLAY; announce('The Long Night begins. How many nights can the cats hold?');
  }
  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER; lastRunFeats = featsForRun(w, won);
    recordRun(profile, w, won, lastRunFeats); saveProfile(profile);
    best = profile.best;
    announce(won ? `You win! Score ${w.state.score}.` : `Game over. Score ${w.state.score}. Best ${best}.`);
  }
  function handleEvents(events) {
    const now = performance.now();
    if (events & EVENT_KILL && now - lastHitSound > 120) {
      lastHitSound = now; audio.hit();
      audio.coin();
    }
    if (events & EVENT_LEAK) audio.leak(); if (events & EVENT_WAVE_CLEAR) audio.waveClear();
    if (events & EVENT_WIN) {
      audio.win(); endGame(true);
    } else if (events & EVENT_OVER) {
      audio.lose(); endGame(false);
    }
    if (events & EVENT_BOSS) audio.boss(); if (events & EVENT_BOSS_PHASE) audio.phase();
    if (events & EVENT_MUTATOR) audio.mutator(); if (events & EVENT_ABILITY) audio.ability();
    if (events & EVENT_PLACE) audio.place(); if (events & EVENT_UPGRADE) audio.upgrade();
    if (events & EVENT_POST) audio.upgrade(); if (events & EVENT_SELL) audio.sell();
  }
  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute(); announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_SPEED && screen === SCREEN_PLAY) {
      speed = speed === 1 ? 2 : 1; announce(`Speed ${speed}x.`);
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY; announce('Playing.');
      }
    }
    if (actions & ACTION_LONGNIGHT && screen === SCREEN_WIN) {
      audio.unlock(); startLongNight();
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED; announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY; announce('Playing.');
      }
    }
    const towerKeys = [ACTION_TOWER_1, ACTION_TOWER_2, ACTION_TOWER_3, ACTION_TOWER_4, ACTION_TOWER_5, ACTION_TOWER_6];
    const towerTypes = ['yarn', 'fish', 'sleepy', 'star', 'frosty', 'mochi'];
    const difficulties = ['easy', 'normal', 'hard'];
    if (screen === SCREEN_TITLE) {
      for (let i = 0; i < 3; i += 1) {
        if (actions & towerKeys[i]) {
          w.setDifficulty(difficulties[i]); announce(`Difficulty: ${difficulties[i]}.`);
        }
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (w.state.draft !== null) {
      for (let i = 0; i < 3; i += 1) {
        if (actions & towerKeys[i]) {
          handleEvents(w.pickRelic(i)); return;
        }
      }
      return;
    }
    if (actions & ACTION_ABILITY_FLARE) handleEvents(w.useAbility('flare'));
    if (actions & ACTION_ABILITY_SURGE) handleEvents(w.useAbility('surge'));
    if (actions & ACTION_ABILITY_PURR) handleEvents(w.useAbility('purr'));
    if (actions & ACTION_TARGET_CYCLE && w.state.selected !== null) {
      const label = w.cycleTarget(w.state.selected); if (label !== null) announce(`Target: ${label}.`);
    }
    for (let i = 0; i < towerKeys.length; i += 1) {
      if (actions & towerKeys[i]) {
        w.state.placing = w.state.placing === towerTypes[i] ? null : towerTypes[i]; w.state.selected = null;
        w.state.selectedPost = null;
      }
    }
    if (actions & ACTION_UPGRADE && w.state.selected !== null) {
      handleEvents(w.upgradeTower(w.state.selected));
    }
    if (actions & ACTION_SELL && w.state.selected !== null) {
      handleEvents(w.sellTower(w.state.selected));
    }
  }
  function inside(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }
  function handleClick() {
    const click = input.takeClick(); if (click === null) return;
    audio.unlock();
    if (screen === SCREEN_TITLE) {
      for (const buttonDef of DIFF_BUTTONS) {
        if (inside(click.x, click.y, buttonDef.rect)) {
          w.setDifficulty(buttonDef.key); audio.click();
          return;
        }
      }
      if (inside(click.x, click.y, TITLE_BUTTON)) startGame(); return;
    }
    if (screen === SCREEN_WIN) {
      if (inside(click.x, click.y, WIN_BUTTON)) startGame();
      else if (inside(click.x, click.y, WIN_SAMESEED_BUTTON)) startSameSeed();
      else if (inside(click.x, click.y, LONGNIGHT_BUTTON)) startLongNight();
      else if (inside(click.x, click.y, WIN_MENU_BUTTON)) toMenu(); return;
    }
    if (screen === SCREEN_OVER) {
      if (inside(click.x, click.y, OVER_BUTTON)) startGame(); return;
    }
    if (screen !== SCREEN_PLAY) return; const hit = hitTest(click.x, click.y, w);
    if (hit === null) {
      w.state.placing = null; w.state.selected = null;
      w.state.selectedPost = null; return;
    }
    if (hit.kind === 'draft') {
      handleEvents(w.pickRelic(hit.index)); return;
    }
    if (hit.kind === 'draftBack') return;
    if (hit.kind === 'button') {
      if (hit.name === 'pause') screen = SCREEN_PAUSED;
      else if (hit.name === 'speed') speed = speed === 1 ? 2 : 1;
      else if (hit.name === 'mute') audio.toggleMute(); return;
    }
    if (hit.kind === 'ability') {
      handleEvents(w.useAbility(hit.key)); return;
    }
    if (hit.kind === 'target' && w.state.selected !== null) {
      const label = w.cycleTarget(w.state.selected); if (label !== null) announce(`Target: ${label}.`);
      return;
    }
    if (hit.kind === 'startWave') {
      w.startWave(); return;
    }
    if (hit.kind === 'shop') {
      if (hit.type === 'mochi') {
        w.state.placing = null; announce('Mochi is already on the field — the hero cat cannot be bought.');
        return;
      }
      w.state.placing = w.state.placing === hit.type ? null : hit.type; w.state.selected = null;
      w.state.selectedPost = null; return;
    }
    if (hit.kind === 'plot') {
      if (w.state.placing !== null) {
        const events = w.placeTower(hit.index, w.state.placing); handleEvents(events);
        if (events !== 0) w.state.placing = null;
      }
      return;
    }
    if (hit.kind === 'tower') {
      w.state.selected = hit.tower; w.state.selectedPost = null;
      w.state.placing = null; return;
    }
    if (hit.kind === 'post') {
      w.state.selectedPost = hit.index; w.state.selected = null;
      w.state.placing = null; return;
    }
    if (hit.kind === 'postUpgrade' && w.state.selectedPost !== null) {
      handleEvents(w.upgradePost(w.state.selectedPost)); return;
    }
    if (hit.kind === 'upgrade' && w.state.selected !== null) {
      handleEvents(w.upgradeTower(w.state.selected)); return;
    }
    if (hit.kind === 'sell' && w.state.selected !== null) {
      handleEvents(w.sellTower(w.state.selected));
    }
  }
  function updateHover() {
    const pointer = input.pointer; w.state.hoverPlot = -1;
    w.state.hoverTower = null; w.state.draftHover = -1;
    if (pointer.x < 0 || screen !== SCREEN_PLAY) return;
    if (w.state.draft !== null) {
      const cards = draftCardRects();
      for (let i = 0; i < cards.length; i += 1) {
        if (inside(pointer.x, pointer.y, cards[i])) { w.state.draftHover = i; return; }
      }
      return;
    }
    for (let i = 0; i < w.plots.length; i += 1) {
      const plot = w.plots[i];
      if (Math.hypot(pointer.x - plot.x, pointer.y - plot.y) <= plot.radius + 6) {
        w.state.hoverPlot = i; w.state.hoverTower = plot.tower;
        return;
      }
    }
  }
  function step() {
    if (screen === SCREEN_TITLE) {
      w.step(STEP, true); return;
    }
    const events = w.step(STEP, false); handleEvents(events);
  }
  function frame(now) {
    requestAnimationFrame(frame); const realDt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now; handleActions();
    handleClick(); updateHover();
    if (w.fx.hitStop > 0) {
      w.fx.hitStop = Math.max(0, w.fx.hitStop - realDt); w.fx.decayTrauma(realDt);
      accumulator = 0;
    } else if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      accumulator += realDt * speed;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(); accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(w, screen, best, speed);
    if (screen === SCREEN_TITLE) drawTitle(renderer.context, renderer.text, renderer.drawCat, w, best, profile);
    else if (screen === SCREEN_PAUSED) drawPaused(renderer.context, renderer.text);
    else if (screen === SCREEN_WIN) drawWin(renderer.context, renderer.text, w, best, profile, lastRunFeats);
    else if (screen === SCREEN_OVER) drawOver(renderer.context, renderer.text, w, best, lastRunFeats);
    else if (w.state.draft !== null) drawDraft(renderer.context, renderer.text, w);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED; announce('Paused.');
    }
  }); announce("Mochi's Lantern Garden. Press Space or click to start.");
  requestAnimationFrame(frame);
}
if (shot) runShot(shot);
else runGame();
