import { ABILITIES, FIELD, FONT, LAYOUT, MAX_POST_LEVEL, MUTATORS, PALETTE as PAL, POST_LEVELS, POST_UPGRADE_COST, TARGET_LABELS } from './config.js';
import { LANTERN, LANTERN_POSTS, PATH_POINTS, PATH_WIDTH, POND, postGlowRadius } from './garden.js';
import { PHASE_BUILD, PHASE_WAVE } from './world.js'; import { TOWER_TYPES, towerStats } from './towers.js';
import { abilityRects, postUpgradeRect, selectedPanelRect, selectedSellRect, selectedUpgradeRect, shopCards, startWaveRect, topButtons } from './ui.js';
import { ENEMY_TYPES } from './enemies.js'; import { wavePreview, groupsForWave } from './waves.js';
import { relicByKey } from './relics.js'; export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play'; export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win'; export const SCREEN_OVER = 'over';
function cachedLabel(prefix) {
  let value = null; let text = '';
  return function label(next) {
    if (next !== value) {
      value = next; text = prefix + next;
    }
    return text;
  };
}
export function createRenderer(canvas) {
  let ctx = canvas.getContext('2d'); const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map(); const coinsLabel = cachedLabel('');
  const livesLabel = cachedLabel(''); const scoreLabel = cachedLabel('Score ');
  const lightLabel = cachedLabel('Lantern Light ');
  const glowSprite = (() => {
    const s = document.createElement('canvas'); s.width = 256;
    s.height = 256; const g = s.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 190, 90, 1)'); grad.addColorStop(0.5, 'rgba(255, 170, 70, 0.45)');
    grad.addColorStop(1, 'rgba(255, 170, 70, 0)'); g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256); return s;
  })();
  const skyGrad = (() => {
    const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height); grad.addColorStop(0, PAL.skyTop);
    grad.addColorStop(0.55, PAL.skyBottom); grad.addColorStop(1, '#5a4066');
    return grad;
  })();
  const fieldGrad = (() => {
    const grad = ctx.createLinearGradient(0, LAYOUT.play.y, 0, FIELD.height); grad.addColorStop(0, PAL.grass);
    grad.addColorStop(1, PAL.grassDark); return grad;
  })();
  function bakeOverlay(stops) {
    const s = document.createElement('canvas'); s.width = FIELD.width;
    s.height = FIELD.height; const g = s.getContext('2d');
    const grad = g.createRadialGradient(640, 360, 240, 640, 360, 720);
    for (const [at, color] of stops) grad.addColorStop(at, color); g.fillStyle = grad;
    g.fillRect(0, 0, FIELD.width, FIELD.height); return s;
  }
  const vignetteSprite = bakeOverlay([[0, 'rgba(20, 10, 30, 0)'], [1, 'rgba(20, 10, 30, 1)']]);
  const washSprite = (() => {
    const s = document.createElement('canvas'); s.width = FIELD.width;
    s.height = FIELD.height; const g = s.getContext('2d');
    const grad = g.createRadialGradient(LANTERN.x, LANTERN.y, 60, LANTERN.x, LANTERN.y, 780);
    grad.addColorStop(0, 'rgba(255, 200, 100, 0.12)'); grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
    g.fillStyle = grad; g.fillRect(0, 0, FIELD.width, FIELD.height);
    return s;
  })(); const volumeGrads = new Map();
  let staticLayer = null; let staticDecor = null;
  function resize() {
    const ratio = window.devicePixelRatio || 1; const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width; canvas.height = height;
    }
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2; view.y = (height - FIELD.height * view.scale) / 2;
  }
  function text(value, x, y, size, color, align, bold) {
    const key = `${size}:${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`); ctx.font = fonts.get(key);
    ctx.fillStyle = color; ctx.textAlign = align ?? 'left';
    ctx.textBaseline = 'alphabetic'; ctx.fillText(value, x, y);
  }
  function toField(sx, sy, rectW, rectH) {
    const scale = Math.min(rectW / FIELD.width, rectH / FIELD.height);
    const ox = (rectW - FIELD.width * scale) / 2; const oy = (rectH - FIELD.height * scale) / 2;
    return { x: (sx - ox) / scale, y: (sy - oy) / scale };
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawSkyStatic(wd) {
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PAL.moon; ctx.beginPath();
    ctx.arc(1215, 72, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 233, 176, 0.25)'; ctx.beginPath();
    ctx.arc(1215, 72, 40, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c98a'; ctx.beginPath();
    ctx.arc(1205, 64, 6, 0, Math.PI * 2); ctx.arc(1225, 80, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawStars(wd) {
    const t = wd.state.elapsed;
    for (const star of wd.decor.stars) {
      if (star.y >= LAYOUT.play.y) continue; const twinkle = 0.5 + 0.5 * Math.sin(t * 1.5 + star.tw);
      ctx.globalAlpha = 0.35 + 0.5 * twinkle; ctx.fillStyle = PAL.star;
      ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawGarden(wd) {
    ctx.fillStyle = fieldGrad; ctx.fillRect(0, LAYOUT.play.y, FIELD.width, FIELD.height - LAYOUT.play.y);
    for (const tuft of wd.decor.tufts) {
      ctx.strokeStyle = PAL.grassLight; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tuft.x - 4 * tuft.s, tuft.y);
      ctx.lineTo(tuft.x - 5 * tuft.s, tuft.y - 8 * tuft.s); ctx.moveTo(tuft.x, tuft.y);
      ctx.lineTo(tuft.x, tuft.y - 10 * tuft.s); ctx.moveTo(tuft.x + 4 * tuft.s, tuft.y);
      ctx.lineTo(tuft.x + 5 * tuft.s, tuft.y - 8 * tuft.s); ctx.stroke();
    }
    for (const flower of wd.decor.flowers) {
      ctx.fillStyle = flower.color; ctx.beginPath();
      ctx.arc(flower.x, flower.y, flower.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff6d8'; ctx.beginPath();
      ctx.arc(flower.x, flower.y, flower.r * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#4a8a9a'; ctx.beginPath();
    ctx.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a9aa0'; ctx.lineWidth = 3;
    ctx.stroke(); ctx.fillStyle = 'rgba(255, 246, 232, 0.35)';
    ctx.beginPath(); ctx.ellipse(POND.x - 20, POND.y - 10, POND.rx * 0.55, POND.ry * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const pad of wd.decor.lilyPads) {
      ctx.fillStyle = '#4a8a5a'; ctx.beginPath();
      ctx.arc(pad.x, pad.y, pad.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6aa878'; ctx.beginPath();
      ctx.arc(pad.x - pad.r * 0.3, pad.y - pad.r * 0.3, pad.r * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    for (const bloom of wd.decor.moonflowers) {
      ctx.fillStyle = '#fff6e8';
      for (let p = 0; p < 5; p += 1) {
        const a = (p / 5) * Math.PI * 2; ctx.beginPath();
        ctx.arc(bloom.x + Math.cos(a) * bloom.r * 0.7, bloom.y + Math.sin(a) * bloom.r * 0.7, bloom.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd166'; ctx.beginPath();
      ctx.arc(bloom.x, bloom.y, bloom.r * 0.35, 0, Math.PI * 2); ctx.fill();
    }
    for (const stone of wd.decor.stones) {
      ctx.fillStyle = '#8a8a92'; ctx.beginPath();
      ctx.ellipse(stone.x, stone.y, stone.r, stone.r * 0.7, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    for (const bush of wd.decor.bushes) {
      ctx.fillStyle = '#1d3d2e'; ctx.beginPath();
      ctx.arc(bush.x, bush.y, bush.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f5d43'; ctx.beginPath();
      ctx.arc(bush.x - bush.r * 0.25, bush.y - bush.r * 0.25, bush.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    for (const shrine of wd.decor.shrines) {
      ctx.fillStyle = '#6a6a72'; ctx.fillRect(shrine.x - 12, shrine.y - 6, 24, 12);
      ctx.fillStyle = '#8a8a92'; ctx.fillRect(shrine.x - 9, shrine.y - 26, 18, 20);
      drawGlow(shrine.x, shrine.y - 16, 34, 0.5); ctx.fillStyle = '#ffd166';
      ctx.fillRect(shrine.x - 4, shrine.y - 22, 8, 12); ctx.fillStyle = '#5a5a62';
      ctx.beginPath(); ctx.moveTo(shrine.x - 12, shrine.y - 26);
      ctx.lineTo(shrine.x, shrine.y - 36); ctx.lineTo(shrine.x + 12, shrine.y - 26);
      ctx.closePath(); ctx.fill();
    }
    for (const statue of wd.decor.statues) {
      ctx.fillStyle = '#7a7a82'; ctx.beginPath();
      ctx.arc(statue.x, statue.y, statue.r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(statue.x - 12, statue.y - 14);
      ctx.lineTo(statue.x - 16, statue.y - 30); ctx.lineTo(statue.x - 4, statue.y - 20);
      ctx.closePath(); ctx.moveTo(statue.x + 12, statue.y - 14);
      ctx.lineTo(statue.x + 16, statue.y - 30); ctx.lineTo(statue.x + 4, statue.y - 20);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#7a7a82'; ctx.lineWidth = 5;
      ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(statue.x - statue.r * 0.8, statue.y + 8);
      ctx.quadraticCurveTo(statue.x - statue.r * 1.4, statue.y, statue.x - statue.r * 1.1, statue.y - 12);
      ctx.stroke(); ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(statue.x - 7, statue.y - 6, 2.5, 0, Math.PI * 2);
      ctx.arc(statue.x + 7, statue.y - 6, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.lineJoin = 'round';
    ctx.lineCap = 'round'; ctx.strokeStyle = PAL.pathEdge;
    ctx.lineWidth = PATH_WIDTH + 8; ctx.beginPath();
    ctx.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
    for (let i = 1; i < PATH_POINTS.length; i += 1) ctx.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
    ctx.stroke(); ctx.strokeStyle = PAL.path;
    ctx.lineWidth = PATH_WIDTH; ctx.stroke();
    for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
      const a = PATH_POINTS[i]; const b = PATH_POINTS[i + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y); const nx = -(b.y - a.y) / segLen;
      const ny = (b.x - a.x) / segLen; let side = i % 2 === 0 ? 1 : -1;
      for (let d = 34; d < segLen - 20; d += 64) {
        const cx = a.x + ((b.x - a.x) * d) / segLen + nx * side * (PATH_WIDTH / 2 + 5);
        const cy = a.y + ((b.y - a.y) * d) / segLen + ny * side * (PATH_WIDTH / 2 + 5); side = -side;
        if (cx < 24 || cx > 1256 || cy < 66 || cy > 606) continue;
        if (Math.hypot(cx - LANTERN.x, cy - LANTERN.y) < 70) continue; let blocked = false;
        for (const post of LANTERN_POSTS) {
          if (Math.hypot(cx - post.x, cy - post.y) < 30) { blocked = true; break; }
        }
        if (blocked) continue;
        for (const plot of wd.plots) {
          if (Math.hypot(cx - plot.x, cy - plot.y) < plot.radius + 8) { blocked = true; break; }
        }
        if (blocked) continue; ctx.fillStyle = '#b8b0a0';
        ctx.beginPath(); ctx.ellipse(cx, cy, 7, 5, 0.4, 0, Math.PI * 2);
        ctx.fill(); ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath(); ctx.ellipse(cx - 2, cy - 2, 3, 2, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(255, 246, 220, 0.45)'; ctx.lineWidth = 2;
    ctx.setLineDash([14, 18]); ctx.beginPath();
    ctx.moveTo(PATH_POINTS[0].x, PATH_POINTS[0].y);
    for (let i = 1; i < PATH_POINTS.length; i += 1) ctx.lineTo(PATH_POINTS[i].x, PATH_POINTS[i].y);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#6b4a2f'; ctx.fillRect(0, 132, 10, 56);
    ctx.fillRect(0, 132, 26, 8); ctx.fillRect(0, 180, 26, 8);
  }
  function drawFireflies(wd) {
    const t = wd.state.elapsed;
    for (const fly of wd.decor.fireflies) {
      const fx = fly.x + Math.sin(t * fly.speed + fly.phase) * fly.amp;
      const fy = fly.y + Math.cos(t * fly.speed * 0.8 + fly.phase) * fly.amp;
      const glow = 0.4 + 0.35 * Math.sin(t * 2 + fly.phase); ctx.globalAlpha = 0.5 + 0.5 * glow;
      drawStar4(fx, fy, 5, '#ffe9b0'); ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawFestivalSparkles(wd) {
    if (wd.state.festival > 0.3) {
      ctx.globalAlpha = wd.state.festival * 0.9;
      for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
        const mx = (PATH_POINTS[i].x + PATH_POINTS[i + 1].x) / 2;
        const my = (PATH_POINTS[i].y + PATH_POINTS[i + 1].y) / 2; drawStar4(mx, my, 9, '#ffd166');
      }
      ctx.globalAlpha = 1;
    }
  }
  function drawGlow(x, y, radius, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.drawImage(glowSprite, x - radius, y - radius, radius * 2, radius * 2); ctx.restore();
  }
  function drawLanternPost(post, level, light, t, festival) {
    const zone = postGlowRadius(level); ctx.fillStyle = 'rgba(255, 190, 90, 0.10)';
    ctx.beginPath(); ctx.arc(post.x, post.y, zone, 0, Math.PI * 2);
    ctx.fill(); ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.lineWidth = 1.5; ctx.setLineDash([8, 6]);
    ctx.stroke(); ctx.setLineDash([]);
    const flicker = 0.85 + 0.15 * Math.sin(t * 2.3 + post.x);
    drawGlow(post.x, post.y - 18, 110 * (1 + festival * 0.6), 0.55 * light * flicker * (1 + festival * 0.6));
    ctx.fillStyle = 'rgba(255, 243, 201, 0.95)'; ctx.beginPath();
    ctx.arc(post.x, post.y - 18, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(post.x, post.y - 18, 12, 0, Math.PI * 2);
    ctx.stroke(); ctx.strokeStyle = '#4a3423';
    ctx.lineWidth = 5; ctx.beginPath();
    ctx.moveTo(post.x, post.y + 14); ctx.lineTo(post.x, post.y - 18);
    ctx.stroke(); ctx.fillStyle = '#ffb347';
    roundRect(post.x - 11, post.y - 30, 22, 24, 8); ctx.fill();
    ctx.strokeStyle = '#d98a2b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(post.x - 11, post.y - 22);
    ctx.lineTo(post.x + 11, post.y - 22); ctx.moveTo(post.x - 11, post.y - 14);
    ctx.lineTo(post.x + 11, post.y - 14); ctx.stroke();
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(post.x - 13, post.y - 34, 26, 5);
    for (let s = 0; s < level; s += 1) {
      ctx.fillStyle = '#ffd166'; ctx.beginPath();
      ctx.arc(post.x - 8 + s * 8, post.y + 20, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawBigLantern(wd, light, t, festival) {
    const flicker = 0.9 + 0.1 * Math.sin(t * 1.8);
    drawGlow(LANTERN.x, LANTERN.y, 190 * (1 + festival * 0.6), 0.6 * light * flicker * (1 + festival * 0.5));
    ctx.fillStyle = 'rgba(255, 243, 201, 0.95)'; ctx.beginPath();
    ctx.arc(LANTERN.x, LANTERN.y - 6, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a6a58'; roundRect(LANTERN.x - 30, LANTERN.y + 18, 60, 16, 6);
    ctx.fill(); const body = light > 0.25 ? '#ffcf7a' : '#8a7a6a';
    ctx.fillStyle = body; ctx.beginPath();
    ctx.ellipse(LANTERN.x, LANTERN.y - 6, 32, 38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = light > 0.25 ? '#e8a94e' : '#6a5a4a'; ctx.lineWidth = 2;
    for (const dy of [-22, -8, 6, 20]) {
      ctx.beginPath(); ctx.ellipse(LANTERN.x, LANTERN.y - 6 + dy, 30 - Math.abs(dy) * 0.35, 4, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(LANTERN.x - 10, LANTERN.y - 48, 20, 6);
    const hearts = Math.ceil(wd.state.lives);
    text(`♥ ${hearts}`, LANTERN.x, LANTERN.y + 52, 18, PAL.heart, 'center', true);
  }
  function drawPlotsStatic(wd) {
    for (let i = 0; i < wd.plots.length; i += 1) {
      const plot = wd.plots[i];
      const soil = ctx.createRadialGradient(plot.x - 6, plot.y - 8, 4, plot.x, plot.y, plot.radius);
      soil.addColorStop(0, '#5a4030'); soil.addColorStop(0.7, '#4a3626');
      soil.addColorStop(1, '#2e2115'); ctx.fillStyle = soil;
      ctx.beginPath(); ctx.arc(plot.x, plot.y, plot.radius, 0, Math.PI * 2);
      ctx.fill(); ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      for (const [dx, dy] of [[-9, -6], [8, 5], [0, 11], [10, -8]]) {
        ctx.beginPath(); ctx.arc(plot.x + dx, plot.y + dy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = PAL.plotEdge; ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  function drawPlots(wd) {
    for (let i = 0; i < wd.plots.length; i += 1) {
      const plot = wd.plots[i]; let lit = false;
      for (let p = 0; p < LANTERN_POSTS.length; p += 1) {
        const post = LANTERN_POSTS[p];
        if (Math.hypot(plot.x - post.x, plot.y - post.y) <= postGlowRadius(wd.state.postLevels[p])) {
          lit = true; break;
        }
      }
      if (lit) {
        ctx.fillStyle = 'rgba(255, 190, 90, 0.10)'; ctx.beginPath();
        ctx.arc(plot.x, plot.y, plot.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.85)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(plot.x, plot.y, plot.radius - 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (plot.tower === null) {
        const hovered = wd.state.hoverPlot === i || (wd.state.placing !== null && wd.state.hoverPlot === i);
        ctx.strokeStyle = hovered ? '#ffd166' : 'rgba(255, 246, 232, 0.35)'; ctx.setLineDash([6, 6]);
        ctx.lineWidth = hovered ? 3 : 2; ctx.beginPath();
        ctx.arc(plot.x, plot.y, plot.radius - 5, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        if (wd.state.placing !== null) {
          text('+', plot.x, plot.y + 7, 22, 'rgba(255, 246, 232, 0.6)', 'center', true);
        }
      }
    }
  }
  function drawCat(x, y, r, def, level, squash, angle, sleeping) {
    const sq = squash > 0 ? 1 - 0.25 * (squash / 0.18) : 1; ctx.save();
    ctx.translate(x, y); ctx.scale(1 + (1 - sq) * 0.6, sq);
    function volume(cx, cy, rad) {
      const key = `${cy},${rad}`; let shade = volumeGrads.get(key);
      if (shade === undefined) {
        shade = ctx.createLinearGradient(cx, cy - rad, cx, cy + rad);
        shade.addColorStop(0, 'rgba(255,255,255,0.22)'); shade.addColorStop(0.45, 'rgba(255,255,255,0)');
        shade.addColorStop(1, 'rgba(20,10,30,0.28)'); volumeGrads.set(key, shade);
      }
      ctx.save(); ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = shade; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(8, 6, 20, 0.38)'; ctx.beginPath();
    ctx.ellipse(0, r * 0.88, r * 0.9, r * 0.26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = def.color; ctx.lineWidth = 6;
    ctx.lineCap = 'round'; const wag = Math.sin((y * 0.13 + x * 0.07) * 2) * 6;
    ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.4);
    ctx.quadraticCurveTo(-r * 1.5, r * 0.2 + wag, -r * 1.3, -r * 0.5 + wag); ctx.stroke();
    ctx.fillStyle = def.ear; ctx.beginPath();
    ctx.moveTo(-r * 0.62, -r * 0.55); ctx.lineTo(-r * 0.85, -r * 1.15);
    ctx.lineTo(-r * 0.2, -r * 0.85); ctx.closePath();
    ctx.moveTo(r * 0.62, -r * 0.55); ctx.lineTo(r * 0.85, -r * 1.15);
    ctx.lineTo(r * 0.2, -r * 0.85); ctx.closePath();
    ctx.fill(); ctx.fillStyle = 'rgba(232, 120, 130, 0.85)';
    ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.68);
    ctx.lineTo(-r * 0.72, -r * 1.02); ctx.lineTo(-r * 0.3, -r * 0.88);
    ctx.closePath(); ctx.moveTo(r * 0.55, -r * 0.68);
    ctx.lineTo(r * 0.72, -r * 1.02); ctx.lineTo(r * 0.3, -r * 0.88);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = def.color; ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    volume(0, 0, r); ctx.strokeStyle = 'rgba(60, 30, 20, 0.35)';
    ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r - 1, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke(); ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(0, -r * 0.28, r * 0.66, 0, Math.PI * 2);
    ctx.fill(); volume(0, -r * 0.28, r * 0.66);
    ctx.strokeStyle = 'rgba(60, 30, 20, 0.35)'; ctx.lineWidth = 2;
    ctx.stroke(); ctx.strokeStyle = 'rgba(255, 240, 200, 0.7)';
    ctx.beginPath(); ctx.arc(0, -r * 0.28, r * 0.66 - 1, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke(); ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath(); ctx.ellipse(-r * 0.24, -r * 0.54, r * 0.16, r * 0.1, -0.5, 0, Math.PI * 2);
    ctx.fill(); ctx.fillStyle = def.belly;
    ctx.beginPath(); ctx.ellipse(0, r * 0.5, r * 0.52, r * 0.36, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath(); ctx.ellipse(-r * 0.18, r * 0.38, r * 0.18, r * 0.1, -0.4, 0, Math.PI * 2);
    ctx.fill(); ctx.fillStyle = def.belly;
    ctx.strokeStyle = 'rgba(60, 30, 20, 0.3)'; ctx.lineWidth = 1.5;
    for (const px of [-r * 0.42, r * 0.42]) {
      ctx.beginPath(); ctx.ellipse(px, r * 0.84, r * 0.22, r * 0.13, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    if (sleeping) {
      ctx.strokeStyle = '#4a3423'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.33, r * 0.12, Math.PI * 1.15, Math.PI * 1.85);
      ctx.arc(r * 0.3, -r * 0.33, r * 0.12, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else {
      ctx.fillStyle = '#2c1f3d'; ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.33, r * 0.09, 0, Math.PI * 2);
      ctx.arc(r * 0.3, -r * 0.33, r * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath();
      ctx.arc(-r * 0.26, -r * 0.37, r * 0.035, 0, Math.PI * 2);
      ctx.arc(r * 0.34, -r * 0.37, r * 0.035, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#e86a7a'; ctx.beginPath();
    ctx.moveTo(-r * 0.09, -r * 0.16); ctx.lineTo(r * 0.09, -r * 0.16);
    ctx.lineTo(0, -r * 0.04); ctx.closePath();
    ctx.fill(); ctx.strokeStyle = 'rgba(74, 52, 35, 0.6)';
    ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(-r * 0.48, -r * 0.18); ctx.lineTo(-r * 0.95, -r * 0.28);
    ctx.moveTo(-r * 0.48, -r * 0.06); ctx.lineTo(-r * 0.95, r * 0.04);
    ctx.moveTo(r * 0.48, -r * 0.18); ctx.lineTo(r * 0.95, -r * 0.28);
    ctx.moveTo(r * 0.48, -r * 0.06); ctx.lineTo(r * 0.95, r * 0.04);
    ctx.stroke();
    if (level >= 2 && def.hat !== 'none') {
      if (def.hat === 'bow') {
        ctx.fillStyle = '#e86a7a'; ctx.beginPath();
        ctx.moveTo(0, -r * 0.85); ctx.lineTo(-r * 0.5, -r * 1.1);
        ctx.lineTo(-r * 0.5, -r * 0.6); ctx.closePath();
        ctx.moveTo(0, -r * 0.85); ctx.lineTo(r * 0.5, -r * 1.1);
        ctx.lineTo(r * 0.5, -r * 0.6); ctx.closePath();
        ctx.fill(); ctx.beginPath();
        ctx.arc(0, -r * 0.85, r * 0.14, 0, Math.PI * 2); ctx.fill();
      } else if (def.hat === 'cap') {
        ctx.fillStyle = '#3a6a9a'; ctx.beginPath();
        ctx.ellipse(0, -r * 0.85, r * 0.62, r * 0.22, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(-r * 0.62, -r * 0.92, r * 1.24, r * 0.14); ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(0, -r * 0.92, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (def.hat === 'nightcap') {
        ctx.fillStyle = '#7a5aa8'; ctx.beginPath();
        ctx.moveTo(-r * 0.55, -r * 0.75); ctx.quadraticCurveTo(-r * 0.2, -r * 1.5, r * 0.5, -r * 1.25);
        ctx.quadraticCurveTo(r * 0.15, -r * 0.95, r * 0.55, -r * 0.75); ctx.closePath();
        ctx.fill(); ctx.fillStyle = '#e6ddf5';
        ctx.beginPath(); ctx.arc(r * 0.55, -r * 1.28, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
      } else if (def.hat === 'wizard') {
        ctx.fillStyle = '#e8a94e'; ctx.beginPath();
        ctx.moveTo(-r * 0.55, -r * 0.75); ctx.lineTo(r * 0.55, -r * 0.75);
        ctx.lineTo(r * 0.1, -r * 1.5); ctx.closePath();
        ctx.fill(); ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(-r * 0.15, -r * 1.05, r * 0.09, 0, Math.PI * 2);
        ctx.arc(r * 0.2, -r * 0.9, r * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(-r * 0.55, -r * 0.82, r * 1.1, r * 0.12);
      } else if (def.hat === 'earmuffs') {
        ctx.strokeStyle = '#5a8ab0'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.85, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke(); ctx.fillStyle = '#8ec9e0';
        ctx.beginPath(); ctx.arc(-r * 0.8, -r * 0.25, r * 0.22, 0, Math.PI * 2);
        ctx.arc(r * 0.8, -r * 0.25, r * 0.22, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (level >= 3) {
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(0, r * 0.35, r * 0.62, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawStar4(x, y, r, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
  }
  function drawTowers(wd) {
    const selected = wd.state.selected;
    for (const tower of wd.towers.towers) {
      if (!tower.active) continue; const def = TOWER_TYPES[tower.type];
      const stats = towerStats(tower.type, tower.level); const range = stats.range * (1 + tower.glowBonus);
      if (selected === tower || (wd.state.placing !== null && wd.state.hoverTower === tower)) {
        ctx.fillStyle = 'rgba(255, 209, 102, 0.12)'; ctx.beginPath();
        ctx.arc(tower.x, tower.y, range, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.7)'; ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (tower.glow) {
        ctx.fillStyle = 'rgba(255, 190, 90, 0.18)'; ctx.beginPath();
        ctx.arc(tower.x, tower.y, 26, 0, Math.PI * 2); ctx.fill();
        drawStar4(tower.x + 18, tower.y - 30, 6, '#ffd166');
      }
      const size = tower.type === 'mochi' ? 24 : 20; ctx.strokeStyle = def.color;
      ctx.globalAlpha = 0.9; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(tower.x, tower.y, 25, 0, Math.PI * 2);
      ctx.stroke(); ctx.globalAlpha = 1;
      drawCat(tower.x, tower.y, size * (1 + 0.12 * (tower.level - 1)), def, tower.level, tower.squash, 0, tower.type === 'sleepy');
      if (tower.type === 'yarn') {
        ctx.fillStyle = '#f2a7c3'; ctx.beginPath();
        ctx.arc(tower.x + 14, tower.y + 12, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#d97a9e'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(tower.x + 14, tower.y + 12, 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tower.type === 'fish') {
        ctx.fillStyle = '#9ecfff'; ctx.beginPath();
        ctx.ellipse(tower.x + 16, tower.y + 10, 9, 5, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(tower.x + 24, tower.y + 6);
        ctx.lineTo(tower.x + 30, tower.y + 10); ctx.lineTo(tower.x + 24, tower.y + 14);
        ctx.closePath(); ctx.fill();
      } else if (tower.type === 'star') {
        ctx.strokeStyle = '#e8a94e'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(tower.x + 12, tower.y + 14);
        ctx.lineTo(tower.x + 22, tower.y - 8); ctx.stroke();
        drawStar4(tower.x + 23, tower.y - 12, 7, '#ffd166');
      } else if (tower.type === 'frosty') {
        ctx.strokeStyle = '#8ec9e0'; ctx.lineWidth = 2;
        const cx = tower.x + 14; const cy = tower.y + 12;
        for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
          ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * 6, cy - Math.sin(a) * 6);
          ctx.lineTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); ctx.stroke();
        }
      } else if (tower.type === 'sleepy') {
        text('z', tower.x + 20, tower.y - 22, 13, PAL.muted, 'center', true);
        text('z', tower.x + 28, tower.y - 32, 10, PAL.muted, 'center', true);
      } else if (tower.type === 'mochi') {
        ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(tower.x + 10, tower.y + 16);
        ctx.lineTo(tower.x + 20, tower.y + 2); ctx.stroke();
        ctx.fillStyle = '#e8d8b0'; ctx.fillRect(tower.x + 14, tower.y - 10, 12, 12);
        ctx.strokeStyle = '#b89a6a'; ctx.lineWidth = 1;
        ctx.strokeRect(tower.x + 14, tower.y - 10, 12, 12); ctx.beginPath();
        ctx.moveTo(tower.x + 20, tower.y - 10); ctx.lineTo(tower.x + 20, tower.y + 2);
        ctx.moveTo(tower.x + 14, tower.y - 4); ctx.lineTo(tower.x + 26, tower.y - 4);
        ctx.stroke();
      }
      for (let s = 0; s < tower.level; s += 1) {
        ctx.fillStyle = '#ffd166'; ctx.beginPath();
        ctx.arc(tower.x - 12 + s * 12, tower.y + 30, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (wd.state.placing !== null && wd.state.hoverPlot >= 0) {
      const plot = wd.plots[wd.state.hoverPlot];
      if (plot.tower === null) {
        const def = TOWER_TYPES[wd.state.placing]; const stats = towerStats(wd.state.placing, 1);
        ctx.globalAlpha = 0.55; ctx.fillStyle = 'rgba(255, 209, 102, 0.15)';
        ctx.beginPath(); ctx.arc(plot.x, plot.y, stats.range, 0, Math.PI * 2);
        ctx.fill(); drawCat(plot.x, plot.y, 20, def, 1, 0, 0, false);
        ctx.globalAlpha = 1;
      }
    }
  }
  function drawBug(enemy, t) {
    const wobble = Math.sin(enemy.wobble) * 0.12; const bob = Math.sin(enemy.wobble * 1.7) * 2;
    ctx.save(); ctx.translate(enemy.x, enemy.y + bob);
    if (enemy.type === 'boss' || enemy.type === 'queen') {
      ctx.fillStyle = 'rgba(8, 6, 20, 0.4)'; ctx.beginPath();
      ctx.ellipse(0, enemy.radius * 0.95, enemy.radius * 1.05, enemy.radius * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (enemy.type === 'moth' || enemy.type === 'queen' || enemy.type === 'boss') {
      const flap = Math.sin(enemy.wobble * 2.4) * 0.5;
      const wingColor = enemy.type === 'boss' ? '#8a5fb0' : enemy.type === 'queen' ? '#f2a7c3' : '#d9c8f2';
      const wingR = enemy.type === 'boss' ? enemy.radius * 1.15 : enemy.radius * 0.95;
      const spread = enemy.type === 'boss' && enemy.phase === 3 ? 0.9 : 0.6; ctx.fillStyle = wingColor;
      ctx.save(); ctx.rotate(-spread - flap * 0.3);
      ctx.beginPath();
      ctx.ellipse(-enemy.radius * 0.9, -enemy.radius * 0.4, wingR, enemy.radius * 0.55, -0.5, 0, Math.PI * 2);
      ctx.fill(); ctx.restore();
      ctx.save(); ctx.rotate(spread + flap * 0.3);
      ctx.beginPath();
      ctx.ellipse(enemy.radius * 0.9, -enemy.radius * 0.4, wingR, enemy.radius * 0.55, 0.5, 0, Math.PI * 2);
      ctx.fill(); ctx.restore();
    }
    if (enemy.type === 'zip') {
      ctx.strokeStyle = 'rgba(245, 166, 91, 0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-enemy.radius * 1.6, -enemy.radius * 0.4);
      ctx.lineTo(-enemy.radius * 2.4, -enemy.radius * 0.4);
      ctx.moveTo(-enemy.radius * 1.6, enemy.radius * 0.3);
      ctx.lineTo(-enemy.radius * 2.3, enemy.radius * 0.3); ctx.stroke();
      ctx.scale(1.35, 0.85);
    }
    ctx.scale(1 + wobble, 1 - wobble);
    ctx.fillStyle = enemy.type === 'zip' ? '#f5a65b' : enemy.type === 'moth' ? '#d9c8f2' : enemy.type === 'queen' ? '#e8b8d8' : enemy.type === 'boss' ? PAL.boss : PAL.shadow;
    ctx.beginPath(); ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    if (enemy.type === 'boss' || enemy.type === 'queen') {
      let shade = volumeGrads.get(`boss,${enemy.radius}`);
      if (shade === undefined) {
        shade = ctx.createLinearGradient(0, -enemy.radius, 0, enemy.radius);
        shade.addColorStop(0, 'rgba(255, 220, 160, 0.22)'); shade.addColorStop(0.5, 'rgba(255, 220, 160, 0)');
        shade.addColorStop(1, 'rgba(10, 5, 25, 0.38)'); volumeGrads.set(`boss,${enemy.radius}`, shade);
      }
      ctx.save(); ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = shade; ctx.fillRect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
      ctx.restore();
    }
    ctx.strokeStyle = enemy.type === 'boss' ? '#ffd166' : 'rgba(20, 10, 30, 0.5)';
    ctx.lineWidth = enemy.type === 'boss' ? 7 : 2; ctx.stroke();
    if (enemy.type === 'moth') {
      ctx.fillStyle = 'rgba(120, 90, 160, 0.55)'; ctx.beginPath();
      ctx.arc(-enemy.radius * 0.9, -enemy.radius * 0.5, enemy.radius * 0.14, 0, Math.PI * 2);
      ctx.arc(enemy.radius * 0.9, -enemy.radius * 0.5, enemy.radius * 0.14, 0, Math.PI * 2); ctx.fill();
    }
    if (enemy.type === 'boss') {
      const pulse = 0.55 + 0.45 * Math.sin(t * 4); ctx.strokeStyle = `rgba(255, 213, 79, ${pulse})`;
      ctx.lineWidth = 2.5; ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 8, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (enemy.type === 'zip') {
      ctx.strokeStyle = '#b06a2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-enemy.radius * 0.4, -enemy.radius * 0.8);
      ctx.lineTo(-enemy.radius * 0.4, enemy.radius * 0.8);
      ctx.moveTo(enemy.radius * 0.3, -enemy.radius * 0.8); ctx.lineTo(enemy.radius * 0.3, enemy.radius * 0.8);
      ctx.stroke();
    }
    if (enemy.type === 'mite') {
      ctx.strokeStyle = '#2c1f3d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-enemy.radius * 0.7, -enemy.radius * 0.4);
      ctx.lineTo(-enemy.radius * 1.25, -enemy.radius * 0.7);
      ctx.moveTo(-enemy.radius * 0.7, enemy.radius * 0.4);
      ctx.lineTo(-enemy.radius * 1.25, enemy.radius * 0.7);
      ctx.moveTo(enemy.radius * 0.7, -enemy.radius * 0.4);
      ctx.lineTo(enemy.radius * 1.25, -enemy.radius * 0.7);
      ctx.moveTo(enemy.radius * 0.7, enemy.radius * 0.4); ctx.lineTo(enemy.radius * 1.25, enemy.radius * 0.7);
      ctx.stroke();
    }
    if (enemy.type === 'beetle') {
      ctx.fillStyle = '#5a3a6e'; ctx.beginPath();
      ctx.arc(0, -enemy.radius * 0.25, enemy.radius * 0.7, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'; ctx.beginPath();
      ctx.ellipse(-enemy.radius * 0.25, -enemy.radius * 0.55, enemy.radius * 0.3, enemy.radius * 0.16, -0.5, 0, Math.PI * 2);
      ctx.fill(); ctx.fillStyle = '#8a6ab0';
      for (const dx of [-8, 0, 8]) {
        ctx.beginPath(); ctx.moveTo(dx - 4, -enemy.radius * 0.5);
        ctx.lineTo(dx, -enemy.radius * 1.05); ctx.lineTo(dx + 4, -enemy.radius * 0.5);
        ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = '#8a6ab0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -enemy.radius);
      ctx.lineTo(0, -enemy.radius * 0.2); ctx.stroke();
    }
    if (enemy.type === 'boss') {
      const r = enemy.radius; ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.55);
      ctx.lineTo(-r * 0.55, -r * 1.05); ctx.lineTo(-r * 0.28, -r * 0.75);
      ctx.lineTo(0, -r * 1.15); ctx.lineTo(r * 0.28, -r * 0.75);
      ctx.lineTo(r * 0.55, -r * 1.05); ctx.lineTo(r * 0.55, -r * 0.55);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e8a94e'; ctx.lineWidth = 2;
      ctx.stroke(); ctx.fillStyle = '#ff5a6e';
      ctx.beginPath(); ctx.arc(-r * 0.28, -r * 0.8, r * 0.08, 0, Math.PI * 2);
      ctx.arc(0, -r * 0.9, r * 0.08, 0, Math.PI * 2); ctx.arc(r * 0.28, -r * 0.8, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.type === 'queen') {
      ctx.strokeStyle = '#c9a7f2'; ctx.lineWidth = 3;
      for (const dx of [-14, 0, 14]) {
        ctx.beginPath(); ctx.moveTo(dx, -enemy.radius + 4);
        ctx.lineTo(dx * 1.4, -enemy.radius - 16); ctx.stroke();
      }
      ctx.fillStyle = '#ffd166'; ctx.beginPath();
      ctx.arc(-20, -enemy.radius - 16, 3, 0, Math.PI * 2); ctx.arc(0, -enemy.radius - 18, 3, 0, Math.PI * 2);
      ctx.arc(20, -enemy.radius - 16, 3, 0, Math.PI * 2); ctx.fill();
    }
    const look = enemy.angle; const ex = Math.cos(look) * enemy.radius * 0.3;
    const ey = Math.sin(look) * enemy.radius * 0.3;
    if (enemy.type === 'boss') {
      drawGlow(ex - enemy.radius * 0.32, ey - enemy.radius * 0.18, 18, 0.8);
      drawGlow(ex + enemy.radius * 0.32, ey - enemy.radius * 0.18, 18, 0.8);
    }
    ctx.fillStyle = enemy.type === 'boss' && enemy.phase === 3 ? '#ff5a3c' : PAL.shadowEye; ctx.beginPath();
    ctx.arc(ex - enemy.radius * 0.32, ey - enemy.radius * 0.18, enemy.radius * 0.16, 0, Math.PI * 2);
    ctx.arc(ex + enemy.radius * 0.32, ey - enemy.radius * 0.18, enemy.radius * 0.16, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();
    if ((enemy.type === 'boss' || enemy.type === 'queen') && enemy.hp < enemy.maxHp) {
      text(`${enemy.hp} / ${enemy.maxHp}`, enemy.x, enemy.y - enemy.radius - 22, 13, '#ffd166', 'center', true);
    }
    if (enemy.hp < enemy.maxHp) {
      const w = enemy.radius * 2; const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = 'rgba(20, 10, 30, 0.6)';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w, 5);
      ctx.fillStyle = ratio > 0.5 ? '#7ddc8a' : ratio > 0.25 ? '#ffd166' : '#ff6b81';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w * ratio, 5);
    }
  }
  function drawEnemies(wd) {
    const t = wd.state.elapsed;
    for (const enemy of wd.enemies.list) {
      if (!enemy.active) continue; if (enemy.type === 'boss') drawGlow(enemy.x, enemy.y, 200, 0.4);
      if (enemy.flying) {
        ctx.fillStyle = 'rgba(20, 10, 30, 0.25)'; ctx.beginPath();
        ctx.ellipse(enemy.x, enemy.y + 20, enemy.radius * 0.8, enemy.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (enemy.slowUntil > t) {
        ctx.fillStyle = 'rgba(184, 167, 217, 0.25)'; ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 5, 0, Math.PI * 2); ctx.fill();
      }
      drawBug(enemy, t);
    }
  }
  function drawProjectiles(wd) {
    for (const proj of wd.towers.projectiles) {
      if (!proj.active) continue;
      if (proj.kind === 'fish') {
        ctx.fillStyle = '#9ecfff'; ctx.beginPath();
        ctx.ellipse(proj.x, proj.y, 9, 5, Math.atan2(proj.ly - proj.y, proj.lx - proj.x), 0, Math.PI * 2);
        ctx.fill();
      } else if (proj.kind === 'star') {
        drawStar4(proj.x, proj.y, 9, '#ffd166');
      } else if (proj.kind === 'frost') {
        ctx.fillStyle = '#bfe3f2'; ctx.beginPath();
        ctx.arc(proj.x, proj.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#eaf7ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(proj.x - 4, proj.y);
        ctx.lineTo(proj.x + 4, proj.y); ctx.moveTo(proj.x, proj.y - 4);
        ctx.lineTo(proj.x, proj.y + 4); ctx.stroke();
      } else {
        ctx.fillStyle = '#f2a7c3'; ctx.beginPath();
        ctx.arc(proj.x, proj.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#d97a9e'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  function drawEffects(wd) {
    const fx = wd.fx;
    for (const ring of fx.rings) {
      if (!ring.active) continue; ctx.globalAlpha = (ring.life / ring.maxLife) * 0.85;
      ctx.strokeStyle = ring.color; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke(); ctx.globalAlpha = (ring.life / ring.maxLife) * 0.5;
      ctx.lineWidth = 2; ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius * 0.72, 0, Math.PI * 2); ctx.stroke();
    }
    for (const arc of fx.arcs) {
      if (!arc.active) continue; const progress = 1 - arc.life / arc.maxLife;
      ctx.globalAlpha = 1 - progress; ctx.strokeStyle = '#fff6e8';
      ctx.lineWidth = 4; ctx.beginPath();
      ctx.arc(arc.x, arc.y, 26 + progress * 14, arc.angle - 0.7, arc.angle + 0.7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const p of fx.particles) {
      if (!p.active) continue; ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 60) {
        ctx.lineWidth = Math.max(2, p.size * 0.8); ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.vx / speed) * p.size * 2.4, p.y - (p.vy / speed) * p.size * 2.4); ctx.stroke();
      } else {
        const s = p.size * 1.1; ctx.beginPath();
        ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y);
        ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s, p.y);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const t of fx.texts) {
      if (!t.active) continue; ctx.globalAlpha = Math.min(1, (t.life / t.maxLife) * 1.5);
      ctx.font = `700 ${t.size}px ${FONT}`; ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic'; ctx.lineWidth = Math.max(3, Math.round(t.size / 5));
      ctx.strokeStyle = 'rgba(20, 10, 30, 0.95)'; ctx.lineJoin = 'round';
      ctx.strokeText(t.text, t.x, t.y); ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    for (const b of fx.beams) {
      if (!b.active) continue; const a = (b.life / b.maxLife) * 0.8;
      const grad = ctx.createLinearGradient(b.x, b.top, b.x, b.bottom);
      grad.addColorStop(0, 'rgba(255, 209, 102, 0)'); grad.addColorStop(0.5, `rgba(255, 209, 102, ${a})`);
      grad.addColorStop(1, `rgba(255, 209, 102, ${a * 0.9})`); ctx.fillStyle = grad;
      ctx.fillRect(b.x - b.width / 2, b.top, b.width, b.bottom - b.top);
      ctx.fillStyle = `rgba(255, 246, 216, ${a * 0.9})`;
      ctx.fillRect(b.x - b.width / 6, b.top, b.width / 3, b.bottom - b.top);
      drawGlow(b.x, b.bottom, b.width * 1.6, a * 0.7);
    }
  }
  function drawBloom(wd) {
    const festival = wd.state.festival; ctx.save();
    ctx.globalCompositeOperation = 'lighter'; const spots = [];
    for (let i = 0; i < LANTERN_POSTS.length; i += 1) {
      spots.push({ x: LANTERN_POSTS[i].x, y: LANTERN_POSTS[i].y - 18, r: 150, a: 0.26 });
    }
    spots.push({ x: LANTERN.x, y: LANTERN.y - 6, r: 240, a: 0.34 });
    for (const enemy of wd.enemies.list) {
      if (enemy.active && enemy.type === 'boss') spots.push({ x: enemy.x, y: enemy.y, r: 200, a: 0.14 });
    }
    for (const spot of spots) {
      ctx.globalAlpha = spot.a * (1 + festival * 0.6);
      ctx.drawImage(glowSprite, spot.x - spot.r, spot.y - spot.r, spot.r * 2, spot.r * 2);
      ctx.globalAlpha = 1; ctx.fillStyle = `rgba(255, 243, 201, ${Math.min(0.9, spot.a * 2.4)})`;
      ctx.beginPath(); ctx.arc(spot.x, spot.y, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawVignette(wd) {
    const light = Math.max(wd.lightLevel(), wd.state.festival * 0.9); ctx.save();
    ctx.globalAlpha = 0.22 + (1 - light) * 0.3; ctx.drawImage(vignetteSprite, 0, 0);
    ctx.restore();
  }
  function bakeStatic(wd) {
    const layer = document.createElement('canvas'); layer.width = FIELD.width;
    layer.height = FIELD.height; const prev = ctx;
    ctx = layer.getContext('2d'); drawSkyStatic(wd);
    drawGarden(wd); drawPlotsStatic(wd);
    ctx = prev; return layer;
  }
  function drawTopBar(wd, screen, best, speed) {
    const bar = LAYOUT.topBar; ctx.fillStyle = PAL.panel;
    ctx.fillRect(bar.x, bar.y, bar.width, bar.height); ctx.fillStyle = PAL.panelEdge;
    ctx.fillRect(bar.x, bar.y + bar.height - 2, bar.width, 2); const state = wd.state;
    text(wd.waveLabel(), 16, 37, 22, PAL.text, 'left', true); ctx.fillStyle = PAL.gold;
    ctx.beginPath(); ctx.arc(156, 30, 9, 0, Math.PI * 2);
    ctx.fill(); ctx.fillStyle = '#8a6a1a';
    text('C', 156, 34, 12, '#8a6a1a', 'center', true);
    text(coinsLabel(`${state.coins}`), 172, 37, 22, PAL.gold, 'left', true);
    text('♥', 252, 37, 20, PAL.heart, 'left');
    text(livesLabel(`${state.lives}/${state.maxLives}`), 278, 37, 22, PAL.text, 'left', true);
    text(scoreLabel(`${state.score}`), 372, 37, 22, PAL.text, 'left', true);
    text(lightLabel(`${Math.round(wd.lightLevel() * 100)}%`), 520, 37, 18, '#ffb347', 'left', true);
    text(`Best ${best}`, 700, 37, 18, PAL.muted, 'left');
    for (const chip of abilityRects()) {
      const def = ABILITIES[chip.key]; const slot = state.abilities[chip.key];
      const active = (chip.key === 'surge' && state.surgeTimer > 0) || (chip.key === 'purr' && state.purrTimer > 0);
      const ready = slot.cd <= 0;
      ctx.fillStyle = ready ? 'rgba(255, 209, 102, 0.28)' : 'rgba(255, 246, 232, 0.08)';
      roundRect(chip.rect.x, chip.rect.y, chip.rect.width, chip.rect.height, 8); ctx.fill();
      ctx.strokeStyle = active ? '#ffd166' : ready ? 'rgba(255, 209, 102, 0.6)' : 'rgba(255, 246, 232, 0.2)';
      ctx.lineWidth = active ? 2.5 : 1.5; ctx.stroke();
      text(def.icon, chip.rect.x + 12, chip.rect.y + 24, 16, ready ? '#ffd166' : PAL.muted, 'left', true);
      text(def.hotkey, chip.rect.x + 32, chip.rect.y + 16, 11, PAL.muted, 'left', true);
      const status = active ? 'ON' : ready ? 'READY' : `${Math.ceil(slot.cd)}s`;
      text(status, chip.rect.x + 32, chip.rect.y + 31, 11, active || ready ? '#ffd166' : PAL.muted, 'left', true);
    }
    const buttons = topButtons();
    for (const [name, rect] of Object.entries(buttons)) {
      ctx.fillStyle = 'rgba(255, 246, 232, 0.12)'; roundRect(rect.x, rect.y, rect.width, rect.height, 8);
      ctx.fill();
      const label = name === 'pause' ? (screen === SCREEN_PAUSED ? '▶' : 'II') : name === 'speed' ? `${speed}x` : '♪';
      text(label, rect.x + rect.width / 2, rect.y + 26, name === 'speed' ? 15 : 17, PAL.text, 'center', true);
    }
  }
  function drawComboMeter(wd) {
    const combo = wd.towers.combo ?? 0; const mult = wd.towers.comboMult ?? 1;
    ctx.fillStyle = 'rgba(28, 24, 48, 0.88)'; roundRect(16, 64, 232, 32, 10);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      const filled = i < combo;
      text('★', 30 + i * 22, 88, 18, filled ? '#ffd166' : 'rgba(255, 246, 232, 0.25)', 'left', true);
    }
    text(combo >= 2 ? `CHAIN x${mult.toFixed(1)}` : 'COMBO', 140, 87, 13, combo >= 3 ? '#ffd166' : PAL.muted, 'left', true);
    if (wd.state.clearBonusTimer > 0) {
      ctx.globalAlpha = Math.min(1, wd.state.clearBonusTimer);
      text(wd.state.clearBonus, 16, 282, 12, '#ffd166', 'left', true); ctx.globalAlpha = 1;
    }
  }
  function drawIncoming(wd) {
    const state = wd.state; const wave = state.wave;
    const groups = groupsForWave(wave);
    const roles = { mite: 'Swarm', zip: 'Fast', beetle: 'Armoured', moth: 'Flying', boss: 'BOSS', queen: 'BOSS' };
    const dots = { mite: '#c9b8e8', zip: '#f5a65b', beetle: '#8a6ab0', moth: '#d9c8f2', boss: '#ff6b81', queen: '#f2a7c3' };
    let alive = 0; for (const e of wd.enemies.list) if (e.active) alive += 1;
    const rows = groups.length; const h = 30 + rows * 17 + 34;
    ctx.fillStyle = 'rgba(28, 24, 48, 0.88)'; roundRect(16, 104, 244, h, 10);
    ctx.fill(); ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.lineWidth = 1.5; ctx.stroke();
    text(state.endless ? `INCOMING — Night ${wave - 10}` : `INCOMING — Wave ${wave}`, 28, 124, 13, '#ffd166', 'left', true);
    text(`${alive} on field`, 248, 124, 11, PAL.muted, 'right', true);
    for (let i = 0; i < rows; i += 1) {
      const [type, count] = groups[i]; const y = 143 + i * 17;
      ctx.fillStyle = dots[type]; ctx.beginPath();
      ctx.arc(28, y - 4, 5, 0, Math.PI * 2); ctx.fill();
      text(`x${count} ${ENEMY_TYPES[type].name}`, 40, y, 12, PAL.text, 'left', true);
      text(roles[type], 248, y, 11, '#ffb347', 'right', true);
    }
    const next = wave + 1;
    const nextLabel = state.endless ? `Night ${next - 10}` : next > 10 ? 'Long Night' : `Wave ${next}`;
    text(`NEXT: ${nextLabel}`, 28, 143 + rows * 17, 11, '#ffd166', 'left', true);
    const relics = state.relics.map((k) => relicByKey(k).icon).join(' ');
    text(relics === '' ? '✦ Relics: draft after wave 3' : `✦ Relics ${state.relics.length}/3: ${relics}`, 28, 160 + rows * 17, 11, PAL.muted, 'left', true);
  }
  function drawWinLose(wd) {
    const state = wd.state; const win = state.endless ? 'WIN: hold the night' : 'WIN: survive wave 10';
    const chips = [[win, '#ffd166', 992], ['LOSE: lantern falls', '#ff8a9a', 1138]];
    for (const [label, color, x] of chips) {
      ctx.fillStyle = 'rgba(28, 24, 48, 0.88)'; roundRect(x, 64, 134, 28, 14);
      ctx.fill(); ctx.strokeStyle = color;
      ctx.lineWidth = 1.5; ctx.stroke();
      text(label, x + 67, 82, 11, color, 'center', true);
    }
  }
  function bossActive(wd) {
    for (const enemy of wd.enemies.list) {
      if (!enemy.active) continue; if (enemy.type === 'boss') return enemy;
      if (enemy.type === 'queen') return enemy;
    }
    return null;
  }
  function drawBossBar(wd) {
    const boss = bossActive(wd); if (boss === null) return;
    ctx.fillStyle = 'rgba(28, 24, 48, 0.88)'; roundRect(430, 56, 420, 34, 10);
    ctx.fill(); ctx.strokeStyle = '#6b5a8e';
    ctx.lineWidth = 2; ctx.stroke();
    text(boss.type === 'boss' ? `SHADOW MOTH · PHASE ${boss.phase}` : 'MOTH QUEEN', 445, 72, 13, '#ffd166', 'left', true);
    const barX = 450; const barW = 290;
    const ratio = Math.max(0, boss.hp / boss.maxHp); ctx.fillStyle = 'rgba(20, 10, 30, 0.7)';
    ctx.fillRect(barX, 78, barW, 8);
    ctx.fillStyle = boss.type === 'boss' && boss.phase === 3 ? '#ff6b81' : '#c9a7f2';
    ctx.fillRect(barX, 78, barW * ratio, 8);
    if (boss.type === 'boss') {
      ctx.fillStyle = '#ffd166'; ctx.fillRect(barX + barW / 3 - 1, 78, 2, 8);
      ctx.fillRect(barX + (2 * barW) / 3 - 1, 78, 2, 8);
    }
    text(`${boss.hp} / ${boss.maxHp}`, 842, 86, 13, '#fff6e8', 'right', true);
  }
  function drawShopBar(wd) {
    const bar = LAYOUT.shopBar; ctx.fillStyle = PAL.panel;
    ctx.fillRect(bar.x, bar.y, bar.width, bar.height); ctx.fillStyle = PAL.panelEdge;
    ctx.fillRect(bar.x, bar.y, bar.width, 2); const state = wd.state;
    for (const card of shopCards()) {
      const rect = card.rect; const affordable = state.coins >= card.def.cost || card.type === 'mochi';
      const active = state.placing === card.type;
      ctx.fillStyle = active ? 'rgba(255, 209, 102, 0.25)' : 'rgba(255, 246, 232, 0.08)';
      roundRect(rect.x, rect.y, rect.width, rect.height, 10); ctx.fill();
      ctx.strokeStyle = active ? '#ffd166' : 'rgba(255, 246, 232, 0.2)'; ctx.lineWidth = active ? 2.5 : 1.5;
      ctx.stroke(); drawCat(rect.x + 26, rect.y + 38, 16, card.def, 1, 0, 0, card.type === 'sleepy');
      text(card.def.name, rect.x + 48, rect.y + 26, 12, PAL.text, 'left', true);
      const cost = card.type === 'mochi' ? 'Hero cat' : `Cost ${card.def.cost}`;
      text(cost, rect.x + 48, rect.y + 44, 12, affordable ? PAL.gold : '#ff8a9a', 'left', true);
      text(card.def.desc, rect.x + 48, rect.y + 62, 10, PAL.muted, 'left');
    }
    const panel = selectedPanelRect(); const selected = state.selected;
    ctx.fillStyle = 'rgba(255, 246, 232, 0.08)'; roundRect(panel.x, panel.y, panel.width, panel.height, 10);
    ctx.fill();
    if (selected !== null && selected.active) {
      const def = TOWER_TYPES[selected.type]; const stats = towerStats(selected.type, selected.level);
      drawCat(panel.x + 22, panel.y + 38, 15, def, selected.level, 0, 0, selected.type === 'sleepy');
      text(`${def.name}  ${'★'.repeat(selected.level)}${'☆'.repeat(3 - selected.level)}`, panel.x + 42, panel.y + 24, 11, PAL.text, 'left', true);
      text(`DMG ${Math.round(stats.damage)}  RNG ${Math.round(stats.range)}  🎯 ${TARGET_LABELS[selected.targetMode ?? 'first']}`, panel.x + 42, panel.y + 42, 10, PAL.muted, 'left');
      const upCost = selected.level < MAX_LEVEL ? TOWER_TYPES[selected.type].upgrade[selected.level - 1] : null;
      const upRect = selectedUpgradeRect(panel); const sellRect = selectedSellRect(panel);
      const canUp = upCost !== null && state.coins >= upCost;
      ctx.fillStyle = canUp ? 'rgba(255, 209, 102, 0.3)' : 'rgba(255, 246, 232, 0.08)';
      roundRect(upRect.x, upRect.y, upRect.width, upRect.height, 6); ctx.fill();
      text(upCost === null ? 'MAX' : `Up ${upCost}`, upRect.x + upRect.width / 2, upRect.y + 15, 11, canUp ? PAL.gold : PAL.muted, 'center', true);
      ctx.fillStyle = 'rgba(255, 107, 129, 0.2)';
      roundRect(sellRect.x, sellRect.y, sellRect.width, sellRect.height, 6); ctx.fill();
      text(selected.type === 'mochi' ? 'Hero' : `Sell +${Math.floor(selected.invested * 0.7)}`, sellRect.x + sellRect.width / 2, sellRect.y + 15, 11, '#ff8a9a', 'center', true);
    } else if (state.selectedPost !== null) {
      const level = state.postLevels[state.selectedPost]; const def = POST_LEVELS[level - 1];
      text(`Lantern Post Lv ${level}`, panel.x + 10, panel.y + 22, 12, PAL.text, 'left', true);
      text(`Glow +${Math.round(def.damageBonus * 100)}% · radius ${def.radius}`, panel.x + 10, panel.y + 40, 10, PAL.muted, 'left');
      const upRect = postUpgradeRect(panel);
      const cost = level < MAX_POST_LEVEL ? POST_UPGRADE_COST[level - 1] : null;
      const canUp = cost !== null && state.coins >= cost;
      ctx.fillStyle = canUp ? 'rgba(255, 209, 102, 0.3)' : 'rgba(255, 246, 232, 0.08)';
      roundRect(upRect.x, upRect.y, upRect.width, upRect.height, 6); ctx.fill();
      text(cost === null ? 'MAX LEVEL' : `Upgrade ${cost}`, upRect.x + upRect.width / 2, upRect.y + 17, 12, canUp ? PAL.gold : PAL.muted, 'center', true);
    } else {
      const next = state.phase === PHASE_BUILD ? state.wave : state.wave + 1;
      const nextLabel = state.endless ? `Night ${next - 10}` : next > 10 ? 'Long Night' : `Wave ${next}`;
      let preview = next > 10 && !state.endless ? 'Win the garden first!' : wavePreview(next);
      if (preview.length > 32) preview = `${preview.slice(0, 31)}…`;
      text(`NEXT  ${nextLabel}`, panel.x + 10, panel.y + 20, 11, '#ffd166', 'left', true);
      text(preview, panel.x + 10, panel.y + 38, 10, PAL.text, 'left');
      if (state.mutator !== 'none') {
        const mut = MUTATORS[state.mutator];
        text(`${mut.icon} ${mut.name}`, panel.x + 10, panel.y + 56, 10, PAL.muted, 'left');
      } else {
        text('WIN: hold 10 · LOSE: lantern falls', panel.x + 10, panel.y + 56, 9, PAL.muted, 'left');
      }
      text('Click a tower or a lantern post.', panel.x + 10, panel.y + 71, 9, PAL.muted, 'left');
    }
    const start = startWaveRect();
    if (state.phase === PHASE_BUILD) {
      const pulse = 0.75 + 0.25 * Math.sin(state.elapsed * 4);
      ctx.fillStyle = `rgba(255, 209, 102, ${pulse})`;
      roundRect(start.x, start.y, start.width, start.height, 10); ctx.fill();
      text('▶ Start Wave', start.x + start.width / 2, start.y + 32, 16, '#4a3423', 'center', true);
      text(`${Math.ceil(state.buildTimer)}s`, start.x + start.width / 2, start.y + 56, 13, '#4a3423', 'center', true);
    } else if (state.phase === PHASE_WAVE) {
      ctx.fillStyle = 'rgba(255, 246, 232, 0.08)'; roundRect(start.x, start.y, start.width, start.height, 10);
      ctx.fill(); text(wd.waveLabel(), start.x + start.width / 2, start.y + 32, 16, PAL.text, 'center', true);
      text('fighting…', start.x + start.width / 2, start.y + 56, 13, PAL.muted, 'center', true);
    }
  }
  function drawBossWarning(wd) {
    if (wd.state.bossCountdown <= 0) return;
    const label = `⚠ BOSS INCOMING — the Shadow Moth arrives in ${Math.ceil(wd.state.bossCountdown)}s!`;
    ctx.fillStyle = 'rgba(28, 24, 48, 0.92)'; roundRect(430, 56, 420, 34, 10);
    ctx.fill(); ctx.strokeStyle = '#ff6b81';
    ctx.lineWidth = 2; ctx.stroke();
    text(label, 640, 78, 15, '#ff8a9a', 'center', true);
  }
  function drawMessage(wd) {
    const state = wd.state; if (state.messageTimer <= 0 || state.message === '') return;
    if (state.bossCountdown > 0) return; const y = bossActive(wd) !== null ? 112 : 96;
    ctx.font = `700 20px ${FONT}`;
    const w = Math.min(FIELD.width - 32, ctx.measureText(state.message).width + 36);
    ctx.globalAlpha = Math.min(1, state.messageTimer); ctx.fillStyle = 'rgba(16, 14, 32, 0.88)';
    roundRect(FIELD.width / 2 - w / 2, y - 26, w, 34, 10); ctx.fill();
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5;
    ctx.stroke(); text(state.message, FIELD.width / 2, y, 20, PAL.text, 'center', true);
    ctx.globalAlpha = 1;
  }
  function draw(wd, screen, best, speed) {
    resize(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAL.backdrop; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shake = wd.fx.shakeOffset();
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x + shake.x * view.scale, view.y + shake.y * view.scale);
    const light = wd.lightLevel(); const festival = wd.state.festival;
    if (staticDecor !== wd.decor) {
      staticLayer = bakeStatic(wd); staticDecor = wd.decor;
    }
    ctx.drawImage(staticLayer, 0, 0); drawStars(wd);
    drawFireflies(wd); drawFestivalSparkles(wd);
    LANTERN_POSTS.forEach((post, i) => drawLanternPost(post, wd.state.postLevels[i], light, wd.state.elapsed, festival));
    drawBigLantern(wd, light, wd.state.elapsed, festival); drawBloom(wd);
    drawPlots(wd); drawTowers(wd);
    drawEnemies(wd); drawProjectiles(wd);
    drawEffects(wd);
    if (festival > 0) {
      ctx.save(); ctx.globalAlpha = festival;
      ctx.drawImage(washSprite, 0, 0); ctx.restore();
    }
    if (wd.fx.flash > 0) {
      ctx.fillStyle = `rgba(255, 210, 110, ${wd.fx.flash * 0.20})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    drawVignette(wd);
    if (screen !== SCREEN_TITLE) {
      drawTopBar(wd, screen, best, speed ?? 1); drawBossBar(wd);
      drawBossWarning(wd);
      if (wd.state.draft === null) { drawComboMeter(wd); drawIncoming(wd); drawWinLose(wd); drawMessage(wd); }
      drawShopBar(wd);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  return { draw, text, context: ctx, toField, drawCat };
}
