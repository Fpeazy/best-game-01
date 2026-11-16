// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred. Warm lantern glow against the
// cool dusk, round cute shapes, thick outlines — crispness comes from light and
// geometry, not saturation.
import { FIELD, FONT, LAYOUT, LIGHT, PALETTE } from './config.js';
import { LANTERN, LANTERN_POSTS, PATH_POINTS, PATH_WIDTH } from './garden.js';
import { PHASE_BUILD, PHASE_WAVE } from './world.js';
import { TOWER_TYPES, towerStats } from './towers.js';
import { selectedPanelRect, shopCards, startWaveRect, topButtons } from './ui.js';

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
  const waveLabel = cachedLabel('Wave ');
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
    // The moon, high over the garden.
    context.fillStyle = PALETTE.moon;
    context.beginPath();
    context.arc(1120, 92, 30, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255, 233, 176, 0.25)';
    context.beginPath();
    context.arc(1120, 92, 40, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8c98a';
    context.beginPath();
    context.arc(1110, 84, 6, 0, Math.PI * 2);
    context.arc(1130, 100, 4, 0, Math.PI * 2);
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

  function drawLanternPost(post, light, t) {
    const flicker = 0.85 + 0.15 * Math.sin(t * 2.3 + post.x);
    const alpha = 0.5 * light * flicker;
    drawGlow(post.x, post.y - 18, 90, alpha);
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
  }

  function drawBigLantern(world, light, t) {
    const flicker = 0.9 + 0.1 * Math.sin(t * 1.8);
    drawGlow(LANTERN.x, LANTERN.y, 150, 0.55 * light * flicker);
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

  /** A cute round cat: body, ears, face, tail, and a hat or scarf at higher levels. */
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
    // Level 2: a little hat. Level 3: a scarf as well, and a bigger cat.
    if (level >= 2) {
      context.fillStyle = '#e86a7a';
      context.beginPath();
      context.moveTo(-r * 0.55, -r * 0.8);
      context.lineTo(r * 0.55, -r * 0.8);
      context.lineTo(r * 0.4, -r * 1.15);
      context.lineTo(-r * 0.4, -r * 1.15);
      context.closePath();
      context.fill();
      context.fillStyle = '#ffd166';
      context.fillRect(-r * 0.55, -r * 0.88, r * 1.1, r * 0.14);
    }
    if (level >= 3) {
      context.strokeStyle = '#ffd166';
      context.lineWidth = 7;
      context.beginPath();
      context.arc(0, r * 0.35, r * 0.62, Math.PI * 0.15, Math.PI * 0.85);
      context.stroke();
    }
    context.restore();
  }

  function drawTowers(world) {
    const selected = world.state.selected;
    for (const tower of world.towers.towers) {
      if (!tower.active) continue;
      const def = TOWER_TYPES[tower.type];
      const stats = towerStats(tower.type, tower.level);
      const range = stats.range * (tower.glow ? 1 + LIGHT.rangeBonus : 1);
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
      }
      const size = tower.type === 'mochi' ? 24 : 20;
      drawCat(tower.x, tower.y, size * (1 + 0.12 * (tower.level - 1)), def, tower.level, tower.squash, 0, tower.type === 'sleepy');
      // What the tower holds: a yarn ball, a fish, or nothing (Mochi swats).
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
    if (enemy.type === 'moth' || enemy.type === 'boss') {
      // Fluttering wings, purple and round.
      const flap = Math.sin(enemy.wobble * 2.4) * 0.5;
      context.fillStyle = enemy.type === 'boss' ? '#6b4a8e' : '#8a6ab0';
      context.save();
      context.rotate(-0.5 - flap * 0.3);
      context.beginPath();
      context.ellipse(-enemy.radius * 0.9, -enemy.radius * 0.4, enemy.radius * 0.85, enemy.radius * 0.55, -0.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
      context.save();
      context.rotate(0.5 + flap * 0.3);
      context.beginPath();
      context.ellipse(enemy.radius * 0.9, -enemy.radius * 0.4, enemy.radius * 0.85, enemy.radius * 0.55, 0.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    context.scale(1 + wobble, 1 - wobble);
    context.fillStyle = enemy.type === 'boss' ? PALETTE.boss : PALETTE.shadow;
    context.beginPath();
    context.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(20, 10, 30, 0.5)';
    context.lineWidth = 2;
    context.stroke();
    if (enemy.type === 'beetle') {
      context.fillStyle = '#5a3a6e';
      context.beginPath();
      context.arc(0, -enemy.radius * 0.25, enemy.radius * 0.7, Math.PI, 0);
      context.fill();
      context.strokeStyle = '#8a6ab0';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, -enemy.radius);
      context.lineTo(0, -enemy.radius * 0.2);
      context.stroke();
    }
    if (enemy.type === 'boss') {
      // A little crown of shadow antennae.
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
    // Glowing eyes, looking toward the lantern.
    const look = enemy.angle;
    const ex = Math.cos(look) * enemy.radius * 0.3;
    const ey = Math.sin(look) * enemy.radius * 0.3;
    context.fillStyle = PALETTE.shadowEye;
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
    text(waveLabel(`${Math.min(state.wave, 10)}/10`), 16, 37, 22, PALETTE.text, 'left', true);
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.arc(142, 30, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#8a6a1a';
    text('C', 142, 34, 12, '#8a6a1a', 'center', true);
    text(coinsLabel(`${state.coins}`), 158, 37, 22, PALETTE.gold, 'left', true);
    text('♥', 240, 37, 20, PALETTE.heart, 'left');
    text(livesLabel(`${state.lives}/10`), 266, 37, 22, PALETTE.text, 'left', true);
    text(scoreLabel(`${state.score}`), 360, 37, 22, PALETTE.text, 'left', true);
    text(lightLabel(`${Math.round(world.lightLevel() * 100)}%`), 520, 37, 18, '#ffb347', 'left', true);
    text(`Best ${best}`, 700, 37, 18, PALETTE.muted, 'left');
    const buttons = topButtons();
    for (const [name, rect] of Object.entries(buttons)) {
      context.fillStyle = 'rgba(255, 246, 232, 0.12)';
      roundRect(rect.x, rect.y, rect.width, rect.height, 8);
      context.fill();
      const label = name === 'pause' ? (screen === SCREEN_PAUSED ? '▶' : 'II') : name === 'speed' ? `${speed}x` : '♪';
      text(label, rect.x + rect.width / 2, rect.y + 26, name === 'speed' ? 15 : 17, PALETTE.text, 'center', true);
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
      drawCat(rect.x + 34, rect.y + 38, 20, card.def, 1, 0, 0, card.type === 'sleepy');
      text(card.def.name, rect.x + 62, rect.y + 28, 15, PALETTE.text, 'left', true);
      const cost = card.type === 'mochi' ? 'Hero — on the field' : `Cost ${card.def.cost}`;
      text(cost, rect.x + 62, rect.y + 50, 14, affordable ? PALETTE.gold : '#ff8a9a', 'left', true);
      text(card.def.desc, rect.x + 62, rect.y + 68, 11, PALETTE.muted, 'left');
    }
    // Selected tower panel.
    const panel = selectedPanelRect();
    const selected = state.selected;
    context.fillStyle = 'rgba(255, 246, 232, 0.08)';
    roundRect(panel.x, panel.y, panel.width, panel.height, 10);
    context.fill();
    if (selected !== null && selected.active) {
      const def = TOWER_TYPES[selected.type];
      const stats = towerStats(selected.type, selected.level);
      drawCat(panel.x + 30, panel.y + 38, 18, def, selected.level, 0, 0, selected.type === 'sleepy');
      text(`${def.name}  ${'★'.repeat(selected.level)}${'☆'.repeat(3 - selected.level)}`, panel.x + 56, panel.y + 26, 14, PALETTE.text, 'left', true);
      text(`DMG ${Math.round(stats.damage)}  ·  RNG ${Math.round(stats.range)}${selected.glow ? '  ·  in glow!' : ''}`, panel.x + 56, panel.y + 46, 12, PALETTE.muted, 'left');
      const upCost = selected.level < 3 ? TOWER_TYPES[selected.type].upgrade[selected.level - 1] : null;
      const upRect = { x: panel.x + 128, y: panel.y + 10, width: 108, height: 28 };
      const sellRect = { x: panel.x + 128, y: panel.y + 42, width: 108, height: 28 };
      const canUp = upCost !== null && state.coins >= upCost;
      context.fillStyle = canUp ? 'rgba(255, 209, 102, 0.3)' : 'rgba(255, 246, 232, 0.08)';
      roundRect(upRect.x, upRect.y, upRect.width, upRect.height, 6);
      context.fill();
      text(upCost === null ? 'MAX LEVEL' : `Upgrade ${upCost}`, upRect.x + upRect.width / 2, upRect.y + 19, 12, canUp ? PALETTE.gold : PALETTE.muted, 'center', true);
      context.fillStyle = 'rgba(255, 107, 129, 0.2)';
      roundRect(sellRect.x, sellRect.y, sellRect.width, sellRect.height, 6);
      context.fill();
      text(selected.type === 'mochi' ? 'Hero — cannot sell' : `Sell +${Math.floor(selected.invested * 0.7)}`, sellRect.x + sellRect.width / 2, sellRect.y + 19, 12, '#ff8a9a', 'center', true);
    } else {
      text('Click a cat tower', panel.x + 14, panel.y + 30, 14, PALETTE.muted, 'left');
      text('to upgrade or sell it.', panel.x + 14, panel.y + 52, 14, PALETTE.muted, 'left');
    }
    // Start wave button (build phase) or the wave status.
    const start = startWaveRect();
    if (state.phase === PHASE_BUILD) {
      const pulse = 0.75 + 0.25 * Math.sin(state.elapsed * 4);
      context.fillStyle = `rgba(255, 209, 102, ${pulse})`;
      roundRect(start.x, start.y, start.width, start.height, 10);
      context.fill();
      text('▶ Start Wave', start.x + start.width / 2, start.y + 34, 18, '#4a3423', 'center', true);
      text(`${Math.ceil(state.buildTimer)}s`, start.x + start.width / 2, start.y + 58, 14, '#4a3423', 'center', true);
    } else if (state.phase === PHASE_WAVE) {
      context.fillStyle = 'rgba(255, 246, 232, 0.08)';
      roundRect(start.x, start.y, start.width, start.height, 10);
      context.fill();
      text(`Wave ${state.wave}`, start.x + start.width / 2, start.y + 34, 18, PALETTE.text, 'center', true);
      text('fighting…', start.x + start.width / 2, start.y + 58, 14, PALETTE.muted, 'center', true);
    }
  }

  function drawMessage(world) {
    const state = world.state;
    if (state.messageTimer <= 0 || state.message === '') return;
    context.globalAlpha = Math.min(1, state.messageTimer);
    text(state.message, FIELD.width / 2, 92, 20, PALETTE.text, 'center', true);
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
    for (const post of LANTERN_POSTS) drawLanternPost(post, light, world.state.elapsed);
    drawBigLantern(world, light, world.state.elapsed);
    drawPlots(world);
    drawTowers(world);
    drawEnemies(world);
    drawProjectiles(world);
    drawEffects(world);
    drawVignette(world);
    if (screen !== SCREEN_TITLE) {
      drawTopBar(world, screen, best, speed ?? 1);
      drawShopBar(world);
      drawMessage(world);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, text, context, toField, drawCat };
}
