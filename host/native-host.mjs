import {createWeriftHostRuntime} from './werift-runtime.mjs';
import {createWeriftAudioRtpPublisher, createWeriftRtpPublisher, createWeriftSession} from './werift-adapter.mjs';
import {createNativeMediaPipeline} from './native-media.mjs';
import {createNativeInputExecutor} from './input.mjs';
import {createEncoderPlan} from './media.mjs';
import {createAudioEncoderPlan} from './audio.mjs';
import {createGameLaunchPlan, createGameLauncher} from './game-launcher.mjs';

function required(value, name) { if (!value || typeof value !== 'object') throw new TypeError(`${name} is required`); return value; }

/**
 * Compose the native capture/encode pipeline, an optional Werift adapter, and
 * the protocol runtime. Platform capture plans and codec packetization remain
 * injected so this factory does not make unsafe assumptions about an OS.
 */
export function createNativeWeriftHost({signaling, module, pipeline, capturePlan, encoderPlan, spawnImpl, maxOutputBytes, stopTimeoutMs, packetizer, sessionId, peerConfig, codec = 'h264', ssrc, streamId, label, maxChunkBytes, audioPipeline = null, audioPacketizer = null, audioCodec = 'opus', audioSsrc = 2, audioStreamId = 'spartan-stream', audioLabel = 'Spartan Gaming Audio', audioPermissionGranted = false, audioMaxChunkBytes, inputAdapter = null, inputPermissions = {}, inputExecutor = null, gameLauncher = null, onInput = () => {}, onInputError = () => {}, ...runtimeOptions} = {}) {
  required(signaling, 'signaling'); required(module, 'module'); required(packetizer, 'packetizer');
  const nativePipeline = pipeline || createNativeMediaPipeline({capturePlan, encoderPlan, spawnImpl, maxOutputBytes, stopTimeoutMs});
  required(nativePipeline, 'pipeline');
  const nativeInput = inputExecutor || (inputAdapter ? createNativeInputExecutor({platform: inputAdapter.platform, adapter: inputAdapter, permissions: inputPermissions}) : null);
  let mediaPublisher = null;
  let audioPublisher = null;
  let gameStarted = false;
  const audioEnabled = Boolean(audioPipeline && audioPacketizer);
  const runtime = createWeriftHostRuntime({
    ...runtimeOptions,
    onInput: event => {
      const operation = nativeInput ? nativeInput.dispatch(event) : Promise.resolve();
      void operation.then(() => onInput(event)).catch(error => onInputError(error, event));
    },
    audioEnabled: runtimeOptions.audioEnabled ?? audioEnabled,
    signaling,
    sessionId,
    sessionFactory: async ({onIceCandidate, onStateChange}) => {
      mediaPublisher = createWeriftRtpPublisher({module, pipeline: nativePipeline, packetizer, peerConfig, codec, ssrc, streamId, label, maxChunkBytes});
      if (audioPipeline || audioPacketizer) {
        if (!audioPipeline || !audioPacketizer) throw new TypeError('audioPipeline and audioPacketizer are required together');
        audioPublisher = createWeriftAudioRtpPublisher({module, pipeline: audioPipeline, packetizer: audioPacketizer, peer: mediaPublisher.adapter.peer, codec: audioCodec, ssrc: audioSsrc, streamId: audioStreamId, label: audioLabel, permissionGranted: audioPermissionGranted, maxChunkBytes: audioMaxChunkBytes});
      }
      const session = createWeriftSession({adapter: mediaPublisher.adapter, onIceCandidate, onStateChange});
      let started = false;
      let audioStarted = false;
      return {
        async acceptOffer(offer) {
          try { if (gameLauncher) { await gameLauncher.start(); gameStarted = true; } await mediaPublisher.publisher.start(); started = true; if (audioPublisher) { await audioPublisher.publisher.start(); audioStarted = true; } return await session.acceptOffer(offer); }
          catch (error) { await session.close(); if (audioStarted) await audioPublisher.publisher.stop(); if (started) await mediaPublisher.publisher.stop(); if (gameStarted) { await gameLauncher.stop(); gameStarted = false; } throw error; }
        },
        addIceCandidate: session.addIceCandidate,
        async close() { await session.close(); if (audioPublisher) await audioPublisher.publisher.stop(); await mediaPublisher.publisher.stop(); if (gameStarted) { await gameLauncher.stop(); gameStarted = false; } },
      };
    },
  });
  return Object.freeze({
    get state() { return runtime.state; },
    get sessionId() { return runtime.sessionId; },
    get pipeline() { return nativePipeline; },
    get mediaPublisher() { return mediaPublisher; },
    get audioPublisher() { return audioPublisher; },
    get gameLauncher() { return gameLauncher; },
    get inputExecutor() { return nativeInput; },
    on: runtime.on,
    start: runtime.start,
    close() { nativeInput?.close(); return runtime.close(); },
  });
}

