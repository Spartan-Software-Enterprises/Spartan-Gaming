import '../pwa/register.mjs';
import {createSessionEnvelope, createSessionManager} from '../session/session.mjs';
import {readSessionPreferences} from '../session/preferences.mjs';
import {createSessionRuntime} from '../session/runtime.mjs';
import {createInputEventEnvelope, createInputMapper} from '../input/input.mjs';
import {createInputPermissionPolicy} from '../input/policy.mjs';
import {createHapticsController} from '../input/haptics.mjs';
import {createPointerInputEvent} from '../input/pointer.mjs';
import {createWebRtcTransport, createWebSocketSignalTransport, createWebTransportSignalTransport} from '../transport/transport.mjs';
import {readTransportPolicy, resolveSignalingTransport} from './transport-config.mjs';
import {createPlayerState, formatLatency, formatNegotiatedCapabilities, formatRate, reducePlayerState} from './player-state.mjs';
import {captureVideoFrame, createInstantReplayController, createRecordingController} from '../capture/capture.mjs';
import {createImmersiveController} from './immersive.mjs';
import {attachMediaStreamTarget, canUsePictureInPicture, describeMediaStream, observeMediaStream, setMediaAudioEnabled, togglePictureInPicture} from './media.mjs';
import {hasAuthenticatedPlayerConnection, normalizePlayerConnection} from './connection.mjs';
import {clearPendingHostPair, readPendingHostPair} from '../host/host.mjs';
import {installLanHandoffListener} from '../host/lan-handoff.mjs';
import {QUALITY_PROFILES} from '../session/quality.mjs';
import {createTouchControlEvent, createTouchControlLayout, normalizeTouchLayout} from '../input/touch-controls.mjs';
import {preparePlayerSession} from './preflight.mjs';
import {clearPendingLaunchHandoff, readPendingLaunchHandoff} from '../launch/handoff.mjs';
import {canSelectAudioOutput, findPreferredAudioOutput, listAudioOutputDevices, selectAudioOutput} from './audio-output.mjs';
import {createMediaSessionController} from './media-session.mjs';

const query = new URLSearchParams(location.search);
const pendingHostPair = readPendingHostPair(sessionStorage); clearPendingHostPair(sessionStorage);
const pendingLaunch = readPendingLaunchHandoff(sessionStorage);
let connectionSessionId = query.get('session') || pendingHostPair?.sessionId || '';
const manager = createSessionManager({idFactory: () => connectionSessionId || `ses-${crypto.randomUUID()}`});
const transportPolicy = readTransportPolicy();
let sessionPreferences = readSessionPreferences();
let inputPolicy = createInputPermissionPolicy(sessionPreferences.capabilities);
let haptics = createHapticsController({enabled: inputPolicy.allows('rumble')});
let mapper = createInputMapper();
const immersive = createImmersiveController({target: document.querySelector('[data-stage]')});
let runtime = null;
const elements = {
  status: document.querySelector('[data-status]'), message: document.querySelector('[data-stage-message]'), quality: document.querySelector('[data-quality]'), qualitySelect: document.querySelector('[data-quality-select]'), qualityDetail: document.querySelector('[data-quality-detail]'), pip: document.querySelector('[data-action="pip"]'),
  latency: document.querySelector('[data-latency]'), latencyDetail: document.querySelector('[data-latency-detail]'), loss: document.querySelector('[data-loss]'), decodeFps: document.querySelector('[data-decode-fps]'), dropped: document.querySelector('[data-dropped]'), jitter: document.querySelector('[data-jitter]'), bitrate: document.querySelector('[data-bitrate]'), gamepad: document.querySelector('[data-gamepad]'), audio: document.querySelector('[data-audio]'), audioOutput: document.querySelector('[data-audio-output]'), replay: document.querySelector('[data-action="replay"]'), negotiated: document.querySelector('[data-negotiated]'), diagnostics: document.querySelector('[data-diagnostics]'), overlay: document.querySelectorAll('[data-overlay]'), stage: document.querySelector('[data-stage]'), video: document.querySelector('[data-video]'), demo: document.querySelector('[data-demo-answer]'), connectionForm: document.querySelector('[data-connection-form]'), connectionEndpoint: document.querySelector('[data-connection-endpoint]'), connectionSession: document.querySelector('[data-connection-session]'), connectionTicket: document.querySelector('[data-connection-ticket]'), sessionName: document.querySelector('[data-session-name]'), transport: document.querySelector('[data-transport]'),
};
const mediaSession = createMediaSessionController({video: elements.video});
let state = createPlayerState({status: 'negotiating'});
let recording = null;
let instantReplay = null;
let inputSequence = 0;
let audioEnabled = true;
let autoFullscreenAttempted = false;
let focusPaused = false;
let mediaObservation = null;
let sessionPreflightReady = false;
const previousGamepad = new Map();

