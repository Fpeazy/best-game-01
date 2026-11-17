import { MAX_WAVE, MUTATOR_KEYS } from './config.js';
export const WAVE_GROUPS = [
  [['mite', 8]],
  [['mite', 10], ['zip', 4]],
  [['mite', 8], ['zip', 6]],
  [['mite', 10], ['zip', 6], ['beetle', 2]],
  [['zip', 8], ['beetle', 4], ['moth', 3]],
  [['mite', 14], ['zip', 7], ['beetle', 3]],
  [['zip', 10], ['beetle', 5], ['moth', 4]],
  [['mite', 16], ['zip', 8], ['beetle', 5], ['moth', 4]],
  [['zip', 14], ['beetle', 8], ['moth', 8]],
  [['boss', 1], ['mite', 10], ['zip', 8]],
]; export const SPAWN_INTERVAL = { mite: 0.85, zip: 0.85, beetle: 1.3, moth: 1.3, boss: 0, queen: 0 };
export function spawnIntervalFor(type, wave) {
  if (wave >= 9 && (type === 'mite' || type === 'zip')) return 0.65; return SPAWN_INTERVAL[type] ?? 0.85;
}
export function endlessGroups(wave) {
  const night = wave - MAX_WAVE;
  const groups = [
    ['mite', 10 + night * 2],
    ['zip', 6 + night],
    ['beetle', 3 + Math.floor(night / 2)],
    ['moth', 2 + Math.floor(night / 2)],
  ]; if (night % 5 === 0) groups.unshift(['queen', 1]);
  return groups;
}
export function groupsForWave(wave) {
  if (wave <= MAX_WAVE) return WAVE_GROUPS[wave - 1]; return endlessGroups(wave);
}
export function waveQueue(wave) {
  const groups = groupsForWave(wave); const queue = [];
  for (const [type] of groups) {
    if (type === 'boss' || type === 'queen') queue.push(type);
  }
  const rest = groups.filter(([type]) => type !== 'boss' && type !== 'queen').map(([type, count]) => ({ type, left: count }));
  let remaining = rest.reduce((sum, g) => sum + g.left, 0);
  while (remaining > 0) {
    for (const g of rest) {
      if (g.left > 0) {
        queue.push(g.type); g.left -= 1;
        remaining -= 1;
      }
    }
  }
  return queue;
}
export function mutatorForWave(wave) {
  if (wave < 6) return 'none'; const hash = (wave * 2654435761) >>> 0;
  return MUTATOR_KEYS[hash % MUTATOR_KEYS.length];
}
export function wavePreview(wave) {
  const groups = groupsForWave(wave);
  const names = { mite: 'mites', zip: 'zips', beetle: 'beetles', moth: 'moths', boss: 'Shadow Moth', queen: 'Moth Queen' };
  return groups.map(([type, count]) => (type === 'boss' || type === 'queen' ? names[type] : `${count} ${names[type]}`)).join(', ');
}
