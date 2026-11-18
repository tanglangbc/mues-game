// Sound only: every effect is synthesised with WebAudio, so the game ships no
// audio files. The context is created on the first user gesture, and M mutes.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(startFreq, endFreq, duration, type, volume, delay) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null) return;
    const when = ctx.currentTime + (delay || 0);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFreq, when);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), when + duration);
    gain.gain.setValueAtTime(volume, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    collect(combo) {
      const base = 520 + Math.min(combo, 8) * 45;
      tone(base, base * 1.5, 0.12, 'sine', 0.16);
      tone(base * 1.5, base * 2, 0.1, 'sine', 0.1, 0.05);
    },
    hit() {
      tone(180, 60, 0.25, 'sawtooth', 0.18);
    },
    dash() {
      tone(300, 900, 0.12, 'triangle', 0.08);
    },
    wave() {
      tone(440, 440, 0.1, 'sine', 0.12);
      tone(660, 660, 0.12, 'sine', 0.12, 0.09);
      tone(880, 880, 0.16, 'sine', 0.1, 0.18);
    },
    expire() {
      tone(320, 180, 0.18, 'sine', 0.07);
    },
    win() {
      const notes = [523, 659, 784, 1047];
      for (let i = 0; i < notes.length; i += 1) tone(notes[i], notes[i], 0.22, 'sine', 0.14, i * 0.12);
    },
    over() {
      tone(392, 392, 0.2, 'triangle', 0.12);
      tone(311, 311, 0.2, 'triangle', 0.12, 0.18);
      tone(233, 180, 0.35, 'triangle', 0.12, 0.36);
    },
  };
}
