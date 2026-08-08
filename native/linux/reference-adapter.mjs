import {spawn, spawnSync} from 'node:child_process';
const {createAudioCapturePlan} = await import('../../host/audio.mjs').catch(() => import('./host/audio.mjs'));
const {createCapturePlan} = await import('../../host/media.mjs').catch(() => import('./host/media.mjs'));
const {createManagedProcess} = await import('../../host/process.mjs').catch(() => import('./host/process.mjs'));

const PLATFORM = 'linux';
const DEFAULT_ENVIRONMENT = process.env;

function commandAvailable(command, probe = spawnSync) {
  try {
    const result = probe(command, ['-version'], {stdio: 'ignore', shell: false});
    return !result?.error && result.status === 0;
  } catch {
    return false;
  }
}

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}

function keyName(control) {
  const value = required(control, 'input.control');
  if (/^Key[A-Z]$/.test(value)) return value.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(value)) return value.slice(5);
  return ({Space: 'space', Enter: 'Return', Escape: 'Escape', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Tab: 'Tab', Backspace: 'BackSpace'}[value] || value).toLowerCase();
}

function inputCommand(operation) {
  if (operation.kind === 'pointer') {
    const dx = Math.round(Number(operation.deltaX) || 0);
    const dy = Math.round(Number(operation.deltaY) || 0);
    const button = {'button-0': '1', 'button-1': '2', 'button-2': '3'}[operation.control];
    if (operation.action === 'pointer:wheel') {
      const wheel = dy < 0 ? '4' : dy > 0 ? '5' : dx < 0 ? '6' : dx > 0 ? '7' : null;
      if (!wheel) return null;
      return {args: ['click', wheel]};
    }
    if (operation.action === 'pointer:down' || operation.action === 'pointer:up' || operation.action === 'pointer:cancel') {
      if (!button) throw new Error('Linux reference input adapter does not implement this mouse button');
      return {args: [operation.action === 'pointer:down' ? 'mousedown' : 'mouseup', button]};
    }
    if (!dx && !dy) return null;
    return {args: ['mousemove_relative', '--', String(dx), String(dy)]};
  }
  if (operation.kind === 'key') {
    const action = operation.pressed === false || operation.action === 'release' ? 'keyup' : 'keydown';
    return {args: [action, keyName(operation.control)]};
  }
  throw new Error(`Linux reference input adapter does not implement ${operation.kind} events`);
}

function processController({plan, spawnImpl = spawn, processFactory = createManagedProcess} = {}) {
  let managed = null;
  return Object.freeze({
    async start() {
      if (managed) throw new Error('Linux reference media process is already active');
      managed = processFactory({plan, spawnImpl, stdio: ['ignore', 'pipe', 'pipe']});
      try { await managed.start(); return Object.freeze({pid: managed.pid, streams: managed.streams, process: managed}); }
      catch (error) { managed = null; throw error; }
    },
    async stop() { if (!managed) return null; const result = await managed.stop(); managed = null; return result; },
    get active() { return Boolean(managed); },
  });
}

function captureController({environment, spawnImpl, processFactory}) {
  let controller = null;
  const plan = (options = {}) => {
    if (options.permissionGranted !== true) throw new Error('Linux screen-capture permission is not granted');
    const sourceType = options.sourceType || (environment.WAYLAND_DISPLAY || environment.XDG_RUNTIME_DIR ? 'pipewire' : 'x11');
    const source = options.source || (sourceType === 'x11' ? `${required(environment.DISPLAY, 'environment.DISPLAY')}+0,0` : 'default');
    return createCapturePlan({platform: PLATFORM, sourceType, source, width: options.width, height: options.height, framerate: options.framerate, audio: false, environment});
  };
  return {
    plan,
    async start(options = {}) {
      controller = processController({plan: plan(options).process, spawnImpl, processFactory});
      try { return await controller.start(); } catch (error) { controller = null; throw error; }
    },
    async stop() { const active = controller; controller = null; return active?.stop() || null; },
  };
}

function audioController({environment, spawnImpl, processFactory}) {
  let controller = null;
  const plan = (options = {}) => {
    if (options.permissionGranted !== true) throw new Error('Linux audio-capture permission is not granted');
    const backend = options.backend || (environment.WAYLAND_DISPLAY || environment.XDG_RUNTIME_DIR ? 'pipewire' : 'pulse');
    return createAudioCapturePlan({platform: PLATFORM, backend, source: options.source || 'default', channels: options.channels, sampleRate: options.sampleRate, environment});
  };
  return {
    plan,
    async start(options = {}) {
      controller = processController({plan: plan(options).process, spawnImpl, processFactory});
      try { return await controller.start(); } catch (error) { controller = null; throw error; }
    },
    async stop() { const active = controller; controller = null; return active?.stop() || null; },
  };
}

/**
 * Build the Linux reference binding used by local development and host
 * integration tests. It uses no shell: media is launched through FFmpeg's
 * validated process plans and X11 input through xdotool argument arrays.
 * Production distribution still requires a signed native package with a
 * portal/uinput implementation and should not treat this as a package release.
 */
export async function createBindings({environment = DEFAULT_ENVIRONMENT, spawnImpl = spawn, spawnProbe = spawnSync, processFactory = createManagedProcess} = {}) {
  const env = {...environment};
  const ffmpeg = commandAvailable('ffmpeg', spawnProbe);
  const xdotool = commandAvailable('xdotool', spawnProbe);
  const hasDisplay = Boolean(env.DISPLAY);
  const hasPipewireSession = Boolean(env.WAYLAND_DISPLAY || env.XDG_RUNTIME_DIR);
  const captureReady = ffmpeg && (hasDisplay || hasPipewireSession);
  const audioReady = ffmpeg && (hasPipewireSession || commandAvailable('pactl', spawnProbe));
  const inputReady = xdotool && hasDisplay;
  const capture = captureController({environment: env, spawnImpl, processFactory});
  const audio = audioController({environment: env, spawnImpl, processFactory});
  const input = {
    async execute(operation) {
      if (!inputReady) throw new Error('Linux X11 input adapter is unavailable');
      const command = inputCommand(operation);
      if (!command) return;
      await new Promise((resolve, reject) => {
        const child = spawnImpl('xdotool', command.args, {shell: false, stdio: 'ignore'});
        child.once?.('error', reject);
        child.once?.('close', code => code === 0 ? resolve() : reject(new Error(`xdotool exited with status ${code}`)));
      });
    },
    close() {},
  };
  return Object.freeze({platform: PLATFORM, capabilities: Object.freeze({capture: captureReady, audio: audioReady, input: inputReady, keyboard: inputReady, pointer: inputReady, gamepad: false, rumble: false, technologies: Object.freeze({capture: 'FFmpeg x11grab/PipeWire', audio: 'FFmpeg Pulse/PipeWire', input: 'X11 XTest via xdotool'}), requires: Object.freeze(['screen-capture-permission', 'audio-session-permission', 'remote-input-permission'])}), capture, audio, input, async close() { await Promise.allSettled([capture.stop(), audio.stop()]); input.close(); }});
}

export {inputCommand};
