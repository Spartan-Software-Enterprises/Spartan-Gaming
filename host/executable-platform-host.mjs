import {createNativeInputExecutor} from './input.mjs';
import {createNativeMediaPipeline} from './native-media.mjs';
import {createNativeHostSession} from './native-session.mjs';
import {createRtpAudioPublisher} from './audio.mjs';
import {createRtpMediaPublisher} from './publisher.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);

/** Compose platform plans and injected OS/transport adapters into one host. */
export function createExecutablePlatformHost({platform, plans, pipeline = null, packetizer, transport, inputAdapter = null, adapterBoundary = null, permissions = {}, codec = 'h264', maxChunkBytes, spawnImpl, maxOutputBytes, stopTimeoutMs, audioPublisher = null, audioPipeline = null, audioPacketizer, audioTransport, audioCodec = 'opus', audioMaxChunkBytes} = {}) {
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported platform: ${platform}`);
  if (!plans || plans.platform !== platform || plans.capture?.platform !== platform) throw new TypeError('platform plans must match the host platform');
  if (adapterBoundary && typeof adapterBoundary.invoke !== 'function') throw new TypeError('adapterBoundary must implement invoke(kind, operation, ...args)');
  const nativePipeline = pipeline || createNativeMediaPipeline({capturePlan: plans.capture, encoderPlan: plans.encoder, spawnImpl, maxOutputBytes, stopTimeoutMs});
  const media = createRtpMediaPublisher({pipeline: nativePipeline, packetizer, transport, codec, maxChunkBytes});
  const nativeAudioPipeline = audioPipeline || (audioPacketizer && audioTransport && plans.audio && plans.audioEncoder ? createNativeMediaPipeline({capturePlan: plans.audio, encoderPlan: plans.audioEncoder, spawnImpl, maxOutputBytes, stopTimeoutMs}) : null);
  const audio = audioPublisher || (nativeAudioPipeline ? createRtpAudioPublisher({pipeline: nativeAudioPipeline, packetizer: audioPacketizer, transport: audioTransport, codec: audioCodec, permissionGranted: permissions.microphone === true || permissions['microphone-capture'] === true, maxChunkBytes: audioMaxChunkBytes}) : null);
  const boundaryInput = adapterBoundary ? {platform, execute: operation => adapterBoundary.invoke('input', 'execute', operation), close: () => adapterBoundary.invoke('input', 'close')} : null;
  const input = inputAdapter || boundaryInput ? createNativeInputExecutor({platform, adapter: inputAdapter || boundaryInput, permissions}) : null;
  const session = createNativeHostSession({platform, mediaPublisher: media.publisher, audioPublisher: audio?.publisher || audio, inputExecutor: input});
  return Object.freeze({platform, plans, pipeline: nativePipeline, mediaPublisher: media, audioPipeline: nativeAudioPipeline, audioPublisher: audio, inputExecutor: input, adapterBoundary, session});
}

/** Load a verified installed adapter and compose it into an executable host. */
export async function createExecutablePlatformHostFromInstalledAdapter({adapterRuntime, adapterRegistry, adapterKind = 'input', ...options} = {}) {
  if (!adapterRuntime || typeof adapterRuntime.createBoundary !== 'function') throw new TypeError('adapterRuntime must implement createBoundary()');
  const activated = await adapterRuntime.createBoundary({registry: adapterRegistry, kind: adapterKind});
  return Object.freeze({...createExecutablePlatformHost({...options, adapterBoundary: activated.boundary}), installedAdapter: Object.freeze({manifest: activated.manifest, adapter: activated.adapter})});
}
