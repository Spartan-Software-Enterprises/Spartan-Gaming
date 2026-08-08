import {spawn, spawnSync} from 'node:child_process';
const {createAudioCapturePlan, listAudioCaptureDevices} = await import('../../host/audio.mjs').catch(() => import('./host/audio.mjs'));
const {createCapturePlan, createFfmpegEncoderProbe, selectHardwareEncoder} = await import('../../host/media.mjs').catch(() => import('./host/media.mjs'));
const {createManagedProcess} = await import('../../host/process.mjs').catch(() => import('./host/process.mjs'));

const PLATFORM = 'linux';
const DEFAULT_ENVIRONMENT = process.env;

const PORTAL_KINDS = Object.freeze({capture: 'org.freedesktop.portal.ScreenCast', audio: 'org.freedesktop.portal.ScreenCast'});

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

function unsupported(message) {
  const error = new Error(message);
  error.code = 'ERR_UNSUPPORTED_INPUT';
  return error;
}

/** Parse `xrandr --query` output into a bounded display descriptor (HDR is never claimed on X11). */
export function probeX11Display(output = '') {
  const lines = String(output).split('\n');
  const screen = lines.find(line => line.includes('current'));
  const currentMode = lines.find(line => line.includes('*'));
  const resolution = screen?.match(/current\s+(\d+)\s*x\s*(\d+)/);
  const refresh = currentMode?.match(/(\d+(?:\.\d+)?)\s*\*+/);
  if (!resolution) return null;
  return Object.freeze({
    width: Number(resolution[1]),
    height: Number(resolution[2]),
    maxRefreshRate: refresh ? Math.round(Number(refresh[1])) : null,
    count: lines.filter(line => line.includes(' connected ')).length,
    hdr: false,
  });
}

function createX11DisplayProbe(probe) {
  const result = probe('xrandr', ['--query'], {encoding: 'utf8'});
  return result?.error ? null : probeX11Display(String(result.stdout || ''));
}

function keyName(control) {
  const value = required(control, 'input.control');
  if (/^Key[A-Z]$/.test(value)) return value.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(value)) return value.slice(5);
  const keysym = {Space: 'space', Enter: 'Return', Escape: 'Escape', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Tab: 'Tab', Backspace: 'BackSpace', Comma: 'comma', Period: 'period', Semicolon: 'semicolon', Quote: 'apostrophe', Backquote: 'grave', Slash: 'slash', Backslash: 'backslash', IntlBackslash: 'backslash', IntlRo: 'backslash', IntlYen: 'yen', Minus: 'minus', Equal: 'equal', BracketLeft: 'bracketleft', BracketRight: 'bracketright', ControlLeft: 'Control_L', ControlRight: 'Control_R', ShiftLeft: 'Shift_L', ShiftRight: 'Shift_R', AltLeft: 'Alt_L', AltRight: 'Alt_R', MetaLeft: 'Super_L', MetaRight: 'Super_R', CapsLock: 'Caps_Lock', Home: 'Home', End: 'End', PageUp: 'Page_Up', PageDown: 'Page_Down', Insert: 'Insert', Delete: 'Delete', F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6', F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12', F13: 'F13', F14: 'F14', F15: 'F15', F16: 'F16', F17: 'F17', F18: 'F18', F19: 'F19', F20: 'F20', F21: 'F21', F22: 'F22', F23: 'F23', F24: 'F24', NumLock: 'Num_Lock', PrintScreen: 'Print', ScrollLock: 'Scroll_Lock', Pause: 'Pause', ContextMenu: 'Menu', Numpad0: 'KP_0', Numpad1: 'KP_1', Numpad2: 'KP_2', Numpad3: 'KP_3', Numpad4: 'KP_4', Numpad5: 'KP_5', Numpad6: 'KP_6', Numpad7: 'KP_7', Numpad8: 'KP_8', Numpad9: 'KP_9', NumpadDecimal: 'KP_Decimal', NumpadAdd: 'KP_Add', NumpadSubtract: 'KP_Subtract', NumpadMultiply: 'KP_Multiply', NumpadDivide: 'KP_Divide', NumpadEnter: 'KP_Enter', AudioVolumeMute: 'XF86AudioMute', AudioVolumeDown: 'XF86AudioLowerVolume', AudioVolumeUp: 'XF86AudioRaiseVolume', MediaTrackNext: 'XF86AudioNext', MediaTrackPrevious: 'XF86AudioPrev', MediaStop: 'XF86AudioStop', MediaPlayPause: 'XF86AudioPlay', MediaSelect: 'XF86AudioMedia', BrowserBack: 'XF86Back', BrowserForward: 'XF86Forward', BrowserRefresh: 'XF86Refresh', BrowserStop: 'XF86Stop', BrowserSearch: 'XF86Search', BrowserFavorites: 'XF86Favorites', BrowserHome: 'XF86HomePage', LaunchMail: 'XF86Mail', LaunchApp1: 'XF86Launch1', LaunchApp2: 'XF86Launch2', Sleep: 'XF86Sleep', WakeUp: 'XF86WakeUp', Print: 'Print', Select: 'Select', Execute: 'Execute', Help: 'Help'}[value];
  if (!keysym) throw unsupported(`Linux X11 reference does not support key ${value}`);
  return keysym;
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
      if (!button) throw unsupported(`Linux X11 reference does not support mouse button ${operation.control}`);
      return {args: [operation.action === 'pointer:down' ? 'mousedown' : 'mouseup', button]};
    }
    if (!dx && !dy) return null;
    return {args: ['mousemove_relative', '--', String(dx), String(dy)]};
  }
  if (operation.kind === 'key') {
    const action = operation.pressed === false || operation.action === 'release' ? 'keyup' : 'keydown';
    return {args: [action, keyName(operation.control)]};
  }
  throw unsupported(`Linux X11 reference does not support ${operation.kind} input`);
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

