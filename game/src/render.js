// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred. Warm lantern glow against the
// cool dusk, round cute shapes, thick outlines — crispness comes from light and
// geometry, not saturation. Every tower and bug type reads at a glance: each cat has
// its own body colour, hat and held item, each bug its own size, colour and shape,
// and the boss carries its own rim light. The lantern glow is the signature: visible
// glow zones on the ground, bright warm pools, and the big lantern's light.
import { DIFFICULTIES, FIELD, FONT, LAYOUT, MAX_POST_LEVEL, MUTATORS, PALETTE, POST_LEVELS, POST_UPGRADE_COST } from './config.js';
import { LANTERN, LANTERN_POSTS, PATH_POINTS, PATH_WIDTH, POND, postGlowRadius } from './garden.js';
import { PHASE_BUILD, PHASE_WAVE } from './world.js';
import { TOWER_TYPES, towerStats } from './towers.js';
import { postUpgradeRect, selectedPanelRect, selectedSellRect, selectedUpgradeRect, shopCards, startWaveRect, topButtons } from './ui.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  const coinsLabel = cachedLabel('');
  const livesLabel = cachedLabel('');
  const scoreLabel = cachedLabel('Score ');
  const lightLabel = cachedLabel('Lantern Light ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    const key = `${size}:${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  /** Field coordinates of a screen point (for input); the inverse of the view. */
  function toField(sx, sy, rectW, rectH) {
    const scale = Math.min(rectW / FIELD.width, rectH / FIELD.height);
    const ox = (rectW - FIELD.width * scale) / 2;
    const oy = (rectH - FIELD.height * scale) / 2;
    return { x: (sx - ox) / scale, y: (sy - oy) / scale };
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawSky(world) {
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyBottom);
    grad.addColorStop(1, '#5a4066');
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const t = world.state.elapsed;
    for (const star of world.decor.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(t * 1.5 + star.tw);
      context.globalAlpha = 0.35 + 0.5 * twinkle;
      context.fillStyle = PALETTE.star;
      context.beginPath();
      context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // The moon, high over the garden, clear of the pond.
    context.fillStyle = PALETTE.moon;
    context.beginPath();
    context.arc(1215, 72, 30, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255, 233, 176, 0.25)';
    context.beginPath();
    context.arc(1215, 72, 40, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8c98a';
    context.beginPath();
    context.arc(1205, 64, 6, 0, Math.PI * 2);
    context.arc(1225, 80, 4, 0, Math.PI * 2);
    context.fill();
  }

  function drawGarden(world) {
    const grad = context.createLinearGradient(0, LAYOUT.play.y, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.grass);
    grad.addColorStop(1, PALETTE.grassDark);
    context.fillStyle = grad;
    context.fillRect(0, LAYOUT.play.y, FIELD.width, FIELD.height - LAYOUT.play.y);
    for (const tuft of world.decor.tufts) {
      context.strokeStyle = PALETTE.grassLight;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(tuft.x - 4 * tuft.s, tuft.y);
      context.lineTo(tuft.x - 5 * tuft.s, tuft.y - 8 * tuft.s);
      context.moveTo(tuft.x, tuft.y);
      context.lineTo(tuft.x, tuft.y - 10 * tuft.s);
      context.moveTo(tuft.x + 4 * tuft.s, tuft.y);
      context.lineTo(tuft.x + 5 * tuft.s, tuft.y - 8 * tuft.s);
      context.stroke();
    }
    for (const flower of world.decor.flowers) {
      context.fillStyle = flower.color;
      context.beginPath();
      context.arc(flower.x, flower.y, flower.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff6d8';
      context.beginPath();
      context.arc(flower.x, flower.y, flower.r * 0.4, 0, Math.PI * 2);
      context.fill();
    }
    // The moonflower pond: water, lily pads, moonflowers and stones.
    context.fillStyle = '#7fc4c9';
    context.beginPath();
    context.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#5a9aa0';
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = 'rgba(255, 246, 232, 0.35)';
    context.beginPath();
    context.ellipse(POND.x - 20, POND.y - 10, POND.rx * 0.55, POND.ry * 0.45, 0, 0, Math.PI * 2);
    context.fill();
    for (const pad of world.decor.lilyPads) {
      context.fillStyle = '#4a8a5a';
      context.beginPath();
      context.arc(pad.x, pad.y, pad.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#6aa878';
      context.beginPath();
      context.arc(pad.x - pad.r * 0.3, pad.y - pad.r * 0.3, pad.r * 0.4, 0, Math.PI * 2);
      context.fill();
    }
    for (const bloom of world.decor.moonflowers) {
      context.fillStyle = '#fff6e8';
      for (let p = 0; p < 5; p += 1) {
        const a = (p / 5) * Math.PI * 2;
        context.beginPath();
        context.arc(bloom.x + Math.cos(a) * bloom.r * 0.7, bloom.y + Math.sin(a) * bloom.r * 0.7, bloom.r * 0.5, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = '#ffd166';
      context.beginPath();
      context.arc(bloom.x, bloom.y, bloom.r * 0.35, 0, Math.PI * 2);
      context.fill();
    }
    for (const stone of world.decor.stones) {
      context.fillStyle = '#8a8a92';
      context.beginPath();
      context.ellipse(stone.x, stone.y, stone.r, stone.r * 0.7, 0.3, 0, Math.PI * 2);
      context.fill();
    }
    // Fireflies, drifting on the sim clock so the same seed gives the same frame.
    const t = world.state.elapsed;
    for (const fly of world.decor.fireflies) {
      const fx = fly.x + Math.sin(t * fly.speed + fly.phase) * fly.amp;
      const fy = fly.y + Math.cos(t * fly.speed * 0.8 + fly.phase) * fly.amp;
      const glow = 0.4 + 0.35 * Math.sin(t * 2 + fly.phase);
      drawGlow(fx, fy, 12, glow);
      context.fillStyle = '#ffe9b0';
      context.beginPath();
      context.arc(fx, fy, 2.2, 0, Math.PI * 2);
      context.fill();
    }
    // The winding path: a wide edge stroke, then the cream path on top.
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.strokeStyle = PALETTE.pathEdge;
    context.lineWidth = PATH_WIDTH + 8;
    context.beginPath();
    context.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
    for (let i = 1; i < PATH_POINTS.length; i += 1) context.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
    context.stroke();
    context.strokeStyle = PALETTE.path;
    context.lineWidth = PATH_WIDTH;
    context.stroke();
    // Garden gate, where the bugs march in.
    context.fillStyle = '#6b4a2f';
    context.fillRect(0, 132, 10, 56);
    context.fillRect(0, 132, 26, 8);
    context.fillRect(0, 180, 26, 8);
  }

  function drawGlow(x, y, radius, alpha) {
    const grad = context.createRadialGradient(x, y, 4, x, y, radius);
    grad.addColorStop(0, `rgba(255, 190, 90, ${alpha})`);
    grad.addColorStop(0.5, `rgba(255, 170, 70, ${alpha * 0.45})`);
    grad.addColorStop(1, 'rgba(255, 170, 70, 0)');
    context.fillStyle = grad;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawLanternPost(post, level, light, t) {
    // The glow zone on the ground: players can SEE where the bonus reaches.
    const zone = postGlowRadius(level);
    context.fillStyle = 'rgba(255, 190, 90, 0.10)';
    context.beginPath();
    context.arc(post.x, post.y, zone, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255, 209, 102, 0.35)';
    context.lineWidth = 1.5;
    context.setLineDash([8, 6]);
    context.stroke();
    context.setLineDash([]);
    const flicker = 0.85 + 0.15 * Math.sin(t * 2.3 + post.x);
    drawGlow(post.x, post.y - 18, 110, 0.75 * light * flicker);
    context.strokeStyle = '#4a3423';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(post.x, post.y + 14);
    context.lineTo(post.x, post.y - 18);
    context.stroke();
    context.fillStyle = '#ffb347';
    roundRect(post.x - 11, post.y - 30, 22, 24, 8);
    context.fill();
    context.strokeStyle = '#d98a2b';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(post.x - 11, post.y - 22);
    context.lineTo(post.x + 11, post.y - 22);
    context.moveTo(post.x - 11, post.y - 14);
    context.lineTo(post.x + 11, post.y - 14);
    context.stroke();
    context.fillStyle = '#8a5a2b';
    context.fillRect(post.x - 13, post.y - 34, 26, 5);
    // Level pips at the base.
    for (let s = 0; s < level; s += 1) {
      context.fillStyle = '#ffd166';
      context.beginPath();
      context.arc(post.x - 8 + s * 8, post.y + 20, 2.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawBigLantern(world, light, t) {
    const flicker = 0.9 + 0.1 * Math.sin(t * 1.8);
    drawGlow(LANTERN.x, LANTERN.y, 190, 0.8 * light * flicker);
    // A stone base, then the big paper lantern.
    context.fillStyle = '#7a6a58';
    roundRect(LANTERN.x - 30, LANTERN.y + 18, 60, 16, 6);
    context.fill();
    const body = light > 0.25 ? '#ffcf7a' : '#8a7a6a';
    context.fillStyle = body;
    context.beginPath();
    context.ellipse(LANTERN.x, LANTERN.y - 6, 32, 38, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = light > 0.25 ? '#e8a94e' : '#6a5a4a';
    context.lineWidth = 2;
    for (const dy of [-22, -8, 6, 20]) {
      context.beginPath();
      context.ellipse(LANTERN.x, LANTERN.y - 6 + dy, 30 - Math.abs(dy) * 0.35, 4, 0, 0, Math.PI);
      context.stroke();
    }
    context.fillStyle = '#8a5a2b';
    context.fillRect(LANTERN.x - 10, LANTERN.y - 48, 20, 6);
    // Its light, in hearts.
    const hearts = Math.ceil(world.state.lives);
    text(`♥ ${hearts}`, LANTERN.x, LANTERN.y + 52, 18, PALETTE.heart, 'center', true);
  }

  function drawPlots(world) {
    for (let i = 0; i < world.plots.length; i += 1) {
      const plot = world.plots[i];
      context.fillStyle = PALETTE.plot;
      context.beginPath();
      context.arc(plot.x, plot.y, plot.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.plotEdge;
      context.lineWidth = 3;
      context.stroke();
      if (plot.tower === null) {
        const hovered = world.state.hoverPlot === i || (world.state.placing !== null && world.state.hoverPlot === i);
        context.strokeStyle = hovered ? '#ffd166' : 'rgba(255, 246, 232, 0.35)';
        context.setLineDash([6, 6]);
        context.lineWidth = hovered ? 3 : 2;
        context.beginPath();
        context.arc(plot.x, plot.y, plot.radius - 5, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
        if (world.state.placing !== null) {
          text('+', plot.x, plot.y + 7, 22, 'rgba(255, 246, 232, 0.6)', 'center', true);
        }
      }
    }
  }

  /** A cute round cat: body, ears, face, tail, and its own hat at higher levels. */
  function drawCat(x, y, r, def, level, squash, angle, sleeping) {
    const sq = squash > 0 ? 1 - 0.25 * (squash / 0.18) : 1;
    context.save();
    context.translate(x, y);
    context.scale(1 + (1 - sq) * 0.6, sq);
    // Tail, wagging.
    context.strokeStyle = def.color;
    context.lineWidth = 6;
    context.lineCap = 'round';
    const wag = Math.sin((y * 0.13 + x * 0.07) * 2) * 6;
    context.beginPath();
    context.moveTo(-r * 0.8, r * 0.4);
    context.quadraticCurveTo(-r * 1.5, r * 0.2 + wag, -r * 1.3, -r * 0.5 + wag);
    context.stroke();
    // Ears.
    context.fillStyle = def.ear;
    context.beginPath();
    context.moveTo(-r * 0.62, -r * 0.55);
    context.lineTo(-r * 0.85, -r * 1.15);
    context.lineTo(-r * 0.2, -r * 0.85);
    context.closePath();
    context.moveTo(r * 0.62, -r * 0.55);
    context.lineTo(r * 0.85, -r * 1.15);
    context.lineTo(r * 0.2, -r * 0.85);
    context.closePath();
    context.fill();
    // Body.
    context.fillStyle = def.color;
    context.beginPath();
    context.arc(0, 0, r, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(60, 30, 20, 0.35)';
    context.lineWidth = 2.5;
    context.stroke();
    // Belly.
    context.fillStyle = def.belly;
    context.beginPath();
    context.ellipse(0, r * 0.42, r * 0.55, r * 0.4, 0, 0, Math.PI * 2);
    context.fill();
    // Face: eyes (closed when sleeping), nose, whiskers.
    if (sleeping) {
      context.strokeStyle = '#4a3423';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(-r * 0.32, -r * 0.1, r * 0.14, Math.PI * 1.15, Math.PI * 1.85);
      context.arc(r * 0.32, -r * 0.1, r * 0.14, Math.PI * 1.15, Math.PI * 1.85);
      context.stroke();
    } else {
      context.fillStyle = '#2c1f3d';
      context.beginPath();
      context.arc(-r * 0.32, -r * 0.12, r * 0.11, 0, Math.PI * 2);
      context.arc(r * 0.32, -r * 0.12, r * 0.11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff';
      context.beginPath();
      context.arc(-r * 0.28, -r * 0.16, r * 0.04, 0, Math.PI * 2);
      context.arc(r * 0.36, -r * 0.16, r * 0.04, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#e86a7a';
    context.beginPath();
    context.moveTo(-r * 0.1, r * 0.08);
    context.lineTo(r * 0.1, r * 0.08);
    context.lineTo(0, r * 0.2);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(74, 52, 35, 0.6)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(-r * 0.5, r * 0.05);
    context.lineTo(-r * 0.95, -r * 0.05);
    context.moveTo(-r * 0.5, r * 0.18);
    context.lineTo(-r * 0.95, r * 0.28);
    context.moveTo(r * 0.5, r * 0.05);
    context.lineTo(r * 0.95, -r * 0.05);
    context.moveTo(r * 0.5, r * 0.18);
    context.lineTo(r * 0.95, r * 0.28);
    context.stroke();
    // Level 2: each tower's own hat, so the types read apart at a glance.
    if (level >= 2 && def.hat !== 'none') {
      if (def.hat === 'bow') {
        // A pink bow between the ears.
        context.fillStyle = '#e86a7a';
        context.beginPath();
        context.moveTo(0, -r * 0.85);
        context.lineTo(-r * 0.5, -r * 1.1);
        context.lineTo(-r * 0.5, -r * 0.6);
        context.closePath();
        context.moveTo(0, -r * 0.85);
        context.lineTo(r * 0.5, -r * 1.1);
        context.lineTo(r * 0.5, -r * 0.6);
        context.closePath();
        context.fill();
        context.beginPath();
        context.arc(0, -r * 0.85, r * 0.14, 0, Math.PI * 2);
        context.fill();
      } else if (def.hat === 'cap') {
        // A blue sailor cap with a brim.
        context.fillStyle = '#3a6a9a';
        context.beginPath();
        context.ellipse(0, -r * 0.85, r * 0.62, r * 0.22, 0, Math.PI, 0);
        context.fill();
        context.fillRect(-r * 0.62, -r * 0.92, r * 1.24, r * 0.14);
        context.fillStyle = '#ffd166';
        context.beginPath();
        context.arc(0, -r * 0.92, r * 0.1, 0, Math.PI * 2);
        context.fill();
      } else if (def.hat === 'nightcap') {
        // A floppy purple nightcap with a pompom.
        context.fillStyle = '#7a5aa8';
        context.beginPath();
        context.moveTo(-r * 0.55, -r * 0.75);
        context.quadraticCurveTo(-r * 0.2, -r * 1.5, r * 0.5, -r * 1.25);
        context.quadraticCurveTo(r * 0.15, -r * 0.95, r * 0.55, -r * 0.75);
        context.closePath();
        context.fill();
        context.fillStyle = '#e6ddf5';
        context.beginPath();
        context.arc(r * 0.55, -r * 1.28, r * 0.16, 0, Math.PI * 2);
        context.fill();
      } else if (def.hat === 'wizard') {
        // A tall gold wizard hat with stars.
        context.fillStyle = '#e8a94e';
        context.beginPath();
        context.moveTo(-r * 0.55, -r * 0.75);
        context.lineTo(r * 0.55, -r * 0.75);
        context.lineTo(r * 0.1, -r * 1.5);
        context.closePath();
        context.fill();
        context.fillStyle = '#ffd166';
        context.beginPath();
        context.arc(-r * 0.15, -r * 1.05, r * 0.09, 0, Math.PI * 2);
        context.arc(r * 0.2, -r * 0.9, r * 0.07, 0, Math.PI * 2);
        context.fill();
        context.fillRect(-r * 0.55, -r * 0.82, r * 1.1, r * 0.12);
      } else if (def.hat === 'earmuffs') {
        // Blue earmuffs: a band over the head, puffs on the ears.
        context.strokeStyle = '#5a8ab0';
        context.lineWidth = 4;
        context.beginPath();
        context.arc(0, -r * 0.1, r * 0.85, Math.PI * 1.15, Math.PI * 1.85);
        context.stroke();
        context.fillStyle = '#8ec9e0';
        context.beginPath();
        context.arc(-r * 0.8, -r * 0.25, r * 0.22, 0, Math.PI * 2);
        context.arc(r * 0.8, -r * 0.25, r * 0.22, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Level 3: a golden scarf as well, and a bigger cat.
    if (level >= 3) {
      context.strokeStyle = '#ffd166';
      context.lineWidth = 7;
      context.beginPath();
      context.arc(0, r * 0.35, r * 0.62, Math.PI * 0.15, Math.PI * 0.85);
      context.stroke();
    }
    context.restore();
  }

  /** A little four-point star, for the Star Gazer's wand and for glow sparkles. */
  function drawStar4(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x, y - r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.quadraticCurveTo(x, y, x, y + r);
    context.quadraticCurveTo(x, y, x - r, y);
    context.quadraticCurveTo(x, y, x, y - r);
    context.fill();
  }

  function drawTowers(world) {
    const selected = world.state.selected;
    for (const tower of world.towers.towers) {
      if (!tower.active) continue;
      const def = TOWER_TYPES[tower.type];
      const stats = towerStats(tower.type, tower.level);
      const range = stats.range * (1 + tower.glowBonus);
      if (selected === tower || (world.state.placing !== null && world.state.hoverTower === tower)) {
        context.fillStyle = 'rgba(255, 209, 102, 0.12)';
        context.beginPath();
        context.arc(tower.x, tower.y, range, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = 'rgba(255, 209, 102, 0.7)';
        context.lineWidth = 2;
        context.setLineDash([8, 6]);
        context.stroke();
        context.setLineDash([]);
      }
      if (tower.glow) {
        context.fillStyle = 'rgba(255, 190, 90, 0.18)';
        context.beginPath();
        context.arc(tower.x, tower.y, 26, 0, Math.PI * 2);
        context.fill();
        // A golden sparkle above every tower standing in the light.
        drawStar4(tower.x + 18, tower.y - 30, 6, '#ffd166');
      }
      const size = tower.type === 'mochi' ? 24 : 20;
      drawCat(tower.x, tower.y, size * (1 + 0.12 * (tower.level - 1)), def, tower.level, tower.squash, 0, tower.type === 'sleepy');
      // What the tower holds: a yarn ball, a fish, a star wand, a snowflake — or nothing (Mochi swats).
      if (tower.type === 'yarn') {
        context.fillStyle = '#f2a7c3';
        context.beginPath();
        context.arc(tower.x + 14, tower.y + 12, 7, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#d97a9e';
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(tower.x + 14, tower.y + 12, 4, 0, Math.PI * 2);
        context.stroke();
      } else if (tower.type === 'fish') {
        context.fillStyle = '#9ecfff';
        context.beginPath();
        context.ellipse(tower.x + 16, tower.y + 10, 9, 5, -0.4, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(tower.x + 24, tower.y + 6);
        context.lineTo(tower.x + 30, tower.y + 10);
        context.lineTo(tower.x + 24, tower.y + 14);
        context.closePath();
        context.fill();
      } else if (tower.type === 'star') {
        context.strokeStyle = '#e8a94e';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(tower.x + 12, tower.y + 14);
        context.lineTo(tower.x + 22, tower.y - 8);
        context.stroke();
        drawStar4(tower.x + 23, tower.y - 12, 7, '#ffd166');
      } else if (tower.type === 'frosty') {
        context.strokeStyle = '#8ec9e0';
        context.lineWidth = 2;
        const cx = tower.x + 14;
        const cy = tower.y + 12;
        for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
          context.beginPath();
          context.moveTo(cx - Math.cos(a) * 6, cy - Math.sin(a) * 6);
          context.lineTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
          context.stroke();
        }
      } else if (tower.type === 'sleepy') {
        text('z', tower.x + 20, tower.y - 22, 13, PALETTE.muted, 'center', true);
        text('z', tower.x + 28, tower.y - 32, 10, PALETTE.muted, 'center', true);
      }
      // Level pips.
      for (let s = 0; s < tower.level; s += 1) {
        context.fillStyle = '#ffd166';
        context.beginPath();
        context.arc(tower.x - 12 + s * 12, tower.y + 30, 3.5, 0, Math.PI * 2);
        context.fill();
      }
    }
    // The tower being placed follows the mouse as a ghost.
    if (world.state.placing !== null && world.state.hoverPlot >= 0) {
      const plot = world.plots[world.state.hoverPlot];
      if (plot.tower === null) {
        const def = TOWER_TYPES[world.state.placing];
        const stats = towerStats(world.state.placing, 1);
        context.globalAlpha = 0.55;
        context.fillStyle = 'rgba(255, 209, 102, 0.15)';
        context.beginPath();
        context.arc(plot.x, plot.y, stats.range, 0, Math.PI * 2);
        context.fill();
        drawCat(plot.x, plot.y, 20, def, 1, 0, 0, false);
        context.globalAlpha = 1;
      }
    }
  }

  function drawBug(enemy, t) {
    const wobble = Math.sin(enemy.wobble) * 0.12;
    const bob = Math.sin(enemy.wobble * 1.7) * 2;
    context.save();
    context.translate(enemy.x, enemy.y + bob);
    if (enemy.type === 'moth' || enemy.type === 'queen' || enemy.type === 'boss') {
      // Fluttering wings: pale lavender for the moth, pink for the queen, wide and
      // dark-rimmed for the boss (wider still in its flying phase).
      const flap = Math.sin(enemy.wobble * 2.4) * 0.5;
      const wingColor = enemy.type === 'boss' ? '#6b4a8e' : enemy.type === 'queen' ? '#f2a7c3' : '#d9c8f2';
      const wingR = enemy.type === 'boss' ? enemy.radius * 1.05 : enemy.radius * 0.95;
      const spread = enemy.type === 'boss' && enemy.phase === 3 ? 0.9 : 0.5;
      context.fillStyle = wingColor;
      context.save();
      context.rotate(-spread - flap * 0.3);
      context.beginPath();
      context.ellipse(-enemy.radius * 0.9, -enemy.radius * 0.4, wingR, enemy.radius * 0.55, -0.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
      context.save();
      context.rotate(spread + flap * 0.3);
      context.beginPath();
      context.ellipse(enemy.radius * 0.9, -enemy.radius * 0.4, wingR, enemy.radius * 0.55, 0.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    // The zip bug is long and amber, with speed lines; the beetle is a big armoured dome.
    if (enemy.type === 'zip') {
      context.strokeStyle = 'rgba(245, 166, 91, 0.7)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-enemy.radius * 1.6, -enemy.radius * 0.4);
      context.lineTo(-enemy.radius * 2.4, -enemy.radius * 0.4);
      context.moveTo(-enemy.radius * 1.6, enemy.radius * 0.3);
      context.lineTo(-enemy.radius * 2.3, enemy.radius * 0.3);
      context.stroke();
      context.scale(1.35, 0.85);
    }
    context.scale(1 + wobble, 1 - wobble);
    context.fillStyle = enemy.type === 'zip' ? '#f5a65b' : enemy.type === 'moth' ? '#d9c8f2' : enemy.type === 'queen' ? '#e8b8d8' : enemy.type === 'boss' ? PALETTE.boss : PALETTE.shadow;
    context.beginPath();
    context.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = enemy.type === 'boss' ? '#ffd166' : 'rgba(20, 10, 30, 0.5)';
    context.lineWidth = enemy.type === 'boss' ? 3.5 : 2;
    context.stroke();
    if (enemy.type === 'zip') {
      context.strokeStyle = '#b06a2a';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-enemy.radius * 0.4, -enemy.radius * 0.8);
      context.lineTo(-enemy.radius * 0.4, enemy.radius * 0.8);
      context.moveTo(enemy.radius * 0.3, -enemy.radius * 0.8);
      context.lineTo(enemy.radius * 0.3, enemy.radius * 0.8);
      context.stroke();
    }
    if (enemy.type === 'mite') {
      // Tiny legs, so the mite never reads as a moth.
      context.strokeStyle = '#2c1f3d';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-enemy.radius * 0.7, -enemy.radius * 0.4);
      context.lineTo(-enemy.radius * 1.25, -enemy.radius * 0.7);
      context.moveTo(-enemy.radius * 0.7, enemy.radius * 0.4);
      context.lineTo(-enemy.radius * 1.25, enemy.radius * 0.7);
      context.moveTo(enemy.radius * 0.7, -enemy.radius * 0.4);
      context.lineTo(enemy.radius * 1.25, -enemy.radius * 0.7);
      context.moveTo(enemy.radius * 0.7, enemy.radius * 0.4);
      context.lineTo(enemy.radius * 1.25, enemy.radius * 0.7);
      context.stroke();
    }
    if (enemy.type === 'beetle') {
      context.fillStyle = '#5a3a6e';
      context.beginPath();
      context.arc(0, -enemy.radius * 0.25, enemy.radius * 0.7, Math.PI, 0);
      context.fill();
      context.fillStyle = '#8a6ab0';
      for (const dx of [-8, 0, 8]) {
        context.beginPath();
        context.moveTo(dx - 4, -enemy.radius * 0.5);
        context.lineTo(dx, -enemy.radius * 1.05);
        context.lineTo(dx + 4, -enemy.radius * 0.5);
        context.closePath();
        context.fill();
      }
      context.strokeStyle = '#8a6ab0';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, -enemy.radius);
      context.lineTo(0, -enemy.radius * 0.2);
      context.stroke();
    }
    if (enemy.type === 'boss' || enemy.type === 'queen') {
      // A crown of shadow antennae with golden tips.
      context.strokeStyle = '#c9a7f2';
      context.lineWidth = 3;
      for (const dx of [-14, 0, 14]) {
        context.beginPath();
        context.moveTo(dx, -enemy.radius + 4);
        context.lineTo(dx * 1.4, -enemy.radius - 16);
        context.stroke();
      }
      context.fillStyle = '#ffd166';
      context.beginPath();
      context.arc(-20, -enemy.radius - 16, 3, 0, Math.PI * 2);
      context.arc(0, -enemy.radius - 18, 3, 0, Math.PI * 2);
      context.arc(20, -enemy.radius - 16, 3, 0, Math.PI * 2);
      context.fill();
    }
    // Glowing eyes, looking toward the lantern; red when the boss enrages.
    const look = enemy.angle;
    const ex = Math.cos(look) * enemy.radius * 0.3;
    const ey = Math.sin(look) * enemy.radius * 0.3;
    context.fillStyle = enemy.type === 'boss' && enemy.phase === 3 ? '#ff5a3c' : PALETTE.shadowEye;
    context.beginPath();
    context.arc(ex - enemy.radius * 0.32, ey - enemy.radius * 0.18, enemy.radius * 0.16, 0, Math.PI * 2);
    context.arc(ex + enemy.radius * 0.32, ey - enemy.radius * 0.18, enemy.radius * 0.16, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // Health bar when hurt.
    if (enemy.hp < enemy.maxHp) {
      const w = enemy.radius * 2;
      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      context.fillStyle = 'rgba(20, 10, 30, 0.6)';
      context.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w, 5);
      context.fillStyle = ratio > 0.5 ? '#7ddc8a' : ratio > 0.25 ? '#ffd166' : '#ff6b81';
      context.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w * ratio, 5);
    }
  }

  function drawEnemies(world) {
    const t = world.state.elapsed;
    for (const enemy of world.enemies.list) {
      if (!enemy.active) continue;
      // The boss carries its own warm rim light, so it never reads as a dark blob.
      if (enemy.type === 'boss') {
        const grad = context.createRadialGradient(enemy.x, enemy.y, 10, enemy.x, enemy.y, 110);
        grad.addColorStop(0, 'rgba(255, 190, 90, 0.45)');
        grad.addColorStop(0.6, 'rgba(180, 120, 200, 0.25)');
        grad.addColorStop(1, 'rgba(180, 120, 200, 0)');
        context.fillStyle = grad;
        context.beginPath();
        context.arc(enemy.x, enemy.y, 110, 0, Math.PI * 2);
        context.fill();
      }
      // Flying bugs cast a soft ground shadow, so they read as flying.
      if (enemy.flying) {
        context.fillStyle = 'rgba(20, 10, 30, 0.25)';
        context.beginPath();
        context.ellipse(enemy.x, enemy.y + 20, enemy.radius * 0.8, enemy.radius * 0.3, 0, 0, Math.PI * 2);
        context.fill();
      }
      if (enemy.slowUntil > t) {
        context.fillStyle = 'rgba(184, 167, 217, 0.25)';
        context.beginPath();
        context.arc(enemy.x, enemy.y, enemy.radius + 5, 0, Math.PI * 2);
        context.fill();
      }
      drawBug(enemy, t);
    }
  }

  function drawProjectiles(world) {
    for (const proj of world.towers.projectiles) {
      if (!proj.active) continue;
      if (proj.kind === 'fish') {
        context.fillStyle = '#9ecfff';
        context.beginPath();
        context.ellipse(proj.x, proj.y, 9, 5, Math.atan2(proj.ly - proj.y, proj.lx - proj.x), 0, Math.PI * 2);
        context.fill();
      } else if (proj.kind === 'star') {
        drawStar4(proj.x, proj.y, 9, '#ffd166');
      } else if (proj.kind === 'frost') {
        context.fillStyle = '#bfe3f2';
        context.beginPath();
        context.arc(proj.x, proj.y, 6, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#eaf7ff';
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(proj.x - 4, proj.y);
        context.lineTo(proj.x + 4, proj.y);
        context.moveTo(proj.x, proj.y - 4);
        context.lineTo(proj.x, proj.y + 4);
        context.stroke();
      } else {
        context.fillStyle = '#f2a7c3';
        context.beginPath();
        context.arc(proj.x, proj.y, 7, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#d97a9e';
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
        context.stroke();
      }
    }
  }

  function drawEffects(world) {
    const fx = world.fx;
    for (const ring of fx.rings) {
      if (!ring.active) continue;
      context.globalAlpha = (ring.life / ring.maxLife) * 0.6;
      context.strokeStyle = ring.color;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      context.stroke();
    }
    for (const arc of fx.arcs) {
      if (!arc.active) continue;
      const progress = 1 - arc.life / arc.maxLife;
      context.globalAlpha = 1 - progress;
      context.strokeStyle = '#fff6e8';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(arc.x, arc.y, 26 + progress * 14, arc.angle - 0.7, arc.angle + 0.7);
      context.stroke();
    }
    context.globalAlpha = 1;
    for (const p of fx.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const t of fx.texts) {
      if (!t.active) continue;
      context.globalAlpha = Math.min(1, (t.life / t.maxLife) * 1.5);
      text(t.text, t.x, t.y, t.size, t.color, 'center', true);
    }
    context.globalAlpha = 1;
  }

  function drawVignette(world) {
    const light = world.lightLevel();
    if (light >= 1) return;
    const grad = context.createRadialGradient(640, 360, 240, 640, 360, 720);
    grad.addColorStop(0, 'rgba(20, 10, 30, 0)');
    grad.addColorStop(1, `rgba(20, 10, 30, ${(1 - light) * 0.45})`);
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawTopBar(world, screen, best, speed) {
    const bar = LAYOUT.topBar;
    context.fillStyle = PALETTE.panel;
    context.fillRect(bar.x, bar.y, bar.width, bar.height);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(bar.x, bar.y + bar.height - 2, bar.width, 2);
    const state = world.state;
    text(world.waveLabel(), 16, 37, 22, PALETTE.text, 'left', true);
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.arc(142, 30, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#8a6a1a';
    text('C', 142, 34, 12, '#8a6a1a', 'center', true);
    text(coinsLabel(`${state.coins}`), 158, 37, 22, PALETTE.gold, 'left', true);
    text('♥', 240, 37, 20, PALETTE.heart, 'left');
    text(livesLabel(`${state.lives}/${state.maxLives}`), 266, 37, 22, PALETTE.text, 'left', true);
    text(scoreLabel(`${state.score}`), 360, 37, 22, PALETTE.text, 'left', true);
    text(lightLabel(`${Math.round(world.lightLevel() * 100)}%`), 520, 37, 18, '#ffb347', 'left', true);
    text(`Best ${best} · ${DIFFICULTIES[state.difficulty].name}`, 700, 37, 18, PALETTE.muted, 'left');
    // Tonight's mutator, as a pill.
    if (state.mutator !== 'none') {
      const mut = MUTATORS[state.mutator];
      context.fillStyle = 'rgba(255, 246, 232, 0.12)';
      roundRect(920, 13, 170, 30, 8);
      context.fill();
      text(`${mut.icon} ${mut.name}`, 1005, 34, 15, PALETTE.text, 'center', true);
    }
    const buttons = topButtons();
    for (const [name, rect] of Object.entries(buttons)) {
      context.fillStyle = 'rgba(255, 246, 232, 0.12)';
      roundRect(rect.x, rect.y, rect.width, rect.height, 8);
      context.fill();
      const label = name === 'pause' ? (screen === SCREEN_PAUSED ? '▶' : 'II') : name === 'speed' ? `${speed}x` : '♪';
      text(label, rect.x + rect.width / 2, rect.y + 26, name === 'speed' ? 15 : 17, PALETTE.text, 'center', true);
    }
  }

  /** The boss (or queen) health bar under the top bar, with phase marks on the bar. */
  function bossActive(world) {
    for (const enemy of world.enemies.list) {
      if (!enemy.active) continue;
      if (enemy.type === 'boss') return enemy;
      if (enemy.type === 'queen') return enemy;
    }
    return null;
  }

  function drawBossBar(world) {
    const boss = bossActive(world);
    if (boss === null) return;
    const name = boss.type === 'boss' ? `SHADOW MOTH · Phase ${boss.phase}` : 'MOTH QUEEN';
    context.fillStyle = 'rgba(28, 24, 48, 0.88)';
    roundRect(430, 56, 420, 34, 10);
    context.fill();
    context.strokeStyle = '#6b5a8e';
    context.lineWidth = 2;
    context.stroke();
    text(name, 640, 72, 13, '#ffd166', 'center', true);
    const barX = 450;
    const barW = 380;
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    context.fillStyle = 'rgba(20, 10, 30, 0.7)';
    context.fillRect(barX, 78, barW, 8);
    context.fillStyle = boss.type === 'boss' && boss.phase === 3 ? '#ff6b81' : '#c9a7f2';
    context.fillRect(barX, 78, barW * ratio, 8);
    if (boss.type === 'boss') {
      context.fillStyle = '#ffd166';
      context.fillRect(barX + barW / 3 - 1, 78, 2, 8);
      context.fillRect(barX + (2 * barW) / 3 - 1, 78, 2, 8);
    }
  }

  function drawShopBar(world) {
    const bar = LAYOUT.shopBar;
    context.fillStyle = PALETTE.panel;
    context.fillRect(bar.x, bar.y, bar.width, bar.height);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(bar.x, bar.y, bar.width, 2);
    const state = world.state;
    for (const card of shopCards()) {
      const rect = card.rect;
      const affordable = state.coins >= card.def.cost || card.type === 'mochi';
      const active = state.placing === card.type;
      context.fillStyle = active ? 'rgba(255, 209, 102, 0.25)' : 'rgba(255, 246, 232, 0.08)';
      roundRect(rect.x, rect.y, rect.width, rect.height, 10);
      context.fill();
      context.strokeStyle = active ? '#ffd166' : 'rgba(255, 246, 232, 0.2)';
      context.lineWidth = active ? 2.5 : 1.5;
      context.stroke();
      drawCat(rect.x + 26, rect.y + 38, 16, card.def, 1, 0, 0, card.type === 'sleepy');
      text(card.def.name, rect.x + 48, rect.y + 26, 12, PALETTE.text, 'left', true);
      const cost = card.type === 'mochi' ? 'Hero — on the field' : `Cost ${card.def.cost}`;
      text(cost, rect.x + 48, rect.y + 44, 12, affordable ? PALETTE.gold : '#ff8a9a', 'left', true);
      text(card.def.desc, rect.x + 48, rect.y + 62, 10, PALETTE.muted, 'left');
    }
    // Selected tower or lantern-post panel.
    const panel = selectedPanelRect();
    const selected = state.selected;
    context.fillStyle = 'rgba(255, 246, 232, 0.08)';
    roundRect(panel.x, panel.y, panel.width, panel.height, 10);
    context.fill();
    if (selected !== null && selected.active) {
      const def = TOWER_TYPES[selected.type];
      const stats = towerStats(selected.type, selected.level);
      drawCat(panel.x + 22, panel.y + 38, 15, def, selected.level, 0, 0, selected.type === 'sleepy');
      text(`${def.name}  ${'★'.repeat(selected.level)}${'☆'.repeat(3 - selected.level)}`, panel.x + 42, panel.y + 24, 11, PALETTE.text, 'left', true);
      text(`DMG ${Math.round(stats.damage)}  RNG ${Math.round(stats.range)}${selected.glow ? '  ✦ in glow!' : ''}`, panel.x + 42, panel.y + 42, 10, PALETTE.muted, 'left');
      const upCost = selected.level < MAX_LEVEL ? TOWER_TYPES[selected.type].upgrade[selected.level - 1] : null;
      const upRect = selectedUpgradeRect(panel);
      const sellRect = selectedSellRect(panel);
      const canUp = upCost !== null && state.coins >= upCost;
      context.fillStyle = canUp ? 'rgba(255, 209, 102, 0.3)' : 'rgba(255, 246, 232, 0.08)';
      roundRect(upRect.x, upRect.y, upRect.width, upRect.height, 6);
      context.fill();
      text(upCost === null ? 'MAX' : `Up ${upCost}`, upRect.x + upRect.width / 2, upRect.y + 15, 11, canUp ? PALETTE.gold : PALETTE.muted, 'center', true);
      context.fillStyle = 'rgba(255, 107, 129, 0.2)';
      roundRect(sellRect.x, sellRect.y, sellRect.width, sellRect.height, 6);
      context.fill();
      text(selected.type === 'mochi' ? 'Hero' : `Sell +${Math.floor(selected.invested * 0.7)}`, sellRect.x + sellRect.width / 2, sellRect.y + 15, 11, '#ff8a9a', 'center', true);
    } else if (state.selectedPost !== null) {
      const level = state.postLevels[state.selectedPost];
      const def = POST_LEVELS[level - 1];
      text(`Lantern Post Lv ${level}`, panel.x + 10, panel.y + 22, 12, PALETTE.text, 'left', true);
      text(`Glow +${Math.round(def.damageBonus * 100)}% · radius ${def.radius}`, panel.x + 10, panel.y + 40, 10, PALETTE.muted, 'left');
      const upRect = postUpgradeRect(panel);
      const cost = level < MAX_POST_LEVEL ? POST_UPGRADE_COST[level - 1] : null;
      const canUp = cost !== null && state.coins >= cost;
      context.fillStyle = canUp ? 'rgba(255, 209, 102, 0.3)' : 'rgba(255, 246, 232, 0.08)';
      roundRect(upRect.x, upRect.y, upRect.width, upRect.height, 6);
      context.fill();
      text(cost === null ? 'MAX LEVEL' : `Upgrade ${cost}`, upRect.x + upRect.width / 2, upRect.y + 17, 12, canUp ? PALETTE.gold : PALETTE.muted, 'center', true);
    } else {
      text('Click a cat tower', panel.x + 14, panel.y + 30, 13, PALETTE.muted, 'left');
      text('or a lantern post.', panel.x + 14, panel.y + 52, 13, PALETTE.muted, 'left');
    }
    // Start wave button (build phase) or the wave status.
    const start = startWaveRect();
    if (state.phase === PHASE_BUILD) {
      const pulse = 0.75 + 0.25 * Math.sin(state.elapsed * 4);
      context.fillStyle = `rgba(255, 209, 102, ${pulse})`;
      roundRect(start.x, start.y, start.width, start.height, 10);
      context.fill();
      text('▶ Start Wave', start.x + start.width / 2, start.y + 32, 16, '#4a3423', 'center', true);
      text(`${Math.ceil(state.buildTimer)}s`, start.x + start.width / 2, start.y + 56, 13, '#4a3423', 'center', true);
    } else if (state.phase === PHASE_WAVE) {
      context.fillStyle = 'rgba(255, 246, 232, 0.08)';
      roundRect(start.x, start.y, start.width, start.height, 10);
      context.fill();
      text(world.waveLabel(), start.x + start.width / 2, start.y + 32, 16, PALETTE.text, 'center', true);
      text('fighting…', start.x + start.width / 2, start.y + 56, 13, PALETTE.muted, 'center', true);
    }
  }

  function drawMessage(world) {
    const state = world.state;
    if (state.messageTimer <= 0 || state.message === '') return;
    context.globalAlpha = Math.min(1, state.messageTimer);
    // Drop below the boss bar when it is showing, so the two never overlap.
    const y = bossActive(world) !== null ? 112 : 96;
    text(state.message, FIELD.width / 2, y, 20, PALETTE.text, 'center', true);
    context.globalAlpha = 1;
  }

  function draw(world, screen, best, speed) {
    resize();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shake = world.fx.shakeOffset();
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shake.x * view.scale, view.y + shake.y * view.scale);
    const light = world.lightLevel();
    drawSky(world);
    drawGarden(world);
    LANTERN_POSTS.forEach((post, i) => drawLanternPost(post, world.state.postLevels[i], light, world.state.elapsed));
    drawBigLantern(world, light, world.state.elapsed);
    drawPlots(world);
    drawTowers(world);
    drawEnemies(world);
    drawProjectiles(world);
    drawEffects(world);
    drawVignette(world);
    if (screen !== SCREEN_TITLE) {
      drawTopBar(world, screen, best, speed ?? 1);
      drawBossBar(world);
      drawShopBar(world);
      drawMessage(world);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, text, context, toField, drawCat };
}
