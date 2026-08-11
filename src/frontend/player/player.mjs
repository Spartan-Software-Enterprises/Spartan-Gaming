import '../pwa/register.mjs';
import { createSessionEnvelope, createSessionManager } from '../session/session.mjs';
import { readSessionPreferences } from '../session/preferences.mjs';
import { createSessionRuntime } from '../session/runtime.mjs';
import { createInputEventEnvelope, createInputMapper } from '../input/input.mjs';
import { createControllerProfileStore, resolveControllerProfile } from '../input/profiles.mjs';
import { createInputPermissionPolicy } from '../input/policy.mjs';
import { controllerPollingIntervalMs } from '../input/controller-policy.mjs';
import { createHapticsController } from '../input/haptics.mjs';
import { createPointerInputEvent, createWheelInputEvent } from '../input/pointer.mjs';
import {
  createWebRtcTransport,
  createWebSocketSignalTransport,
  createWebTransportSignalTransport,
} from '../transport/transport.mjs';
import {
  readTransportPolicy,
  resolveSignalingEndpoint,
  resolveSignalingTransport,
} from './transport-config.mjs';
import {
  createPlayerState,
  formatLatency,
  formatNegotiatedCapabilities,
  formatRate,
  reducePlayerState,
} from './player-state.mjs';
import {
  captureVideoFrame,
  createInstantReplayController,
  createRecordingController,
} from '../capture/capture.mjs';
import { createImmersiveController } from './immersive.mjs';
import {
  applyCaptionPreference,
  attachMediaStreamTarget,
  canUsePictureInPicture,
  describeMediaStream,
  observeMediaStream,
  setMediaAudioEnabled,
  togglePictureInPicture,
} from './media.mjs';
import { hasAuthenticatedPlayerConnection, normalizePlayerConnection } from './connection.mjs';
import { clearPendingHostPair, readPendingHostPair } from '../host/host.mjs';
import { installLanHandoffListener } from '../host/lan-handoff.mjs';
import { QUALITY_PROFILES, findQualityProfile } from '../session/quality.mjs';
import {
  createTouchControlEvent,
  createTouchControlLayout,
  createTouchStickEvents,
  normalizeTouchLayout,
} from '../input/touch-controls.mjs';
import { preparePlayerSession } from './preflight.mjs';
import { clearPendingLaunchHandoff, readPendingLaunchHandoff } from '../launch/handoff.mjs';
import {
  canSelectAudioOutput,
  findPreferredAudioOutput,
  listAudioOutputDevices,
  selectAudioOutput,
} from './audio-output.mjs';
import { createMediaSessionController } from './media-session.mjs';
import { clearTransientSessionData } from '../privacy/cleanup.mjs';
import {
  describeNegotiationAdjustments,
  formatNegotiationAdjustments,
} from '../session/negotiation-notices.mjs';
import {
  createSessionDiagnosticsBundle,
  createSessionTelemetryLog,
  serializeSessionDiagnostics,
} from '../session/telemetry-log.mjs';
import {
  clearSessionRecoveryHandoff,
  readSessionRecoveryHandoff,
  saveSessionRecoveryHandoff,
} from '../session/recovery-handoff.mjs';
import { createActiveProfileStorage } from '../profiles/storage.mjs';
import { resolveSessionPauseAction } from './session-controls.mjs';
import { formatDisplayNegotiation, resolveDisplayNegotiation } from '../display/negotiation.mjs';
import { formatSessionVolume, setSessionVolume } from './volume.mjs';
import { createStickyKeysController } from '../input/sticky-keys.mjs';
import { createWakeLockController } from './wake-lock.mjs';

const query = new URLSearchParams(location.search);
const pendingHostPair = readPendingHostPair(sessionStorage);
clearPendingHostPair(sessionStorage);
const pendingLaunch = readPendingLaunchHandoff(sessionStorage);
const storedRecovery = readSessionRecoveryHandoff(sessionStorage);
let connectionSessionId =
  query.get('session') || pendingHostPair?.sessionId || storedRecovery?.sessionId || '';
const manager = createSessionManager({
  idFactory: () => connectionSessionId || `ses-${crypto.randomUUID()}`,
});
const transportPolicy = readTransportPolicy();
const profileStorage = createActiveProfileStorage();
const controllerProfileOverride = query.get('controllerProfile') || undefined;
let sessionPreferences = readSessionPreferences(globalThis.localStorage, undefined, {
  workspaceStorage: profileStorage,
  controllerProfile: controllerProfileOverride,
});
const recoveryHandoff =
  sessionPreferences.preferences.restoreSession && !pendingHostPair ? storedRecovery : null;