elements.connectionEndpoint.value = query.get('signal') || pendingHostPair?.endpoint || '';
elements.connectionSession.value = query.get('session') || pendingHostPair?.sessionId || 'ses-browser-host';
elements.connectionTicket.value = query.get('ticket') || pendingHostPair?.ticket || '';
installLanHandoffListener({handoffId: query.get('handoff'), target: 'client', onHandoff: handoff => { elements.connectionEndpoint.value = handoff.endpoint; elements.connectionSession.value = handoff.sessionId; elements.connectionTicket.value = handoff.ticket; elements.message.textContent = 'LAN session details received. Press Connect securely to join.'; }});
if (!inputPolicy.allows('gamepad')) elements.gamepad.textContent = 'Disabled by settings';
elements.stage.style.touchAction = 'none';

function apply(event) {
  state = reducePlayerState(state, event);
  const labels = {idle: 'Ready', preparing: 'Preparing session', negotiating: 'Negotiating session', connected: 'Connected', reconnecting: 'Reconnecting', ended: 'Session ended', error: 'Connection error'};
  const profile = QUALITY_PROFILES.find(item => item.id === state.quality) || QUALITY_PROFILES[2]; elements.status.textContent = labels[state.status]; elements.quality.textContent = profile.id[0].toUpperCase() + profile.id.slice(1); if (elements.qualitySelect) elements.qualitySelect.value = profile.id; elements.qualityDetail.textContent = `${elements.quality.textContent} · ${profile.maxWidth}×${profile.maxHeight} @ ${profile.maxFramerate}`; elements.latency.textContent = formatLatency(state.latencyMs); elements.latencyDetail.textContent = formatLatency(state.latencyMs); elements.loss.textContent = `${state.packetLossPct}%`; if (elements.decodeFps) elements.decodeFps.textContent = Number.isFinite(state.decodeFps) ? `${state.decodeFps} fps` : '—'; if (elements.dropped) elements.dropped.textContent = `${state.framesDropped}`; if (elements.jitter) elements.jitter.textContent = formatLatency(state.jitterMs); if (elements.bitrate) elements.bitrate.textContent = formatRate(state.bitrateKbps); elements.negotiated.textContent = formatNegotiatedCapabilities(state.negotiated); elements.diagnostics.classList.toggle('is-visible', state.diagnosticsVisible); elements.overlay.forEach(overlay => overlay.classList.toggle('is-hidden', !state.overlayVisible));
  if (state.status === 'connected' && sessionPreferences.preferences.autoFullscreen && !autoFullscreenAttempted) { autoFullscreenAttempted = true; immersive.enter().catch(() => {}); }
  if (state.status === 'error') elements.message.textContent = state.error; if (state.status === 'ended') elements.message.textContent = 'This session has ended. Return to the library to choose another backend.';
  if (state.status === 'connected' && state.mediaState === 'not-configured') elements.message.textContent = 'Host paired successfully. Media capture and encoding are not configured on this host.';
}

