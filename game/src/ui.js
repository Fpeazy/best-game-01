import { ABILITY_ORDER, LAYOUT } from './config.js'; import { LANTERN_POSTS } from './garden.js';
import { TOWER_TYPES } from './towers.js';
export const SHOP_ORDER = ['yarn', 'fish', 'sleepy', 'star', 'frosty', 'mochi'];
export function shopCards() {
  const cards = []; const bar = LAYOUT.shopBar;
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
export function selectedPanelRect() {
  return { x: 948, y: LAYOUT.shopBar.y + 8, width: 186, height: LAYOUT.cardHeight };
}
export function selectedUpgradeRect(panel) {
  return { x: panel.x + 40, y: panel.y + 50, width: 68, height: 20 };
}
export function selectedSellRect(panel) {
  return { x: panel.x + 114, y: panel.y + 50, width: 64, height: 20 };
}
export function postUpgradeRect(panel) {
  return { x: panel.x + 8, y: panel.y + 46, width: 170, height: 24 };
}
export function startWaveRect() {
  return { x: 1142, y: LAYOUT.shopBar.y + 8, width: 126, height: LAYOUT.cardHeight };
}
export function abilityRects() {
  const bar = LAYOUT.topBar;
  return ABILITY_ORDER.map((key, i) => ({
    key,
    rect: { x: 800 + i * 96, y: bar.y + 10, width: 88, height: 36 },
  }));
}
export function selectedTargetRect(panel) {
  return { x: panel.x, y: panel.y, width: panel.width, height: 28 };
}
export function topButtons() {
  const bar = LAYOUT.topBar; const size = 36;
  const gap = 8;
  return {
    pause: { x: 1108, y: bar.y + 10, width: size, height: size },
    speed: { x: 1108 + size + gap, y: bar.y + 10, width: size, height: size },
    mute: { x: 1108 + (size + gap) * 2, y: bar.y + 10, width: size, height: size },
  };
}
export function draftCardRects() {
  return [0, 1, 2].map((i) => ({ x: 170 + i * 320, y: 180, width: 300, height: 400 }));
}
function inside(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
export function hitTest(x, y, world) {
  if (world.state.draft !== null) {
    const cards = draftCardRects();
    for (let i = 0; i < cards.length; i += 1) {
      if (inside(x, y, cards[i])) return { kind: 'draft', index: i };
    }
    return { kind: 'draftBack' };
  }
  const buttons = topButtons(); if (inside(x, y, buttons.pause)) return { kind: 'button', name: 'pause' };
  if (inside(x, y, buttons.speed)) return { kind: 'button', name: 'speed' };
  if (inside(x, y, buttons.mute)) return { kind: 'button', name: 'mute' };
  for (const chip of abilityRects()) {
    if (inside(x, y, chip.rect)) return { kind: 'ability', key: chip.key };
  }
  if (world.state.phase === 'build' && inside(x, y, startWaveRect())) return { kind: 'startWave' };
  for (const card of shopCards()) {
    if (inside(x, y, card.rect)) return { kind: 'shop', type: card.type };
  }
  const panel = selectedPanelRect();
  if (world.state.selected !== null && inside(x, y, panel)) {
    if (inside(x, y, selectedTargetRect(panel))) return { kind: 'target' };
    if (inside(x, y, selectedUpgradeRect(panel))) return { kind: 'upgrade' };
    if (inside(x, y, selectedSellRect(panel))) return { kind: 'sell' }; return { kind: 'panel' };
  }
  if (world.state.selectedPost !== null && inside(x, y, panel)) {
    if (inside(x, y, postUpgradeRect(panel))) return { kind: 'postUpgrade' }; return { kind: 'panel' };
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