/**
 * Build a complete host from a platform package binding. The package owns
 * OS APIs; this composition layer owns permission gates, FFmpeg plans,
 * WebRTC publication, and remote-input dispatch.
 */
export function createNativeWeriftHostFromPlatformBindings({bindings, platform = bindings?.platform, captureOptions = {}, audioOptions = {}, permissions = {}, includeAudio = true, width = 1920, height = 1080, framerate = 60, codec = 'h264', bitrateKbps = 10000, audioCodec = 'opus', audioBitrateKbps = 128, audioPacketizer, runtimeProfile = null, gamePath = null, gameArgs = [], gameCwd, gameEnv, ...options} = {}) {
  required(bindings, 'bindings');
  if (bindings.platform !== platform) throw new TypeError('platform bindings must match the requested platform');
  if (typeof bindings.capture?.plan !== 'function') throw new TypeError('platform bindings must provide capture.plan(options)');
  const capturePermissionGranted = captureOptions.permissionGranted === true || permissions['screen-capture'] === true || permissions['screen-recording'] === true;
  const capturePlan = bindings.capture.plan({...captureOptions, width, height, framerate, permissionGranted: capturePermissionGranted});
  const encoderPlan = createEncoderPlan({codec, width, height, framerate, bitrateKbps});
  const gameLauncher = runtimeProfile && gamePath ? createGameLauncher({plan: createGameLaunchPlan({platform, runtimeProfile, gamePath, args: gameArgs, cwd: gameCwd, env: gameEnv}) , spawnImpl: options.spawnImpl, maxOutputBytes: options.maxOutputBytes, stopTimeoutMs: options.stopTimeoutMs}) : null;
  let audioPipeline = null;
  let audioPermissionGranted = false;
  if (includeAudio) {
    if (typeof bindings.audio?.plan !== 'function') throw new TypeError('platform bindings must provide audio.plan(options) when audio is enabled');
    if (!audioPacketizer) throw new TypeError('audioPacketizer is required when audio is enabled');
    audioPermissionGranted = audioOptions.permissionGranted === true || permissions.microphone === true || permissions['microphone-capture'] === true;
    const audioCapturePlan = bindings.audio.plan({...audioOptions, permissionGranted: audioPermissionGranted});
    const audioEncoderPlan = createAudioEncoderPlan({codec: audioCodec, bitrateKbps: audioBitrateKbps, channels: audioCapturePlan.channels, sampleRate: audioCapturePlan.sampleRate});
    audioPipeline = createNativeMediaPipeline({capturePlan: audioCapturePlan, encoderPlan: audioEncoderPlan, spawnImpl: options.spawnImpl, maxOutputBytes: options.maxOutputBytes, stopTimeoutMs: options.stopTimeoutMs});
  }
  return createNativeWeriftHost({
    ...options,
    platform,
    capturePlan,
    encoderPlan,
    codec,
    audioPipeline,
    audioPacketizer,
    audioCodec,
    audioPermissionGranted,
    gameLauncher,
    inputAdapter: bindings.input,
    inputPermissions: permissions,
  });
}