async function loadAudioOutputs({applyPreference = false} = {}) {
  if (!elements.audioOutput) return;
  if (!canSelectAudioOutput(elements.video)) { elements.audioOutput.disabled = true; elements.audioOutput.innerHTML = '<option value="">Browser default (selection unavailable)</option>'; return; }
  try {
    const devices = await listAudioOutputDevices();
    elements.audioOutput.disabled = false;
    elements.audioOutput.innerHTML = `<option value="">Browser default</option>${devices.map(device => `<option value="${device.deviceId.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">${device.label.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')}</option>`).join('')}`;
    if (applyPreference) { const preferred = findPreferredAudioOutput(devices, sessionPreferences.preferences.audioOutput); if (preferred) { try { await selectAudioOutput(elements.video, preferred.deviceId); elements.audioOutput.value = preferred.deviceId; } catch { /* Keep the browser default when a device disappears or routing is denied. */ } } }
  } catch { elements.audioOutput.disabled = true; elements.audioOutput.innerHTML = '<option value="">Audio outputs unavailable</option>'; }
}

async function prepareSession() {
  if (sessionPreflightReady) return;
  const preflight = await preparePlayerSession();
  sessionPreferences = preflight.preferences;
  immersive.setDisplayPreference(sessionPreferences.preferences.display);
  await loadAudioOutputs({applyPreference: true});
  if (elements.pip) elements.pip.disabled = !sessionPreferences.preferences.pictureInPicture || !canUsePictureInPicture(elements.video);
  if (elements.replay) elements.replay.disabled = !sessionPreferences.preferences.instantReplay;
  elements.video.volume = sessionPreferences.preferences.gameVolume;
  if (sessionPreferences.preferences.showTelemetry && !state.diagnosticsVisible) apply({type: 'toggle.diagnostics'});
  mapper = createInputMapper({bindings: sessionPreferences.preferences.controllerBindings, deadzone: sessionPreferences.preferences.controllerDeadzone});
  inputPolicy = preflight.inputPolicy;
  haptics = createHapticsController({enabled: inputPolicy.allows('rumble')});
  sessionPreflightReady = true;
}

async function connect(connectionValues = {}) {
  const backendId = query.get('backend') || 'spartan-host'; const backendName = query.get('name') || pendingHostPair?.name || 'Spartan Host'; elements.sessionName.textContent = backendName; mediaSession.update({title: backendName, artist: 'Spartan Gaming', album: 'Cloud gaming session'});
  const connection = normalizePlayerConnection(connectionValues);
  const authenticated = hasAuthenticatedPlayerConnection(connection);
  if (!connection.endpoint) throw new Error('Signaling endpoint is required');
  if (!authenticated && !connectionValues.allowUnauthenticated) throw new Error('A short-lived client ticket is required for signaling');
  if (authenticated) connectionSessionId = connection.sessionId;
  const selectedSignaling = resolveSignalingTransport({endpoint: connection.endpoint, policy: transportPolicy});
  const join = authenticated ? {sessionId: connection.sessionId, role: 'client', ticket: connection.ticket} : undefined;
  const signaling = selectedSignaling === 'webtransport' ? createWebTransportSignalTransport({endpoint: connection.endpoint, join}) : createWebSocketSignalTransport({endpoint: connection.endpoint, join});
  const media = typeof RTCPeerConnection === 'function' ? createWebRtcTransport({ice: {policy: transportPolicy.icePolicy}}) : undefined;
  runtime = createSessionRuntime({manager, signaling, media});
  runtime.on('stream', stream => {
    instantReplay?.stop?.(); instantReplay = null;
    if (sessionPreferences.preferences.instantReplay) {
      try { instantReplay = createInstantReplayController({stream, durationSeconds: sessionPreferences.preferences.replayLengthSeconds, codec: sessionPreferences.preferences.recordingCodec}); instantReplay.start(); if (elements.replay) elements.replay.disabled = false; }
      catch { if (elements.replay) elements.replay.disabled = true; }
    }
    const mediaState = attachMediaStreamTarget({video: elements.video, stream, audioEnabled});
    mediaObservation?.disconnect();
    mediaObservation = observeMediaStream(stream, nextState => { elements.audio.textContent = nextState.hasAudio ? (audioEnabled ? 'Active' : 'Muted') : 'No track'; });
    elements.audio.textContent = mediaState.hasAudio ? (audioEnabled ? 'Active' : 'Muted') : 'No track'; elements.video.play().catch(() => {});
    mediaSession.setPlaybackState('playing');
  });
  runtime.on('stream', () => { apply({type: 'media.state', state: 'active'}); elements.demo.classList.add('is-hidden'); });
  runtime.on('session.answer', message => { const mediaState = message.payload?.hostCapabilities?.media?.state || (message.payload?.sdp ? 'negotiating' : 'not-configured'); apply({type: 'media.state', state: mediaState}); apply({type: 'session.negotiated', capabilities: manager.negotiated}); elements.demo.classList.add('is-hidden'); });
  runtime.on('telemetry', sample => { apply({type: 'telemetry.health', rttMs: sample.rttMs, packetLossPct: sample.packetLossPct, decodeFps: sample.decodeFps, framesDropped: sample.framesDropped, jitterMs: sample.jitterMs, bitrateKbps: sample.bitrateKbps}); apply({type: 'quality.changed', profile: manager.quality.id}); });
  runtime.on('error', error => apply({type: 'error', message: error.message || 'Transport error'}));
  runtime.on('reconnect.state', reconnect => {
    if (reconnect.state === 'waiting') elements.message.textContent = `Reconnect attempt ${reconnect.attempt}/${reconnect.maxAttempts} pending${reconnect.delayMs ? ` · retrying in ${Math.ceil(reconnect.delayMs / 1000)}s` : ''}.`;
    if (reconnect.state === 'exhausted') apply({type: 'error', message: 'Reconnect attempts exhausted. Check the host and signaling connection.'});
    if (reconnect.state === 'succeeded') elements.message.textContent = 'Session reconnected.';
  });
  runtime.on('input.event', message => { const event = message.payload || {}; if (event.source === 'host' && event.kind === 'rumble' && inputPolicy.allows('rumble')) haptics.play({gamepadIndex: event.gamepadIndex, durationMs: event.durationMs, strongMagnitude: event.strongMagnitude ?? event.value, weakMagnitude: event.weakMagnitude ?? event.value}); });
  const offer = await runtime.start({backend: {id: backendId, backendType: 'remote-play', hostId: pendingHostPair?.hostId, pairingCode: pendingHostPair?.pairingCode}, capabilities: sessionPreferences.capabilities, preferences: sessionPreferences.preferences, ...(pendingLaunch ? {launch: pendingLaunch.request} : {})});
  if (pendingLaunch) clearPendingLaunchHandoff(sessionStorage);
  elements.transport.textContent = `${selectedSignaling === 'webtransport' ? 'WebTransport' : 'WebSocket'} signaling${media ? ' · WebRTC media' : ''}`;
  elements.connectionForm.hidden = true; window.dispatchEvent(new CustomEvent('spartan:session-offer', {detail: offer}));
}

async function start() {
  const endpoint = query.get('signal') || pendingHostPair?.endpoint; const ticket = query.get('ticket') || pendingHostPair?.ticket; const sessionId = query.get('session') || pendingHostPair?.sessionId;
  try {
    await prepareSession();
    installTouchControls();
    if (endpoint && ticket && sessionId) await connect({endpoint, ticket, sessionId});
    else if (endpoint && pendingHostPair) await connect({endpoint, allowUnauthenticated: true});
    else if (query.get('demo') === '1') { const offer = manager.start({backend: {id: query.get('backend') || 'spartan-host', backendType: 'remote-play'}, capabilities: sessionPreferences.capabilities, preferences: sessionPreferences.preferences, ...(pendingLaunch ? {launch: pendingLaunch.request} : {})}); if (pendingLaunch) clearPendingLaunchHandoff(sessionStorage); elements.connectionForm.hidden = true; elements.transport.textContent = offer.payload.quality.profile === 'balanced' ? 'WebRTC · adaptive' : 'WebRTC'; setTimeout(acceptHostAnswer, 500); }
    else { elements.message.textContent = pendingLaunch ? 'A native launch request is ready. Pair a host to continue.' : 'Enter a signaling endpoint, session ID, and short-lived client ticket to connect.'; }
  } catch (error) { runtime?.close(); runtime = null; apply({type: 'error', message: error.message}); }
}

elements.connectionForm.addEventListener('submit', async event => {
  event.preventDefault();
  try { await connect({endpoint: elements.connectionEndpoint.value, sessionId: elements.connectionSession.value, ticket: elements.connectionTicket.value}); }
  catch (error) { runtime?.close(); runtime = null; apply({type: 'error', message: error.message}); }
});

function acceptHostAnswer() { if (manager.state !== 'negotiating' && manager.state !== 'reconnecting') return; try { const answer = createSessionEnvelope({sessionId: manager.session.id, type: 'session.answer', payload: {accepted: true, capabilities: manager.session.capabilities, hostCapabilities: {media: {state: 'not-configured'}}}}); if (runtime) runtime.receive(answer); else manager.receive(answer); if (manager.state !== 'connected') return; apply({type: 'session.negotiated', capabilities: manager.negotiated}); apply({type: 'session.state', status: 'connected'}); apply({type: 'media.state', state: 'not-configured'}); elements.demo.classList.add('is-hidden'); } catch (error) { apply({type: 'error', message: error.message || 'Host answer rejected'}); } }
function requestReconnect() { try { if (runtime?.reconnect.state === 'waiting') { runtime.cancelReconnect(); elements.message.textContent = 'Reconnect cancelled. Press reconnect to try again.'; return; } const envelope = runtime ? runtime.requestReconnect() : manager.requestReconnect(); apply({type: 'session.state', status: 'reconnecting'}); window.dispatchEvent(new CustomEvent('spartan:session-reconnect', {detail: envelope})); elements.message.textContent = `Reconnecting (attempt ${envelope.payload.attempt})…`; if (query.get('demo') === '1') setTimeout(acceptHostAnswer, Math.min(envelope.payload.delayMs, 700)); } catch (error) { apply({type: 'error', message: error.message}); } }
function applyFocusPolicy(isBlurred) { if (!sessionPreferences.preferences.pauseOnBlur || state.status !== 'connected') return; if (isBlurred && !focusPaused) { focusPaused = true; elements.video.pause(); try { runtime?.requestControl('pause'); } catch { /* focus changes must not interrupt teardown */ } } else if (!isBlurred && focusPaused) { focusPaused = false; elements.video.play?.().catch?.(() => {}); try { runtime?.requestControl('resume'); } catch { /* focus changes must not interrupt teardown */ } } }
function emitInput(event) { if (!inputPolicy.allows(event.source)) return; try { const envelope = createInputEventEnvelope({sessionId: manager.session?.id, event, sequence: ++inputSequence}); if (runtime) runtime.send(envelope); window.dispatchEvent(new CustomEvent('spartan:input', {detail: envelope})); } catch { /* Input is best-effort while a session is ending. */ } }
function requestQuality(profileId) { try { if (runtime) runtime.requestQuality(profileId); else manager.setQuality(profileId); apply({type: 'quality.changed', profile: profileId}); elements.message.textContent = `Quality set to ${profileId}.`; } catch (error) { elements.qualitySelect.value = state.quality; elements.message.textContent = error.message; } }
function installTouchControls() { const layout = normalizeTouchLayout(sessionPreferences.preferences.touchLayout); const touchAvailable = query.get('touch') === '1' || Number(navigator.maxTouchPoints) > 0; if (layout === 'off' || !touchAvailable || !inputPolicy.allows('touch')) return; const root = document.createElement('div'); root.className = `touch-controls touch-controls-${layout}`; root.setAttribute('aria-label', 'Touch game controls'); root.innerHTML = createTouchControlLayout(layout).map(control => `<button type="button" class="touch-control touch-${control.group}" data-touch-action="${control.action}" aria-label="${control.action}">${control.label}</button>`).join(''); const active = new Map(); const release = (button, pointerId) => { const action = active.get(pointerId) || button?.dataset.touchAction; if (!action) return; active.delete(pointerId); emitInput(createTouchControlEvent({action, pressed: false})); button?.releasePointerCapture?.(pointerId); }; root.addEventListener('pointerdown', event => { const button = event.target.closest('[data-touch-action]'); if (!button) return; event.preventDefault(); event.stopPropagation(); active.set(event.pointerId, button.dataset.touchAction); button.setPointerCapture?.(event.pointerId); button.classList.add('is-pressed'); emitInput(createTouchControlEvent({action: button.dataset.touchAction, pressed: true})); }); root.addEventListener('pointerup', event => { const button = event.target.closest('[data-touch-action]'); if (!button) return; event.preventDefault(); event.stopPropagation(); button.classList.remove('is-pressed'); release(button, event.pointerId); }); root.addEventListener('pointercancel', event => { const button = event.target.closest('[data-touch-action]'); if (!button) return; event.preventDefault(); event.stopPropagation(); button.classList.remove('is-pressed'); release(button, event.pointerId); }); elements.stage.append(root); }
function keyboardInput(event, pressed) { if (event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName)) return; if (event.repeat && pressed) return; emitInput({type: 'input.event', action: `key:${event.code}`, pressed, value: pressed ? 1 : 0, source: 'keyboard', control: event.code}); }
function pointerInput(event) { const source = event.pointerType === 'touch' ? 'touch' : 'pointer'; if (!inputPolicy.allows(source)) return; event.preventDefault(); if (event.type === 'pointerdown') elements.stage.setPointerCapture?.(event.pointerId); emitInput(createPointerInputEvent({event, rect: elements.stage.getBoundingClientRect()})); }

