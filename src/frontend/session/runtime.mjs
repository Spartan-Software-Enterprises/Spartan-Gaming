import {createSessionEnvelope, createSessionManager} from './session.mjs';
import {applyJitterBufferTarget, validateTransportMessage} from '../transport/transport.mjs';
import {createWebRtcTelemetryCollector} from './telemetry.mjs';
import {createReconnectController} from './reconnect-controller.mjs';

function eventBus() { const listeners = new Map(); return {on(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); return () => listeners.get(type)?.delete(handler); }, emit(type, value) { for (const handler of listeners.get(type) || []) handler(value); }}; }
function required(value, name) { if (!value || typeof value.on !== 'function') throw new TypeError(`${name} must provide on()`); }

export function createSessionRuntime({manager = createSessionManager(), signaling, media, clock = () => new Date().toISOString(), reconnect = {}} = {}) {
  required(signaling, 'signaling');
  const bus = eventBus();
  let sessionId = null; let sequence = 0; let dataChannel = null; let activePreferences = null; let unbind = []; const telemetry = media?.peerConnection?.getStats ? createWebRtcTelemetryCollector({peerConnection: media.peerConnection}) : null;
  const send = message => {
    const validated = validateTransportMessage(message);
    if (dataChannel?.readyState === 'open') { dataChannel.send(JSON.stringify(validated)); return validated; }
    signaling.send(validated); return validated;
  };
  const receive = message => {
    const validated = validateTransportMessage(message);
    if (validated.sessionId !== sessionId) return;
    const beforeQuality = manager.quality.id;
    try { manager.receive(validated); } catch (error) { bus.emit('error', error); return false; }
    if (validated.type === 'session.answer' && media && validated.payload.sdp) Promise.resolve(media.acceptAnswer(validated.payload.sdp)).catch(error => bus.emit('error', error));
    if (validated.type === 'session.ice-candidate' && media && validated.payload.candidate) Promise.resolve(media.addIceCandidate(validated.payload.candidate)).catch(error => bus.emit('error', error));
    if (validated.type === 'telemetry.health' && manager.quality.id !== beforeQuality) send(createSessionEnvelope({sessionId, type: 'quality.request', sequence: ++sequence, sentAt: clock(), payload: manager.qualityRequest}));
    bus.emit('message', validated); bus.emit(validated.type, validated); if (validated.type === 'session.answer' && reconnectController.state.state === 'waiting') reconnectController.succeed(validated); return true;
  };
  const bind = () => {
    unbind.forEach(off => off()); unbind = [];
    unbind.push(signaling.on('message', receive));
    unbind.push(signaling.on('error', error => { if (reconnectController.state.state === 'waiting') reconnectController.fail(error); bus.emit('error', error); }));
    unbind.push(signaling.on('close', event => { if (reconnectController.state.state === 'waiting') reconnectController.fail(new Error('Signaling transport closed')); bus.emit('close', event); }));
    if (!media) return;
    unbind.push(media.on('icecandidate', candidate => send(createSessionEnvelope({sessionId, type: 'session.ice-candidate', sequence: ++sequence, sentAt: clock(), payload: {candidate}}))));
    unbind.push(media.on('track', event => { applyJitterBufferTarget(event?.receiver, activePreferences?.jitterBufferMs); const stream = event?.streams?.[0]; if (stream) bus.emit('stream', stream); bus.emit('track', event); }));
    unbind.push(media.on('close', event => bus.emit('media.close', event)));
    if (telemetry) { unbind.push(telemetry.on('health', sample => { const message = createSessionEnvelope({sessionId, type: 'telemetry.health', sequence: ++sequence, sentAt: clock(), payload: sample}); manager.receive(message); send(message); bus.emit('telemetry', sample); })); unbind.push(telemetry.on('error', error => bus.emit('error', error))); }
  };
  const reconnectController = createReconnectController({...reconnect, attempt: () => { const envelope = manager.requestReconnect(); send(envelope); bus.emit('reconnect', envelope); return envelope; }});
  reconnectController.on(state => bus.emit('reconnect.state', state));
  const runtime = {
    get state() { return manager.state; },
    get session() { return manager.session; },
    get manager() { return manager; },
    get reconnect() { return reconnectController.state; },
    on: bus.on,
    async start({backend, capabilities, preferences, launch} = {}) {
      const offer = manager.start({backend, capabilities, preferences, launch}); activePreferences = preferences || null; sessionId = offer.sessionId; sequence = offer.sequence;
      bind(); await signaling.connect();
      let outbound = offer;
      if (media) { dataChannel = media.createDataChannel?.(); if (dataChannel) dataChannel.onmessage = event => { try { receive(JSON.parse(typeof event.data === 'string' ? event.data : String(event.data))); } catch (error) { bus.emit('error', error); } }; const sdp = await media.createOffer(); outbound = createSessionEnvelope({sessionId, type: offer.type, sequence: offer.sequence, sentAt: clock(), payload: {...offer.payload, sdp}}); }
      send(outbound); telemetry?.start(); bus.emit('offer', outbound); return outbound;
    },
    send,
    requestQuality(profileId) { const request = manager.setQuality(profileId); return send(createSessionEnvelope({sessionId, type: 'quality.request', sequence: ++sequence, sentAt: clock(), payload: request})); },
    requestControl(action) { if (!['pause', 'resume'].includes(action)) throw new TypeError('session control action is invalid'); if (!sessionId) throw new Error('Session has not started'); return send(createSessionEnvelope({sessionId, type: 'session.control', sequence: ++sequence, sentAt: clock(), payload: {action}})); },
    receive,
    requestReconnect() { return reconnectController.start().result; },
    cancelReconnect() { return reconnectController.cancel(); },
    close() { reconnectController.cancel(); telemetry?.stop(); manager.close(); dataChannel?.close?.(); media?.close?.(); signaling.close?.(); unbind.forEach(off => off()); unbind = []; bus.emit('closed'); },
  };
  return Object.freeze(runtime);
}
