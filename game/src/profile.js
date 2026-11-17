import { BEST_KEY } from './config.js'; export const PROFILE_KEY = 'mochi-lantern-garden.profile';
export const PROFILE_VERSION = 2;
export const FEATS = [
  { key: 'firstwin', name: 'First Bloom', desc: 'Win the garden' },
  { key: 'flawless', name: 'Untouched', desc: 'Win without a single leak' },
  { key: 'relic3', name: 'Relic Hoarder', desc: 'Draft 3 relics in one run' },
  { key: 'starfall3', name: 'Starshower', desc: '3 Starfalls in one run' },
  { key: 'bossslayer', name: 'Moth Slayer', desc: 'Defeat the Shadow Moth' },
  { key: 'longnight', name: 'Night Owl', desc: 'Reach Night 3 of the Long Night' },
  { key: 'rich', name: 'Coin Keeper', desc: 'Earn 1,000 coins in one run' },
  { key: 'combo5', name: 'Chain Master', desc: 'Reach a 5-chain combo' },
];
export function defaultProfile() { return { v: PROFILE_VERSION, best: 0, wins: 0, games: 0, feats: {}, runs: [], seen: [] }; }
let mem = null;
function store() { return (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : null; }
function parse(raw) {
  try { const p = JSON.parse(raw); if (p && p.v === PROFILE_VERSION && Array.isArray(p.runs)) return p; } catch { /* corrupt save */ }
  return null;
}
export function loadProfile() {
  const s = store();
  if (s === null) { if (mem === null) mem = defaultProfile(); return mem; }
  let p = parse(s.getItem(PROFILE_KEY)) ?? parse(s.getItem(`${PROFILE_KEY}.bak`));
  if (p === null) { p = defaultProfile(); try { p.best = Number.parseInt(s.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { /* no old best */ } }
  return p;
}
export function saveProfile(p) {
  const s = store();
  if (s === null) { mem = p; return; }
  try { const old = s.getItem(PROFILE_KEY); if (old) s.setItem(`${PROFILE_KEY}.bak`, old); s.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}
export function gradeFor(score, won) {
  if (!won) return '—';
  if (score >= 21000) return 'S'; if (score >= 18000) return 'A'; if (score >= 14000) return 'B'; return 'C';
}
export function featsForRun(world, won) {
  const s = world.state; const f = []; if (won) f.push('firstwin');
  if (won && s.leaked === 0) f.push('flawless'); if (s.relics.length >= 3) f.push('relic3');
  if (world.towers.starfalls >= 3) f.push('starfall3'); if (s.bossSlain) f.push('bossslayer');
  if (s.endless && s.wave >= 13) f.push('longnight'); if (s.earned >= 1000) f.push('rich');
  if (s.run.bestCombo >= 5) f.push('combo5'); return f;
}
export function recordRun(p, world, won, feats) {
  const s = world.state; p.games += 1; if (won) p.wins += 1; if (s.score > p.best) p.best = s.score;
  for (const k of feats) p.feats[k] = true; for (const k of s.relics) if (!p.seen.includes(k)) p.seen.push(k);
  p.runs.unshift({ s: s.score, k: s.kills, w: s.wave, win: won, d: s.difficulty, g: gradeFor(s.score, won), seed: world.seed });
  p.runs = p.runs.slice(0, 5); return p;
}