function downloadBlob(blob, filename) { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }
function captureExtension(blob, fallback = 'webm') { return blob?.type?.includes('mp4') ? 'mp4' : blob?.type?.includes('png') ? 'png' : fallback; }
async function saveCaptureBlob(blob, filename, location = sessionPreferences.preferences.recordingLocation) {
  if (['Ask each time', 'Custom folder'].includes(location) && typeof globalThis.showSaveFilePicker === 'function') {
    const extension = captureExtension(blob, filename.split('.').pop());
    const handle = await globalThis.showSaveFilePicker({suggestedName: filename.replace(/\.[^.]+$/, `.${extension}`), types: [{description: blob.type || 'Capture', accept: {[blob.type || 'application/octet-stream']: [`.${extension}`]}}]});
    const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); return;
  }
  downloadBlob(blob, filename.replace(/\.[^.]+$/, `.${captureExtension(blob, filename.split('.').pop())}`));
}
async function takeScreenshot() { try { const blob = await captureVideoFrame(elements.video); await saveCaptureBlob(blob, `spartan-gaming-${new Date().toISOString().replaceAll(':', '-')}.png`); elements.message.textContent = 'Screenshot saved locally.'; } catch (error) { elements.message.textContent = error.message; } }
async function toggleRecording() { try { if (!recording) recording = createRecordingController({stream: elements.video.srcObject, codec: sessionPreferences.preferences.recordingCodec}); if (recording.state === 'recording') { const blob = await recording.stop(); await saveCaptureBlob(blob, `spartan-gaming-${new Date().toISOString().replaceAll(':', '-')}.webm`); elements.message.textContent = 'Recording saved locally.'; elements.record.classList.remove('capture-active'); } else { recording.start(); elements.message.textContent = 'Recording locally. Press record again to stop.'; elements.record.classList.add('capture-active'); } } catch (error) { elements.message.textContent = error.message; } }
async function saveInstantReplay() { try { if (!instantReplay) throw new Error('Instant replay is unavailable until a stream is active.'); const blob = instantReplay.clip(); await saveCaptureBlob(blob, `spartan-replay-${new Date().toISOString().replaceAll(':', '-')}.webm`); elements.message.textContent = 'Instant replay saved locally.'; } catch (error) { elements.message.textContent = error.message; } }

