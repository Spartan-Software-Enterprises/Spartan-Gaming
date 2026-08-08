import {createWeriftHostRuntime} from './werift-runtime.mjs';
import {createWeriftAudioRtpPublisher, createWeriftRtpPublisher, createWeriftSession} from './werift-adapter.mjs';
import {createNativeMediaPipeline} from './native-media.mjs';

function required(value, name) { if (!value || typeof value !== 'object') throw new TypeError(`${name} is required`); return value; }

/**
 * Compose the native capture/encode pipeline, an optional Werift adapter, and
 * the protocol runtime. Platform capture plans and codec packetization remain
 * injected so this factory does not make unsafe assumptions about an OS.
 */
export function createNativeWeriftHost({signaling, module, pipeline, capturePlan, encoderPlan, spawnImpl, maxOutputBytes, stopTimeoutMs, packetizer, sessionId, peerConfig, codec = 'h264', ssrc, streamId, label, maxChunkBytes, audioPipeline = null, audioPacketizer = null, audioCodec = 'opus', audioSsrc = 2, audioStreamId = 'spartan-stream', audioLabel = 'Spartan Gaming Audio', audioPermissionGranted = false, audioMaxChunkBytes, ...runtimeOptions} = {}) {
  required(signaling, 'signaling'); required(module, 'module'); required(packetizer, 'packetizer');
  const nativePipeline = pipeline || createNativeMediaPipeline({capturePlan, encoderPlan, spawnImpl, maxOutputBytes, stopTimeoutMs});
  required(nativePipeline, 'pipeline');
  let mediaPublisher = null;
  let audioPublisher = null;
  const runtime = createWeriftHostRuntime({
    ...runtimeOptions,
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
          try { await mediaPublisher.publisher.start(); started = true; if (audioPublisher) { await audioPublisher.publisher.start(); audioStarted = true; } return await session.acceptOffer(offer); }
          catch (error) { await session.close(); if (audioStarted) await audioPublisher.publisher.stop(); if (started) await mediaPublisher.publisher.stop(); throw error; }
        },
        addIceCandidate: session.addIceCandidate,
        async close() { await session.close(); if (audioPublisher) await audioPublisher.publisher.stop(); await mediaPublisher.publisher.stop(); },
      };
    },
  });
  return Object.freeze({
    get state() { return runtime.state; },
    get sessionId() { return runtime.sessionId; },
    get pipeline() { return nativePipeline; },
    get mediaPublisher() { return mediaPublisher; },
    get audioPublisher() { return audioPublisher; },
    on: runtime.on,
    start: runtime.start,
    close: runtime.close,
  });
}
