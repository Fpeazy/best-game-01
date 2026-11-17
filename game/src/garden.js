import { FIELD, POST_LEVELS } from './config.js';

/** The path as waypoints, from the garden gate (off the left edge) to the big lantern. */
export const PATH_POINTS = [
  { x: -40, y: 160 },
  { x: 280, y: 160 },
  { x: 280, y: 420 },
  { x: 620, y: 420 },
  { x: 620, y: 180 },
  { x: 960, y: 180 },
  { x: 960, y: 470 },
  { x: 1180, y: 470 },
];

/** The big paper lantern the bugs are after, at the end of the path. */
export const LANTERN = { x: 1215, y: 470, radius: 34 };

/** Small lantern posts along the path; towers inside their glow fight better. */
export const LANTERN_POSTS = [
  { x: 140, y: 108 },
  { x: 450, y: 472 },
  { x: 790, y: 128 },
  { x: 1090, y: 522 },
];

/** The moonflower pond in the top-right corner, with lily pads and stones. */
export const POND = { x: 1090, y: 118, rx: 95, ry: 42 };

export const PATH_WIDTH = 44;

/** Distance from a point to one path segment. */
export function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Shortest distance from a point to the whole path. */
export function distanceToPath(x, y) {
  let best = Infinity;
  for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
    const a = PATH_POINTS[i];
    const b = PATH_POINTS[i + 1];
    best = Math.min(best, distanceToSegment(x, y, a.x, a.y, b.x, b.y));
  }
  return best;
}

/** Total length of the path, in pixels. */
export function pathLength() {
  let total = 0;
  for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
    total += Math.hypot(PATH_POINTS[i + 1].x - PATH_POINTS[i].x, PATH_POINTS[i + 1].y - PATH_POINTS[i].y);
  }
  return total;
}

