import {createWeriftHostRuntime} from './werift-runtime.mjs';
import {createWeriftRtpPublisher, createWeriftSession} from './werift-adapter.mjs';

function required(value, name) { if (!value || typeof value !== 'object') throw new TypeError(`${name} is required`); return value; }

/**
 * Compose the native capture/encode pipeline, an optional Werift adapter, and
 * the protocol runtime. Platform capture plans and codec packetization remain
 * injected so this factory does not make unsafe assumptions about an OS.
 */
export function createNativeWeriftHost({signaling, module, pipeline, packetizer, sessionId, peerConfig, codec = 'h264', ssrc, streamId, label, maxChunkBytes, ...runtimeOptions} = {}) {
  required(signaling, 'signaling'); required(module, 'module'); required(pipeline, 'pipeline'); required(packetizer, 'packetizer');
  let mediaPublisher = null;
  const runtime = createWeriftHostRuntime({
    ...runtimeOptions,
    signaling,
    sessionId,
    sessionFactory: async ({onIceCandidate, onStateChange}) => {
      mediaPublisher = createWeriftRtpPublisher({module, pipeline, packetizer, peerConfig, codec, ssrc, streamId, label, maxChunkBytes});
      const session = createWeriftSession({adapter: mediaPublisher.adapter, onIceCandidate, onStateChange});
      let started = false;
      return {
        async acceptOffer(offer) {
          try { await mediaPublisher.publisher.start(); started = true; return await session.acceptOffer(offer); }
          catch (error) { await session.close(); if (started) await mediaPublisher.publisher.stop(); throw error; }
        },
        addIceCandidate: session.addIceCandidate,
        async close() { await session.close(); await mediaPublisher.publisher.stop(); },
      };
    },
  });
  return Object.freeze({
    get state() { return runtime.state; },
    get sessionId() { return runtime.sessionId; },
    get mediaPublisher() { return mediaPublisher; },
    on: runtime.on,
    start: runtime.start,
    close: runtime.close,
  });
}
