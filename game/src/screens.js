// The full-screen overlays: title, paused, win and game over. Each one is a panel
// over the living garden, with the buttons the player clicks — their rectangles are
// exported so the click handler and the drawing can never disagree.
import { FIELD, PALETTE } from './config.js';
import { TOWER_TYPES } from './towers.js';

export const TITLE_BUTTON = { x: 490, y: 520, width: 300, height: 64 };
export const WIN_BUTTON = { x: 490, y: 500, width: 300, height: 64 };
export const OVER_BUTTON = { x: 490, y: 500, width: 300, height: 64 };

function panel(ctx, text, x, y, w, h) {
  ctx.fillStyle = 'rgba(20, 14, 36, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = 'rgba(28, 24, 48, 0.94)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 20);
  ctx.fill();
  ctx.strokeStyle = '#6b5a8e';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function button(ctx, textFn, rect, label, sub) {
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 12);
  ctx.fill();
  textFn(label, rect.x + rect.width / 2, rect.y + 40, 26, '#4a3423', 'center', true);
  if (sub !== undefined) textFn(sub, rect.x + rect.width / 2, rect.y + rect.height + 26, 15, PALETTE.muted, 'center');
}

export function drawTitle(ctx, textFn, drawCat, world, best) {
  panel(ctx, textFn, 290, 110, 700, 440);
  textFn("Mochi's", 640, 210, 64, '#ffd166', 'center', true);
  textFn('Lantern Garden', 640, 272, 64, PALETTE.text, 'center', true);
  textFn('A cute tower defense', 640, 312, 20, PALETTE.muted, 'center');
  // Mochi asleep on the panel, dreaming of yarn.
  drawCat(640, 392, 44, TOWER_TYPES.mochi, 1, 0, 0, true);
  textFn('Z', 700, 350, 22, PALETTE.muted, 'center', true);
  textFn('z', 716, 366, 17, PALETTE.muted, 'center', true);
  textFn('z', 728, 384, 13, PALETTE.muted, 'center', true);
  textFn('Shadow bugs are marching on the big lantern!', 640, 452, 17, PALETTE.text, 'center');
  textFn('Place cat towers on the plots, earn coins, survive 10 waves.', 640, 478, 17, PALETTE.text, 'center');
  textFn('Towers in lantern glow fight 25% better. Click a plot to build.', 640, 504, 15, PALETTE.muted, 'center');
  button(ctx, textFn, TITLE_BUTTON, '▶  Start the garden', 'or press Space');
  if (best > 0) textFn(`Best score ${best}`, 640, 622, 16, PALETTE.muted, 'center');
}

export function drawPaused(ctx, textFn) {
  ctx.fillStyle = 'rgba(20, 14, 36, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  textFn('Paused', 640, 330, 56, PALETTE.text, 'center', true);
  textFn('Press P or click ▶ to keep playing', 640, 372, 18, PALETTE.muted, 'center');
}

export function drawWin(ctx, textFn, world, best) {
  panel(ctx, textFn, 290, 110, 700, 440);
  textFn('The garden blooms!', 640, 210, 52, '#ffd166', 'center', true);
  textFn('Mochi held the garden through all 10 waves.', 640, 256, 19, PALETTE.text, 'center');
  textFn('The shadow bugs have gone home. The cats are very proud.', 640, 284, 19, PALETTE.text, 'center');
  textFn(`Score  ${world.state.score}`, 640, 360, 30, PALETTE.text, 'center', true);
  textFn(`Bugs swatted ${world.state.kills}   ·   Coins earned ${world.state.earned}   ·   Best ${best}`, 640, 404, 17, PALETTE.muted, 'center');
  textFn(`Lantern light: ${Math.round(world.lightLevel() * 100)}% — the garden glows all night.`, 640, 436, 16, '#ffb347', 'center');
  button(ctx, textFn, WIN_BUTTON, '↻  Play again', 'or press Space');
}

export function drawOver(ctx, textFn, world, best) {
  panel(ctx, textFn, 290, 110, 700, 440);
  textFn('The lantern went dark…', 640, 210, 52, '#ff8a9a', 'center', true);
  textFn('The shadow bugs reached the big lantern and blew it out.', 640, 256, 19, PALETTE.text, 'center');
  textFn('Mochi is already plotting a comeback.', 640, 284, 19, PALETTE.text, 'center');
  textFn(`Score  ${world.state.score}`, 640, 360, 30, PALETTE.text, 'center', true);
  textFn(`You reached wave ${world.state.wave} of 10   ·   Bugs swatted ${world.state.kills}   ·   Best ${best}`, 640, 404, 17, PALETTE.muted, 'center');
  textFn('Tip: towers in lantern glow fight 25% better — build near the posts!', 640, 436, 16, '#ffb347', 'center');
  button(ctx, textFn, OVER_BUTTON, '↻  Try again', 'or press Space');
}
