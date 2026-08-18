/**
 * Spartan Gaming — lightweight UI sound effects using Web Audio API.
 * No external audio files needed; all sounds are synthesized.
 */

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', volume = 0.08) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration, volume = 0.03) {
  const ctx = getCtx();
  if (!ctx) return;
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3000;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime);
  source.stop(ctx.currentTime + duration);
}

/** Subtle hover tick — quick high-frequency blip */
export function hover() {
  playTone(2800, 0.06, 'sine', 0.05);
  playNoise(0.04, 0.02);
}

/** Focus navigation — slightly deeper tone */
export function focus() {
  playTone(1800, 0.1, 'sine', 0.06);
}

/** Click / select — two-tone confirmation */
export function click() {
  playTone(1200, 0.08, 'sine', 0.07);
  setTimeout(() => playTone(1600, 0.1, 'sine', 0.07), 50);
}

/** Back / cancel — descending tone */
export function back() {
  playTone(1600, 0.08, 'sine', 0.06);
  setTimeout(() => playTone(1100, 0.1, 'sine', 0.06), 60);
}

/** Error / warning — low buzz */
export function error() {
  playTone(220, 0.2, 'sawtooth', 0.06);
  playTone(250, 0.15, 'square', 0.04);
}

/** Success / complete — ascending chime */
export function success() {
  playTone(800, 0.1, 'sine', 0.06);
  setTimeout(() => playTone(1000, 0.1, 'sine', 0.06), 80);
  setTimeout(() => playTone(1400, 0.15, 'sine', 0.07), 160);
}

/** Rail scroll tick — very short subtle click */
export function scrollTick() {
  playTone(3200, 0.03, 'sine', 0.03);
}

/**
 * Initialize sound system. Call once on user interaction to satisfy
 * browser autoplay policy. Attaches to all interactive elements.
 */
export function initSounds() {
  if (document.documentElement.dataset.spartanSounds === 'ready') return;
  document.documentElement.dataset.spartanSounds = 'ready';

  document.addEventListener(
    'mouseover',
    (e) => {
      if (e.target.closest('button, a, [role="button"], select, input[type="checkbox"], input[type="radio"]')) {
        hover();
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'focusin',
    (e) => {
      if (e.target.closest('button, a, [role="button"], select, input, textarea, [tabindex]')) {
        focus();
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'click',
    (e) => {
      if (e.target.closest('button, a, [role="button"], select, input[type="checkbox"], input[type="radio"]')) {
        click();
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') back();
      if (e.key === 'Enter' || e.key === ' ') {
        const active = document.activeElement;
        if (active && active.closest('button, a, [role="button"]')) click();
      }
    },
    { passive: true }
  );
}