function portalEnvironmentAvailable(environment) {
  return Boolean(environment.XDG_RUNTIME_DIR && environment.DBUS_SESSION_BUS_ADDRESS);
}

function portalServiceAvailable(environment, probe) {
  if (!portalEnvironmentAvailable(environment)) return false;
  if (environment.SPARTAN_PORTAL_AVAILABLE !== undefined) return environment.SPARTAN_PORTAL_AVAILABLE === true;
  return commandAvailable('xdg-desktop-portal', probe);
}

/**
 * Dependency-free xdg-desktop-portal consent boundary. It never opens a real
 * portal dialog; it reports whether the portal session is reachable and models
 * the explicit consent grant an operator or portal would provide. Capture and
 * audio plans require the matching consent before a process plan is returned.
 */
function createPortalConsent({environment = DEFAULT_ENVIRONMENT, probe = spawnSync} = {}) {
  const available = portalServiceAvailable(environment, probe);
  const grants = new Set();
  return Object.freeze({
    get available() { return available; },
    get status() { return available ? (grants.size ? 'granted' : 'available') : 'unavailable'; },
    get grantedKinds() { return Object.freeze([...grants]); },
    request(kind) {
      if (!PORTAL_KINDS[kind]) throw new TypeError(`unsupported portal consent kind: ${kind}`);
      if (!available) throw new Error('xdg-desktop-portal is not reachable; screen/audio capture consent cannot be requested');
      grants.add(kind);
      return Object.freeze({kind, granted: true, portal: PORTAL_KINDS[kind]});
    },
    revoke(kind) { if (!kind) { grants.clear(); return; } grants.delete(kind); },
    granted(kind) { return grants.has(kind); },
    requires: Object.freeze(Object.keys(PORTAL_KINDS)),
  });
}

function captureController({environment, spawnImpl, processFactory, consent}) {
  let controller = null;
  const plan = (options = {}) => {
    if (options.permissionGranted !== true && !consent.granted('capture')) throw new Error('Linux screen-capture permission is not granted');
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

function audioController({environment, spawnImpl, processFactory, consent, spawnProbe}) {
  let controller = null;
  const backendFor = options => options.backend || (environment.WAYLAND_DISPLAY || environment.XDG_RUNTIME_DIR ? 'pipewire' : 'pulse');
  const plan = (options = {}) => {
    if (options.permissionGranted !== true && !consent.granted('audio')) throw new Error('Linux audio-capture permission is not granted');
    const backend = backendFor(options);
    return createAudioCapturePlan({platform: PLATFORM, backend, source: options.source || 'default', channels: options.channels, sampleRate: options.sampleRate, environment});
  };
  const devices = (options = {}) => listAudioCaptureDevices({platform: PLATFORM, backend: backendFor(options), includeMonitors: options.includeMonitors === true, run: (command, args) => { const result = spawnProbe(command, args, {encoding: 'utf8'}); return result?.error ? null : String(result.stdout || ''); }});
  return {
    plan,
    devices,
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
  const consent = createPortalConsent({environment: env, probe: spawnProbe});
  const display = hasDisplay ? createX11DisplayProbe(spawnProbe) : null;
  const encoderProbe = ffmpeg ? createFfmpegEncoderProbe({command: 'ffmpeg', run: (command, args, options) => { const result = spawnSync(command, args, {encoding: 'utf8', ...options}); return result?.error ? null : String(result.stdout || ''); }}) : () => false;
  const encoders = Object.freeze(['h264', 'vp9', 'av1'].flatMap(codec => { const selected = selectHardwareEncoder({codec, platform: PLATFORM, probe: encoderProbe}); return selected ? [Object.freeze({codec, encoder: selected.encoder, device: selected.device})] : []; }));
  const capture = captureController({environment: env, spawnImpl, processFactory, consent});
  const audio = audioController({environment: env, spawnImpl, processFactory, consent, spawnProbe});
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
  return Object.freeze({platform: PLATFORM, consent, display, capabilities: Object.freeze({capture: captureReady, audio: audioReady, input: inputReady, keyboard: inputReady, pointer: inputReady, gamepad: false, rumble: false, portal: consent.available, encoders: Object.freeze({hardware: encoders}), technologies: Object.freeze({capture: 'FFmpeg x11grab/PipeWire', audio: 'FFmpeg Pulse/PipeWire', input: 'X11 XTest via xdotool'}), requires: Object.freeze(['screen-capture-permission', 'audio-session-permission', 'remote-input-permission'])}), capture, audio, input, async close() { await Promise.allSettled([capture.stop(), audio.stop()]); input.close(); }});
}

export {inputCommand, keyName};
