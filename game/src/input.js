export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SPEED = 4;
export const ACTION_MUTE = 8;
export const ACTION_UPGRADE = 16;
export const ACTION_SELL = 32;
export const ACTION_TOWER_1 = 64;
export const ACTION_TOWER_2 = 128;
export const ACTION_TOWER_3 = 256;
export const ACTION_TOWER_4 = 512;
export const ACTION_TOWER_5 = 1024;
export const ACTION_TOWER_6 = 2048;
export const ACTION_LONGNIGHT = 4096;
export const ACTION_ABILITY_FLARE = 8192;
export const ACTION_ABILITY_SURGE = 16384;
export const ACTION_ABILITY_PURR = 32768;
export const ACTION_TARGET_CYCLE = 65536;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const SPEED = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);
const UPGRADE = new Set(['KeyU']);
const SELL = new Set(['KeyX', 'Backspace']);
const LONGNIGHT = new Set(['KeyL']);
const ABILITY_KEYS = { KeyQ: ACTION_ABILITY_FLARE, KeyE: ACTION_ABILITY_SURGE, KeyR: ACTION_ABILITY_PURR };
const TARGET_CYCLE = new Set(['KeyT']);
const TOWER_KEYS = { Digit1: ACTION_TOWER_1, Digit2: ACTION_TOWER_2, Digit3: ACTION_TOWER_3, Digit4: ACTION_TOWER_4, Digit5: ACTION_TOWER_5, Digit6: ACTION_TOWER_6 };

export function createInput(canvas, toField) {
  let actions = 0;
  const pointer = { x: -1, y: -1, clicked: false, down: false };

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (SPEED.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SPEED;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (UPGRADE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_UPGRADE;
    } else if (SELL.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SELL;
    } else if (LONGNIGHT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_LONGNIGHT;
    } else if (ABILITY_KEYS[event.code] !== undefined) {
      if (!event.repeat) actions |= ABILITY_KEYS[event.code];
    } else if (TARGET_CYCLE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_TARGET_CYCLE;
    } else if (TOWER_KEYS[event.code] !== undefined) {
      if (!event.repeat) actions |= TOWER_KEYS[event.code];
    } else return;
    event.preventDefault();
  });

  function track(event) {
    const rect = canvas.getBoundingClientRect();
    const field = toField(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    pointer.x = field.x;
    pointer.y = field.y;
  }

  canvas.addEventListener('pointermove', track);
  canvas.addEventListener('pointerdown', (event) => {
    track(event);
    pointer.clicked = true;
    pointer.down = true;
  });
  canvas.addEventListener('pointerup', () => { pointer.down = false; });
  canvas.addEventListener('pointerleave', () => { pointer.x = -1; pointer.y = -1; });

  return {
    pointer,
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The click since the last call, as field coordinates, or null. */
    takeClick() {
      if (!pointer.clicked) return null;
      pointer.clicked = false;
      return { x: pointer.x, y: pointer.y };
    },
  };
}
