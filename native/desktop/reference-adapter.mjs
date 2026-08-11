import { spawn, spawnSync } from 'node:child_process';
const { createAudioCapturePlan } = await import('../../host/audio.mjs').catch(
  () => import('./host/audio.mjs'),
);
const { createCapturePlan, resolveFfmpegCommand } = await import('../../host/media.mjs').catch(
  () => import('./host/media.mjs'),
);
const { createManagedProcess } = await import('../../host/process.mjs').catch(
  () => import('./host/process.mjs'),
);

const PLATFORMS = new Set(['win32', 'darwin']);

function required(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}
function commandAvailable(command, probe = spawnSync) {
  try {
    const result = probe(command, ['-version'], { stdio: 'ignore', shell: false });
    return !result?.error && result.status === 0;
  } catch {
    return false;
  }
}

function processController({
  plan,
  spawnImpl = spawn,
  processFactory = createManagedProcess,
} = {}) {
  let managed = null;
  return Object.freeze({
    async start() {
      if (managed) throw new Error('desktop media process is already active');
      managed = processFactory({ plan, spawnImpl, stdio: ['ignore', 'pipe', 'pipe'] });
      try {
        await managed.start();
        return Object.freeze({ pid: managed.pid, streams: managed.streams, process: managed });
      } catch (error) {
        managed = null;
        throw error;
      }
    },
    async stop() {
      if (!managed) return null;
      const result = await managed.stop();
      managed = null;
      return result;
    },
    get active() {
      return Boolean(managed);
    },
  });
}

function captureController({ platform, environment, spawnImpl, processFactory }) {
  let controller = null;
  const plan = (options = {}) => {
    if (options.permissionGranted !== true)
      throw new Error(`${platform} screen-capture permission is not granted`);
    const sourceType = platform === 'darwin' ? 'avfoundation' : 'desktop';
    const source = options.source || (platform === 'darwin' ? '1' : 'desktop');
    return createCapturePlan({
      platform,
      sourceType,
      source: required(source, 'capture.source'),
      width: options.width,
      height: options.height,
      framerate: options.framerate,
      audio: false,
      environment: {
        ...environment,
        screenRecordingGranted: platform === 'darwin' ? true : environment.screenRecordingGranted,
      },
    });
  };
  return {
    plan,
    async start(options = {}) {
      controller = processController({ plan: plan(options).process, spawnImpl, processFactory });
      try {
        return await controller.start();
      } catch (error) {
        controller = null;
        throw error;
      }
    },
    async stop() {
      const active = controller;
      controller = null;
      return active?.stop() || null;
    },
  };
}

function audioController({ platform, environment, spawnImpl, processFactory }) {
  let controller = null;
  const plan = (options = {}) => {
    if (options.permissionGranted !== true)
      throw new Error(`${platform} microphone/audio permission is not granted`);
    const backend = platform === 'darwin' ? 'coreaudio' : 'wasapi';
    const source = options.source || 'default';
    return createAudioCapturePlan({
      platform,
      backend,
      source: required(source, 'audio.source'),
      channels: options.channels,
      sampleRate: options.sampleRate,
      environment: { ...environment, microphoneGranted: true },
    });
  };
  return {
    plan,
    async start(options = {}) {
      controller = processController({ plan: plan(options).process, spawnImpl, processFactory });
      try {
        return await controller.start();
      } catch (error) {
        controller = null;
        throw error;
      }
    },
    async stop() {
      const active = controller;
      controller = null;
      return active?.stop() || null;
    },
  };
}

export async function createBindings({
  platform,
  environment = process.env,
  spawnImpl = spawn,
  spawnProbe = spawnSync,
  processFactory = createManagedProcess,
} = {}) {
  if (!PLATFORMS.has(platform))
    throw new TypeError(`unsupported desktop reference platform: ${platform}`);
  const env = { ...environment };
  const ffmpegCommand = resolveFfmpegCommand(env);
  const ffmpeg = commandAvailable(ffmpegCommand, spawnProbe);
  const capture = captureController({ platform, environment: env, spawnImpl, processFactory });
  const audio = audioController({ platform, environment: env, spawnImpl, processFactory });
  return Object.freeze({
    platform,
    capabilities: Object.freeze({
      capture: ffmpeg,
      audio: ffmpeg,
      input: false,
      keyboard: false,
      pointer: false,
      gamepad: false,
      virtualGamepad: false,
      rumble: false,
      technologies: Object.freeze({
        capture: platform === 'darwin' ? 'FFmpeg AVFoundation' : 'FFmpeg gdigrab',
        audio: platform === 'darwin' ? 'FFmpeg AVFoundation/CoreAudio' : 'FFmpeg WASAPI',
      }),
      requires: Object.freeze([
        'screen-capture-permission',
        'microphone-permission',
        'native-input-adapter',
      ]),
    }),
    capture,
    audio,
    async close() {
      await Promise.allSettled([capture.stop(), audio.stop()]);
    },
  });
}
