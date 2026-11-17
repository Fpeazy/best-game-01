import { DIFFICULTIES, FIELD, MAX_WAVE, PALETTE as PAL } from './config.js';
import { TOWER_TYPES } from './towers.js'; import { FEATS, gradeFor } from './profile.js';
export const TITLE_BUTTON = { x: 490, y: 540, width: 300, height: 56 };
export const WIN_BUTTON = { x: 262, y: 540, width: 180, height: 56 };
export const WIN_SAMESEED_BUTTON = { x: 462, y: 540, width: 180, height: 56 };
export const LONGNIGHT_BUTTON = { x: 662, y: 540, width: 180, height: 56 };
export const WIN_MENU_BUTTON = { x: 862, y: 540, width: 180, height: 56 };
export const OVER_BUTTON = { x: 490, y: 500, width: 300, height: 64 };
export const DIFF_BUTTONS = [
  { key: 'easy', rect: { x: 320, y: 470, width: 200, height: 44 } },
  { key: 'normal', rect: { x: 540, y: 470, width: 200, height: 44 } },
  { key: 'hard', rect: { x: 760, y: 470, width: 200, height: 44 } },
];
function panel(ctx, text, x, y, w, h, dim = 0.72) {
  ctx.fillStyle = `rgba(20, 14, 36, ${dim})`; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = 'rgba(28, 24, 48, 0.94)'; ctx.beginPath();
  ctx.roundRect(x, y, w, h, 20); ctx.fill();
  ctx.strokeStyle = '#6b5a8e'; ctx.lineWidth = 3;
  ctx.stroke();
}
function button(ctx, tx, rect, label, sub) {
  ctx.fillStyle = '#ffd166'; ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 12); ctx.fill();
  tx(label, rect.x + rect.width / 2, rect.y + 38, 24, '#4a3423', 'center', true);
  if (sub !== undefined) tx(sub, rect.x + rect.width / 2, rect.y + rect.height + 26, 15, PAL.muted, 'center');
}
function runLine(run, i) {
  return `${i + 1}.  Score ${run.s}  ·  ${run.win ? 'WIN' : 'lost wave ' + run.w}  ·  ${run.d}  ·  ${run.k} bugs  ·  Grade ${run.g}`;
}
export function drawTitle(ctx, tx, drawCat, world, best, profile) {
  panel(ctx, tx, 240, 36, 800, 648, 0.55); const halo = ctx.createRadialGradient(640, 350, 60, 640, 350, 480);
  halo.addColorStop(0, 'rgba(255, 209, 102, 0)'); halo.addColorStop(0.6, 'rgba(255, 209, 102, 0.06)');
  halo.addColorStop(0.8, 'rgba(255, 209, 102, 0.16)'); halo.addColorStop(1, 'rgba(255, 209, 102, 0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  tx("Mochi's", 640, 108, 52, '#ffd166', 'center', true);
  tx('Lantern Garden', 640, 158, 52, PAL.text, 'center', true);
  drawCat(975, 118, 28, TOWER_TYPES.mochi, 1, 0, 0, true); tx('Z', 1012, 96, 18, PAL.muted, 'center', true);
  tx('z', 1022, 110, 14, PAL.muted, 'center', true);
  tx('GOAL — Guard the big lantern through 10 waves of shadow bugs.', 640, 200, 16, PAL.text, 'center', true);
  tx('WIN: survive all 10 waves  ·  LOSE: the lantern falls (0 HP)', 640, 224, 14, 'rgba(255, 209, 102, 0.9)', 'center', true);
  tx('HOW TO PLAY', 640, 254, 14, '#ffd166', 'center', true);
  tx('1.  Place cat towers on the glowing plots — each cat guards its patch.', 640, 276, 14, PAL.text, 'center');
  tx('2.  Earn coins from swatted bugs — upgrade cats, feed the lantern posts.', 640, 296, 14, PAL.text, 'center');
  tx('3.  Draft a relic after waves 3, 6 and 9 — then face the Shadow Moth.', 640, 316, 14, PAL.text, 'center');
  tx('INSIDE:  6 cat towers  ·  5 bug types + Shadow Moth + Moth Queen  ·  8 relics  ·  3 abilities  ·  3 difficulties', 640, 346, 13, PAL.muted, 'center');
  const featCount = profile ? Object.keys(profile.feats).length : 0;
  const featNames = profile ? FEATS.filter((f) => profile.feats[f.key]).map((f) => f.name).join(' · ') : '';
  tx(`FEATS  ${featCount}/8  —  ${featNames === '' ? 'none yet — win a run to earn your first' : featNames}`, 640, 376, 13, '#ffb347', 'center');
  tx('LAST RUNS', 640, 404, 13, '#ffd166', 'center', true);
  if (profile && profile.runs.length > 0) {
    for (let i = 0; i < Math.min(3, profile.runs.length); i += 1) tx(runLine(profile.runs[i], i), 640, 426 + i * 20, 13, PAL.text, 'center');
  } else {
    tx('No runs yet — your garden awaits.', 640, 426, 13, PAL.muted, 'center');
  }
  for (const buttonDef of DIFF_BUTTONS) {
    const diff = DIFFICULTIES[buttonDef.key]; const selected = world.state.difficulty === buttonDef.key;
    ctx.fillStyle = selected ? '#ffd166' : 'rgba(255, 246, 232, 0.1)'; ctx.beginPath();
    ctx.roundRect(buttonDef.rect.x, buttonDef.rect.y, buttonDef.rect.width, buttonDef.rect.height, 10);
    ctx.fill(); ctx.strokeStyle = selected ? '#ffd166' : 'rgba(255, 246, 232, 0.25)';
    ctx.lineWidth = selected ? 2.5 : 1.5; ctx.stroke();
    tx(diff.name, buttonDef.rect.x + buttonDef.rect.width / 2, buttonDef.rect.y + 21, 17, selected ? '#4a3423' : PAL.text, 'center', true);
    tx(diff.desc, buttonDef.rect.x + buttonDef.rect.width / 2, buttonDef.rect.y + 38, 11, selected ? '#6a4a1a' : PAL.muted, 'center');
  }
  button(ctx, tx, TITLE_BUTTON, '▶  Start the garden', 'or press Space');
  if (best > 0) tx(`Best score ${best}`, 640, 640, 16, PAL.muted, 'center');
}
export function drawPaused(ctx, tx) {
  ctx.fillStyle = 'rgba(20, 14, 36, 0.6)'; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  tx('Paused', 640, 330, 56, PAL.text, 'center', true);
  tx('Press P or click ▶ to keep playing', 640, 372, 18, PAL.muted, 'center');
}
export function drawWin(ctx, tx, world, best, profile, runFeats) {
  panel(ctx, tx, 230, 40, 820, 640, 0.55); const halo = ctx.createRadialGradient(640, 350, 60, 640, 350, 480);
  halo.addColorStop(0, 'rgba(255, 209, 102, 0)'); halo.addColorStop(0.6, 'rgba(255, 209, 102, 0.06)');
  halo.addColorStop(0.8, 'rgba(255, 209, 102, 0.16)'); halo.addColorStop(1, 'rgba(255, 209, 102, 0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const grade = gradeFor(world.state.score, true); ctx.fillStyle = 'rgba(255, 209, 102, 0.15)';
  ctx.beginPath(); ctx.arc(330, 150, 42, 0, Math.PI * 2);
  ctx.fill(); ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3; ctx.stroke();
  tx(grade, 330, 166, 44, '#ffd166', 'center', true); tx('GRADE', 330, 210, 12, PAL.muted, 'center', true);
  tx('★ YOU WIN ★', 640, 106, 26, '#ffd166', 'center', true);
  tx('The garden blooms!', 640, 150, 30, '#ffd166', 'center', true);
  tx(`Score  ${world.state.score}`, 640, 186, 26, PAL.text, 'center', true);
  if (world.state.score >= best && world.state.score > 0) tx('★ NEW BEST ★', 830, 186, 16, '#ffd166', 'center', true);
  const stats = [
    [`Bugs swatted`, `${world.state.kills}`],
    [`Coins earned`, `${world.state.earned}`],
    [`Best combo`, `x${world.state.run.bestCombo}`],
    [`Starfalls`, `${world.towers.starfalls}`],
    [`Relics held`, `${world.state.relics.length}/3`],
    [`Lantern light`, `${Math.round(world.lightLevel() * 100)}%`],
  ];
  for (let i = 0; i < stats.length; i += 1) {
    const x = 330 + (i % 3) * 310; const y = 236 + Math.floor(i / 3) * 44;
    tx(stats[i][0], x, y, 12, PAL.muted, 'center'); tx(stats[i][1], x, y + 20, 20, PAL.text, 'center', true);
  }
  const earnedNames = (runFeats ?? []).map((k) => FEATS.find((f) => f.key === k)?.name).filter(Boolean).join(' · ');
  tx('FEATS EARNED', 640, 348, 13, '#ffd166', 'center', true);
  tx(earnedNames === '' ? 'None this run — the garden keeps its secrets.' : earnedNames, 640, 370, 14, '#ffb347', 'center');
  tx('LAST 3 RUNS', 640, 402, 13, '#ffd166', 'center', true);
  if (profile && profile.runs.length > 0) {
    for (let i = 0; i < Math.min(3, profile.runs.length); i += 1) tx(runLine(profile.runs[i], i), 640, 424 + i * 20, 13, PAL.text, 'center');
  } else {
    tx('Your first run is in the books!', 640, 424, 13, PAL.muted, 'center');
  }
  const nextFeat = FEATS.find((f) => !(profile?.feats[f.key]));
  tx(nextFeat ? `NEXT GOAL: ${nextFeat.name} — ${nextFeat.desc}` : 'NEXT GOAL: beat your best score!', 640, 500, 14, '#ffd166', 'center', true);
  button(ctx, tx, WIN_BUTTON, '↻  Play again'); button(ctx, tx, WIN_SAMESEED_BUTTON, '🎲  Same seed');
  button(ctx, tx, LONGNIGHT_BUTTON, '🌙  Long Night'); button(ctx, tx, WIN_MENU_BUTTON, '☰  Menu');
}
export function drawOver(ctx, tx, world, best, runFeats) {
  panel(ctx, tx, 290, 110, 700, 440); tx('✖ YOU LOSE ✖', 640, 155, 26, '#ff8a9a', 'center', true);
  tx('The lantern went dark…', 640, 220, 48, '#ff8a9a', 'center', true);
  tx('The shadow bugs reached the big lantern and blew it out.', 640, 256, 19, PAL.text, 'center');
  tx('Mochi is already plotting a comeback.', 640, 284, 19, PAL.text, 'center');
  tx(`Score  ${world.state.score}`, 640, 360, 30, PAL.text, 'center', true);
  const reached = world.state.endless
    ? `You reached Night ${world.state.wave - MAX_WAVE} of the Long Night`
    : `You reached wave ${world.state.wave} of ${MAX_WAVE}`;
  tx(`${reached}   ·   Bugs swatted ${world.state.kills}   ·   Best ${best}`, 640, 404, 17, PAL.muted, 'center');
  const earnedNames = (runFeats ?? []).map((k) => FEATS.find((f) => f.key === k)?.name).filter(Boolean).join(' · ');
  if (earnedNames !== '') tx(`Feats earned: ${earnedNames}`, 640, 432, 14, '#ffb347', 'center');
  tx('Tip: towers in lantern glow fight up to 50% better — build near the posts!', 640, 460, 16, '#ffb347', 'center');
  button(ctx, tx, OVER_BUTTON, '↻  Try again', 'or press Space');
}
export function drawDraft(ctx, tx, world) {
  ctx.fillStyle = 'rgba(20, 14, 36, 0.78)'; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const wave = world.state.draftWave;
  tx(`✦ RELIC DRAFT — after Wave ${wave} ✦`, 640, 116, 30, '#ffd166', 'center', true);
  tx('Pick 1 of 3 — it stays for the whole run. The garden waits.', 640, 146, 16, PAL.text, 'center');
  const cards = world.state.draft ?? [];
  for (let i = 0; i < cards.length; i += 1) {
    const r = cards[i]; const x = 170 + i * 320;
    const y = 180; const hover = world.state.draftHover === i;
    ctx.fillStyle = 'rgba(28, 24, 48, 0.96)'; ctx.beginPath();
    ctx.roundRect(x, y, 300, 400, 16); ctx.fill();
    ctx.strokeStyle = hover ? '#ffd166' : '#6b5a8e'; ctx.lineWidth = hover ? 4 : 2;
    ctx.stroke(); tx(r.icon, x + 150, 268, 52, PAL.text, 'center', true);
    tx(r.name, x + 150, 312, 22, '#ffd166', 'center', true);
    tx(r.stat, x + 150, 344, 17, PAL.text, 'center', true); tx(r.desc, x + 150, 376, 13, PAL.muted, 'center');
    tx(`Press ${i + 1} or click to pick`, x + 150, 548, 13, hover ? '#ffd166' : PAL.muted, 'center');
  }
}
