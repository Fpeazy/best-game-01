export const RELICS = [
  { key: 'wick', name: 'Amber Wick', icon: '🕯', stat: '+8% attack speed', desc: 'Every cat swats faster.' },
  { key: 'bell', name: 'Mochi Bell', icon: '🔔', stat: '+2 dmg vs slowed', desc: 'Slowed bugs take extra hits.' },
  { key: 'jar', name: 'Star Jar', icon: '⭐', stat: 'Starfall at 4-chain', desc: 'The star combo fires sooner.' },
  { key: 'leaf', name: 'Gold Leaf', icon: '🍂', stat: '+15% coin drops', desc: 'Bugs drop richer coins.' },
  { key: 'shield', name: 'Wick Shield', icon: '🛡', stat: '+8% tower range', desc: 'Every tower reaches further.' },
  { key: 'core', name: 'Glow Core', icon: '💎', stat: 'Crits deal 2.5x', desc: 'Star Gazer crits hit harder.' },
  { key: 'veil', name: 'Petal Veil', icon: '🌸', stat: '+1 max HP, heal 1', desc: 'Each wave clear mends the garden.' },
  { key: 'knot', name: 'Lantern Knot', icon: '🪢', stat: 'Kills chain 50%', desc: 'A killing blow arcs to a nearby bug.' },
]; export const DRAFT_WAVES = [3, 6, 9];
export function relicByKey(key) { return RELICS.find((r) => r.key === key); }
export function draftChoices(held, seed, wave) {
  const pool = RELICS.filter((r) => !held.includes(r.key)); const out = [];
  let h = ((seed * 2654435761 + wave * 40503) >>> 0) || 1;
  while (out.length < 3 && pool.length > 0) { h = (h * 1103515245 + 12345) & 0x7fffffff; out.push(pool.splice(h % pool.length, 1)[0]); }
  return out;
}
export function relicMods(held) {
  const m = { rate: 1, range: 1, coins: 1, crit: 2, chain: false, bell: 0, starfall: 5, veil: false };
  for (const k of held) {
    if (k === 'wick') m.rate = 1.08; else if (k === 'bell') m.bell = 2; else if (k === 'jar') m.starfall = 4;
    else if (k === 'leaf') m.coins = 1.15; else if (k === 'shield') m.range = 1.08; else if (k === 'core') m.crit = 2.5;
    else if (k === 'veil') m.veil = true; else if (k === 'knot') m.chain = true;
  }
  return m;
}
