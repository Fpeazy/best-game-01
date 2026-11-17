// Juice: pooled particles, floating numbers, rings, arcs, trauma shake.
import { FIELD, POOL } from './config.js';

export function createEffects(random) {
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', gravity: 0 });
  }
  const texts = [];
  for (let i = 0; i < POOL.texts; i += 1) {
    texts.push({ active: false, x: 0, y: 0, life: 0, maxLife: 0.8, text: '', color: '#fff', size: 14 });
  }
  const rings = [];
  for (let i = 0; i < 8; i += 1) {
    rings.push({ active: false, x: 0, y: 0, radius: 0, maxRadius: 0, life: 0, maxLife: 0.6, color: '#fff' });
  }
  const arcs = [];
  for (let i = 0; i < 8; i += 1) {
    arcs.push({ active: false, x: 0, y: 0, angle: 0, life: 0, maxLife: 0.18 });
  }
  const beams = [];
  for (let i = 0; i < 8; i += 1) {
    beams.push({ active: false, x: 0, top: 0, bottom: 0, life: 0, maxLife: 1, width: 24, color: '#ffd166' });
  }
  let trauma = 0;
  let time = 0;
  /** Full-field gold flash, 0..1 — set by sim events, decays with sim time. */
  let flash = 0;
  /** Hit-stop, in real seconds — the main loop (not the sim) spends it. */
  let hitStop = 0;

  function freeParticle() {
    for (let i = 0; i < particles.length; i += 1) if (!particles[i].active) return particles[i];
    return particles[0];
  }

  function spawnBurst(x, y, color, count, speed, life, size) {
    for (let n = 0; n < count; n += 1) {
      const p = freeParticle();
      const angle = random() * Math.PI * 2;
      const v = speed * (0.4 + random() * 0.8);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v - speed * 0.25;
      p.life = life * (0.6 + random() * 0.7);
      p.maxLife = p.life;
      p.size = size * (0.7 + random() * 0.6);
      p.color = color;
      p.gravity = 160;
    }
  }

  function spawnText(x, y, text, color, size) {
    const big = (size ?? 14) >= 20;
    let live = 0;
    for (let i = 0; i < texts.length; i += 1) if (texts[i].active) live += 1;
    if (!big && live >= 40) return;
    let slot = null;
    for (let i = 0; i < texts.length; i += 1) {
      if (!texts[i].active) { slot = texts[i]; break; }
    }
    if (slot === null) slot = texts[0];
    slot.active = true;
    // Clamp callouts inside the field; stack numbers that would land on the
    // same spot (FIX-2: dense moments stacked "144/1518" into one blob).
    slot.x = Math.max(140, Math.min(FIELD.width - 140, x + (random() - 0.5) * 28));
    let stack = 0;
    for (let i = 0; i < texts.length; i += 1) {
      const t = texts[i];
      if (t.active && t !== slot && Math.abs(t.x - slot.x) < 48 && Math.abs(t.y - y) < 36) stack += 1;
    }
    slot.y = y - 20 * stack;
    slot.life = 0.8;
    slot.maxLife = 0.8;
    slot.text = text;
    slot.color = color;
    slot.size = size ?? 14;
  }

  /** A golden column of light, e.g. a tower reaching its final form. */
  function spawnBeam(x, top, bottom, width, color, life) {
    for (let i = 0; i < beams.length; i += 1) {
      if (beams[i].active) continue;
      beams[i].active = true;
      beams[i].x = x;
      beams[i].top = top;
      beams[i].bottom = bottom;
      beams[i].life = life;
      beams[i].maxLife = life;
      beams[i].width = width;
      beams[i].color = color;
      return;
    }
  }

  function triggerFlash(amount) {
    flash = Math.min(1, Math.max(flash, amount));
  }

  /** Start (or extend) a hit-stop; only the newest, longest one is kept. */
  function triggerHitStop(seconds) {
    hitStop = Math.max(hitStop, seconds);
  }

  /** Decay the shake trauma on real time, so the camera never freezes off-centre. */
  function decayTrauma(realDt) {
    trauma = Math.max(0, trauma - realDt * 1.4);
  }

  function spawnRing(x, y, maxRadius, color) {
    for (let i = 0; i < rings.length; i += 1) {
      if (rings[i].active) continue;
      rings[i].active = true;
      rings[i].x = x;
      rings[i].y = y;
      rings[i].radius = 10;
      rings[i].maxRadius = maxRadius;
      rings[i].life = 0.6;
      rings[i].maxLife = 0.6;
      rings[i].color = color;
      return;
    }
  }

  function spawnArc(x, y, angle) {
    for (let i = 0; i < arcs.length; i += 1) {
      if (arcs[i].active) continue;
      arcs[i].active = true;
      arcs[i].x = x;
      arcs[i].y = y;
      arcs[i].angle = angle;
      arcs[i].life = 0.18;
      arcs[i].maxLife = 0.18;
      return;
    }
  }

  function addTrauma(amount) {
    trauma = Math.min(1, trauma + amount);
  }

  function update(dt) {
    time += dt;
    trauma = Math.max(0, trauma - dt * 1.4);
    flash = Math.max(0, flash - dt * 1.8);
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = 0; i < texts.length; i += 1) {
      const t = texts[i];
      if (!t.active) continue;
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) t.active = false;
    }
    for (let i = 0; i < rings.length; i += 1) {
      const r = rings[i];
      if (!r.active) continue;
      r.life -= dt;
      r.radius += (r.maxRadius - r.radius) * dt * 6;
      if (r.life <= 0) r.active = false;
    }
    for (let i = 0; i < arcs.length; i += 1) {
      const a = arcs[i];
      if (!a.active) continue;
      a.life -= dt;
      if (a.life <= 0) a.active = false;
    }
    for (let i = 0; i < beams.length; i += 1) {
      const b = beams[i];
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) b.active = false;
    }
  }

  /** The camera offset this frame (visual only — it never moves the simulation).
   * Bumped in v4: hits must punch, not wobble softly. */
  function shakeOffset() {
    const shake = trauma * trauma;
    return {
      x: 12 * shake * Math.sin(time * 47.3),
      y: 10 * shake * Math.sin(time * 39.7),
    };
  }

  return {
    particles, texts, rings, arcs, beams,
    get flash() { return flash; },
    get hitStop() { return hitStop; },
    set hitStop(value) { hitStop = value; },
    spawnBurst, spawnText, spawnRing, spawnArc, spawnBeam,
    triggerFlash, triggerHitStop, decayTrauma,
    addTrauma, update, shakeOffset,
  };
}
