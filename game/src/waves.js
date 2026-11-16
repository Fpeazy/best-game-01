// The ten waves: what marches in, and in what order. The queue is interleaved so a
// wave arrives as a mixed stream, not one clump of each kind. The boss opens wave 10
// and its escorts trickle in behind it.
import { MAX_WAVE } from './config.js';

/** [type, count] groups per wave, in the order they are introduced. */
export const WAVE_GROUPS = [
  [['mite', 8]],
  [['mite', 10], ['zip', 4]],
  [['mite', 8], ['zip', 6]],
  [['mite', 10], ['zip', 6], ['beetle', 2]],
  [['zip', 8], ['beetle', 4], ['moth', 3]],
  [['mite', 14], ['zip', 7], ['beetle', 3]],
  [['zip', 10], ['beetle', 5], ['moth', 4]],
  [['mite', 16], ['zip', 8], ['beetle', 5], ['moth', 4]],
  [['zip', 12], ['beetle', 7], ['moth', 6]],
  [['boss', 1], ['mite', 8], ['zip', 6]],
];

/** Seconds between spawns of each kind. */
export const SPAWN_INTERVAL = { mite: 0.85, zip: 0.85, beetle: 1.3, moth: 1.3, boss: 0 };

/** The flat spawn queue for a wave: the boss first, the rest interleaved round-robin. */
export function waveQueue(wave) {
  const groups = WAVE_GROUPS[Math.max(1, Math.min(MAX_WAVE, wave)) - 1];
  const queue = [];
  for (const [type, count] of groups) {
    if (type === 'boss') queue.push(type);
  }
  const rest = groups.filter(([type]) => type !== 'boss').map(([type, count]) => ({ type, left: count }));
  let remaining = rest.reduce((sum, g) => sum + g.left, 0);
  while (remaining > 0) {
    for (const g of rest) {
      if (g.left > 0) {
        queue.push(g.type);
        g.left -= 1;
        remaining -= 1;
      }
    }
  }
  return queue;
}

/** Short preview text for the HUD: "Wave 5 — 6 zips, 3 beetles, 2 moths". */
export function wavePreview(wave) {
  const groups = WAVE_GROUPS[Math.max(1, Math.min(MAX_WAVE, wave)) - 1];
  const names = { mite: 'mites', zip: 'zips', beetle: 'beetles', moth: 'moths', boss: 'Shadow Moth' };
  return groups.map(([type, count]) => (type === 'boss' ? 'Shadow Moth' : `${count} ${names[type]}`)).join(', ');
}
