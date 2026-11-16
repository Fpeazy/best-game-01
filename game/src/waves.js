// The ten campaign waves, and the endless Long Night after them: what marches in,
// and in what order. The queue is interleaved so a wave arrives as a mixed stream,
// not one clump of each kind. The boss opens wave 10 and its escorts trickle in
// behind it; in the Long Night a Moth Queen arrives every fifth night.
import { MAX_WAVE, MUTATOR_KEYS } from './config.js';

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
export const SPAWN_INTERVAL = { mite: 0.85, zip: 0.85, beetle: 1.3, moth: 1.3, boss: 0, queen: 0 };

/** The groups for an endless wave: the stream grows with each night, and a Moth
 * Queen opens every fifth night. Night 1 is wave 11. */
export function endlessGroups(wave) {
  const night = wave - MAX_WAVE;
  const groups = [
    ['mite', 10 + night * 2],
    ['zip', 6 + night],
    ['beetle', 3 + Math.floor(night / 2)],
    ['moth', 2 + Math.floor(night / 2)],
  ];
  if (night % 5 === 0) groups.unshift(['queen', 1]);
  return groups;
}

/** The groups for a wave, campaign or endless. */
export function groupsForWave(wave) {
  if (wave <= MAX_WAVE) return WAVE_GROUPS[wave - 1];
  return endlessGroups(wave);
}

/** The flat spawn queue for a wave: the boss or queen first, the rest interleaved round-robin. */
export function waveQueue(wave) {
  const groups = groupsForWave(wave);
  const queue = [];
  for (const [type] of groups) {
    if (type === 'boss' || type === 'queen') queue.push(type);
  }
  const rest = groups.filter(([type]) => type !== 'boss' && type !== 'queen').map(([type, count]) => ({ type, left: count }));
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

/** The night's twist, from wave 6 on: a deterministic pick by wave number, so the
 * same seed always meets the same twist. Waves 1-5 are calm. */
export function mutatorForWave(wave) {
  if (wave < 6) return 'none';
  const hash = (wave * 2654435761) >>> 0;
  return MUTATOR_KEYS[hash % MUTATOR_KEYS.length];
}

/** Short preview text for the HUD: "Wave 5 — 6 zips, 3 beetles, 2 moths". */
export function wavePreview(wave) {
  const groups = groupsForWave(wave);
  const names = { mite: 'mites', zip: 'zips', beetle: 'beetles', moth: 'moths', boss: 'Shadow Moth', queen: 'Moth Queen' };
  return groups.map(([type, count]) => (type === 'boss' || type === 'queen' ? names[type] : `${count} ${names[type]}`)).join(', ');
}
