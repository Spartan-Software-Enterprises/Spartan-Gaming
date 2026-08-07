const MAX = Object.freeze({width: 7680, height: 4320, framerate: 240});

function bounded(value, fallback, maximum) { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.min(maximum, number) : fallback; }
function events() { const listeners = new Map(); return {on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); }, emit(type, value) { for (const handler of listeners.get(type) || []) handler(value); }}; }
function required(value, name) { if (!value) throw new TypeError(`${name} is required`); return value; }

export function createBrowserCaptureConstraints({width = 1920, height = 1080, framerate = 60, audio = false, displaySurface = 'monitor'} = {}) {
  const surface = ['monitor', 'window', 'browser'].includes(displaySurface) ? displaySurface : 'monitor';
  return Object.freeze({video: Object.freeze({width: Object.freeze({ideal: bounded(width, 1920, MAX.width)}), height: Object.freeze({ideal: bounded(height, 1080, MAX.height)}), frameRate: Object.freeze({ideal: bounded(framerate, 60, MAX.framerate)}), displaySurface: surface}), audio: Boolean(audio)});
}

export function createBrowserWebRtcPublisher({RTCPeerConnectionImpl = globalThis.RTCPeerConnection, mediaDevices = globalThis.navigator?.mediaDevices, configuration = {}, createPeer} = {}) {
  const Peer = createPeer || RTCPeerConnectionImpl;
  if (typeof Peer !== 'function') throw new Error('RTCPeerConnection is unavailable in this browser');
  const peer = typeof createPeer === 'function' ? Peer() : new Peer(configuration);
  const bus = events(); let stream = null; let state = 'new';
  peer.onicecandidate = event => { if (event.candidate) bus.emit('icecandidate', event.candidate); };
  peer.onconnectionstatechange = () => { state = peer.connectionState || state; bus.emit('state', state); };
  return Object.freeze({
    get state() { return state; }, get stream() { return stream; }, get peerConnection() { return peer; }, on: bus.on,
    async capture(options = {}) {
      if (!mediaDevices?.getDisplayMedia) throw new Error('Display capture is unavailable in this browser');
      if (stream) throw new Error('Display capture is already active');
      stream = await mediaDevices.getDisplayMedia(createBrowserCaptureConstraints(options));
      if (!stream?.getTracks) throw new Error('Display capture returned no media stream');
      for (const track of stream.getTracks()) { peer.addTrack(track, stream); track.addEventListener?.('ended', () => bus.emit('capture.ended')); }
      state = 'capturing'; bus.emit('capture', stream); return stream;
    },
    async acceptOffer(offer) {
      required(offer, 'offer');
      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer(); await peer.setLocalDescription(answer);
      state = 'connected'; bus.emit('state', state); return peer.localDescription || answer;
    },
    addIceCandidate(candidate) { return peer.addIceCandidate(candidate); },
    close() { stream?.getTracks?.().forEach(track => track.stop?.()); stream = null; peer.close?.(); state = 'closed'; bus.emit('state', state); },
  });
}
