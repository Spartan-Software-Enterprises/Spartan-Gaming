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
