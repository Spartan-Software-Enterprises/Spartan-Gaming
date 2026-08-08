const MAX = Object.freeze({width: 7680, height: 4320, framerate: 240, bitrateKbps: 100000});
const DEFAULT_QUALITY = Object.freeze({profile: 'custom', maxWidth: 1920, maxHeight: 1080, bitrateKbps: 10000, maxFramerate: 60});

function bounded(value, fallback, maximum) { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.min(maximum, number) : fallback; }
function boundedInteger(value, fallback, minimum, maximum) { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.min(maximum, Math.max(minimum, Math.floor(number))) : fallback; }
function events() { const listeners = new Map(); return {on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); }, emit(type, value) { for (const handler of listeners.get(type) || []) handler(value); }}; }
function required(value, name) { if (!value) throw new TypeError(`${name} is required`); return value; }

export function createMicrophoneConstraints({deviceId = '', echoCancellation = true, noiseSuppression = true, autoGainControl = true} = {}) {
  const audio = {echoCancellation: Boolean(echoCancellation), noiseSuppression: Boolean(noiseSuppression), autoGainControl: Boolean(autoGainControl)};
  const normalizedDeviceId = typeof deviceId === 'string' ? deviceId.trim() : '';
  if (normalizedDeviceId) audio.deviceId = {exact: normalizedDeviceId};
  return Object.freeze(audio);
}

export function createBrowserCaptureConstraints({width = 1920, height = 1080, framerate = 60, audio = false, displaySurface = 'monitor'} = {}) {
  const surface = ['monitor', 'window', 'browser'].includes(displaySurface) ? displaySurface : 'monitor';
  return Object.freeze({video: Object.freeze({width: Object.freeze({ideal: bounded(width, 1920, MAX.width)}), height: Object.freeze({ideal: bounded(height, 1080, MAX.height)}), frameRate: Object.freeze({ideal: bounded(framerate, 60, MAX.framerate)}), displaySurface: surface}), audio: Boolean(audio)});
}

export function normalizeBrowserQualityRequest({profile = DEFAULT_QUALITY.profile, maxWidth = DEFAULT_QUALITY.maxWidth, maxHeight = DEFAULT_QUALITY.maxHeight, bitrateKbps = DEFAULT_QUALITY.bitrateKbps, maxFramerate = DEFAULT_QUALITY.maxFramerate} = {}) {
  return Object.freeze({profile: typeof profile === 'string' && profile.trim() ? profile.trim() : DEFAULT_QUALITY.profile, maxWidth: boundedInteger(maxWidth, DEFAULT_QUALITY.maxWidth, 320, MAX.width), maxHeight: boundedInteger(maxHeight, DEFAULT_QUALITY.maxHeight, 180, MAX.height), bitrateKbps: boundedInteger(bitrateKbps, DEFAULT_QUALITY.bitrateKbps, 250, MAX.bitrateKbps), maxFramerate: boundedInteger(maxFramerate, DEFAULT_QUALITY.maxFramerate, 1, MAX.framerate)});
}

export function createVideoEncodingParameters(request, parameters = {}, trackSettings = {}) {
  const quality = normalizeBrowserQualityRequest(request);
  if (!Array.isArray(parameters.encodings) || parameters.encodings.length === 0) return null;
  const trackWidth = Number(trackSettings.width); const trackHeight = Number(trackSettings.height);
  const hasTrackDimensions = Number.isFinite(trackWidth) && trackWidth > 0 && Number.isFinite(trackHeight) && trackHeight > 0;
  const scale = hasTrackDimensions ? Math.min(64, Math.max(1, Math.max(trackWidth / quality.maxWidth, trackHeight / quality.maxHeight))) : null;
  return {...parameters, encodings: parameters.encodings.map(encoding => ({...encoding, maxBitrate: quality.bitrateKbps * 1000, maxFramerate: quality.maxFramerate, ...(scale ? {scaleResolutionDownBy: Number(scale.toFixed(3))} : {})}))};
}

