export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context !== null) return context;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (Ctor === undefined) return null;
      context = new Ctor();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(freq, dur, type, gain, when, slideTo) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null || ctx.state === 'suspended') return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const start = ctx.currentTime + (when ?? 0);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    click() { tone(660, 0.07, 'sine', 0.08); },
    place() { tone(392, 0.09, 'triangle', 0.12); tone(523, 0.12, 'triangle', 0.1, 0.07); },
    upgrade() { tone(523, 0.1, 'triangle', 0.12); tone(659, 0.1, 'triangle', 0.12, 0.08); tone(784, 0.16, 'triangle', 0.12, 0.16); },
    sell() { tone(587, 0.09, 'sine', 0.1); tone(392, 0.14, 'sine', 0.1, 0.07); },
    shoot(kind) {
      if (kind === 'fish') tone(300, 0.08, 'square', 0.04, 0, 180);
      else if (kind === 'yarn') tone(520, 0.06, 'sine', 0.05, 0, 700);
    },
    hit() { tone(220, 0.05, 'square', 0.03, 0, 140); },
    coin() { tone(880, 0.07, 'sine', 0.06); tone(1174, 0.1, 'sine', 0.05, 0.05); },
    leak() { tone(196, 0.3, 'sawtooth', 0.1, 0, 98); },
    waveClear() {
      tone(523, 0.12, 'triangle', 0.12);
      tone(659, 0.12, 'triangle', 0.12, 0.1);
      tone(784, 0.12, 'triangle', 0.12, 0.2);
      tone(1046, 0.24, 'triangle', 0.12, 0.3);
    },
    boss() { tone(98, 0.5, 'sawtooth', 0.12, 0, 65); tone(147, 0.4, 'sawtooth', 0.08, 0.1, 98); },
    ability() { tone(784, 0.12, 'triangle', 0.12); tone(1046, 0.18, 'triangle', 0.12, 0.09); },
    flare() { tone(880, 0.1, 'sine', 0.12, 0, 1320); tone(1174, 0.2, 'sine', 0.1, 0.08); },
    purr() { tone(262, 0.4, 'sine', 0.08, 0, 330); tone(330, 0.4, 'sine', 0.06, 0.15, 392); },
    phase() { tone(131, 0.3, 'sawtooth', 0.12, 0, 98); tone(98, 0.4, 'sawtooth', 0.12, 0.12, 65); },
    mutator() { tone(587, 0.1, 'sine', 0.1); tone(880, 0.14, 'sine', 0.1, 0.09); },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, 'triangle', 0.12, i * 0.12));
    },
    lose() {
      tone(392, 0.25, 'triangle', 0.1, 0, 370);
      tone(330, 0.25, 'triangle', 0.1, 0.22, 311);
      tone(262, 0.5, 'triangle', 0.1, 0.44, 233);
    },
  };
}