let inputPolicy = createInputPermissionPolicy(sessionPreferences.capabilities);
let haptics = createHapticsController({ enabled: inputPolicy.allows('rumble') });
const controllerProfiles = createControllerProfileStore({ storage: profileStorage }).list();
let mapper = createInputMapper({
  bindings: sessionPreferences.preferences.controllerBindings,
  deadzone: sessionPreferences.preferences.controllerDeadzone,
});
const stickyKeys = createStickyKeysController({
  enabled: sessionPreferences.preferences.stickyKeys,
});
const immersive = createImmersiveController({ target: document.querySelector('[data-stage]') });
let runtime = null;
const elements = {
  status: document.querySelector('[data-status]'),
  message: document.querySelector('[data-stage-message]'),
  quality: document.querySelector('[data-quality]'),
  qualitySelect: document.querySelector('[data-quality-select]'),
  qualityDetail: document.querySelector('[data-quality-detail]'),
  pip: document.querySelector('[data-action="pip"]'),
  latency: document.querySelector('[data-latency]'),
  latencyDetail: document.querySelector('[data-latency-detail]'),
  loss: document.querySelector('[data-loss]'),
  decodeFps: document.querySelector('[data-decode-fps]'),
  dropped: document.querySelector('[data-dropped]'),
  jitter: document.querySelector('[data-jitter]'),
  bitrate: document.querySelector('[data-bitrate]'),
  gamepad: document.querySelector('[data-gamepad]'),
  audio: document.querySelector('[data-audio]'),
  audioOutput: document.querySelector('[data-audio-output]'),
  sessionVolume: document.querySelector('[data-session-volume]'),
  sessionVolumeValue: document.querySelector('[data-session-volume-value]'),
  replay: document.querySelector('[data-action="replay"]'),
  negotiated: document.querySelector('[data-negotiated]'),
  display: document.querySelector('[data-display]'),
  diagnostics: document.querySelector('[data-diagnostics]'),
  overlay: document.querySelectorAll('[data-overlay]'),
  stage: document.querySelector('[data-stage]'),
  video: document.querySelector('[data-video]'),
  demo: document.querySelector('[data-demo-answer]'),
  connectionForm: document.querySelector('[data-connection-form]'),
  connectionEndpoint: document.querySelector('[data-connection-endpoint]'),
  connectionSession: document.querySelector('[data-connection-session]'),
  connectionTicket: document.querySelector('[data-connection-ticket]'),
  sessionName: document.querySelector('[data-session-name]'),
  transport: document.querySelector('[data-transport]'),
};
const mediaSession = createMediaSessionController({ video: elements.video });
const wakeLock = createWakeLockController({
  enabled: sessionPreferences.preferences.mobile.keepScreenAwake,
});
let state = createPlayerState({ status: 'negotiating' });
let recording = null;
let instantReplay = null;
let inputSequence = 0;
let audioEnabled = true;
let autoFullscreenAttempted = false;
let focusPaused = false;
let sessionPaused = false;
let mediaObservation = null;
let sessionPreflightReady = false;
let negotiationAdjustments = [];
let displayNegotiation = resolveDisplayNegotiation();
const telemetryLog = createSessionTelemetryLog({ enabled: false });
const previousGamepad = new Map();
const gamepadMappers = new Map();
const gamepadProfileIds = new Map();

function mapperForGamepad(gamepad) {
  const selection = sessionPreferences.preferences.controllerProfileSelection.toLowerCase();
  if (selection !== 'auto' && selection !== 'auto-detect') return mapper;
  const profile = resolveControllerProfile({
    profileId: 'auto',
    deviceName: gamepad.id,
    profiles: controllerProfiles,
  });
  if (!profile) return mapper;
  const profileId = profile.id;
  if (gamepadProfileIds.get(gamepad.index) !== profileId) {
    gamepadProfileIds.set(gamepad.index, profileId);
    gamepadMappers.set(
      gamepad.index,
      createInputMapper({ bindings: profile.bindings, deadzone: profile.deadzone }),
    );
    elements.message.textContent = `Controller ${gamepad.index + 1}: ${profile.name}.`;
  }
  return gamepadMappers.get(gamepad.index) || mapper;
}

elements.connectionEndpoint.value = resolveSignalingEndpoint({
  queryEndpoint: query.get('signal'),
  pendingEndpoint: pendingHostPair?.endpoint,
  recoveryEndpoint: recoveryHandoff?.endpoint,
  customEndpoint: sessionPreferences.preferences.customSignalingUrl,
});
elements.connectionSession.value =
  query.get('session') ||
  pendingHostPair?.sessionId ||
  recoveryHandoff?.sessionId ||
  'ses-browser-host';
elements.connectionTicket.value =
  query.get('ticket') || pendingHostPair?.ticket || recoveryHandoff?.ticket || '';
installLanHandoffListener({
  handoffId: query.get('handoff'),
  target: 'client',
  onHandoff: (handoff) => {
    elements.connectionEndpoint.value = handoff.endpoint;
    elements.connectionSession.value = handoff.sessionId;
    elements.connectionTicket.value = handoff.ticket;
    elements.message.textContent = 'LAN session details received. Press Connect securely to join.';
  },
});
if (!inputPolicy.allows('gamepad')) elements.gamepad.textContent = 'Disabled by settings';
elements.stage.style.touchAction = 'none';
elements.diagnostics
  .querySelector('h2')
  ?.insertAdjacentHTML(
    'afterend',
    '<button class="secondary" data-action="export-session" type="button">Export session report</button>',
  );
elements.diagnostics
  .querySelector('.audio-output-control')
  ?.insertAdjacentHTML(
    'beforeend',
    '<label for="session-volume">Game volume</label><input id="session-volume" data-session-volume type="range" min="0" max="100" step="1" value="100" aria-label="Game volume"><output data-session-volume-value for="session-volume">100%</output>',
  );
elements.sessionVolume = document.querySelector('[data-session-volume]');
elements.sessionVolumeValue = document.querySelector('[data-session-volume-value]');
elements.diagnostics
  .querySelector('dl')
  ?.insertAdjacentHTML(
    'afterbegin',
    '<div><dt>Display outcome</dt><dd data-display>Pending</dd></div>',
  );
elements.display = document.querySelector('[data-display]');
document
  .querySelector('.overlay-bottom')
  ?.insertAdjacentHTML(
    'afterbegin',
    '<button class="icon-button" data-action="pause" aria-label="Pause session">Ⅱ</button>',
  );
elements.pause = document.querySelector('[data-action="pause"]');