export function createBrowserWebRtcPublisher({RTCPeerConnectionImpl = globalThis.RTCPeerConnection, mediaDevices = globalThis.navigator?.mediaDevices, configuration = {}, createPeer} = {}) {
  const Peer = createPeer || RTCPeerConnectionImpl;
  if (typeof Peer !== 'function') throw new Error('RTCPeerConnection is unavailable in this browser');
  const peer = typeof createPeer === 'function' ? Peer() : new Peer(configuration);
  const bus = events(); let stream = null; let state = 'new'; let paused = false;
  peer.onicecandidate = event => { if (event.candidate) bus.emit('icecandidate', event.candidate); };
  peer.onconnectionstatechange = () => { state = peer.connectionState || state; bus.emit('state', state); };
  return Object.freeze({
    get state() { return state; }, get stream() { return stream; }, get paused() { return paused; }, get peerConnection() { return peer; }, on: bus.on,
    async capture(options = {}) {
      if (!mediaDevices?.getDisplayMedia) throw new Error('Display capture is unavailable in this browser');
      if (stream) throw new Error('Display capture is already active');
      stream = await mediaDevices.getDisplayMedia(createBrowserCaptureConstraints(options));
      if (!stream?.getTracks) throw new Error('Display capture returned no media stream');
      if (options.microphone === true) {
        if (typeof mediaDevices.getUserMedia !== 'function') { stream.getTracks().forEach(track => track.stop?.()); stream = null; throw new Error('Microphone capture is unavailable in this browser'); }
        try {
          const microphone = await mediaDevices.getUserMedia({audio: createMicrophoneConstraints({deviceId: options.microphoneDeviceId, noiseSuppression: options.microphoneNoiseSuppression !== false})});
          const microphoneTracks = microphone?.getAudioTracks?.() || [];
          if (!microphoneTracks.length || typeof stream.addTrack !== 'function') throw new Error('Microphone capture returned no usable audio track');
          microphoneTracks.forEach(track => stream.addTrack(track));
        } catch (error) {
          stream.getTracks().forEach(track => track.stop?.()); stream = null;
          throw new Error(`Microphone capture failed: ${error.message || 'permission was denied'}`);
        }
      }
      for (const track of stream.getTracks()) { track.enabled = !paused; peer.addTrack(track, stream); track.addEventListener?.('ended', () => bus.emit('capture.ended')); }
      state = 'capturing'; bus.emit('capture', stream); return stream;
    },
    async acceptOffer(offer) {
      required(offer, 'offer');
      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer(); await peer.setLocalDescription(answer);
      state = 'connected'; bus.emit('state', state); return peer.localDescription || answer;
    },
    async applyQualityRequest(request = {}) {
      const quality = normalizeBrowserQualityRequest(request);
      const senders = typeof peer.getSenders === 'function' ? peer.getSenders() : [];
      let appliedSenders = 0;
      let failedSenders = 0;
      for (const sender of senders || []) {
        if (sender?.track?.kind !== 'video' || typeof sender.getParameters !== 'function' || typeof sender.setParameters !== 'function') continue;
        try {
          const parameters = createVideoEncodingParameters(quality, await sender.getParameters(), sender.track.getSettings?.() || {});
          if (!parameters) continue;
          await sender.setParameters(parameters);
          appliedSenders += 1;
        } catch {
          failedSenders += 1;
        }
      }
      const status = appliedSenders > 0 ? 'applied' : failedSenders > 0 ? 'failed' : 'unsupported';
      const result = Object.freeze({...quality, status, appliedSenders, failedSenders});
      bus.emit('quality', result);
      return result;
    },
    setPaused(value) {
      const next = Boolean(value);
      if (paused === next) return paused;
      paused = next;
      for (const track of stream?.getTracks?.() || []) track.enabled = !paused;
      bus.emit('pause', paused);
      return paused;
    },
    addIceCandidate(candidate) { return peer.addIceCandidate(candidate); },
    close() { stream?.getTracks?.().forEach(track => track.stop?.()); stream = null; paused = false; peer.close?.(); state = 'closed'; bus.emit('state', state); },
  });
}
