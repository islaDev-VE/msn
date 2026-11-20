// Original Procedural 2005 Retro Sound Engine using Web Audio API
// 100% original melodies & effects, zero external MP3 dependencies

let audioCtx = null;
let muted = false;

function getAudioContext() {
  if (muted) return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function initAudio() {
  getAudioContext();
}

export function setSoundMuted(value) {
  muted = Boolean(value);
}

export function isSoundMuted() {
  return muted;
}

/**
 * Original warm 2005 sign-in chime (3-note crystal triad)
 */
export function playLoginSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 587.33, time: 0.00, dur: 0.14 }, // D5
    { freq: 739.99, time: 0.11, dur: 0.15 }, // F#5
    { freq: 880.00, time: 0.22, dur: 0.16 }, // A5
    { freq: 1174.66, time: 0.34, dur: 0.42 } // D6
  ];

  notes.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.linearRampToValueAtTime(0.22, now + time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + time);
    osc.stop(now + time + dur + 0.04);
  });
}

/**
 * Clean retro message chime
 */
export function playMessageSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(1318.5, now); // E6
  osc1.frequency.setValueAtTime(1567.98, now + 0.065); // G6

  gain1.gain.setValueAtTime(0.0001, now);
  gain1.gain.linearRampToValueAtTime(0.28, now + 0.01);
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.35);
}

/**
 * Zumbido (Nudge) rumble + alert pulses
 */
export function playNudgeSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const rumbleOsc = ctx.createOscillator();
  const rumbleGain = ctx.createGain();
  rumbleOsc.type = 'sawtooth';
  rumbleOsc.frequency.setValueAtTime(70, now);
  rumbleOsc.frequency.linearRampToValueAtTime(48, now + 0.3);

  rumbleGain.gain.setValueAtTime(0.0001, now);
  rumbleGain.gain.linearRampToValueAtTime(0.25, now + 0.02);
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

  rumbleOsc.connect(rumbleGain);
  rumbleGain.connect(ctx.destination);
  rumbleOsc.start(now);
  rumbleOsc.stop(now + 0.35);

  [0.06, 0.20, 0.34].forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1046.5, now + offset);

    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.linearRampToValueAtTime(0.28, now + offset + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.2);
  });
}

/**
 * Wink cartoon sound effects
 */
export function playWinkSound(winkType = 'laugh') {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  if (winkType === 'water') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.38);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.44);
  } else if (winkType === 'kiss') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(860, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.12);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  } else if (winkType === 'knock') {
    [0.0, 0.12, 0.24].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now + t);
      osc.frequency.exponentialRampToValueAtTime(135, now + t + 0.06);
      gain.gain.setValueAtTime(0.4, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.09);
    });
  } else {
    [0.0, 0.1, 0.2, 0.3, 0.42].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480 + (i % 2 === 0 ? 130 : 0), now + t);
      gain.gain.setValueAtTime(0.2, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.09);
    });
  }
}

/**
 * Toaster contact sign-in chime
 */
export function playToasterSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.setValueAtTime(1174.66, now + 0.075);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.28);
}

/**
 * Descending logout chime
 */
export function playLogoutSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 987.77, time: 0.00, dur: 0.14 },
    { freq: 739.99, time: 0.13, dur: 0.14 },
    { freq: 493.88, time: 0.26, dur: 0.34 }
  ];

  notes.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.linearRampToValueAtTime(0.18, now + time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + time);
    osc.stop(now + time + dur + 0.04);
  });
}

/**
 * Mobile haptic vibration when receiving a Zumbido
 */
export function vibrateForNudge() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([120, 60, 120, 60, 200]);
    }
  } catch {
    // ignore unsupported browsers
  }
}
