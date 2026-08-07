const DEFAULT_CODEC = 'h264';

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

function subscribe(event, handler) { if (typeof event?.subscribe === 'function') return event.subscribe(handler); if (typeof event?.addEventListener === 'function') { event.addEventListener(handler); return () => event.removeEventListener?.(handler); } return () => {}; }

export function createWeriftSession({adapter, onIceCandidate = () => {}, onStateChange = () => {}} = {}) {
  if (!adapter?.peer || typeof adapter.peer.setRemoteDescription !== 'function' || typeof adapter.peer.createAnswer !== 'function' || typeof adapter.peer.setLocalDescription !== 'function') throw new TypeError('a Werift video transport with a negotiable peer is required');
  const peer = adapter.peer; const unbindIce = subscribe(peer.onIceCandidate, candidate => onIceCandidate(candidate)); const unbindState = subscribe(peer.connectionStateChange, state => onStateChange(state)); let closed = false;
  return Object.freeze({
    get peer() { return peer; }, get track() { return adapter.track; }, get transport() { return adapter.transport; },
    async acceptOffer(offer) { if (closed) throw new Error('Werift session is closed'); const description = typeof offer === 'string' ? {type: 'offer', sdp: offer} : offer; if (!description?.sdp) throw new TypeError('an SDP offer is required'); await peer.setRemoteDescription({type: 'offer', sdp: description.sdp}); const answer = await peer.createAnswer(); const local = await peer.setLocalDescription(answer); return {type: 'answer', sdp: local?.sdp || answer?.sdp}; },
    async addIceCandidate(candidate) { if (closed) throw new Error('Werift session is closed'); await peer.addIceCandidate?.(candidate || null); },
    async close() { if (closed) return; closed = true; unbindIce?.(); unbindState?.(); adapter.close?.(); },
  });
}