function apply(event) {
  state = reducePlayerState(state, event);
  globalThis.spartanElectron?.setSessionActive?.(
    state.status === 'connected' || state.status === 'reconnecting',
  );
  const labels = {
    idle: 'Ready',
    preparing: 'Preparing session',
    negotiating: 'Negotiating session',
    connected: 'Connected',
    reconnecting: 'Reconnecting',
    ended: 'Session ended',
    error: 'Connection error',
  };
  const profile = findQualityProfile(
    sessionPreferences.preferences.qualityProfiles || QUALITY_PROFILES,
    state.quality,
  );
  elements.status.textContent = labels[state.status];
  elements.quality.textContent = profile.id[0].toUpperCase() + profile.id.slice(1);
  if (elements.qualitySelect) elements.qualitySelect.value = profile.id;
  elements.qualityDetail.textContent = `${elements.quality.textContent} · ${profile.maxWidth}×${profile.maxHeight} @ ${profile.maxFramerate}`;
  elements.latency.textContent = formatLatency(state.latencyMs);
  elements.latencyDetail.textContent = formatLatency(state.latencyMs);
  elements.loss.textContent = `${state.packetLossPct}%`;
  if (elements.decodeFps)
    elements.decodeFps.textContent = Number.isFinite(state.decodeFps)
      ? `${state.decodeFps} fps`
      : '—';
  if (elements.dropped) elements.dropped.textContent = `${state.framesDropped}`;
  if (elements.jitter) elements.jitter.textContent = formatLatency(state.jitterMs);
  if (elements.bitrate) elements.bitrate.textContent = formatRate(state.bitrateKbps);
  elements.negotiated.textContent = formatNegotiatedCapabilities(state.negotiated);
  if (elements.display) elements.display.textContent = formatDisplayNegotiation(displayNegotiation);
  elements.diagnostics.classList.toggle('is-visible', state.diagnosticsVisible);
  elements.overlay.forEach((overlay) =>
    overlay.classList.toggle('is-hidden', !state.overlayVisible),
  );
  if (
    state.status === 'connected' &&
    sessionPreferences.preferences.autoFullscreen &&
    !autoFullscreenAttempted
  ) {
    autoFullscreenAttempted = true;
    immersive.enter().catch(() => {});
  }
  if (state.status === 'connected' || state.status === 'reconnecting') void wakeLock.start();
  else if (state.status === 'ended' || state.status === 'error') void wakeLock.stop();
  if (state.status === 'error') elements.message.textContent = state.error;
  if (state.status === 'ended')
    elements.message.textContent =
      'This session has ended. Return to the library to choose another backend.';
  if (event.type === 'session.negotiated') {
    negotiationAdjustments = describeNegotiationAdjustments({
      requested: sessionPreferences.capabilities,
      negotiated: state.negotiated,
    });
    displayNegotiation = resolveDisplayNegotiation({
      preferences: sessionPreferences.preferences,
      requestedCapabilities: sessionPreferences.capabilities,
      negotiatedCapabilities: state.negotiated,
      displayCapabilities: sessionPreferences.preferences.displayPolicy,
    });
    inputPolicy = createInputPermissionPolicy(state.negotiated);
    haptics = createHapticsController({ enabled: inputPolicy.allows('rumble') });
    const notice = formatNegotiationAdjustments(negotiationAdjustments);
    if (notice) elements.message.textContent = notice;
  }
  if (event.type === 'telemetry.health') telemetryLog.add(event);
  if (state.status === 'connected' && state.mediaState === 'not-configured')
    elements.message.textContent =
      'Host paired successfully. Media capture and encoding are not configured on this host.';
}