document.querySelector('[data-action="audio"]').addEventListener('click', () => { audioEnabled = !audioEnabled; setMediaAudioEnabled(elements.video, audioEnabled); elements.audio.textContent = audioEnabled ? (describeMediaStream(elements.video.srcObject).hasAudio ? 'Active' : 'Waiting') : 'Muted'; const button = document.querySelector('[data-action="audio"]'); button.textContent = audioEnabled ? '🔊' : '🔇'; button.setAttribute('aria-label', audioEnabled ? 'Mute session audio' : 'Unmute session audio'); });
elements.audioOutput?.addEventListener('change', async event => { try { await selectAudioOutput(elements.video, event.target.value); elements.message.textContent = event.target.value ? 'Session audio output changed.' : 'Session audio is using the browser default output.'; } catch (error) { event.target.value = ''; elements.message.textContent = error.message; } });
elements.qualitySelect?.addEventListener('change', event => requestQuality(event.target.value));
document.querySelector('[data-action="fullscreen"]').addEventListener('click', () => immersive.toggle().catch(error => { elements.message.textContent = error.message; }));
document.querySelector('[data-action="pip"]').addEventListener('click', async () => { try { const active = await togglePictureInPicture(elements.video); const button = document.querySelector('[data-action="pip"]'); button.setAttribute('aria-label', active ? 'Exit Picture-in-Picture' : 'Enter Picture-in-Picture'); elements.message.textContent = active ? 'Picture-in-Picture enabled.' : 'Picture-in-Picture closed.'; } catch (error) { elements.message.textContent = error.message; } });
elements.screenshot = document.querySelector('[data-action="screenshot"]'); elements.record = document.querySelector('[data-action="record"]'); elements.screenshot.addEventListener('click', takeScreenshot); elements.record.addEventListener('click', toggleRecording); elements.replay?.addEventListener('click', saveInstantReplay); elements.reconnect = document.querySelector('[data-action="reconnect"]'); elements.reconnect.addEventListener('click', requestReconnect);
document.querySelector('[data-action="overlay"]').addEventListener('click', () => apply({type: 'toggle.overlay'}));
document.querySelector('[data-action="diagnostics"]').addEventListener('click', () => apply({type: 'toggle.diagnostics'}));
document.querySelector('[data-action="end"]').addEventListener('click', () => { instantReplay?.stop?.(); instantReplay = null; if (runtime) runtime.close(); else if (manager.state === 'connected' || manager.state === 'reconnecting') manager.close(); mediaSession.dispose(); apply({type: 'session.state', status: 'ended'}); });
elements.demo.addEventListener('click', acceptHostAnswer);
window.addEventListener('spartan:telemetry', event => { const sample = event.detail || {}; try { const telemetry = createSessionEnvelope({sessionId: manager.session.id, type: 'telemetry.health', payload: sample}); if (runtime) runtime.receive(telemetry); else manager.receive(telemetry); apply({type: 'telemetry.health', rttMs: sample.rttMs, packetLossPct: sample.packetLossPct, decodeFps: sample.decodeFps, framesDropped: sample.framesDropped, jitterMs: sample.jitterMs, bitrateKbps: sample.bitrateKbps}); apply({type: 'quality.changed', profile: manager.quality.id}); } catch { apply({type: 'error', message: 'Invalid session telemetry received'}); } });
window.addEventListener('keydown', event => keyboardInput(event, true)); window.addEventListener('keyup', event => keyboardInput(event, false));
window.addEventListener('blur', () => applyFocusPolicy(true)); window.addEventListener('focus', () => applyFocusPolicy(false)); document.addEventListener('visibilitychange', () => applyFocusPolicy(document.visibilityState !== 'visible'));
['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(type => elements.stage.addEventListener(type, pointerInput, {passive: false}));
window.addEventListener('gamepadconnected', () => apply({type: 'gamepad.connection', connected: true})); window.addEventListener('gamepaddisconnected', () => apply({type: 'gamepad.connection', connected: false}));
setInterval(() => { const gamepads = navigator.getGamepads?.() || []; const connected = inputPolicy.allows('gamepad') && [...gamepads].some(Boolean); if (connected !== state.gamepadConnected) apply({type: 'gamepad.connection', connected}); if (!inputPolicy.allows('gamepad')) return; const pad = [...gamepads].find(Boolean); if (!pad) return; const normalized = mapper.normalize(pad); const previous = previousGamepad.get(normalized.index); normalized.buttons.forEach((button, index) => { if (!previous || button.pressed !== previous.buttons[index]?.pressed || button.value !== previous.buttons[index]?.value) { const event = mapper.mapButton(index, button.pressed, button.value); if (event) emitInput({...event, source: 'gamepad', control: `button-${index}`}); } }); normalized.axes.forEach((value, index) => { if (!previous || Math.abs(value - (previous.axes[index] || 0)) > 0.08) { const event = mapper.mapAxis(index, value); if (event) emitInput({...event, source: 'gamepad', control: `axis-${index}`}); } }); previousGamepad.set(normalized.index, normalized); }, 100);
const suppliedStream = window.__SPARTAN_MEDIA_STREAM__; if (suppliedStream && typeof MediaStream !== 'undefined' && suppliedStream instanceof MediaStream) { const mediaState = attachMediaStreamTarget({video: elements.video, stream: suppliedStream, audioEnabled}); elements.audio.textContent = mediaState.hasAudio ? 'Active' : 'No track'; elements.video.play().catch(() => {}); }
start(); apply({type: 'session.state', status: 'negotiating'});
