// The garden's map: the winding path the bugs walk, the build plots beside it, the
// lantern posts whose glow empowers nearby towers, and the big paper lantern at the end.
// Nothing here depends on the browser; the same fixed map is used by the sim, the
// renderer and the headless playtest.
import { FIELD } from './config.js';

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

/**
 * Build plots: a fixed grid of candidate spots, keeping only the ones clear of the path,
 * the big lantern and the lantern posts. Each plot gets a coverage score (how much path
 * lies within a typical tower's range) so the autopilot — and the player — can tell the
 * good spots from the bad ones.
 */
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
      let nearPost = false;
      for (const post of LANTERN_POSTS) {
        if (Math.hypot(x - post.x, y - post.y) < 58) { nearPost = true; break; }
      }
      if (nearPost) continue;
      // Coverage: path samples within 160 px (a yarnball's reach).
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

/** True when a tower on this plot stands inside a lantern post's glow. */
export function inLanternGlow(x, y, radius) {
  for (const post of LANTERN_POSTS) {
    if (Math.hypot(x - post.x, y - post.y) <= radius) return true;
  }
  return false;
}

/** Fixed, seeded-looking decoration: stars, grass tufts and flowers, placed once. */
export function buildDecor(random) {
  const stars = [];
  for (let i = 0; i < 70; i += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * 200, r: 0.8 + random() * 1.6, tw: random() * Math.PI * 2 });
  }
  const tufts = [];
  for (let i = 0; i < 90; i += 1) {
    const x = 20 + random() * (FIELD.width - 40);
    const y = 70 + random() * 540;
    if (distanceToPath(x, y) < 40) continue;
    if (Math.hypot(x - LANTERN.x, y - LANTERN.y) < 60) continue;
    tufts.push({ x, y, s: 0.7 + random() * 0.9 });
  }
  const flowers = [];
  for (let i = 0; i < 46; i += 1) {
    const x = 20 + random() * (FIELD.width - 40);
    const y = 70 + random() * 540;
    if (distanceToPath(x, y) < 36) continue;
    if (Math.hypot(x - LANTERN.x, y - LANTERN.y) < 60) continue;
    flowers.push({ x, y, color: i % 3 === 0 ? '#f2a7c3' : i % 3 === 1 ? '#ffd166' : '#c9a7f2', r: 3 + random() * 2.5 });
  }
  return { stars, tufts, flowers };
}
