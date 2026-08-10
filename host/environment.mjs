import {spawnSync} from 'node:child_process';
import {platform, release} from 'node:os';
import {createHostAdapterRegistry} from './adapters.mjs';
import {listCaptureBackends} from './media.mjs';
import {normalizePublisherCapabilities} from './publisher.mjs';
import {normalizeInputAdapterCapabilities} from './input.mjs';
import {listAudioBackends, normalizeAudioCapabilities} from './audio.mjs';
import {createPlatformAdapterRegistry} from './platform-adapters.mjs';
import {loadPlatformNativeBindings} from './native-binding-loader.mjs';
import {loadVirtualGamepadAdapter} from './virtual-gamepad-loader.mjs';
import {createInputAdapterMux} from './input-adapter-mux.mjs';
import {describeVirtualGamepadReadiness, normalizeVirtualGamepadConfig} from './virtual-gamepad-config.mjs';

const NATIVE_PLATFORMS = new Set(['win32', 'darwin', 'linux']);

function commandAvailable(command) { try { return spawnSync(command, ['-version'], {stdio: 'ignore', windowsHide: true}).status === 0; } catch { return false; } }

export function detectHostEnvironment({platformName = platform(), releaseName = release(), commandProbe = commandAvailable, webrtcAdapters = []} = {}) {
  const adapter = createHostAdapterRegistry({platform: platformName}).primary();
  const platformAdapters = createPlatformAdapterRegistry({platform: platformName});
  const ffmpeg = commandProbe('ffmpeg'); const gstreamer = commandProbe(platformName === 'win32' ? 'gst-launch-1.0.exe' : 'gst-launch-1.0');
  const captureBackends = listCaptureBackends(platformName, ffmpeg ? 'ffmpeg' : 'unavailable'); const audioBackends = listAudioBackends(platformName, ffmpeg ? 'ffmpeg' : 'unavailable');
  return Object.freeze({platform: platformName, release: releaseName, adapter: adapter ? {id: adapter.id, kind: adapter.kind, status: adapter.status, technologies: adapter.technologies} : null, platformAdapters: platformAdapters.describe(), tools: Object.freeze({ffmpeg, gstreamer}), captureBackends, audioBackends, webrtc: Object.freeze({adapters: Object.freeze(webrtcAdapters.map(adapter => Object.freeze({id: String(adapter.id), state: String(adapter.state)})))}), publisher: normalizePublisherCapabilities({state: 'unconfigured', requires: ['native-capture-adapter', 'webrtc-publisher']}), audioPublisher: normalizeAudioCapabilities({state: 'unconfigured'}), inputAdapter: normalizeInputAdapterCapabilities({platform: platformName, state: 'unconfigured'}), readiness: Object.freeze({controlPlane: true, processLaunch: true, mediaCapture: false, mediaEncode: Boolean(ffmpeg || gstreamer), osInput: false, audioCapture: Boolean(ffmpeg || gstreamer), tls: false, turn: false, platformAdapters: platformAdapters.list().length > 0})});
}

/**
 * Discover the optional installed platform package and project only its
 * serializable capability descriptor into host health. The binding object is
 * returned separately for host composition and is never exposed in JSON.
 */
