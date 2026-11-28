// Original Procedural 2005 Retro Sound Engine using Web Audio API
// 100% original melodies & effects, zero external MP3 dependencies

const MUTED_STORAGE_KEY = 'zumbido05_muted';

function readStoredMuted() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let audioCtx = null;
let muted = readStoredMuted();

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
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MUTED_STORAGE_KEY, muted ? '1' : '0');
    }
  } catch {
    // ignore storage errors
  }
  if (muted) {
    stopTrackLoop();
  }
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
  } else if (winkType === 'hearts') {
    [523.25, 659.25, 783.99, 987.77, 1046.5].forEach((freq, i) => {
      const t = i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + t);
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.linearRampToValueAtTime(0.2, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.3);
    });
  } else if (winkType === 'party') {
    [587.33, 739.99, 880, 1174.66, 880, 1174.66].forEach((freq, i) => {
      const t = i * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 === 0 ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(freq, now + t);
      gain.gain.setValueAtTime(0.14, now + t);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.18);
    });
  } else if (winkType === 'lightning') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.42);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.47);
  } else if (winkType === 'clap') {
    [0.0, 0.11, 0.22, 0.33, 0.44].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(640 + (i % 2) * 140, now + t);
      osc.frequency.exponentialRampToValueAtTime(190, now + t + 0.05);
      gain.gain.setValueAtTime(0.24, now + t);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.07);
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

// ========================
// REPRODUCTOR 05 SYNTH ENGINE
// ========================

export const REPRODUCTOR_TRACKS = [
  {
    id: 'neon-cyber',
    title: 'Neon Cybercafé 2005',
    artist: 'Zumbido Beats',
    statusText: 'Zumbido Beats - Neon Cybercafé 2005',
    bpm: 118,
    wave: 'triangle',
    notes: [523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 587.33],
    bass: [130.81, 130.81, 164.81, 164.81, 174.61, 174.61, 146.83, 196.0],
  },
  {
    id: 'msn-chill',
    title: 'Conexión ADSL Nocturna',
    artist: 'Lo-Fi 2005',
    statusText: 'Lo-Fi 2005 - Conexión ADSL Nocturna',
    bpm: 92,
    wave: 'sine',
    notes: [440.0, 523.25, 659.25, 587.33, 523.25, 493.88, 440.0, 392.0],
    bass: [110.0, 110.0, 130.81, 130.81, 146.83, 146.83, 130.81, 98.0],
  },
  {
    id: 'xp-dance',
    title: 'Eurodance Messenger Mix',
    artist: 'DJ Zumbido',
    statusText: 'DJ Zumbido - Eurodance Messenger Mix',
    bpm: 132,
    wave: 'sawtooth',
    notes: [587.33, 587.33, 739.99, 880.0, 739.99, 987.77, 880.0, 739.99],
    bass: [146.83, 293.66, 146.83, 293.66, 123.47, 246.94, 164.81, 220.0],
  },
  {
    id: 'xp-lounge',
    title: 'Atardecer Bliss XP',
    artist: 'Retro Wave',
    statusText: 'Retro Wave - Atardecer Bliss XP',
    bpm: 100,
    wave: 'sine',
    notes: [659.25, 783.99, 987.77, 880.0, 783.99, 659.25, 587.33, 659.25],
    bass: [164.81, 164.81, 196.0, 196.0, 146.83, 146.83, 130.81, 146.83],
  },
  {
    id: 'arcade-8bit',
    title: 'Arcade Break (8-Bit)',
    artist: 'ChipTune 05',
    statusText: 'ChipTune 05 - Arcade Break',
    bpm: 128,
    wave: 'square',
    notes: [523.25, 783.99, 1046.5, 783.99, 659.25, 880.0, 987.77, 783.99],
    bass: [130.81, 196.0, 130.81, 196.0, 174.61, 220.0, 196.0, 146.83],
  },
];

let musicState = {
  isPlaying: false,
  trackIndex: 0,
  volume: 0.45,
  step: 0,
};
let musicTimer = null;
const musicListeners = new Set();

function emitMusicState() {
  const snapshot = {
    ...musicState,
    track: REPRODUCTOR_TRACKS[musicState.trackIndex] || REPRODUCTOR_TRACKS[0],
  };
  musicListeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {
      // ignore subscriber errors
    }
  });
}

export function subscribeMusicState(listener) {
  musicListeners.add(listener);
  listener({
    ...musicState,
    track: REPRODUCTOR_TRACKS[musicState.trackIndex] || REPRODUCTOR_TRACKS[0],
  });
  return () => musicListeners.delete(listener);
}

export function getMusicState() {
  return {
    ...musicState,
    track: REPRODUCTOR_TRACKS[musicState.trackIndex] || REPRODUCTOR_TRACKS[0],
  };
}

export function setMusicVolume(vol) {
  const clamped = Math.max(0, Math.min(1, Number(vol) || 0));
  musicState = { ...musicState, volume: clamped };
  emitMusicState();
}

export function stopTrackLoop() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  if (musicState.isPlaying) {
    musicState = { ...musicState, isPlaying: false };
    emitMusicState();
  }
}

function playMusicStep() {
  if (muted || !musicState.isPlaying) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const track = REPRODUCTOR_TRACKS[musicState.trackIndex] || REPRODUCTOR_TRACKS[0];
  const stepIdx = musicState.step % track.notes.length;
  const leadFreq = track.notes[stepIdx];
  const bassFreq = track.bass[stepIdx];
  const stepSec = 60 / track.bpm / 2;
  const now = ctx.currentTime;
  const master = Math.max(0.02, musicState.volume * 0.16);

  // Lead voice
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = track.wave;
  osc.frequency.setValueAtTime(leadFreq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(master, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + stepSec * 0.92);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + stepSec);

  // Bass voice
  const bassOsc = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bassOsc.type = 'triangle';
  bassOsc.frequency.setValueAtTime(bassFreq, now);
  bassGain.gain.setValueAtTime(0.0001, now);
  bassGain.gain.linearRampToValueAtTime(master * 0.8, now + 0.015);
  bassGain.gain.exponentialRampToValueAtTime(0.0001, now + stepSec * 0.9);
  bassOsc.connect(bassGain);
  bassGain.connect(ctx.destination);
  bassOsc.start(now);
  bassOsc.stop(now + stepSec);

  musicState = { ...musicState, step: (musicState.step + 1) % track.notes.length };
  emitMusicState();
}

export function startTrackLoop(trackIndex = musicState.trackIndex) {
  if (muted) {
    setSoundMuted(false);
  }
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
  const safeIndex = ((Number(trackIndex) || 0) % REPRODUCTOR_TRACKS.length + REPRODUCTOR_TRACKS.length) % REPRODUCTOR_TRACKS.length;
  const track = REPRODUCTOR_TRACKS[safeIndex];
  const intervalMs = Math.max(150, Math.round((60 / track.bpm / 2) * 1000));
  musicState = { ...musicState, isPlaying: true, trackIndex: safeIndex, step: 0 };
  emitMusicState();
  playMusicStep();
  musicTimer = setInterval(playMusicStep, intervalMs);
}
