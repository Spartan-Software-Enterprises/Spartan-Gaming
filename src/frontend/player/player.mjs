import '../pwa/register.mjs';
import {createSessionEnvelope, createSessionManager} from '../session/session.mjs';
import {readSessionPreferences} from '../session/preferences.mjs';
import {createSessionRuntime} from '../session/runtime.mjs';
import {createInputEventEnvelope, createInputMapper} from '../input/input.mjs';
import {createInputPermissionPolicy} from '../input/policy.mjs';
import {createWebRtcTransport, createWebSocketSignalTransport, createWebTransportSignalTransport} from '../transport/transport.mjs';
import {readTransportPolicy, resolveSignalingTransport} from './transport-config.mjs';
import {createPlayerState, formatLatency, reducePlayerState} from './player-state.mjs';
import {captureVideoFrame, createRecordingController} from '../capture/capture.mjs';
import {createImmersiveController} from './immersive.mjs';
import {attachMediaStreamTarget, describeMediaStream, observeMediaStream, setMediaAudioEnabled} from './media.mjs';

const query = new URLSearchParams(location.search);
const pendingHostPair = (() => { try { const value = JSON.parse(sessionStorage.getItem('spartan-gaming.pending-host-pair.v1') || 'null'); sessionStorage.removeItem('spartan-gaming.pending-host-pair.v1'); return value; } catch { return null; } })();
const manager = createSessionManager({idFactory: () => `ses-${crypto.randomUUID()}`});
const transportPolicy = readTransportPolicy();
const sessionPreferences = readSessionPreferences();
const inputPolicy = createInputPermissionPolicy(sessionPreferences.capabilities);
const mapper = createInputMapper();
const immersive = createImmersiveController({target: document.querySelector('[data-stage]')});
let runtime = null;
const elements = {
  status: document.querySelector('[data-status]'), message: document.querySelector('[data-stage-message]'), quality: document.querySelector('[data-quality]'), qualityDetail: document.querySelector('[data-quality-detail]'),
  latency: document.querySelector('[data-latency]'), latencyDetail: document.querySelector('[data-latency-detail]'), loss: document.querySelector('[data-loss]'), gamepad: document.querySelector('[data-gamepad]'), audio: document.querySelector('[data-audio]'), diagnostics: document.querySelector('[data-diagnostics]'), overlay: document.querySelectorAll('[data-overlay]'), stage: document.querySelector('[data-stage]'), video: document.querySelector('[data-video]'), demo: document.querySelector('[data-demo-answer]'), sessionName: document.querySelector('[data-session-name]'), transport: document.querySelector('[data-transport]'),
};
let state = createPlayerState({status: 'negotiating'});
let recording = null;
let inputSequence = 0;
let audioEnabled = true;
let mediaObservation = null;
const previousGamepad = new Map();

if (!inputPolicy.allows('gamepad')) elements.gamepad.textContent = 'Disabled by settings';

function apply(event) {
  state = reducePlayerState(state, event);
  const labels = {idle: 'Ready', preparing: 'Preparing session', negotiating: 'Negotiating session', connected: 'Connected', reconnecting: 'Reconnecting', ended: 'Session ended', error: 'Connection error'};
  elements.status.textContent = labels[state.status]; elements.quality.textContent = state.quality[0].toUpperCase() + state.quality.slice(1); elements.qualityDetail.textContent = `${elements.quality.textContent} · ${state.quality === 'low' ? '720p30' : '1080p60'}`; elements.latency.textContent = formatLatency(state.latencyMs); elements.latencyDetail.textContent = formatLatency(state.latencyMs); elements.loss.textContent = `${state.packetLossPct}%`; elements.diagnostics.classList.toggle('is-visible', state.diagnosticsVisible); elements.overlay.forEach(overlay => overlay.classList.toggle('is-hidden', !state.overlayVisible));
  if (state.status === 'error') elements.message.textContent = state.error; if (state.status === 'ended') elements.message.textContent = 'This session has ended. Return to the library to choose another backend.';
  if (state.status === 'connected' && state.mediaState === 'not-configured') elements.message.textContent = 'Host paired successfully. Media capture and encoding are not configured on this host.';
}

