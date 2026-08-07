import {createSessionEnvelope, createSessionManager} from '../session/session.mjs';
import {createInputMapper} from '../input/input.mjs';
import {createPlayerState, formatLatency, reducePlayerState} from './player-state.mjs';
import {captureVideoFrame, createRecordingController} from '../capture/capture.mjs';

const query = new URLSearchParams(location.search);
const manager = createSessionManager({idFactory: () => `ses-${crypto.randomUUID()}`});
const mapper = createInputMapper();
const elements = {
  status: document.querySelector('[data-status]'), message: document.querySelector('[data-stage-message]'), quality: document.querySelector('[data-quality]'), qualityDetail: document.querySelector('[data-quality-detail]'),
  latency: document.querySelector('[data-latency]'), latencyDetail: document.querySelector('[data-latency-detail]'), loss: document.querySelector('[data-loss]'), gamepad: document.querySelector('[data-gamepad]'), diagnostics: document.querySelector('[data-diagnostics]'), overlay: document.querySelectorAll('[data-overlay]'), stage: document.querySelector('[data-stage]'), video: document.querySelector('[data-video]'), demo: document.querySelector('[data-demo-answer]'), sessionName: document.querySelector('[data-session-name]'), transport: document.querySelector('[data-transport]'),
};
let state = createPlayerState({status: 'negotiating'});
let recording = null;

function apply(event) {
  state = reducePlayerState(state, event);
  const labels = {idle: 'Ready', preparing: 'Preparing session', negotiating: 'Negotiating session', connected: 'Connected', reconnecting: 'Reconnecting', ended: 'Session ended', error: 'Connection error'};
  elements.status.textContent = labels[state.status]; elements.quality.textContent = state.quality[0].toUpperCase() + state.quality.slice(1); elements.qualityDetail.textContent = `${elements.quality.textContent} · ${state.quality === 'low' ? '720p30' : '1080p60'}`; elements.latency.textContent = formatLatency(state.latencyMs); elements.latencyDetail.textContent = formatLatency(state.latencyMs); elements.loss.textContent = `${state.packetLossPct}%`; elements.diagnostics.classList.toggle('is-visible', state.diagnosticsVisible); elements.overlay.forEach(overlay => overlay.classList.toggle('is-hidden', !state.overlayVisible));
  if (state.status === 'error') elements.message.textContent = state.error; if (state.status === 'ended') elements.message.textContent = 'This session has ended. Return to the library to choose another backend.';
}

function start() {
  const backendId = query.get('backend') || 'spartan-host'; const backendName = query.get('name') || 'Spartan Host'; elements.sessionName.textContent = backendName;
  try { const offer = manager.start({backend: {id: backendId, backendType: 'remote-play'}}); elements.transport.textContent = offer.payload.quality.profile === 'balanced' ? 'WebRTC · adaptive' : 'WebRTC'; } catch (error) { apply({type: 'error', message: error.message}); return; }
  if (query.get('demo') === '1') setTimeout(acceptHostAnswer, 500);
}

function acceptHostAnswer() { if (manager.state !== 'negotiating' && manager.state !== 'reconnecting') return; manager.receive(createSessionEnvelope({sessionId: manager.session.id, type: 'session.answer', payload: {accepted: true}})); apply({type: 'session.state', status: 'connected'}); elements.demo.classList.add('is-hidden'); elements.message.textContent = 'Media transport is ready. Attach a host stream to begin playback.'; }
function requestReconnect() { try { const envelope = manager.requestReconnect(); apply({type: 'session.state', status: 'reconnecting'}); window.dispatchEvent(new CustomEvent('spartan:session-reconnect', {detail: envelope})); elements.message.textContent = `Reconnecting (attempt ${envelope.payload.attempt})…`; if (query.get('demo') === '1') setTimeout(acceptHostAnswer, Math.min(envelope.payload.delayMs, 700)); } catch (error) { apply({type: 'error', message: error.message}); } }

function downloadBlob(blob, filename) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }
async function takeScreenshot() { try { const blob = await captureVideoFrame(elements.video); downloadBlob(blob, `spartan-gaming-${new Date().toISOString().replaceAll(':', '-')}.png`); elements.message.textContent = 'Screenshot saved locally.'; } catch (error) { elements.message.textContent = error.message; } }
async function toggleRecording() { try { if (!recording) recording = createRecordingController({stream: elements.video.srcObject}); if (recording.state === 'recording') { const blob = await recording.stop(); downloadBlob(blob, `spartan-gaming-${new Date().toISOString().replaceAll(':', '-')}.webm`); elements.message.textContent = 'Recording saved locally.'; elements.record.classList.remove('capture-active'); } else { recording.start(); elements.message.textContent = 'Recording locally. Press record again to stop.'; elements.record.classList.add('capture-active'); } } catch (error) { elements.message.textContent = error.message; } }

document.querySelector('[data-action="fullscreen"]').addEventListener('click', () => elements.stage.requestFullscreen?.());
elements.screenshot = document.querySelector('[data-action="screenshot"]'); elements.record = document.querySelector('[data-action="record"]'); elements.screenshot.addEventListener('click', takeScreenshot); elements.record.addEventListener('click', toggleRecording); elements.reconnect = document.querySelector('[data-action="reconnect"]'); elements.reconnect.addEventListener('click', requestReconnect);
document.querySelector('[data-action="overlay"]').addEventListener('click', () => apply({type: 'toggle.overlay'}));
document.querySelector('[data-action="diagnostics"]').addEventListener('click', () => apply({type: 'toggle.diagnostics'}));
document.querySelector('[data-action="end"]').addEventListener('click', () => { if (manager.state === 'connected' || manager.state === 'reconnecting') manager.close(); apply({type: 'session.state', status: 'ended'}); });
elements.demo.addEventListener('click', acceptHostAnswer);
window.addEventListener('spartan:telemetry', event => { const sample = event.detail || {}; try { manager.receive(createSessionEnvelope({sessionId: manager.session.id, type: 'telemetry.health', payload: sample})); apply({type: 'telemetry.health', rttMs: sample.rttMs, packetLossPct: sample.packetLossPct}); apply({type: 'quality.changed', profile: manager.quality.id}); } catch { apply({type: 'error', message: 'Invalid session telemetry received'}); } });
window.addEventListener('gamepadconnected', () => apply({type: 'gamepad.connection', connected: true})); window.addEventListener('gamepaddisconnected', () => apply({type: 'gamepad.connection', connected: false}));
setInterval(() => { const gamepads = navigator.getGamepads?.() || []; const connected = [...gamepads].some(Boolean); if (connected !== state.gamepadConnected) apply({type: 'gamepad.connection', connected}); if (connected) { const pad = [...gamepads].find(Boolean); mapper.normalize(pad); } }, 500);
const suppliedStream = window.__SPARTAN_MEDIA_STREAM__; if (suppliedStream && typeof MediaStream !== 'undefined' && suppliedStream instanceof MediaStream) { elements.video.srcObject = suppliedStream; elements.video.play().catch(() => {}); }
start(); apply({type: 'session.state', status: 'negotiating'});
