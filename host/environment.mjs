import {spawnSync} from 'node:child_process';
import {platform, release} from 'node:os';
import {createHostAdapterRegistry} from './adapters.mjs';
import {listCaptureBackends} from './media.mjs';
import {normalizePublisherCapabilities} from './publisher.mjs';
import {normalizeInputAdapterCapabilities} from './input.mjs';
import {listAudioBackends, normalizeAudioCapabilities} from './audio.mjs';
import {createPlatformAdapterRegistry} from './platform-adapters.mjs';

function commandAvailable(command) { try { return spawnSync(command, ['-version'], {stdio: 'ignore', windowsHide: true}).status === 0; } catch { return false; } }

export function detectHostEnvironment({platformName = platform(), releaseName = release(), commandProbe = commandAvailable, webrtcAdapters = []} = {}) {
  const adapter = createHostAdapterRegistry({platform: platformName}).primary();
  const platformAdapters = createPlatformAdapterRegistry({platform: platformName});
  const ffmpeg = commandProbe('ffmpeg'); const gstreamer = commandProbe(platformName === 'win32' ? 'gst-launch-1.0.exe' : 'gst-launch-1.0');
  const captureBackends = listCaptureBackends(platformName, ffmpeg ? 'ffmpeg' : 'unavailable'); const audioBackends = listAudioBackends(platformName, ffmpeg ? 'ffmpeg' : 'unavailable');
  return Object.freeze({platform: platformName, release: releaseName, adapter: adapter ? {id: adapter.id, kind: adapter.kind, status: adapter.status, technologies: adapter.technologies} : null, platformAdapters: platformAdapters.describe(), tools: Object.freeze({ffmpeg, gstreamer}), captureBackends, audioBackends, webrtc: Object.freeze({adapters: Object.freeze(webrtcAdapters.map(adapter => Object.freeze({id: String(adapter.id), state: String(adapter.state)})))}), publisher: normalizePublisherCapabilities({state: 'unconfigured', requires: ['native-capture-adapter', 'webrtc-publisher']}), audioPublisher: normalizeAudioCapabilities({state: 'unconfigured'}), inputAdapter: normalizeInputAdapterCapabilities({platform: platformName, state: 'unconfigured'}), readiness: Object.freeze({controlPlane: true, processLaunch: true, mediaCapture: false, mediaEncode: Boolean(ffmpeg || gstreamer), osInput: false, audioCapture: Boolean(ffmpeg || gstreamer), tls: false, turn: false, platformAdapters: platformAdapters.list().length > 0})});
}