async function start() {
  const backendId = query.get('backend') || 'spartan-host'; const backendName = query.get('name') || 'Spartan Host'; elements.sessionName.textContent = backendName;
  try {
    const endpoint = query.get('signal') || pendingHostPair?.endpoint;
    if (endpoint) {
      const selectedSignaling = resolveSignalingTransport({endpoint, policy: transportPolicy});
      const signaling = selectedSignaling === 'webtransport' ? createWebTransportSignalTransport({endpoint}) : createWebSocketSignalTransport({endpoint});
      const media = typeof RTCPeerConnection === 'function' ? createWebRtcTransport({ice: {policy: transportPolicy.icePolicy}}) : undefined;
      runtime = createSessionRuntime({manager, signaling, media});
      runtime.on('stream', stream => {
        const mediaState = attachMediaStreamTarget({video: elements.video, stream, audioEnabled});
        mediaObservation?.disconnect();
        mediaObservation = observeMediaStream(stream, nextState => {
          elements.audio.textContent = nextState.hasAudio ? (audioEnabled ? 'Active' : 'Muted') : 'No track';
        });
        elements.audio.textContent = mediaState.hasAudio ? (audioEnabled ? 'Active' : 'Muted') : 'No track';
        elements.video.play().catch(() => {});
      });
      runtime.on('stream', () => { apply({type: 'media.state', state: 'active'}); elements.demo.classList.add('is-hidden'); });
      runtime.on('session.answer', message => { const mediaState = message.payload?.hostCapabilities?.media?.state || (message.payload?.sdp ? 'negotiating' : 'not-configured'); apply({type: 'media.state', state: mediaState}); elements.demo.classList.add('is-hidden'); });
      runtime.on('telemetry', sample => { apply({type: 'telemetry.health', rttMs: sample.rttMs, packetLossPct: sample.packetLossPct}); apply({type: 'quality.changed', profile: manager.quality.id}); });
      runtime.on('error', error => apply({type: 'error', message: error.message || 'Transport error'}));
      const offer = await runtime.start({backend: {id: backendId, backendType: 'remote-play', hostId: pendingHostPair?.hostId, pairingCode: pendingHostPair?.pairingCode}, capabilities: sessionPreferences.capabilities, preferences: sessionPreferences.preferences});
      elements.transport.textContent = `${selectedSignaling === 'webtransport' ? 'WebTransport' : 'WebSocket'} signaling${media ? ' · WebRTC media' : ''}`;
      window.dispatchEvent(new CustomEvent('spartan:session-offer', {detail: offer}));
    } else {
      const offer = manager.start({backend: {id: backendId, backendType: 'remote-play'}, capabilities: sessionPreferences.capabilities, preferences: sessionPreferences.preferences}); elements.transport.textContent = offer.payload.quality.profile === 'balanced' ? 'WebRTC · adaptive' : 'WebRTC';
    }
  } catch (error) { apply({type: 'error', message: error.message}); return; }
  if (query.get('demo') === '1') setTimeout(acceptHostAnswer, 500);
}

function acceptHostAnswer() { if (manager.state !== 'negotiating' && manager.state !== 'reconnecting') return; const answer = createSessionEnvelope({sessionId: manager.session.id, type: 'session.answer', payload: {accepted: true, hostCapabilities: {media: {state: 'not-configured'}}}}); if (runtime) runtime.receive(answer); else manager.receive(answer); apply({type: 'session.state', status: 'connected'}); apply({type: 'media.state', state: 'not-configured'}); elements.demo.classList.add('is-hidden'); }
function requestReconnect() { try { const envelope = runtime ? runtime.requestReconnect() : manager.requestReconnect(); apply({type: 'session.state', status: 'reconnecting'}); window.dispatchEvent(new CustomEvent('spartan:session-reconnect', {detail: envelope})); elements.message.textContent = `Reconnecting (attempt ${envelope.payload.attempt})…`; if (query.get('demo') === '1') setTimeout(acceptHostAnswer, Math.min(envelope.payload.delayMs, 700)); } catch (error) { apply({type: 'error', message: error.message}); } }
function emitInput(event) { if (!inputPolicy.allows(event.source)) return; try { const envelope = createInputEventEnvelope({sessionId: manager.session?.id, event, sequence: ++inputSequence}); if (runtime) runtime.send(envelope); window.dispatchEvent(new CustomEvent('spartan:input', {detail: envelope})); } catch { /* Input is best-effort while a session is ending. */ } }
function keyboardInput(event, pressed) { if (event.repeat && pressed) return; emitInput({type: 'input.event', action: `key:${event.code}`, pressed, value: pressed ? 1 : 0, source: 'keyboard', control: event.code}); }

