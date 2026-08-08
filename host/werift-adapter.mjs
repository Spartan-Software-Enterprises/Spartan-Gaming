const DEFAULT_CODEC = 'h264';

function bounded(value, fallback, minimum, maximum) { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.min(maximum, Math.max(minimum, Math.floor(number))) : fallback; }
function normalizeQualityRequest(request = {}) { return Object.freeze({profile: typeof request.profile === 'string' && request.profile.trim() ? request.profile.trim() : 'custom', maxWidth: bounded(request.maxWidth, 1920, 320, 7680), maxHeight: bounded(request.maxHeight, 1080, 180, 4320), maxFramerate: bounded(request.maxFramerate, 60, 1, 240), bitrateKbps: bounded(request.bitrateKbps, 10000, 250, 100000)}); }

import {createRtpMediaPublisher} from './publisher.mjs';
import {createRtpAudioPublisher} from './audio.mjs';

export async function loadWerift({loader = packageName => import(packageName)} = {}) {
  if (typeof loader !== 'function') throw new TypeError('loader must be a function');
  const module = await loader('werift');
  return module?.default && typeof module.default === 'object' ? {...module.default, ...module} : module;
}

function requiredFunction(module, name) { if (typeof module?.[name] !== 'function') throw new TypeError(`werift adapter requires ${name}`); return module[name]; }

export function createWeriftVideoTransport({module, peerConfig = {}, codec = DEFAULT_CODEC, ssrc = 1, streamId = 'spartan-stream', label = 'Spartan Gaming'} = {}) {
  const PeerConnection = requiredFunction(module, 'RTCPeerConnection'); const MediaStreamTrack = requiredFunction(module, 'MediaStreamTrack');
  const peer = new PeerConnection(peerConfig); const suffix = codec === 'h264' ? 'H264' : codec === 'vp9' ? 'VP9' : codec === 'av1' ? 'AV1X' : ''; const codecFactory = suffix ? module[`use${suffix}`] : null;
  if (codecFactory && typeof codecFactory !== 'function') throw new TypeError(`invalid Werift codec factory for ${codec}`);
  const track = new MediaStreamTrack({kind: 'video', ssrc, streamId, label, ...(codecFactory ? {codec: codecFactory()} : {})});
  const sender = typeof peer.addTrack === 'function' ? peer.addTrack(track) : null; let closed = false;
  const transport = Object.freeze({send(packet) { if (closed) throw new Error('Werift transport is closed'); track.writeRtp(packet); }, close() { if (closed) return; closed = true; track.stop?.(); peer.close?.(); }});
  return Object.freeze({peer, track, sender, transport, close: () => transport.close()});
}

/** Add an audio RTP track to an existing Werift peer, or create an audio-only peer. */
export function createWeriftAudioTransport({module, peer = null, peerConfig = {}, codec = 'opus', ssrc = 2, streamId = 'spartan-stream', label = 'Spartan Gaming Audio'} = {}) {
  const PeerConnection = peer ? null : requiredFunction(module, 'RTCPeerConnection'); const MediaStreamTrack = requiredFunction(module, 'MediaStreamTrack'); const activePeer = peer || new PeerConnection(peerConfig); const codecFactory = codec === 'opus' ? module.useOpus : null;
  if (codecFactory && typeof codecFactory !== 'function') throw new TypeError(`invalid Werift codec factory for ${codec}`);
  const track = new MediaStreamTrack({kind: 'audio', ssrc, streamId, label, ...(codecFactory ? {codec: codecFactory()} : {})}); const sender = typeof activePeer.addTrack === 'function' ? activePeer.addTrack(track) : null; let closed = false;
  const transport = Object.freeze({send(packet) { if (closed) throw new Error('Werift audio transport is closed'); track.writeRtp(packet); }, close() { if (closed) return; closed = true; track.stop?.(); if (!peer) activePeer.close?.(); }});
  return Object.freeze({peer: activePeer, track, sender, transport, close: () => transport.close()});
}