async function loadAudioOutputs({ applyPreference = false } = {}) {
  if (!elements.audioOutput) return;
  if (!canSelectAudioOutput(elements.video)) {
    elements.audioOutput.disabled = true;
    elements.audioOutput.innerHTML =
      '<option value="">Browser default (selection unavailable)</option>';
    return;
  }
  try {
    const devices = await listAudioOutputDevices();
    elements.audioOutput.disabled = false;
    elements.audioOutput.innerHTML = `<option value="">Browser default</option>${devices.map((device) => `<option value="${device.deviceId.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">${device.label.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')}</option>`).join('')}`;
    if (applyPreference) {
      const preferred = findPreferredAudioOutput(
        devices,
        sessionPreferences.preferences.audioOutput,
      );
      if (preferred) {
        try {
          await selectAudioOutput(elements.video, preferred.deviceId);
          elements.audioOutput.value = preferred.deviceId;
        } catch {
          /* Keep the browser default when a device disappears or routing is denied. */
        }
      }
    }
  } catch {
    elements.audioOutput.disabled = true;
    elements.audioOutput.innerHTML = '<option value="">Audio outputs unavailable</option>';
  }
}

async function prepareSession() {
  if (sessionPreflightReady) return;
  const preflight = await preparePlayerSession({
    workspaceStorage: profileStorage,
    controllerProfile: controllerProfileOverride,
  });
  sessionPreferences = preflight.preferences;
  displayNegotiation = resolveDisplayNegotiation({
    preferences: sessionPreferences.preferences,
    requestedCapabilities: sessionPreferences.capabilities,
    displayCapabilities: sessionPreferences.preferences.displayPolicy,
  });
  telemetryLog.setEnabled(sessionPreferences.preferences.sessionTelemetry);
  immersive.setDisplayPreference(sessionPreferences.preferences.display);
  await loadAudioOutputs({ applyPreference: true });
  if (elements.pip)
    elements.pip.disabled =
      !sessionPreferences.preferences.pictureInPicture || !canUsePictureInPicture(elements.video);
  if (elements.replay) elements.replay.disabled = !sessionPreferences.preferences.instantReplay;
  elements.video.volume = sessionPreferences.preferences.gameVolume;
  if (elements.sessionVolume)
    elements.sessionVolume.value = String(
      Math.round(sessionPreferences.preferences.gameVolume * 100),
    );
  if (elements.sessionVolumeValue)
    elements.sessionVolumeValue.textContent = formatSessionVolume(
      sessionPreferences.preferences.gameVolume,
    );
  if (sessionPreferences.preferences.showTelemetry && !state.diagnosticsVisible)
    apply({ type: 'toggle.diagnostics' });
  mapper = createInputMapper({
    bindings: sessionPreferences.preferences.controllerBindings,
    deadzone: sessionPreferences.preferences.controllerDeadzone,
  });
  inputPolicy = preflight.inputPolicy;
  haptics = createHapticsController({ enabled: inputPolicy.allows('rumble') });
  sessionPreflightReady = true;
}

async function connect(connectionValues = {}) {
  const backendId =
    query.get('backend') ||
    pendingHostPair?.backendId ||
    recoveryHandoff?.backendId ||
    'spartan-host';
  const backendName =
    query.get('name') || pendingHostPair?.name || recoveryHandoff?.backendName || 'Spartan Host';
  elements.sessionName.textContent = backendName;
  mediaSession.update({
    title: backendName,
    artist: 'Spartan Gaming',
    album: 'Cloud gaming session',
  });
  const connection = normalizePlayerConnection(connectionValues);
  const authenticated = hasAuthenticatedPlayerConnection(connection);
  if (!connection.endpoint) throw new Error('Signaling endpoint is required');
  if (!authenticated && !connectionValues.allowUnauthenticated)
    throw new Error('A short-lived client ticket is required for signaling');
  if (authenticated) connectionSessionId = connection.sessionId;
  if (authenticated && sessionPreferences.preferences.restoreSession)
    saveSessionRecoveryHandoff(sessionStorage, {
      endpoint: connection.endpoint,
      sessionId: connection.sessionId,
      ticket: connection.ticket,
      backendId,
      backendType: 'remote-play',
      backendName,
      hostId: pendingHostPair?.hostId || recoveryHandoff?.hostId,
    });
  const selectedSignaling = resolveSignalingTransport({
    endpoint: connection.endpoint,
    policy: transportPolicy,
  });
  const join = authenticated
    ? { sessionId: connection.sessionId, role: 'client', ticket: connection.ticket }
    : undefined;
  const signaling =
    selectedSignaling === 'webtransport'
      ? createWebTransportSignalTransport({ endpoint: connection.endpoint, join })
      : createWebSocketSignalTransport({ endpoint: connection.endpoint, join });
  const media =
    typeof RTCPeerConnection === 'function'
      ? createWebRtcTransport({ ice: { policy: transportPolicy.icePolicy } })
      : undefined;
  runtime = createSessionRuntime({ manager, signaling, media });
  runtime.on('stream', (stream) => {
    instantReplay?.stop?.();
    instantReplay = null;
    if (sessionPreferences.preferences.instantReplay) {
      try {
        instantReplay = createInstantReplayController({
          stream,
          durationSeconds: sessionPreferences.preferences.replayLengthSeconds,
          codec: sessionPreferences.preferences.recordingCodec,
        });
        instantReplay.start();
        if (elements.replay) elements.replay.disabled = false;
      } catch {
        if (elements.replay) elements.replay.disabled = true;
      }
    }
    const mediaState = attachMediaStreamTarget({ video: elements.video, stream, audioEnabled });
    applyCaptionPreference(elements.video, sessionPreferences.preferences);
    mediaObservation?.disconnect();
    mediaObservation = observeMediaStream(stream, (nextState) => {
      elements.audio.textContent = nextState.hasAudio
        ? audioEnabled
          ? 'Active'
          : 'Muted'
        : 'No track';
    });
    elements.audio.textContent = mediaState.hasAudio
      ? audioEnabled
        ? 'Active'
        : 'Muted'
      : 'No track';
    elements.video.play().catch(() => {});
    mediaSession.setPlaybackState('playing');
  });
  runtime.on('stream', () => {
    apply({ type: 'media.state', state: 'active' });
    elements.demo.classList.add('is-hidden');
  });
  runtime.on('session.answer', (message) => {
    const mediaState =
      message.payload?.hostCapabilities?.media?.state ||
      (message.payload?.sdp ? 'negotiating' : 'not-configured');
    apply({ type: 'media.state', state: mediaState });
    apply({ type: 'session.negotiated', capabilities: manager.negotiated });
    elements.demo.classList.add('is-hidden');
  });
  runtime.on('telemetry', (sample) => {
    apply({
      type: 'telemetry.health',
      rttMs: sample.rttMs,
      packetLossPct: sample.packetLossPct,
      decodeFps: sample.decodeFps,
      framesDropped: sample.framesDropped,
      jitterMs: sample.jitterMs,
      bitrateKbps: sample.bitrateKbps,
    });
    apply({ type: 'quality.changed', profile: manager.quality.id });
  });
  runtime.on('error', (error) =>
    apply({ type: 'error', message: error.message || 'Transport error' }),
  );
  runtime.on('reconnect.state', (reconnect) => {
    if (reconnect.state === 'waiting')
      elements.message.textContent = `Reconnect attempt ${reconnect.attempt}/${reconnect.maxAttempts} pending${reconnect.delayMs ? ` · retrying in ${Math.ceil(reconnect.delayMs / 1000)}s` : ''}.`;
    if (reconnect.state === 'exhausted')
      apply({
        type: 'error',
        message: 'Reconnect attempts exhausted. Check the host and signaling connection.',
      });
    if (reconnect.state === 'succeeded') elements.message.textContent = 'Session reconnected.';
  });
  runtime.on('input.event', (message) => {
    const event = message.payload || {};
    if (event.source === 'host' && event.kind === 'rumble' && inputPolicy.allows('rumble'))
      haptics.play({
        gamepadIndex: event.gamepadIndex,
        durationMs: event.durationMs,
        strongMagnitude: event.strongMagnitude ?? event.value,
        weakMagnitude: event.weakMagnitude ?? event.value,
      });
  });
  const offer = await runtime.start({
    backend: {
      id: backendId,
      backendType: 'remote-play',
      hostId: pendingHostPair?.hostId || recoveryHandoff?.hostId,
      pairingCode: pendingHostPair?.pairingCode,
    },
    capabilities: sessionPreferences.capabilities,
    preferences: sessionPreferences.preferences,
    ...(pendingLaunch ? { launch: pendingLaunch.request } : {}),
  });
  if (pendingLaunch) clearPendingLaunchHandoff(sessionStorage);
  elements.transport.textContent = `${selectedSignaling === 'webtransport' ? 'WebTransport' : 'WebSocket'} signaling${media ? ' · WebRTC media' : ''}`;
  elements.connectionForm.hidden = true;
  window.dispatchEvent(new CustomEvent('spartan:session-offer', { detail: offer }));
}

async function start() {
  const endpoint = resolveSignalingEndpoint({
    queryEndpoint: query.get('signal'),
    pendingEndpoint: pendingHostPair?.endpoint,
    recoveryEndpoint: recoveryHandoff?.endpoint,
    customEndpoint: sessionPreferences.preferences.customSignalingUrl,
  });
  const ticket = query.get('ticket') || pendingHostPair?.ticket || recoveryHandoff?.ticket;
  const sessionId =
    query.get('session') || pendingHostPair?.sessionId || recoveryHandoff?.sessionId;
  try {
    await prepareSession();
    installTouchControls();
    if (endpoint && ticket && sessionId) await connect({ endpoint, ticket, sessionId });
    else if (endpoint && pendingHostPair) await connect({ endpoint, allowUnauthenticated: true });
    else if (query.get('demo') === '1') {
      const offer = manager.start({
        backend: { id: query.get('backend') || 'spartan-host', backendType: 'remote-play' },
        capabilities: sessionPreferences.capabilities,
        preferences: sessionPreferences.preferences,
        ...(pendingLaunch ? { launch: pendingLaunch.request } : {}),
      });
      if (pendingLaunch) clearPendingLaunchHandoff(sessionStorage);
      elements.connectionForm.hidden = true;
      elements.transport.textContent =
        offer.payload.quality.profile === 'balanced' ? 'WebRTC · adaptive' : 'WebRTC';
      setTimeout(acceptHostAnswer, 500);
    } else {
      elements.message.textContent = pendingLaunch
        ? 'A native launch request is ready. Pair a host to continue.'
        : 'Enter a signaling endpoint, session ID, and short-lived client ticket to connect.';
    }
  } catch (error) {
    runtime?.close();
    runtime = null;
    apply({ type: 'error', message: error.message });
  }
}

elements.connectionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await connect({
      endpoint: elements.connectionEndpoint.value,
      sessionId: elements.connectionSession.value,
      ticket: elements.connectionTicket.value,
    });
  } catch (error) {
    runtime?.close();
    runtime = null;
    apply({ type: 'error', message: error.message });
  }
});

