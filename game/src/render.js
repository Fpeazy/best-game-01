// Drawing only: world state in, pixels out. Warm lantern glow on cool night;
// crispness from light and geometry, not saturation.
import { ABILITIES, ABILITY_ORDER, DIFFICULTIES, FIELD, FONT, LAYOUT, MAX_POST_LEVEL, MUTATORS, PALETTE, POST_LEVELS, POST_UPGRADE_COST } from './config.js';
import { LANTERN, LANTERN_POSTS, PATH_POINTS, PATH_WIDTH, POND, postGlowRadius } from './garden.js';
import { PHASE_BUILD, PHASE_WAVE } from './world.js';
import { TOWER_TYPES, towerStats } from './towers.js';
import { abilityRects, postUpgradeRect, selectedPanelRect, selectedSellRect, selectedTargetRect, selectedUpgradeRect, shopCards, startWaveRect, topButtons } from './ui.js';
import { wavePreview } from './waves.js';
import { TARGET_LABELS } from './config.js';

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
  let context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  const coinsLabel = cachedLabel('');
  const livesLabel = cachedLabel('');
  const scoreLabel = cachedLabel('Score ');
  const lightLabel = cachedLabel('Lantern Light ');
  // Perf: gradients built once and reused; glows are one stamped sprite.
  const glowSprite = (() => {
    const s = document.createElement('canvas');
    s.width = 256;
    s.height = 256;
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 190, 90, 1)');
    grad.addColorStop(0.5, 'rgba(255, 170, 70, 0.45)');
    grad.addColorStop(1, 'rgba(255, 170, 70, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return s;
  })();
  const skyGrad = (() => {
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyBottom);
    grad.addColorStop(1, '#5a4066');
    return grad;
  })();
  const fieldGrad = (() => {
    const grad = context.createLinearGradient(0, LAYOUT.play.y, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.grass);
    grad.addColorStop(1, PALETTE.grassDark);
    return grad;
  })();
  // Full-screen overlays, baked once as sprites (perf, v4): stamping a bitmap
  // is a fraction of a gradient fill in software rendering.
  function bakeOverlay(stops) {
    const s = document.createElement('canvas');
    s.width = FIELD.width;
    s.height = FIELD.height;
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(640, 360, 240, 640, 360, 720);
    for (const [at, color] of stops) grad.addColorStop(at, color);
    g.fillStyle = grad;
    g.fillRect(0, 0, FIELD.width, FIELD.height);
    return s;
  }
  const vignetteSprite = bakeOverlay([[0, 'rgba(20, 10, 30, 0)'], [1, 'rgba(20, 10, 30, 1)']]);
  const washSprite = (() => {
    const s = document.createElement('canvas');
    s.width = FIELD.width;
    s.height = FIELD.height;
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(LANTERN.x, LANTERN.y, 60, LANTERN.x, LANTERN.y, 780);
    grad.addColorStop(0, 'rgba(255, 200, 100, 0.12)');
    grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, FIELD.width, FIELD.height);
    return s;
  })();
  // Per-volume shading gradients, keyed by (centre-y, radius) in local coords.
  const volumeGrads = new Map();
  // The baked static garden: sky, field, decor, path, plot beds. Re-baked
  // whenever the world's decor object changes (new world / new seed).
  let staticLayer = null;
  let staticDecor = null;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    // Assigning canvas.width clears the canvas even to the same value, so
    // only assign when it actually changed (perf, v4).
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
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

  // Static sky (baked into the background layer, perf v4): gradient + moon.
  function drawSkyStatic(world) {
    context.fillStyle = skyGrad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
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

  // Twinkling stars, dynamic — only the ones above the field (y < 56) are
  // ever visible; the rest are covered by the garden fill.
  function drawStars(world) {
    const t = world.state.elapsed;
    for (const star of world.decor.stars) {
      if (star.y >= LAYOUT.play.y) continue;
      const twinkle = 0.5 + 0.5 * Math.sin(t * 1.5 + star.tw);
      context.globalAlpha = 0.35 + 0.5 * twinkle;
      context.fillStyle = PALETTE.star;
      context.beginPath();
      context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawGarden(world) {
    context.fillStyle = fieldGrad;
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
    // Night water: deep teal, so the pond reads as water at night, not daylight.
    context.fillStyle = '#4a8a9a';
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
    // Cat statues, stone lantern shrines and bushes fill the middle (v4):
    // the garden reads as a garden even where no tower stands.
    for (const bush of world.decor.bushes) {
      context.fillStyle = '#1d3d2e';
      context.beginPath();
      context.arc(bush.x, bush.y, bush.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2f5d43';
      context.beginPath();
      context.arc(bush.x - bush.r * 0.25, bush.y - bush.r * 0.25, bush.r * 0.6, 0, Math.PI * 2);
      context.fill();
    }
    for (const shrine of world.decor.shrines) {
      context.fillStyle = '#6a6a72';
      context.fillRect(shrine.x - 12, shrine.y - 6, 24, 12);
      context.fillStyle = '#8a8a92';
      context.fillRect(shrine.x - 9, shrine.y - 26, 18, 20);
      drawGlow(shrine.x, shrine.y - 16, 34, 0.5);
      context.fillStyle = '#ffd166';
      context.fillRect(shrine.x - 4, shrine.y - 22, 8, 12);
      context.fillStyle = '#5a5a62';
      context.beginPath();
      context.moveTo(shrine.x - 12, shrine.y - 26);
      context.lineTo(shrine.x, shrine.y - 36);
      context.lineTo(shrine.x + 12, shrine.y - 26);
      context.closePath();
      context.fill();
    }
    for (const statue of world.decor.statues) {
      // A stone cat, sitting: body, ears, tail — grey stone, gold eyes.
      context.fillStyle = '#7a7a82';
      context.beginPath();
      context.arc(statue.x, statue.y, statue.r, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(statue.x - 12, statue.y - 14);
      context.lineTo(statue.x - 16, statue.y - 30);
      context.lineTo(statue.x - 4, statue.y - 20);
      context.closePath();
      context.moveTo(statue.x + 12, statue.y - 14);
      context.lineTo(statue.x + 16, statue.y - 30);
      context.lineTo(statue.x + 4, statue.y - 20);
      context.closePath();
      context.fill();
      context.strokeStyle = '#7a7a82';
      context.lineWidth = 5;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(statue.x - statue.r * 0.8, statue.y + 8);
      context.quadraticCurveTo(statue.x - statue.r * 1.4, statue.y, statue.x - statue.r * 1.1, statue.y - 12);
      context.stroke();
      context.fillStyle = '#ffd166';
      context.beginPath();
      context.arc(statue.x - 7, statue.y - 6, 2.5, 0, Math.PI * 2);
      context.arc(statue.x + 7, statue.y - 6, 2.5, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
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
    // Edge stones along both path edges, so the lane reads as a road.
    for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
      const a = PATH_POINTS[i];
      const b = PATH_POINTS[i + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      const nx = -(b.y - a.y) / segLen;
      const ny = (b.x - a.x) / segLen;
      let side = i % 2 === 0 ? 1 : -1;
      for (let d = 34; d < segLen - 20; d += 64) {
        const cx = a.x + ((b.x - a.x) * d) / segLen + nx * side * (PATH_WIDTH / 2 + 5);
        const cy = a.y + ((b.y - a.y) * d) / segLen + ny * side * (PATH_WIDTH / 2 + 5);
        side = -side;
        if (cx < 24 || cx > 1256 || cy < 66 || cy > 606) continue;
        if (Math.hypot(cx - LANTERN.x, cy - LANTERN.y) < 70) continue;
        let blocked = false;
        for (const post of LANTERN_POSTS) {
          if (Math.hypot(cx - post.x, cy - post.y) < 30) { blocked = true; break; }
        }
        if (blocked) continue;
        for (const plot of world.plots) {
          if (Math.hypot(cx - plot.x, cy - plot.y) < plot.radius + 8) { blocked = true; break; }
        }
        if (blocked) continue;
        context.fillStyle = '#b8b0a0';
        context.beginPath();
        context.ellipse(cx, cy, 7, 5, 0.4, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(255, 255, 255, 0.25)';
        context.beginPath();
        context.ellipse(cx - 2, cy - 2, 3, 2, 0.4, 0, Math.PI * 2);
        context.fill();
      }
    }
    // A dashed lane line down the middle: the path reads as a road at a glance.
    context.strokeStyle = 'rgba(255, 246, 220, 0.45)';
    context.lineWidth = 2;
    context.setLineDash([14, 18]);
    context.beginPath();
    context.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
    for (let i = 1; i < PATH_POINTS.length; i += 1) context.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
    context.stroke();
    context.setLineDash([]);
    // Garden gate, where the bugs march in.
    context.fillStyle = '#6b4a2f';
    context.fillRect(0, 132, 10, 56);
    context.fillRect(0, 132, 26, 8);
    context.fillRect(0, 180, 26, 8);
  }

  // Fireflies: sharp sparkles, drawn every frame (they drift).
  function drawFireflies(world) {
    const t = world.state.elapsed;
    for (const fly of world.decor.fireflies) {
      const fx = fly.x + Math.sin(t * fly.speed + fly.phase) * fly.amp;
      const fy = fly.y + Math.cos(t * fly.speed * 0.8 + fly.phase) * fly.amp;
      const glow = 0.4 + 0.35 * Math.sin(t * 2 + fly.phase);
      context.globalAlpha = 0.5 + 0.5 * glow;
      drawStar4(fx, fy, 5, '#ffe9b0');
      context.fillStyle = '#fff6d8';
      context.beginPath();
      context.arc(fx, fy, 1.8, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  // Festival sparkles (v4 spectacle): while the lanterns blaze, gold stars
  // glitter along the whole path — the flare reads across the field, not
  // just at the lantern.
  function drawFestivalSparkles(world) {
    if (world.state.festival > 0.3) {
      context.globalAlpha = world.state.festival * 0.9;
      for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
        const mx = (PATH_POINTS[i].x + PATH_POINTS[i + 1].x) / 2;
        const my = (PATH_POINTS[i].y + PATH_POINTS[i + 1].y) / 2;
        drawStar4(mx, my, 9, '#ffd166');
      }
      context.globalAlpha = 1;
    }
  }

  function drawGlow(x, y, radius, alpha) {
    // One stamped sprite instead of a fresh gradient per call (perf, v4).
    context.save();
    context.globalAlpha = alpha;
    context.drawImage(glowSprite, x - radius, y - radius, radius * 2, radius * 2);
    context.restore();
  }

  function drawLanternPost(post, level, light, t, festival) {
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
    drawGlow(post.x, post.y - 18, 110 * (1 + festival * 0.6), 0.55 * light * flicker * (1 + festival * 0.6));
    // Sharp core: a white-hot centre + a hard gold rim, not a soft blob.
    context.fillStyle = 'rgba(255, 243, 201, 0.95)';
    context.beginPath();
    context.arc(post.x, post.y - 18, 7, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255, 209, 102, 0.9)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(post.x, post.y - 18, 12, 0, Math.PI * 2);
    context.stroke();
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

  function drawBigLantern(world, light, t, festival) {
    const flicker = 0.9 + 0.1 * Math.sin(t * 1.8);
    drawGlow(LANTERN.x, LANTERN.y, 190 * (1 + festival * 0.6), 0.6 * light * flicker * (1 + festival * 0.5));
    // Hard white-hot core at the lantern's heart (v4 sharpening).
    context.fillStyle = 'rgba(255, 243, 201, 0.95)';
    context.beginPath();
    context.arc(LANTERN.x, LANTERN.y - 6, 12, 0, Math.PI * 2);
    context.fill();
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

  // Static plot beds: brown soil gradient, darker at the bottom.
  function drawPlotsStatic(world) {
    for (let i = 0; i < world.plots.length; i += 1) {
      const plot = world.plots[i];
      const soil = context.createRadialGradient(plot.x - 6, plot.y - 8, 4, plot.x, plot.y, plot.radius);
      soil.addColorStop(0, '#5a4030');
      soil.addColorStop(0.7, '#4a3626');
      soil.addColorStop(1, '#2e2115');
      context.fillStyle = soil;
      context.beginPath();
      context.arc(plot.x, plot.y, plot.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(0, 0, 0, 0.28)';
      for (const [dx, dy] of [[-9, -6], [8, 5], [0, 11], [10, -8]]) {
        context.beginPath();
        context.arc(plot.x + dx, plot.y + dy, 2.5, 0, Math.PI * 2);
        context.fill();
      }
      context.strokeStyle = PALETTE.plotEdge;
      context.lineWidth = 3;
      context.stroke();
    }
  }

  function drawPlots(world) {
    for (let i = 0; i < world.plots.length; i += 1) {
      const plot = world.plots[i];
      // A plot standing in a lantern post's glow reads as powered: a warm
      // gold rim + a soft gold wash, so the glow mechanic is visible on the
      // field itself, not only in the post's dashed zone.
      let lit = false;
      for (let p = 0; p < LANTERN_POSTS.length; p += 1) {
        const post = LANTERN_POSTS[p];
        if (Math.hypot(plot.x - post.x, plot.y - post.y) <= postGlowRadius(world.state.postLevels[p])) {
          lit = true;
          break;
        }
      }
      if (lit) {
        context.fillStyle = 'rgba(255, 190, 90, 0.10)';
        context.beginPath();
        context.arc(plot.x, plot.y, plot.radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = 'rgba(255, 209, 102, 0.85)';
        context.lineWidth = 2.5;
        context.beginPath();
        context.arc(plot.x, plot.y, plot.radius - 1.5, 0, Math.PI * 2);
        context.stroke();
      }
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
    // Somewhat-3D volumes: top light + bottom shade, canvas 2D only.
    function volume(cx, cy, rad) {
      const key = `${cy},${rad}`;
      let shade = volumeGrads.get(key);
      if (shade === undefined) {
        shade = context.createLinearGradient(cx, cy - rad, cx, cy + rad);
        shade.addColorStop(0, 'rgba(255,255,255,0.22)');
        shade.addColorStop(0.45, 'rgba(255,255,255,0)');
        shade.addColorStop(1, 'rgba(20,10,30,0.28)');
        volumeGrads.set(key, shade);
      }
      context.save();
      context.beginPath();
      context.arc(cx, cy, rad, 0, Math.PI * 2);
      context.clip();
      context.fillStyle = shade;
      context.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      context.restore();
    }
    // A soft drop shadow grounds the cat on the plot.
    context.fillStyle = 'rgba(8, 6, 20, 0.38)';
    context.beginPath();
    context.ellipse(0, r * 0.88, r * 0.9, r * 0.26, 0, 0, Math.PI * 2);
    context.fill();
    // Tail, wagging.
    context.strokeStyle = def.color;
    context.lineWidth = 6;
    context.lineCap = 'round';
    const wag = Math.sin((y * 0.13 + x * 0.07) * 2) * 6;
    context.beginPath();
    context.moveTo(-r * 0.8, r * 0.4);
    context.quadraticCurveTo(-r * 1.5, r * 0.2 + wag, -r * 1.3, -r * 0.5 + wag);
    context.stroke();
    // Ears, with a darker inner ear for depth (the head volume drawn later
    // covers the ear bases, so the ears sit behind the head).
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
    context.fillStyle = 'rgba(232, 120, 130, 0.85)';
    context.beginPath();
    context.moveTo(-r * 0.55, -r * 0.68);
    context.lineTo(-r * 0.72, -r * 1.02);
    context.lineTo(-r * 0.3, -r * 0.88);
    context.closePath();
    context.moveTo(r * 0.55, -r * 0.68);
    context.lineTo(r * 0.72, -r * 1.02);
    context.lineTo(r * 0.3, -r * 0.88);
    context.closePath();
    context.fill();
    // Body.
    context.fillStyle = def.color;
    context.beginPath();
    context.arc(0, 0, r, 0, Math.PI * 2);
    context.fill();
    volume(0, 0, r);
    context.strokeStyle = 'rgba(60, 30, 20, 0.35)';
    context.lineWidth = 2.5;
    context.stroke();
    // Hard warm rim-light arc on the body top.
    context.strokeStyle = 'rgba(255, 240, 200, 0.8)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, r - 1, Math.PI * 1.15, Math.PI * 1.85);
    context.stroke();
    // Head as its own overlapping volume (not one flat circle): same colour,
    // its own shading and rim, sitting on the body so the cat reads as two
    // puffed clay volumes. The face moves onto the head below.
    context.fillStyle = def.color;
    context.beginPath();
    context.arc(0, -r * 0.28, r * 0.66, 0, Math.PI * 2);
    context.fill();
    volume(0, -r * 0.28, r * 0.66);
    context.strokeStyle = 'rgba(60, 30, 20, 0.35)';
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = 'rgba(255, 240, 200, 0.7)';
    context.beginPath();
    context.arc(0, -r * 0.28, r * 0.66 - 1, Math.PI * 1.15, Math.PI * 1.85);
    context.stroke();
    // A small top-left highlight on the head — the lantern light catching it.
    context.fillStyle = 'rgba(255, 255, 255, 0.3)';
    context.beginPath();
    context.ellipse(-r * 0.24, -r * 0.54, r * 0.16, r * 0.1, -0.5, 0, Math.PI * 2);
    context.fill();
    // Belly.
    context.fillStyle = def.belly;
    context.beginPath();
    context.ellipse(0, r * 0.5, r * 0.52, r * 0.36, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255, 255, 255, 0.22)';
    context.beginPath();
    context.ellipse(-r * 0.18, r * 0.38, r * 0.18, r * 0.1, -0.4, 0, Math.PI * 2);
    context.fill();
    // Paws, slightly forward of the body.
    context.fillStyle = def.belly;
    context.strokeStyle = 'rgba(60, 30, 20, 0.3)';
    context.lineWidth = 1.5;
    for (const px of [-r * 0.42, r * 0.42]) {
      context.beginPath();
      context.ellipse(px, r * 0.84, r * 0.22, r * 0.13, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    // Face, on the head volume (head centre 0, -0.28r): eyes (closed when
    // sleeping), nose, whiskers.
    if (sleeping) {
      context.strokeStyle = '#4a3423';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(-r * 0.3, -r * 0.33, r * 0.12, Math.PI * 1.15, Math.PI * 1.85);
      context.arc(r * 0.3, -r * 0.33, r * 0.12, Math.PI * 1.15, Math.PI * 1.85);
      context.stroke();
    } else {
      context.fillStyle = '#2c1f3d';
      context.beginPath();
      context.arc(-r * 0.3, -r * 0.33, r * 0.09, 0, Math.PI * 2);
      context.arc(r * 0.3, -r * 0.33, r * 0.09, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff';
      context.beginPath();
      context.arc(-r * 0.26, -r * 0.37, r * 0.035, 0, Math.PI * 2);
      context.arc(r * 0.34, -r * 0.37, r * 0.035, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#e86a7a';
    context.beginPath();
    context.moveTo(-r * 0.09, -r * 0.16);
    context.lineTo(r * 0.09, -r * 0.16);
    context.lineTo(0, -r * 0.04);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(74, 52, 35, 0.6)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(-r * 0.48, -r * 0.18);
    context.lineTo(-r * 0.95, -r * 0.28);
    context.moveTo(-r * 0.48, -r * 0.06);
    context.lineTo(-r * 0.95, r * 0.04);
    context.moveTo(r * 0.48, -r * 0.18);
    context.lineTo(r * 0.95, -r * 0.28);
    context.moveTo(r * 0.48, -r * 0.06);
    context.lineTo(r * 0.95, r * 0.04);
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
      // A signature-colour ring under every tower (v4): yarn pink, fish blue,
      // sleepy lavender, star gold, frosty cyan, Mochi orange — the tower's
      // type reads at thumbnail size even when the cat is small.
      context.strokeStyle = def.color;
      context.globalAlpha = 0.9;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(tower.x, tower.y, 25, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
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
      } else if (tower.type === 'mochi') {
        // Mochi swats with a little fly-swatter: handle + mesh head, so the
        // hero reads as the melee cat at a glance.
        context.strokeStyle = '#8a5a2b';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(tower.x + 10, tower.y + 16);
        context.lineTo(tower.x + 20, tower.y + 2);
        context.stroke();
        context.fillStyle = '#e8d8b0';
        context.fillRect(tower.x + 14, tower.y - 10, 12, 12);
        context.strokeStyle = '#b89a6a';
        context.lineWidth = 1;
        context.strokeRect(tower.x + 14, tower.y - 10, 12, 12);
        context.beginPath();
        context.moveTo(tower.x + 20, tower.y - 10);
        context.lineTo(tower.x + 20, tower.y + 2);
        context.moveTo(tower.x + 14, tower.y - 4);
        context.lineTo(tower.x + 26, tower.y - 4);
        context.stroke();
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
    // The boss and queen cast a drop shadow: they read as volumes hovering
    // over the garden, not flat stickers on it (v4 spectacle).
    if (enemy.type === 'boss' || enemy.type === 'queen') {
      context.fillStyle = 'rgba(8, 6, 20, 0.4)';
      context.beginPath();
      context.ellipse(0, enemy.radius * 0.95, enemy.radius * 1.05, enemy.radius * 0.28, 0, 0, Math.PI * 2);
      context.fill();
    }
    if (enemy.type === 'moth' || enemy.type === 'queen' || enemy.type === 'boss') {
      // Fluttering wings: pale lavender for the moth, pink for the queen, wide and
      // dark-rimmed for the boss (wider still in its flying phase).
      const flap = Math.sin(enemy.wobble * 2.4) * 0.5;
      const wingColor = enemy.type === 'boss' ? '#6b4a8e' : enemy.type === 'queen' ? '#f2a7c3' : '#d9c8f2';
      const wingR = enemy.type === 'boss' ? enemy.radius * 1.15 : enemy.radius * 0.95;
      const spread = enemy.type === 'boss' && enemy.phase === 3 ? 0.9 : 0.6;
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
    // Volume shading for the boss and queen (v4, somewhat-3D): warm light
    // from above, deep shade below — the big body reads as a volume, not a
    // flat dark blob.
    if (enemy.type === 'boss' || enemy.type === 'queen') {
      // Cached by radius (perf, v4): the boss radius never changes.
      let shade = volumeGrads.get(`boss,${enemy.radius}`);
      if (shade === undefined) {
        shade = context.createLinearGradient(0, -enemy.radius, 0, enemy.radius);
        shade.addColorStop(0, 'rgba(255, 220, 160, 0.22)');
        shade.addColorStop(0.5, 'rgba(255, 220, 160, 0)');
        shade.addColorStop(1, 'rgba(10, 5, 25, 0.38)');
        volumeGrads.set(`boss,${enemy.radius}`, shade);
      }
      context.save();
      context.beginPath();
      context.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      context.clip();
      context.fillStyle = shade;
      context.fillRect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
      context.restore();
    }
    context.strokeStyle = enemy.type === 'boss' ? '#ffd166' : 'rgba(20, 10, 30, 0.5)';
    context.lineWidth = enemy.type === 'boss' ? 7 : 2;
    context.stroke();
    if (enemy.type === 'moth') {
      // Wing spots: the flutter moth is a moth, not a pale blob.
      context.fillStyle = 'rgba(120, 90, 160, 0.55)';
      context.beginPath();
      context.arc(-enemy.radius * 0.9, -enemy.radius * 0.5, enemy.radius * 0.14, 0, Math.PI * 2);
      context.arc(enemy.radius * 0.9, -enemy.radius * 0.5, enemy.radius * 0.14, 0, Math.PI * 2);
      context.fill();
    }
    if (enemy.type === 'boss') {
      // Pulsing gold rim light (v4, warm amber not magenta — Lead's call):
      // the boss glows against the night instead of reading as a dark blob.
      // No shadowBlur (perf, v4): it is the single slowest canvas op in
      // software rendering, and the bloom + halo already carry the glow.
      context.strokeStyle = 'rgba(255, 209, 102, 0.9)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(0, 0, enemy.radius + 3, 0, Math.PI * 2);
      context.stroke();
    }
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
      // A lighter dome crescent on the shell + a top highlight, so the beetle
      // reads as an armoured dome, not a flat dark disc.
      context.fillStyle = '#5a3a6e';
      context.beginPath();
      context.arc(0, -enemy.radius * 0.25, enemy.radius * 0.7, Math.PI, 0);
      context.fill();
      context.fillStyle = 'rgba(255, 255, 255, 0.22)';
      context.beginPath();
      context.ellipse(-enemy.radius * 0.25, -enemy.radius * 0.55, enemy.radius * 0.3, enemy.radius * 0.16, -0.5, 0, Math.PI * 2);
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
    if (enemy.type === 'boss') {
      // A real golden crown with red gems — the first thing the eye lands on.
      const r = enemy.radius;
      context.fillStyle = '#ffd166';
      context.beginPath();
      context.moveTo(-r * 0.55, -r * 0.55);
      context.lineTo(-r * 0.55, -r * 1.05);
      context.lineTo(-r * 0.28, -r * 0.75);
      context.lineTo(0, -r * 1.15);
      context.lineTo(r * 0.28, -r * 0.75);
      context.lineTo(r * 0.55, -r * 1.05);
      context.lineTo(r * 0.55, -r * 0.55);
      context.closePath();
      context.fill();
      context.strokeStyle = '#e8a94e';
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = '#ff5a6e';
      context.beginPath();
      context.arc(-r * 0.28, -r * 0.8, r * 0.08, 0, Math.PI * 2);
      context.arc(0, -r * 0.9, r * 0.08, 0, Math.PI * 2);
      context.arc(r * 0.28, -r * 0.8, r * 0.08, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.type === 'queen') {
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
    if (enemy.type === 'boss') {
      drawGlow(ex - enemy.radius * 0.32, ey - enemy.radius * 0.18, 18, 0.8);
      drawGlow(ex + enemy.radius * 0.32, ey - enemy.radius * 0.18, 18, 0.8);
    }
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
      // Halo thinned in v4 (sharp rim does the work now, not a soft wash).
      if (enemy.type === 'boss') drawGlow(enemy.x, enemy.y, 200, 0.4);
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
      context.globalAlpha = (ring.life / ring.maxLife) * 0.85;
      context.strokeStyle = ring.color;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      context.stroke();
      // A second, tighter ring: the shockwave reads as a hard edge, not a halo.
      context.globalAlpha = (ring.life / ring.maxLife) * 0.5;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(ring.x, ring.y, ring.radius * 0.72, 0, Math.PI * 2);
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
    // Sharp sparks and shards (v4, Fxzy: "pertajam efek, jangan terlalu soft
    // dan kartun"): fast particles draw as hard streaks along their velocity,
    // slow ones as small diamonds — never soft blobs.
    for (const p of fx.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.strokeStyle = p.color;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 60) {
        context.lineWidth = Math.max(2, p.size * 0.8);
        context.lineCap = 'butt';
        context.beginPath();
        context.moveTo(p.x, p.y);
        context.lineTo(p.x - (p.vx / speed) * p.size * 2.4, p.y - (p.vy / speed) * p.size * 2.4);
        context.stroke();
      } else {
        const s = p.size * 1.1;
        context.beginPath();
        context.moveTo(p.x, p.y - s);
        context.lineTo(p.x + s, p.y);
        context.lineTo(p.x, p.y + s);
        context.lineTo(p.x - s, p.y);
        context.closePath();
        context.fill();
      }
    }
    context.globalAlpha = 1;
    // Damage numbers: bold, high-contrast, with a hard dark outline so they
    // read at thumbnail size against any background.
    for (const t of fx.texts) {
      if (!t.active) continue;
      context.globalAlpha = Math.min(1, (t.life / t.maxLife) * 1.5);
      context.font = `700 ${t.size}px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'alphabetic';
      context.lineWidth = Math.max(3, Math.round(t.size / 5));
      context.strokeStyle = 'rgba(20, 10, 30, 0.95)';
      context.lineJoin = 'round';
      context.strokeText(t.text, t.x, t.y);
      context.fillStyle = t.color;
      context.fillText(t.text, t.x, t.y);
    }
    context.globalAlpha = 1;
    // Golden beams: a hard solid core stripe inside the soft column, so the
    // beam has a defined edge instead of fading into haze.
    for (const b of fx.beams) {
      if (!b.active) continue;
      const a = (b.life / b.maxLife) * 0.8;
      const grad = context.createLinearGradient(b.x, b.top, b.x, b.bottom);
      grad.addColorStop(0, 'rgba(255, 209, 102, 0)');
      grad.addColorStop(0.5, `rgba(255, 209, 102, ${a})`);
      grad.addColorStop(1, `rgba(255, 209, 102, ${a * 0.9})`);
      context.fillStyle = grad;
      context.fillRect(b.x - b.width / 2, b.top, b.width, b.bottom - b.top);
      context.fillStyle = `rgba(255, 246, 216, ${a * 0.9})`;
      context.fillRect(b.x - b.width / 6, b.top, b.width / 3, b.bottom - b.top);
      drawGlow(b.x, b.bottom, b.width * 1.6, a * 0.7);
    }
  }

  /** Night bloom (v4): lantern light drawn additively ('lighter') so the glow
   * pools POP against the deep-night garden. Sharpened per Fxzy ("jangan
   * terlalu soft"): the wash is thinner, and every light has a hard bright
   * core + a defined rim instead of a diffuse pastel haze. */
  function drawBloom(world) {
    const festival = world.state.festival;
    context.save();
    context.globalCompositeOperation = 'lighter';
    const spots = [];
    for (let i = 0; i < LANTERN_POSTS.length; i += 1) {
      spots.push({ x: LANTERN_POSTS[i].x, y: LANTERN_POSTS[i].y - 18, r: 150, a: 0.20 });
    }
    spots.push({ x: LANTERN.x, y: LANTERN.y - 6, r: 240, a: 0.30 });
    for (const enemy of world.enemies.list) {
      if (enemy.active && enemy.type === 'boss') spots.push({ x: enemy.x, y: enemy.y, r: 200, a: 0.14 });
    }
    for (const spot of spots) {
      // Stamped sprite (perf, v4) — same gold pool as the old gradient fill.
      context.globalAlpha = spot.a * (1 + festival * 0.6);
      context.drawImage(glowSprite, spot.x - spot.r, spot.y - spot.r, spot.r * 2, spot.r * 2);
      context.globalAlpha = 1;
      // Hard core: a small solid bright disc at the light's heart.
      context.fillStyle = `rgba(255, 243, 201, ${Math.min(0.9, spot.a * 2.4)})`;
      context.beginPath();
      context.arc(spot.x, spot.y, 14, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawVignette(world) {
    const light = Math.max(world.lightLevel(), world.state.festival * 0.9);
    // Night always carries a little vignette; losing lives deepens it.
    context.save();
    context.globalAlpha = 0.22 + (1 - light) * 0.3;
    context.drawImage(vignetteSprite, 0, 0);
    context.restore();
  }

  /** Bake the static garden once per decor: sky, field, decor, path, plot
   * beds. The draw functions read the shared `context` binding, so the bake
   * swaps it to the offscreen canvas and swaps it back. */
  function bakeStatic(world) {
    const layer = document.createElement('canvas');
    layer.width = FIELD.width;
    layer.height = FIELD.height;
    const prev = context;
    context = layer.getContext('2d');
    drawSkyStatic(world);
    drawGarden(world);
    drawPlotsStatic(world);
    context = prev;
    return layer;
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
    context.arc(156, 30, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#8a6a1a';
    text('C', 156, 34, 12, '#8a6a1a', 'center', true);
    text(coinsLabel(`${state.coins}`), 172, 37, 22, PALETTE.gold, 'left', true);
    text('♥', 252, 37, 20, PALETTE.heart, 'left');
    text(livesLabel(`${state.lives}/${state.maxLives}`), 278, 37, 22, PALETTE.text, 'left', true);
    text(scoreLabel(`${state.score}`), 372, 37, 22, PALETTE.text, 'left', true);
    text(lightLabel(`${Math.round(world.lightLevel() * 100)}%`), 520, 37, 18, '#ffb347', 'left', true);
    text(`Best ${best}`, 700, 37, 18, PALETTE.muted, 'left');
    // Ability chips (v4): icon + hotkey + READY / cooldown seconds. A surge or
    // purr that is running shows ON in gold instead of its cooldown.
    for (const chip of abilityRects()) {
      const def = ABILITIES[chip.key];
      const slot = state.abilities[chip.key];
      const active = (chip.key === 'surge' && state.surgeTimer > 0) || (chip.key === 'purr' && state.purrTimer > 0);
      const ready = slot.cd <= 0;
      context.fillStyle = ready ? 'rgba(255, 209, 102, 0.28)' : 'rgba(255, 246, 232, 0.08)';
      roundRect(chip.rect.x, chip.rect.y, chip.rect.width, chip.rect.height, 8);
      context.fill();
      context.strokeStyle = active ? '#ffd166' : ready ? 'rgba(255, 209, 102, 0.6)' : 'rgba(255, 246, 232, 0.2)';
      context.lineWidth = active ? 2.5 : 1.5;
      context.stroke();
      text(def.icon, chip.rect.x + 12, chip.rect.y + 24, 16, ready ? '#ffd166' : PALETTE.muted, 'left', true);
      text(def.hotkey, chip.rect.x + 32, chip.rect.y + 16, 11, PALETTE.muted, 'left', true);
      const status = active ? 'ON' : ready ? 'READY' : `${Math.ceil(slot.cd)}s`;
      text(status, chip.rect.x + 32, chip.rect.y + 31, 11, active || ready ? '#ffd166' : PALETTE.muted, 'left', true);
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

  /** The Starfall Combo meter: five stars under the top bar, filling gold as
   * chained kills build toward the next starfall. Always visible during play
   * so the mechanic teaches itself; dim when the combo is cold. */
  function drawComboMeter(world) {
    const combo = world.towers.combo ?? 0;
    context.fillStyle = 'rgba(28, 24, 48, 0.88)';
    roundRect(16, 64, 178, 32, 10);
    context.fill();
    for (let i = 0; i < 5; i += 1) {
      const filled = i < combo;
      text('★', 30 + i * 22, 88, 18, filled ? '#ffd166' : 'rgba(255, 246, 232, 0.25)', 'left', true);
    }
    text('COMBO', 140, 87, 13, combo >= 3 ? '#ffd166' : PALETTE.muted, 'left', true);
    // Wave-clear bonus as short stacked text under the meter (Nemotron Stage 4).
    if (world.state.clearBonusTimer > 0) {
      context.globalAlpha = Math.min(1, world.state.clearBonusTimer);
      text(world.state.clearBonus, 16, 112, 12, '#ffd166', 'left', true);
      context.globalAlpha = 1;
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

  /** One merged boss strip (v4, Nemotron Stage 4): boss health runs the strip,
   * "SHADOW MOTH" sits left, the phase name is a right-aligned pill at the
   * strip's right edge — no separate phase-banner row. The phase-change
   * announcement text still shows briefly as the message pill (it carries
   * the phase-3 targeting warning), then the strip alone remains. */
  function drawBossBar(world) {
    const boss = bossActive(world);
    if (boss === null) return;
    context.fillStyle = 'rgba(28, 24, 48, 0.88)';
    roundRect(430, 56, 420, 34, 10);
    context.fill();
    context.strokeStyle = '#6b5a8e';
    context.lineWidth = 2;
    context.stroke();
    text(boss.type === 'boss' ? 'SHADOW MOTH' : 'MOTH QUEEN', 445, 72, 13, '#ffd166', 'left', true);
    if (boss.type === 'boss') {
      context.fillStyle = 'rgba(255, 209, 102, 0.25)';
      roundRect(786, 61, 56, 20, 8);
      context.fill();
      context.strokeStyle = 'rgba(255, 209, 102, 0.7)';
      context.lineWidth = 1.5;
      context.stroke();
      text(`Phase ${boss.phase}`, 814, 76, 11, '#ffd166', 'center', true);
    }
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
      // Targeting mode (v4): click the name row (or press T) to cycle it.
      text(`DMG ${Math.round(stats.damage)}  RNG ${Math.round(stats.range)}  🎯 ${TARGET_LABELS[selected.targetMode ?? 'first']}`, panel.x + 42, panel.y + 42, 10, PALETTE.muted, 'left');
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
      // Next-wave panel (v4): the incoming list + WIN/LOSE, always visible —
      // the top entries all state the goal and the next wave in the HUD.
      const next = state.phase === PHASE_BUILD ? state.wave : state.wave + 1;
      const nextLabel = state.endless ? `Night ${next - 10}` : next > 10 ? 'Long Night' : `Wave ${next}`;
      let preview = next > 10 && !state.endless ? 'Win the garden first!' : wavePreview(next);
      if (preview.length > 32) preview = `${preview.slice(0, 31)}…`;
      text(`NEXT  ${nextLabel}`, panel.x + 10, panel.y + 20, 11, '#ffd166', 'left', true);
      text(preview, panel.x + 10, panel.y + 38, 10, PALETTE.text, 'left');
      if (state.mutator !== 'none') {
        const mut = MUTATORS[state.mutator];
        text(`${mut.icon} ${mut.name}`, panel.x + 10, panel.y + 56, 10, PALETTE.muted, 'left');
      } else {
        text('WIN: hold 10 · LOSE: lantern falls', panel.x + 10, panel.y + 56, 9, PALETTE.muted, 'left');
      }
      text('Click a tower or a lantern post.', panel.x + 10, panel.y + 71, 9, PALETTE.muted, 'left');
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

  /** The "BOSS INCOMING" countdown pill, top-centre, where the boss bar will sit. */
  function drawBossWarning(world) {
    if (world.state.bossCountdown <= 0) return;
    const label = `⚠ BOSS INCOMING — the Shadow Moth arrives in ${Math.ceil(world.state.bossCountdown)}s!`;
    context.fillStyle = 'rgba(28, 24, 48, 0.92)';
    roundRect(430, 56, 420, 34, 10);
    context.fill();
    context.strokeStyle = '#ff6b81';
    context.lineWidth = 2;
    context.stroke();
    text(label, 640, 78, 15, '#ff8a9a', 'center', true);
  }

  function drawMessage(world) {
    const state = world.state;
    if (state.messageTimer <= 0 || state.message === '') return;
    // During the boss countdown the warning pill carries the message instead.
    if (state.bossCountdown > 0) return;
    // A dark pill behind the banner (v4 fix): the v3 banner was white text on
    // pale green, overlapping the boss bar and cut off at the edges.
    const y = bossActive(world) !== null ? 112 : 96;
    context.font = `700 20px ${FONT}`;
    const w = Math.min(FIELD.width - 32, context.measureText(state.message).width + 36);
    context.globalAlpha = Math.min(1, state.messageTimer);
    context.fillStyle = 'rgba(16, 14, 32, 0.88)';
    roundRect(FIELD.width / 2 - w / 2, y - 26, w, 34, 10);
    context.fill();
    context.strokeStyle = '#ffd166';
    context.lineWidth = 1.5;
    context.stroke();
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
    const festival = world.state.festival;
    if (staticDecor !== world.decor) {
      staticLayer = bakeStatic(world);
      staticDecor = world.decor;
    }
    context.drawImage(staticLayer, 0, 0);
    drawStars(world);
    drawFireflies(world);
    drawFestivalSparkles(world);
    LANTERN_POSTS.forEach((post, i) => drawLanternPost(post, world.state.postLevels[i], light, world.state.elapsed, festival));
    drawBigLantern(world, light, world.state.elapsed, festival);
    drawBloom(world);
    drawPlots(world);
    drawTowers(world);
    drawEnemies(world);
    drawProjectiles(world);
    drawEffects(world);
    // Festival wash + flash: gold over the field only; HUD stays readable.
    if (festival > 0) {
      context.save();
      context.globalAlpha = festival;
      context.drawImage(washSprite, 0, 0);
      context.restore();
    }
    if (world.fx.flash > 0) {
      context.fillStyle = `rgba(255, 210, 110, ${world.fx.flash * 0.20})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    drawVignette(world);
    if (screen !== SCREEN_TITLE) {
      drawTopBar(world, screen, best, speed ?? 1);
      drawBossBar(world);
      drawBossWarning(world);
      drawComboMeter(world);
      drawShopBar(world);
      drawMessage(world);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, text, context, toField, drawCat };
}
