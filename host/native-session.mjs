import {normalizeAudioCapabilities} from './audio.mjs';
import {normalizeInputAdapterCapabilities} from './input.mjs';
import {normalizePublisherCapabilities} from './publisher.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);

function requiredComponent(value, name) { if (!value || typeof value.start !== 'function' || typeof value.stop !== 'function') throw new TypeError(`${name} must implement start() and stop()`); return value; }

/** Compose native media, audio, and input lifecycles without owning OS APIs. */
export function createNativeHostSession({platform, mediaPublisher, audioPublisher = null, inputExecutor = null, requireAudio = false} = {}) {
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported native session platform: ${platform}`);
  requiredComponent(mediaPublisher, 'mediaPublisher');
  if (audioPublisher) requiredComponent(audioPublisher, 'audioPublisher');
  if (requireAudio && !audioPublisher) throw new TypeError('audioPublisher is required when requireAudio is enabled');
  if (inputExecutor && typeof inputExecutor.dispatch !== 'function') throw new TypeError('inputExecutor must implement dispatch(event)');
  let state = 'idle'; let startedMedia = false; let startedAudio = false;
  const capabilities = () => Object.freeze({platform, state, media: normalizePublisherCapabilities(mediaPublisher.capabilities || {state: state === 'active' ? 'active' : 'unconfigured'}), audio: normalizeAudioCapabilities(audioPublisher?.capabilities || {state: 'unconfigured'}), input: normalizeInputAdapterCapabilities({platform, state: inputExecutor?.state || 'unconfigured'})});
  const session = {
    get state() { return state; },
    get capabilities() { return capabilities(); },
    async start() {
      if (state !== 'idle') throw new Error(`native host session cannot start from ${state}`);
      state = 'preparing';
      try { await mediaPublisher.start(); startedMedia = true; if (audioPublisher) { await audioPublisher.start(); startedAudio = true; } state = 'active'; return this; }
      catch (error) { state = 'failed'; if (startedAudio) await audioPublisher.stop().catch(() => {}); if (startedMedia) await mediaPublisher.stop().catch(() => {}); throw error; }
    },
    async dispatchInput(event) { if (state !== 'active') throw new Error(`native host session is ${state}`); if (!inputExecutor) throw new Error('native input executor is not configured'); return inputExecutor.dispatch(event); },
    async stop() { if (state === 'stopped' || state === 'idle') { state = 'stopped'; return this; } state = 'stopping'; if (inputExecutor?.close) inputExecutor.close(); if (startedAudio) await audioPublisher.stop(); if (startedMedia) await mediaPublisher.stop(); state = 'stopped'; return this; },
  };
  return Object.freeze(session);
}