export async function detectHostRuntime({platformName = platform(), releaseName = release(), commandProbe = commandAvailable, webrtcAdapters = [], packageName, loader, bindingOptions = {}, virtualGamepadPackageName, virtualGamepadBackend = 'Automatic', virtualGamepadDevice, virtualGamepadDevices, virtualGamepadLoader, virtualGamepadRuntime, allowUnverifiedVirtualGamepad = false, virtualGamepadOptions = {}} = {}) {
  const base = detectHostEnvironment({platformName, releaseName, commandProbe, webrtcAdapters});
  let result;
  try { result = await loadPlatformNativeBindings({platform: platformName, packageName, loader, options: bindingOptions}); }
  catch (error) { result = Object.freeze({status: 'unavailable', platform: platformName, packageName: packageName || null, reason: error.message}); }
  const virtualGamepadConfig = NATIVE_PLATFORMS.has(platformName) ? normalizeVirtualGamepadConfig({platform: platformName, backend: virtualGamepadBackend, packageName: virtualGamepadPackageName, deviceId: virtualGamepadDevice, deviceIds: virtualGamepadDevices}) : Object.freeze({version: 1, platform: platformName, backend: 'Disabled', packageName: null, deviceId: null, deviceIds: Object.freeze([]), compatible: true, requires: Object.freeze([])});
  let virtualResult = Object.freeze({status: 'not-required', platform: platformName, packageName: virtualGamepadConfig.packageName, reason: 'virtual gamepad is not available on this host platform', readiness: Object.freeze({state: 'not-required', reason: null})});
  if (NATIVE_PLATFORMS.has(platformName)) {
    virtualResult = Object.freeze({status: 'unconfigured', platform: platformName, packageName: virtualGamepadConfig.packageName, reason: 'virtual gamepad package is not configured', readiness: describeVirtualGamepadReadiness({config: virtualGamepadConfig})});
    if (virtualGamepadPackageName || virtualGamepadRuntime || ['Disabled', 'Browser Gamepad'].includes(virtualGamepadConfig.backend)) virtualResult = await loadVirtualGamepadAdapter({platform: platformName, config: virtualGamepadConfig, loader: virtualGamepadLoader, runtime: virtualGamepadRuntime, allowUnverified: allowUnverifiedVirtualGamepad, options: virtualGamepadOptions});
  }
  const capabilities = result.status === 'available' ? result.capabilities : {};
  const nativeInput = Boolean(result.status === 'available' && (capabilities.input || capabilities.keyboard || capabilities.pointer || capabilities.gamepad || capabilities.rumble));
  const nativeCapture = Boolean(result.status === 'available' && capabilities.capture);
  const nativeAudio = Boolean(result.status === 'available' && capabilities.audio);
  const virtualInput = virtualResult.status === 'available'; const inputReady = nativeInput || virtualInput;
  const runtimeCapabilities = {...capabilities, virtualGamepad: Boolean(capabilities.virtualGamepad || virtualInput)};
  const runtimePlatformAdapters = createPlatformAdapterRegistry({platform: platformName, capabilities: runtimeCapabilities});
  const nativeBindings = result.bindings || (virtualInput ? {platform: platformName} : null);
  const bindings = nativeBindings ? Object.freeze({...nativeBindings, ...(virtualInput ? {input: createInputAdapterMux({platform: platformName, base: nativeBindings.input || virtualResult.adapter, virtualGamepad: virtualResult.adapter, deviceIds: virtualGamepadConfig.deviceIds})} : {})}) : null;
  const nativeVirtualReady = Boolean(capabilities.virtualGamepad || capabilities.gamepad) && (virtualGamepadConfig.backend === 'Automatic' || virtualGamepadConfig.backend === 'Linux uinput');
  const virtualReadiness = nativeVirtualReady ? Object.freeze({state: 'ready', reason: null}) : virtualResult.readiness;
  const environment = Object.freeze({...base, platformAdapters: runtimePlatformAdapters.describe(), nativeBinding: Object.freeze({status: result.status, platform: result.platform, packageName: result.packageName, reason: result.reason || null, capabilities: Object.freeze({...capabilities})}), virtualGamepadConfig, virtualGamepadBinding: Object.freeze({status: virtualResult.status, platform: virtualResult.platform, packageName: virtualResult.packageName, reason: virtualResult.reason || null, capabilities: Object.freeze({...virtualResult.capabilities}), readiness: virtualReadiness}), inputAdapter: normalizeInputAdapterCapabilities({platform: platformName, state: inputReady ? 'ready' : 'unconfigured', keyboard: Boolean(capabilities.keyboard), pointer: Boolean(capabilities.pointer), gamepad: Boolean(capabilities.gamepad || virtualInput), virtualGamepad: Boolean(runtimeCapabilities.virtualGamepad), rumble: Boolean(capabilities.rumble)}), readiness: Object.freeze({...base.readiness, mediaCapture: nativeCapture, osInput: inputReady, audioCapture: nativeAudio, virtualGamepad: virtualReadiness.state === 'ready'})});
  return Object.freeze({environment, bindings});
}
