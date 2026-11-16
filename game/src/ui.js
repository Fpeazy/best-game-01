// The HUD's hit areas: the shop cards, the top-bar buttons, the start-wave button
// and the selected-tower panel. One place owns every rectangle, so the renderer and
// the click handler can never disagree about where a button is.
import { LAYOUT } from './config.js';
import { LANTERN_POSTS } from './garden.js';
import { TOWER_TYPES } from './towers.js';

export const SHOP_ORDER = ['yarn', 'fish', 'sleepy', 'star', 'frosty', 'mochi'];

/** The six shop cards, left to right across the bottom bar. */
export function shopCards() {
  const cards = [];
  const bar = LAYOUT.shopBar;
  const startX = 12;
  for (let i = 0; i < SHOP_ORDER.length; i += 1) {
    const type = SHOP_ORDER[i];
    cards.push({
      type,
      def: TOWER_TYPES[type],
      rect: {
        x: startX + i * (LAYOUT.cardWidth + LAYOUT.cardGap),
        y: bar.y + 8,
        width: LAYOUT.cardWidth,
        height: LAYOUT.cardHeight,
      },
    });
  }
  return cards;
}

/** The selected-tower (or lantern-post) panel sits right of the shop cards. */
export function selectedPanelRect() {
  return { x: 948, y: LAYOUT.shopBar.y + 8, width: 186, height: LAYOUT.cardHeight };
}

/** The upgrade and sell buttons inside the selected-tower panel (shared with the renderer). */
export function selectedUpgradeRect(panel) {
  return { x: panel.x + 40, y: panel.y + 50, width: 68, height: 20 };
}
export function selectedSellRect(panel) {
  return { x: panel.x + 114, y: panel.y + 50, width: 64, height: 20 };
}

/** The upgrade button inside the selected-post panel. */
export function postUpgradeRect(panel) {
  return { x: panel.x + 8, y: panel.y + 46, width: 170, height: 24 };
}

/** The start-wave button, far right of the bottom bar. */
export function startWaveRect() {
  return { x: 1142, y: LAYOUT.shopBar.y + 8, width: 126, height: LAYOUT.cardHeight };
}

/** The top bar's pause / speed / mute buttons, far right. */
export function topButtons() {
  const bar = LAYOUT.topBar;
  const size = 36;
  const gap = 8;
  return {
    pause: { x: 1108, y: bar.y + 10, width: size, height: size },
    speed: { x: 1108 + size + gap, y: bar.y + 10, width: size, height: size },
    mute: { x: 1108 + (size + gap) * 2, y: bar.y + 10, width: size, height: size },
  };
}

function inside(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

/**
 * What a click at field coordinates (x, y) hit: a shop card, a plot, a placed tower,
 * a lantern post, a top-bar button, the start-wave button, or the selected panel's
 * upgrade/sell buttons. Returns null when it hit nothing clickable.
 */
export function hitTest(x, y, world) {
  const buttons = topButtons();
  if (inside(x, y, buttons.pause)) return { kind: 'button', name: 'pause' };
  if (inside(x, y, buttons.speed)) return { kind: 'button', name: 'speed' };
  if (inside(x, y, buttons.mute)) return { kind: 'button', name: 'mute' };
  if (world.state.phase === 'build' && inside(x, y, startWaveRect())) return { kind: 'startWave' };
  for (const card of shopCards()) {
    if (inside(x, y, card.rect)) return { kind: 'shop', type: card.type };
  }
  const panel = selectedPanelRect();
  if (world.state.selected !== null && inside(x, y, panel)) {
    if (inside(x, y, selectedUpgradeRect(panel))) return { kind: 'upgrade' };
    if (inside(x, y, selectedSellRect(panel))) return { kind: 'sell' };
    return { kind: 'panel' };
  }
  if (world.state.selectedPost !== null && inside(x, y, panel)) {
    if (inside(x, y, postUpgradeRect(panel))) return { kind: 'postUpgrade' };
    return { kind: 'panel' };
  }
  for (let i = 0; i < LANTERN_POSTS.length; i += 1) {
    const post = LANTERN_POSTS[i];
    if (Math.hypot(x - post.x, y - post.y) <= 34) return { kind: 'post', index: i };
  }
  for (let i = 0; i < world.plots.length; i += 1) {
    const plot = world.plots[i];
    if (Math.hypot(x - plot.x, y - plot.y) <= plot.radius + 6) {
      return plot.tower === null ? { kind: 'plot', index: i } : { kind: 'tower', tower: plot.tower };
    }
  }
  return null;
}
