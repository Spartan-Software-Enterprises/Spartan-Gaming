import {createNativeInputExecutor} from './input.mjs';
import {createNativeMediaPipeline} from './native-media.mjs';
import {createNativeHostSession} from './native-session.mjs';
import {createRtpMediaPublisher} from './publisher.mjs';

const PLATFORMS = new Set(['win32', 'darwin', 'linux']);

/** Compose platform plans and injected OS/transport adapters into one host. */
export function createExecutablePlatformHost({platform, plans, pipeline = null, packetizer, transport, inputAdapter = null, permissions = {}, codec = 'h264', maxChunkBytes, spawnImpl, maxOutputBytes, stopTimeoutMs, audioPublisher = null} = {}) {
  if (!PLATFORMS.has(platform)) throw new TypeError(`unsupported platform: ${platform}`);
  if (!plans || plans.platform !== platform || plans.capture?.platform !== platform) throw new TypeError('platform plans must match the host platform');
  const nativePipeline = pipeline || createNativeMediaPipeline({capturePlan: plans.capture, encoderPlan: plans.encoder, spawnImpl, maxOutputBytes, stopTimeoutMs});
  const media = createRtpMediaPublisher({pipeline: nativePipeline, packetizer, transport, codec, maxChunkBytes});
  const input = inputAdapter ? createNativeInputExecutor({platform, adapter: inputAdapter, permissions}) : null;
  const session = createNativeHostSession({platform, mediaPublisher: media.publisher, audioPublisher, inputExecutor: input});
  return Object.freeze({platform, plans, pipeline: nativePipeline, mediaPublisher: media, inputExecutor: input, audioPublisher, session});
}