/** The point `distance` pixels along the path, plus the direction of travel there. */
export function pointAlongPath(distance) {
  let remaining = distance;
  for (let i = 0; i < PATH_POINTS.length - 1; i += 1) {
    const a = PATH_POINTS[i];
    const b = PATH_POINTS[i + 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg || i === PATH_POINTS.length - 2) {
      const t = seg === 0 ? 0 : Math.min(1, remaining / seg);
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    remaining -= seg;
  }
  const last = PATH_POINTS[PATH_POINTS.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
}

export function buildPlots() {
  const plots = [];
  const spacingX = 96;
  const spacingY = 96;
  for (let row = 0; row < 6; row += 1) {
    const y = 108 + row * spacingY;
    const offset = row % 2 === 0 ? 0 : 48;
    for (let col = 0; col < 13; col += 1) {
      const x = 84 + col * spacingX + offset;
      if (x < 50 || x > 1230 || y < 92 || y > 606) continue;
      if (distanceToPath(x, y) < 62) continue;
      if (Math.hypot(x - LANTERN.x, y - LANTERN.y) < 84) continue;
      if (((x - POND.x) / (POND.rx + 40)) ** 2 + ((y - POND.y) / (POND.ry + 40)) ** 2 < 1) continue;
      let nearPost = false;
      for (const post of LANTERN_POSTS) {
        if (Math.hypot(x - post.x, y - post.y) < 58) { nearPost = true; break; }
      }
      if (nearPost) continue;
      let coverage = 0;
      const total = pathLength();
      for (let d = 0; d <= total; d += 24) {
        const p = pointAlongPath(d);
        if (Math.hypot(p.x - x, p.y - y) <= 160) coverage += 1;
      }
      plots.push({ x, y, radius: 30, coverage, tower: null });
    }
  }
  plots.sort((a, b) => b.coverage - a.coverage);
  return plots.slice(0, 16);
}

/** The lantern-light bonus at a point, from the posts' levels (0 outside every glow). */
export function glowBonusAt(x, y, levels) {
  let best = 0;
  for (let i = 0; i < LANTERN_POSTS.length; i += 1) {
    const post = LANTERN_POSTS[i];
    const level = levels?.[i] ?? 1;
    const def = POST_LEVELS[Math.max(1, Math.min(POST_LEVELS.length, level)) - 1];
    if (Math.hypot(x - post.x, y - post.y) <= def.radius) best = Math.max(best, def.damageBonus);
  }
  return best;
}

/** True when a tower on this plot stands inside a lantern post's glow. */
export function inLanternGlow(x, y, levels) {
  return glowBonusAt(x, y, levels) > 0;
}

/** The glow radius of a lantern post at a level. */
export function postGlowRadius(level) {
  return POST_LEVELS[Math.max(1, Math.min(POST_LEVELS.length, level)) - 1].radius;
}

/** Fixed, seeded-looking decoration: stars, grass tufts and flowers, placed once. */
export function buildDecor(random) {
  const stars = [];
  for (let i = 0; i < 70; i += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * 200, r: 0.8 + random() * 1.6, tw: random() * Math.PI * 2 });
  }
  const tufts = [];
  for (let i = 0; i < 120; i += 1) {
    const x = 20 + random() * (FIELD.width - 40);
    const y = 70 + random() * 540;
    if (distanceToPath(x, y) < 40) continue;
    if (Math.hypot(x - LANTERN.x, y - LANTERN.y) < 60) continue;
    tufts.push({ x, y, s: 0.7 + random() * 0.9 });
  }
  const flowers = [];
  for (let i = 0; i < 70; i += 1) {
    const x = 20 + random() * (FIELD.width - 40);
    const y = 70 + random() * 540;
    if (distanceToPath(x, y) < 36) continue;
    if (Math.hypot(x - LANTERN.x, y - LANTERN.y) < 60) continue;
    flowers.push({ x, y, color: i % 3 === 0 ? '#f2a7c3' : i % 3 === 1 ? '#ffd166' : '#c9a7f2', r: 3 + random() * 2.5 });
  }
  const mid = [[360, 240], [430, 340], [500, 230], [560, 330], [700, 260], [840, 360], [900, 240], [760, 340]];
  for (const [x, y] of mid) flowers.push({ x, y, color: '#ffd166', r: 5 });
  for (const [x, y] of [[500, 300], [660, 300], [840, 270], [400, 300], [580, 250], [760, 280]]) flowers.push({ x, y, color: '#ffd166', r: 9 });
  const fireflies = [];
  for (let i = 0; i < 9; i += 1) {
    fireflies.push({
      x: POND.x - 60 + random() * 130, y: POND.y - 24 + random() * 60,
      phase: random() * Math.PI * 2, amp: 6 + random() * 10, speed: 0.4 + random() * 0.6,
    });
  }
  for (let i = 0; i < 6; i += 1) {
    fireflies.push({
      x: 120 + random() * 1000, y: 90 + random() * 480,
      phase: random() * Math.PI * 2, amp: 5 + random() * 8, speed: 0.3 + random() * 0.5,
    });
  }
  for (const [x, y] of [[400, 300], [520, 260], [720, 320], [860, 280], [450, 280], [650, 330], [800, 260]]) {
    fireflies.push({ x, y, phase: random() * Math.PI * 2, amp: 7, speed: 0.5 });
  }
  const moonflowers = [
    { x: POND.x - 78, y: POND.y + 26, r: 7 },
    { x: POND.x + 62, y: POND.y - 30, r: 6 },
    { x: POND.x + 30, y: POND.y + 34, r: 6 },
  ];
  const stones = [
    { x: POND.x - 96, y: POND.y - 6, r: 8 },
    { x: POND.x + 88, y: POND.y + 12, r: 6 },
    { x: POND.x - 20, y: POND.y - 44, r: 5 },
  ];
  const lilyPads = [
    { x: POND.x - 34, y: POND.y - 6, r: 12 },
    { x: POND.x + 18, y: POND.y + 12, r: 10 },
    { x: POND.x + 52, y: POND.y - 12, r: 9 },
  ];
  const statues = [
    { x: 430, y: 285, r: 22 },
    { x: 790, y: 305, r: 22 },
    { x: 560, y: 255, r: 22 },
    { x: 880, y: 360, r: 22 },
    { x: 480, y: 250, r: 22 },
    { x: 820, y: 300, r: 22 },
  ];
  const shrines = [
    { x: 1050, y: 300, r: 16 },
    { x: 140, y: 540, r: 16 },
    { x: 620, y: 560, r: 16 },
    { x: 700, y: 260, r: 16 },
    { x: 350, y: 250, r: 16 },
    { x: 700, y: 330, r: 16 },
  ];
  const bushes = [];
  const bushSpots = [[100, 260], [200, 540], [360, 90], [540, 90], [700, 540], [880, 540], [1180, 600]];
  for (const [x, y] of bushSpots) {
    if (distanceToPath(x, y) < 46) continue;
    bushes.push({ x, y, r: 16 + random() * 8 });
  }
  return { stars, tufts, flowers, fireflies, moonflowers, stones, lilyPads, statues, shrines, bushes };
}
