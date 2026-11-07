// Procedural MSN Messenger 7.5 Sound Effects using Web Audio API
// 100% self-contained, no external MP3 dependencies, instant playback

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function initAudio() {
  getAudioContext();
}

/**
 * Authentic MSN Messenger Login Chime (tuk-tu-tu-tu)
 * A signature ascending sequence of 4 warm, bright bell chimes
 */
export function playLoginSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 523.25, time: 0.00, dur: 0.14 }, // C5
    { freq: 659.25, time: 0.12, dur: 0.14 }, // E5
    { freq: 783.99, time: 0.24, dur: 0.16 }, // G5
    { freq: 1046.50, time: 0.38, dur: 0.45 } // C6
  ];

  notes.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    // Warm bell-like envelope
    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.linearRampToValueAtTime(0.28, now + time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + time);
    osc.stop(now + time + dur + 0.05);
  });
}

/**
 * The Iconic MSN Incoming Message "Ding"
 * Crisp dual-harmonic bell notification
 */
export function playMessageSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // Primary high bell tone
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(1480, now); // F#6
  
  gain1.gain.setValueAtTime(0.0001, now);
  gain1.gain.linearRampToValueAtTime(0.35, now + 0.008);
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);

  osc1.start(now);
  osc1.stop(now + 0.38);

  // Secondary undertone chime
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(880, now); // A5

  gain2.gain.setValueAtTime(0.0001, now);
  gain2.gain.linearRampToValueAtTime(0.18, now + 0.01);
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);

  osc2.start(now);
  osc2.stop(now + 0.28);
}

/**
 * MSN Zumbido (Nudge)
 * Low rumble vibration followed by the urgent double-strike alarm chime
 */
export function playNudgeSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Rumble motor vibration
  const rumbleOsc = ctx.createOscillator();
  const rumbleGain = ctx.createGain();
  rumbleOsc.type = 'sawtooth';
  rumbleOsc.frequency.setValueAtTime(65, now);
  rumbleOsc.frequency.linearRampToValueAtTime(50, now + 0.28);

  rumbleGain.gain.setValueAtTime(0.0001, now);
  rumbleGain.gain.linearRampToValueAtTime(0.3, now + 0.02);
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  rumbleOsc.connect(rumbleGain);
  rumbleGain.connect(ctx.destination);

  rumbleOsc.start(now);
  rumbleOsc.stop(now + 0.32);

  // 2. Urgent Nudge Dings (Double impact)
  const impacts = [0.08, 0.22];
  impacts.forEach((timeOffset) => {
    const dingOsc = ctx.createOscillator();
    const dingGain = ctx.createGain();
    dingOsc.type = 'sine';
    dingOsc.frequency.setValueAtTime(1174.66, now + timeOffset); // D6

    dingGain.gain.setValueAtTime(0.0001, now + timeOffset);
    dingGain.gain.linearRampToValueAtTime(0.35, now + timeOffset + 0.005);
    dingGain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.26);

    dingOsc.connect(dingGain);
    dingGain.connect(ctx.destination);

    dingOsc.start(now + timeOffset);
    dingOsc.stop(now + timeOffset + 0.28);
  });
}

/**
 * MSN Wink / Guiño Sound
 * Whimsical pop and cartoon glissando
 */
export function playWinkSound(winkType = 'laugh') {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (winkType === 'water') {
    // Water splash: noise + downward sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.4);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  } else if (winkType === 'kiss') {
    // Pop / Smack sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.12);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  } else if (winkType === 'knock') {
    // Triple knock on glass
    [0.0, 0.12, 0.24].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(350, now + t);
      osc.frequency.exponentialRampToValueAtTime(140, now + t + 0.06);

      gain.gain.setValueAtTime(0.45, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.09);
    });
  } else {
    // Laugh: series of rapid staccato chirps
    [0.0, 0.1, 0.2, 0.3, 0.42].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(500 + (i % 2 === 0 ? 120 : 0), now + t);

      gain.gain.setValueAtTime(0.22, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.09);
    });
  }
}

/**
 * Contact Sign-In Toaster Notification Chime
 */
export function playToasterSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1046.5, now); // C6
  osc.frequency.setValueAtTime(1318.5, now + 0.07); // E6

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.28);
}

/**
 * Logout descending chime
 */
export function playLogoutSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [
    { freq: 1046.50, time: 0.00, dur: 0.15 },
    { freq: 783.99, time: 0.14, dur: 0.15 },
    { freq: 523.25, time: 0.28, dur: 0.35 }
  ];

  notes.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.linearRampToValueAtTime(0.2, now + time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + time);
    osc.stop(now + time + dur + 0.05);
  });
}
