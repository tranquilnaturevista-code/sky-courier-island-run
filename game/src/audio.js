// Sky Courier: Island Run — synthesized sound.
// One clear job: every sound is an oscillator, never a file — engine hum
// that follows the throttle, a chime for a gate, a thud for a crash.
export function createSound() {
  const state = {
    ctx: null,
    engine: null,
    engineGain: null,
    muted: false,
    started: false,
  };

  function ensure() {
    if (state.ctx) return state.ctx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      state.ctx = new Ctx();
      const osc = state.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      const filter = state.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = state.ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(state.ctx.destination);
      osc.start();
      state.engine = osc;
      state.engineGain = gain;
      state.started = true;
    } catch {
      state.ctx = null;
    }
    return state.ctx;
  }

  // Call from a user gesture (the title screen button): browsers only let
  // audio start after one.
  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  function setEngine(throttle, speed, running) {
    if (!state.ctx || !state.engine) return;
    const target = state.muted || !running ? 0 : 0.045 + throttle * 0.05;
    state.engineGain.gain.setTargetAtTime(target, state.ctx.currentTime, 0.1);
    state.engine.frequency.setTargetAtTime(48 + throttle * 70 + speed * 0.25, state.ctx.currentTime, 0.1);
  }

  function blip(freq, dur, type, vol) {
    if (!state.ctx || state.muted) return;
    try {
      const t = state.ctx.currentTime;
      const osc = state.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      const gain = state.ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(state.ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch {
      // Sound is garnish: a failure here must never break the game.
    }
  }

  return {
    unlock,
    setEngine,
    toggleMute() {
      state.muted = !state.muted;
      return state.muted;
    },
    get muted() {
      return state.muted;
    },
    ring() {
      blip(880, 0.35, 'sine', 0.18);
      setTimeout(() => blip(1318, 0.4, 'sine', 0.14), 70);
    },
    course() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.4, 'sine', 0.16), i * 90));
    },
    land() {
      blip(392, 0.3, 'triangle', 0.15);
    },
    crash() {
      blip(70, 0.7, 'sawtooth', 0.25);
    },
    click() {
      blip(660, 0.08, 'square', 0.06);
    },
  };
}