export function createWeriftRtpPublisher({module, pipeline, packetizer, peerConfig = {}, codec = DEFAULT_CODEC, ssrc = 1, streamId = 'spartan-stream', label = 'Spartan Gaming', maxChunkBytes} = {}) {
  const adapter = createWeriftVideoTransport({module, peerConfig, codec, ssrc, streamId, label});
  try {
    const publisher = createRtpMediaPublisher({pipeline, packetizer, transport: adapter.transport, codec, maxChunkBytes});
    return Object.freeze({adapter, publisher: publisher.publisher, get packetsSent() { return publisher.packetsSent; }});
  } catch (error) {
    adapter.close();
    throw error;
  }
}

/** Bind encoded audio chunks to a Werift audio track on the supplied peer. */
export function createWeriftAudioRtpPublisher({module, pipeline, packetizer, peer = null, peerConfig = {}, codec = 'opus', ssrc = 2, streamId = 'spartan-stream', label = 'Spartan Gaming Audio', permissionGranted = false, maxChunkBytes} = {}) {
  const adapter = createWeriftAudioTransport({module, peer, peerConfig, codec, ssrc, streamId, label});
  try { const publisher = createRtpAudioPublisher({pipeline, packetizer, transport: adapter.transport, codec, permissionGranted, maxChunkBytes}); return Object.freeze({adapter, publisher: publisher.publisher, get packetsSent() { return publisher.packetsSent; }}); }
  catch (error) { adapter.close(); throw error; }
}

function subscribe(event, handler) { if (typeof event?.subscribe === 'function') return event.subscribe(handler); if (typeof event?.addEventListener === 'function') { event.addEventListener(handler); return () => event.removeEventListener?.(handler); } return () => {}; }

export function createWeriftSession({adapter, onIceCandidate = () => {}, onStateChange = () => {}} = {}) {
  if (!adapter?.peer || typeof adapter.peer.setRemoteDescription !== 'function' || typeof adapter.peer.createAnswer !== 'function' || typeof adapter.peer.setLocalDescription !== 'function') throw new TypeError('a Werift video transport with a negotiable peer is required');
  const peer = adapter.peer; const unbindIce = subscribe(peer.onIceCandidate, candidate => onIceCandidate(candidate)); const unbindState = subscribe(peer.connectionStateChange, state => onStateChange(state)); let closed = false;
  return Object.freeze({
    get peer() { return peer; }, get track() { return adapter.track; }, get transport() { return adapter.transport; },
    async acceptOffer(offer) { if (closed) throw new Error('Werift session is closed'); const description = typeof offer === 'string' ? {type: 'offer', sdp: offer} : offer; if (!description?.sdp) throw new TypeError('an SDP offer is required'); await peer.setRemoteDescription({type: 'offer', sdp: description.sdp}); const answer = await peer.createAnswer(); const local = await peer.setLocalDescription(answer); return {type: 'answer', sdp: local?.sdp || answer?.sdp}; },
    async addIceCandidate(candidate) { if (closed) throw new Error('Werift session is closed'); await peer.addIceCandidate?.(candidate || null); },
    async applyQualityRequest(request = {}) {
      const quality = normalizeQualityRequest(request); const sender = adapter.sender;
      if (!sender || typeof sender.getParameters !== 'function' || typeof sender.setParameters !== 'function') return Object.freeze({...quality, status: 'unsupported', applied: false});
      try {
        const parameters = await sender.getParameters();
        if (!Array.isArray(parameters?.encodings) || !parameters.encodings.length) return Object.freeze({...quality, status: 'unsupported', applied: false});
        await sender.setParameters({...parameters, encodings: parameters.encodings.map(encoding => ({...encoding, maxBitrate: quality.bitrateKbps * 1000, maxFramerate: quality.maxFramerate}))});
        return Object.freeze({...quality, status: 'applied', applied: true});
      } catch (error) {
        return Object.freeze({...quality, status: 'failed', applied: false, reason: error?.message || 'sender parameters were rejected'});
      }
    },
    async close() { if (closed) return; closed = true; unbindIce?.(); unbindState?.(); adapter.close?.(); },
  });
}