function acceptHostAnswer() {
  if (manager.state !== 'negotiating' && manager.state !== 'reconnecting') return;
  try {
    const answer = createSessionEnvelope({
      sessionId: manager.session.id,
      type: 'session.answer',
      payload: {
        accepted: true,
        capabilities: manager.session.capabilities,
        hostCapabilities: { media: { state: 'not-configured' } },
      },
    });
    if (runtime) runtime.receive(answer);
    else manager.receive(answer);
    if (manager.state !== 'connected') return;
    apply({ type: 'session.negotiated', capabilities: manager.negotiated });
    apply({ type: 'session.state', status: 'connected' });
    apply({ type: 'media.state', state: 'not-configured' });
    elements.demo.classList.add('is-hidden');
  } catch (error) {
    apply({ type: 'error', message: error.message || 'Host answer rejected' });
  }
}
function requestReconnect() {
  try {
    if (runtime?.reconnect.state === 'waiting') {
      runtime.cancelReconnect();
      elements.message.textContent = 'Reconnect cancelled. Press reconnect to try again.';
      return;
    }
    const envelope = runtime ? runtime.requestReconnect() : manager.requestReconnect();
    apply({ type: 'session.state', status: 'reconnecting' });
    window.dispatchEvent(new CustomEvent('spartan:session-reconnect', { detail: envelope }));
    elements.message.textContent = `Reconnecting (attempt ${envelope.payload.attempt})…`;
    if (query.get('demo') === '1')
      setTimeout(acceptHostAnswer, Math.min(envelope.payload.delayMs, 700));
  } catch (error) {
    apply({ type: 'error', message: error.message });
  }
}
function toggleSessionPause() {
  const action = resolveSessionPauseAction({ status: state.status, paused: sessionPaused });
  if (!action.available) {
    elements.message.textContent = action.message;
    return;
  }
  sessionPaused = action.paused;
  if (sessionPaused) {
    elements.video.pause();
    try {
      runtime?.requestControl(action.action);
    } catch {
      /* local pause remains useful when no control plane is active */
    }
    elements.pause.textContent = action.glyph;
    elements.pause.setAttribute('aria-label', action.label);
    elements.message.textContent = action.message;
    mediaSession.setPlaybackState('paused');
  } else {
    elements.video.play?.().catch?.(() => {});
    try {
      runtime?.requestControl(action.action);
    } catch {
      /* local resume remains useful when no control plane is active */
    }
    elements.pause.textContent = action.glyph;
    elements.pause.setAttribute('aria-label', action.label);
    elements.message.textContent = action.message;
    mediaSession.setPlaybackState('playing');
  }
}
function applyFocusPolicy(isBlurred) {
  if (!sessionPreferences.preferences.pauseOnBlur || state.status !== 'connected') return;
  if (isBlurred && !focusPaused) {
    focusPaused = true;
    elements.video.pause();
    try {
      runtime?.requestControl('pause');
    } catch {
      /* focus changes must not interrupt teardown */
    }
  } else if (!isBlurred && focusPaused) {
    focusPaused = false;
    elements.video.play?.().catch?.(() => {});
    try {
      runtime?.requestControl('resume');
    } catch {
      /* focus changes must not interrupt teardown */
    }
  }
}
function emitInput(event) {
  if (!inputPolicy.allows(event.source)) return;
  try {
    const envelope = createInputEventEnvelope({
      sessionId: manager.session?.id,
      event,
      sequence: ++inputSequence,
    });
    if (runtime) runtime.send(envelope);
    window.dispatchEvent(new CustomEvent('spartan:input', { detail: envelope }));
  } catch {
    /* Input is best-effort while a session is ending. */
  }
}
function requestQuality(profileId) {
  try {
    if (runtime) runtime.requestQuality(profileId);
    else manager.setQuality(profileId);
    apply({ type: 'quality.changed', profile: profileId });
    elements.message.textContent = `Quality set to ${profileId}.`;
  } catch (error) {
    elements.qualitySelect.value = state.quality;
    elements.message.textContent = error.message;
  }
}
function installTouchControls() {
  const layout = normalizeTouchLayout(sessionPreferences.preferences.touchLayout);
  const touchAvailable = query.get('touch') === '1' || Number(navigator.maxTouchPoints) > 0;
  if (layout === 'off' || !touchAvailable || !inputPolicy.allows('touch')) return;
  const root = document.createElement('div');
  root.className = `touch-controls touch-controls-${layout}`;
  root.setAttribute('aria-label', 'Touch game controls');
  root.innerHTML =
    createTouchControlLayout(layout)
      .map(
        (control) =>
          `<button type="button" class="touch-control touch-${control.group}${control.side ? ` touch-${control.side}` : ''}" data-touch-action="${control.action}" data-touch-control="${control.control || control.action}" aria-label="${control.action}">${control.label}</button>`,
      )
      .join('') +
    (layout === 'full'
      ? '<div class="touch-stick touch-stick-left" data-touch-stick="0" role="slider" aria-label="Left analog stick"><span></span></div><div class="touch-stick touch-stick-right" data-touch-stick="2" role="slider" aria-label="Right analog stick"><span></span></div>'
      : '');
  const active = new Map();
  const emitStick = (stick, event, pressed = true) => {
    const rect = stick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
    let x = (event.clientX - (rect.left + rect.width / 2)) / radius;
    let y = (event.clientY - (rect.top + rect.height / 2)) / radius;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }
    createTouchStickEvents({ index: Number(stick.dataset.touchStick), x, y, pressed }).forEach(
      emitInput,
    );
    stick.style.setProperty('--stick-x', `${x * 50}%`);
    stick.style.setProperty('--stick-y', `${y * 50}%`);
  };
  const release = (pointerId, fallback) => {
    const entry = active.get(pointerId);
    if (!entry) return;
    active.delete(pointerId);
    if (entry.kind === 'stick') {
      emitStick(entry.element, fallback || { clientX: 0, clientY: 0 }, false);
      entry.element.classList.remove('is-active');
      entry.element.style.setProperty('--stick-x', '0%');
      entry.element.style.setProperty('--stick-y', '0%');
    } else {
      entry.element.classList.remove('is-pressed');
      emitInput(
        createTouchControlEvent({ action: entry.action, control: entry.control, pressed: false }),
      );
    }
    entry.element.releasePointerCapture?.(pointerId);
  };
  root.addEventListener('pointerdown', (event) => {
    const stick = event.target.closest('[data-touch-stick]');
    const button = event.target.closest('[data-touch-action]');
    if (!stick && !button) return;
    event.preventDefault();
    event.stopPropagation();
    const element = stick || button;
    if (stick) {
      active.set(event.pointerId, { kind: 'stick', element });
      element.classList.add('is-active');
      element.setPointerCapture?.(event.pointerId);
      emitStick(element, event);
    } else {
      active.set(event.pointerId, {
        kind: 'button',
        action: button.dataset.touchAction,
        control: button.dataset.touchControl,
        element: button,
      });
      button.setPointerCapture?.(event.pointerId);
      button.classList.add('is-pressed');
      emitInput(
        createTouchControlEvent({
          action: button.dataset.touchAction,
          control: button.dataset.touchControl,
          pressed: true,
        }),
      );
    }
  });
  root.addEventListener('pointermove', (event) => {
    const entry = active.get(event.pointerId);
    if (!entry || entry.kind !== 'stick') return;
    event.preventDefault();
    event.stopPropagation();
    emitStick(entry.element, event);
  });
  root.addEventListener('pointerup', (event) => {
    if (!active.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    release(event.pointerId, event);
  });
  root.addEventListener('pointercancel', (event) => {
    if (!active.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    release(event.pointerId, event);
  });
  elements.stage.append(root);
}
function emitKeyboardEvents(events) {
  events.forEach(({ code, pressed }) =>
    emitInput({
      type: 'input.event',
      action: `key:${code}`,
      pressed,
      value: pressed ? 1 : 0,
      source: 'keyboard',
      control: code,
    }),
  );
}
function releaseStickyKeys() {
  emitKeyboardEvents(stickyKeys.flush());
}
function keyboardInput(event, pressed) {
  if (
    event.target instanceof HTMLElement &&
    ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName)
  )
    return;
  if (event.repeat && pressed) return;
  emitKeyboardEvents(stickyKeys.process(event.code, pressed));
}
function pointerInput(event) {
  const source = event.pointerType === 'touch' ? 'touch' : 'pointer';
  if (!inputPolicy.allows(source)) return;
  event.preventDefault();
  if (event.type === 'pointerdown') elements.stage.setPointerCapture?.(event.pointerId);
  emitInput(createPointerInputEvent({ event, rect: elements.stage.getBoundingClientRect() }));
}
function wheelInput(event) {
  if (!inputPolicy.allows('pointer')) return;
  event.preventDefault();
  emitInput(createWheelInputEvent({ event, rect: elements.stage.getBoundingClientRect() }));
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
function captureExtension(blob, fallback = 'webm') {
  return blob?.type?.includes('mp4') ? 'mp4' : blob?.type?.includes('png') ? 'png' : fallback;
}
async function saveCaptureBlob(
  blob,
  filename,
  location = sessionPreferences.preferences.recordingLocation,
) {
  if (
    ['Ask each time', 'Custom folder'].includes(location) &&
    typeof globalThis.showSaveFilePicker === 'function'
  ) {
    const extension = captureExtension(blob, filename.split('.').pop());
    const handle = await globalThis.showSaveFilePicker({
      suggestedName: filename.replace(/\.[^.]+$/, `.${extension}`),
      types: [
        {
          description: blob.type || 'Capture',
          accept: { [blob.type || 'application/octet-stream']: [`.${extension}`] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  downloadBlob(
    blob,
    filename.replace(/\.[^.]+$/, `.${captureExtension(blob, filename.split('.').pop())}`),
  );
}
async function takeScreenshot() {
  try {
    const blob = await captureVideoFrame(elements.video);
    await saveCaptureBlob(
      blob,
      `spartan-gaming-${new Date().toISOString().replaceAll(':', '-')}.png`,
    );
    elements.message.textContent = 'Screenshot saved locally.';
  } catch (error) {
    elements.message.textContent = error.message;
  }
}
async function toggleRecording() {
  try {
    if (!recording)
      recording = createRecordingController({
        stream: elements.video.srcObject,
        codec: sessionPreferences.preferences.recordingCodec,
      });
    if (recording.state === 'recording') {
      const blob = await recording.stop();
      await saveCaptureBlob(
        blob,
        `spartan-gaming-${new Date().toISOString().replaceAll(':', '-')}.webm`,
      );
      elements.message.textContent = 'Recording saved locally.';
      elements.record.classList.remove('capture-active');
    } else {
      recording.start();
      elements.message.textContent = 'Recording locally. Press record again to stop.';
      elements.record.classList.add('capture-active');
    }
  } catch (error) {
    elements.message.textContent = error.message;
  }
}
async function saveInstantReplay() {
  try {
    if (!instantReplay) throw new Error('Instant replay is unavailable until a stream is active.');
    const blob = instantReplay.clip();
    await saveCaptureBlob(
      blob,
      `spartan-replay-${new Date().toISOString().replaceAll(':', '-')}.webm`,
    );
    elements.message.textContent = 'Instant replay saved locally.';
  } catch (error) {
    elements.message.textContent = error.message;
  }
}
function exportSessionDiagnostics() {
  try {
    const bundle = createSessionDiagnosticsBundle({
      session: manager.session || {},
      negotiated: state.negotiated,
      samples: telemetryLog.list(),
      adjustments: negotiationAdjustments,
    });
    const blob = new Blob([serializeSessionDiagnostics(bundle)], { type: 'application/json' });
    downloadBlob(
      blob,
      `spartan-session-diagnostics-${new Date().toISOString().replaceAll(':', '-')}.json`,
    );
    elements.message.textContent = telemetryLog.enabled
      ? 'Redacted session diagnostics exported.'
      : 'Session diagnostics exported without telemetry samples.';
  } catch (error) {
    elements.message.textContent = error.message;
  }
}

document.querySelector('[data-action="audio"]').addEventListener('click', () => {
  audioEnabled = !audioEnabled;
  setMediaAudioEnabled(elements.video, audioEnabled);
  elements.audio.textContent = audioEnabled
    ? describeMediaStream(elements.video.srcObject).hasAudio
      ? 'Active'
      : 'Waiting'
    : 'Muted';
  const button = document.querySelector('[data-action="audio"]');
  button.textContent = audioEnabled ? '🔊' : '🔇';
  button.setAttribute('aria-label', audioEnabled ? 'Mute session audio' : 'Unmute session audio');
});
elements.audioOutput?.addEventListener('change', async (event) => {
  try {
    await selectAudioOutput(elements.video, event.target.value);
    elements.message.textContent = event.target.value
      ? 'Session audio output changed.'
      : 'Session audio is using the browser default output.';
  } catch (error) {
    event.target.value = '';
    elements.message.textContent = error.message;
  }
});
elements.sessionVolume?.addEventListener('input', (event) => {
  try {
    const volume = setSessionVolume(elements.video, Number(event.target.value) / 100);
    if (elements.sessionVolumeValue)
      elements.sessionVolumeValue.textContent = formatSessionVolume(volume);
    elements.message.textContent = `Game volume ${formatSessionVolume(volume)}.`;
  } catch (error) {
    elements.message.textContent = error.message;
  }
});
elements.qualitySelect?.addEventListener('change', (event) => requestQuality(event.target.value));
document.querySelector('[data-action="fullscreen"]').addEventListener('click', () =>
  immersive.toggle().catch((error) => {
    elements.message.textContent = error.message;
  }),
);
document.querySelector('[data-action="pip"]').addEventListener('click', async () => {
  try {
    const active = await togglePictureInPicture(elements.video);
    const button = document.querySelector('[data-action="pip"]');
    button.setAttribute(
      'aria-label',
      active ? 'Exit Picture-in-Picture' : 'Enter Picture-in-Picture',
    );
    elements.message.textContent = active
      ? 'Picture-in-Picture enabled.'
      : 'Picture-in-Picture closed.';
  } catch (error) {
    elements.message.textContent = error.message;
  }
});
elements.screenshot = document.querySelector('[data-action="screenshot"]');
elements.record = document.querySelector('[data-action="record"]');
elements.screenshot.addEventListener('click', takeScreenshot);
elements.record.addEventListener('click', toggleRecording);
elements.replay?.addEventListener('click', saveInstantReplay);
elements.reconnect = document.querySelector('[data-action="reconnect"]');
elements.reconnect.addEventListener('click', requestReconnect);
elements.pause?.addEventListener('click', toggleSessionPause);
document
  .querySelector('[data-action="export-session"]')
  ?.addEventListener('click', exportSessionDiagnostics);
document
  .querySelector('[data-action="overlay"]')
  .addEventListener('click', () => apply({ type: 'toggle.overlay' }));
document
  .querySelector('[data-action="diagnostics"]')
  .addEventListener('click', () => apply({ type: 'toggle.diagnostics' }));
document.querySelector('[data-action="end"]').addEventListener('click', () => {
  releaseStickyKeys();
  instantReplay?.stop?.();
  instantReplay = null;
  clearInterval(gamepadPollTimer);
  previousGamepad.clear();
  gamepadMappers.clear();
  gamepadProfileIds.clear();
  if (runtime) runtime.close();
  else if (manager.state === 'connected' || manager.state === 'reconnecting') manager.close();
  clearSessionRecoveryHandoff(sessionStorage);
  if (sessionPreferences.preferences.clearOnExit) clearTransientSessionData(sessionStorage);
  mediaSession.dispose();
  void wakeLock.stop();
  apply({ type: 'session.state', status: 'ended' });
});
elements.demo.addEventListener('click', acceptHostAnswer);
window.addEventListener('spartan:telemetry', (event) => {
  const sample = event.detail || {};
  try {
    const telemetry = createSessionEnvelope({
      sessionId: manager.session.id,
      type: 'telemetry.health',
      payload: sample,
    });
    if (runtime) runtime.receive(telemetry);
    else manager.receive(telemetry);
    apply({
      type: 'telemetry.health',
      rttMs: sample.rttMs,
      packetLossPct: sample.packetLossPct,
      decodeFps: sample.decodeFps,
      framesDropped: sample.framesDropped,
      jitterMs: sample.jitterMs,
      bitrateKbps: sample.bitrateKbps,
    });
    apply({ type: 'quality.changed', profile: manager.quality.id });
  } catch {
    apply({ type: 'error', message: 'Invalid session telemetry received' });
  }
});
window.addEventListener('keydown', (event) => keyboardInput(event, true));
window.addEventListener('keyup', (event) => keyboardInput(event, false));
window.addEventListener('blur', () => {
  releaseStickyKeys();
  applyFocusPolicy(true);
});
window.addEventListener('focus', () => applyFocusPolicy(false));
window.addEventListener('pagehide', () => {
  releaseStickyKeys();
  void wakeLock.stop();
  if (sessionPreferences.preferences.clearOnExit) {
    runtime?.close?.();
    clearSessionRecoveryHandoff(sessionStorage);
    clearTransientSessionData(sessionStorage);
  }
});
document.addEventListener('visibilitychange', () =>
  applyFocusPolicy(document.visibilityState !== 'visible'),
);
['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach((type) =>
  elements.stage.addEventListener(type, pointerInput, { passive: false }),
);
elements.stage.addEventListener('wheel', wheelInput, { passive: false });
window.addEventListener('gamepadconnected', () =>
  apply({ type: 'gamepad.connection', connected: true }),
);
window.addEventListener('gamepaddisconnected', () =>
  apply({ type: 'gamepad.connection', connected: false }),
);
const gamepadPollTimer = setInterval(() => {
  if (!inputPolicy.allows('gamepad')) {
    if (state.gamepadConnected !== false) apply({ type: 'gamepad.connection', connected: false });
    previousGamepad.clear();
    gamepadMappers.clear();
    gamepadProfileIds.clear();
    return;
  }
  const allGamepads = [...(navigator.getGamepads?.() || [])].filter(Boolean);
  const negotiatedInput = state.negotiated?.input;
  const multipleControllers =
    sessionPreferences.preferences.controllerSettings.multipleControllers &&
    negotiatedInput?.multipleControllers !== false;
  const configuredSlots = sessionPreferences.preferences.controllerSettings.playerSlots;
  const negotiatedSlots = Number.isInteger(negotiatedInput?.playerSlots)
    ? negotiatedInput.playerSlots
    : configuredSlots;
  const limit = multipleControllers ? Math.max(1, Math.min(configuredSlots, negotiatedSlots)) : 1;
  const gamepads = allGamepads.slice(0, limit);
  const activeIndices = new Set(gamepads.map((gamepad) => gamepad.index));
  for (const index of previousGamepad.keys()) {
    if (!activeIndices.has(index)) {
      previousGamepad.delete(index);
      gamepadMappers.delete(index);
      gamepadProfileIds.delete(index);
    }
  }
  const connected = gamepads.length > 0;
  if (connected !== state.gamepadConnected) apply({ type: 'gamepad.connection', connected });
  for (const pad of gamepads) {
    const padMapper = mapperForGamepad(pad);
    const normalized = padMapper.normalize(pad);
    const previous = previousGamepad.get(normalized.index);
    normalized.buttons.forEach((button, index) => {
      if (
        !previous ||
        button.pressed !== previous.buttons[index]?.pressed ||
        button.value !== previous.buttons[index]?.value
      ) {
        const event =
          padMapper.mapButton(index, button.pressed, button.value) ||
          padMapper.mapNativeButton(index, button.pressed, button.value);
        if (event)
          emitInput({
            ...event,
            source: 'gamepad',
            control: `button-${index}`,
            gamepadIndex: normalized.index,
          });
      }
    });
    normalized.axes.forEach((value, index) => {
      const previousValue = previous?.axes[index] || 0;
      if (!previous || Math.abs(value - previousValue) > 0.001) {
        padMapper.mapAxisTransition(index, value, previousValue).forEach((event) =>
          emitInput({
            ...event,
            source: 'gamepad',
            control: `axis-${index}`,
            gamepadIndex: normalized.index,
          }),
        );
        padMapper.mapNativeAxis(index, value, previousValue).forEach((event) =>
          emitInput({
            ...event,
            source: 'gamepad',
            control: `axis-${index}`,
            gamepadIndex: normalized.index,
          }),
        );
      }
    });
    previousGamepad.set(normalized.index, normalized);
  }
}, controllerPollingIntervalMs(sessionPreferences.preferences.inputPolling));
const suppliedStream = window.__SPARTAN_MEDIA_STREAM__;
if (suppliedStream && typeof MediaStream !== 'undefined' && suppliedStream instanceof MediaStream) {
  const mediaState = attachMediaStreamTarget({
    video: elements.video,
    stream: suppliedStream,
    audioEnabled,
  });
  applyCaptionPreference(elements.video, sessionPreferences.preferences);
  elements.audio.textContent = mediaState.hasAudio ? 'Active' : 'No track';
  elements.video.play().catch(() => {});
}
start();
apply({ type: 'session.state', status: 'negotiating' });