function downloadBlob(blob, filename) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }
async function takeScreenshot() { try { const blob = await captureVideoFrame(elements.video); downloadBlob(blob, `spartan-gaming-${new Date().toISOString().replaceAll(':', '-')}.png`); elements.message.textContent = 'Screenshot saved locally.'; } catch (error) { elements.message.textContent = error.message; } }
async function toggleRecording() { try { if (!recording) recording = createRecordingController({stream: elements.video.srcObject}); if (recording.state === 'recording') { const blob = await recording.stop(); downloadBlob(blob, `spartan-gaming-${new Date().toISOString().replaceAll(':', '-')}.webm`); elements.message.textContent = 'Recording saved locally.'; elements.record.classList.remove('capture-active'); } else { recording.start(); elements.message.textContent = 'Recording locally. Press record again to stop.'; elements.record.classList.add('capture-active'); } } catch (error) { elements.message.textContent = error.message; } }

document.querySelector('[data-action="audio"]').addEventListener('click', () => { audioEnabled = !audioEnabled; setMediaAudioEnabled(elements.video, audioEnabled); elements.audio.textContent = audioEnabled ? (describeMediaStream(elements.video.srcObject).hasAudio ? 'Active' : 'Waiting') : 'Muted'; const button = document.querySelector('[data-action="audio"]'); button.textContent = audioEnabled ? '🔊' : '🔇'; button.setAttribute('aria-label', audioEnabled ? 'Mute session audio' : 'Unmute session audio'); });
document.querySelector('[data-action="fullscreen"]').addEventListener('click', () => immersive.toggle().catch(error => { elements.message.textContent = error.message; }));
elements.screenshot = document.querySelector('[data-action="screenshot"]'); elements.record = document.querySelector('[data-action="record"]'); elements.screenshot.addEventListener('click', takeScreenshot); elements.record.addEventListener('click', toggleRecording); elements.reconnect = document.querySelector('[data-action="reconnect"]'); elements.reconnect.addEventListener('click', requestReconnect);
document.querySelector('[data-action="overlay"]').addEventListener('click', () => apply({type: 'toggle.overlay'}));
document.querySelector('[data-action="diagnostics"]').addEventListener('click', () => apply({type: 'toggle.diagnostics'}));
document.querySelector('[data-action="end"]').addEventListener('click', () => { if (runtime) runtime.close(); else if (manager.state === 'connected' || manager.state === 'reconnecting') manager.close(); apply({type: 'session.state', status: 'ended'}); });
elements.demo.addEventListener('click', acceptHostAnswer);
window.addEventListener('spartan:telemetry', event => { const sample = event.detail || {}; try { const telemetry = createSessionEnvelope({sessionId: manager.session.id, type: 'telemetry.health', payload: sample}); if (runtime) runtime.receive(telemetry); else manager.receive(telemetry); apply({type: 'telemetry.health', rttMs: sample.rttMs, packetLossPct: sample.packetLossPct}); apply({type: 'quality.changed', profile: manager.quality.id}); } catch { apply({type: 'error', message: 'Invalid session telemetry received'}); } });
window.addEventListener('keydown', event => keyboardInput(event, true)); window.addEventListener('keyup', event => keyboardInput(event, false));
window.addEventListener('gamepadconnected', () => apply({type: 'gamepad.connection', connected: true})); window.addEventListener('gamepaddisconnected', () => apply({type: 'gamepad.connection', connected: false}));
setInterval(() => { const gamepads = navigator.getGamepads?.() || []; const connected = inputPolicy.allows('gamepad') && [...gamepads].some(Boolean); if (connected !== state.gamepadConnected) apply({type: 'gamepad.connection', connected}); if (!inputPolicy.allows('gamepad')) return; const pad = [...gamepads].find(Boolean); if (!pad) return; const normalized = mapper.normalize(pad); const previous = previousGamepad.get(normalized.index); normalized.buttons.forEach((button, index) => { if (!previous || button.pressed !== previous.buttons[index]?.pressed || button.value !== previous.buttons[index]?.value) { const event = mapper.mapButton(index, button.pressed, button.value); if (event) emitInput({...event, source: 'gamepad', control: `button-${index}`}); } }); normalized.axes.forEach((value, index) => { if (!previous || Math.abs(value - (previous.axes[index] || 0)) > 0.08) { const event = mapper.mapAxis(index, value); if (event) emitInput({...event, source: 'gamepad', control: `axis-${index}`}); } }); previousGamepad.set(normalized.index, normalized); }, 100);
const suppliedStream = window.__SPARTAN_MEDIA_STREAM__; if (suppliedStream && typeof MediaStream !== 'undefined' && suppliedStream instanceof MediaStream) { const mediaState = attachMediaStreamTarget({video: elements.video, stream: suppliedStream, audioEnabled}); elements.audio.textContent = mediaState.hasAudio ? 'Active' : 'No track'; elements.video.play().catch(() => {}); }
start(); apply({type: 'session.state', status: 'negotiating'});
