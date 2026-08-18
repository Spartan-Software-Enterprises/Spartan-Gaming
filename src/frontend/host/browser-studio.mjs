import '../pwa/register.mjs';
import '../console-mode-init.mjs';
import { createWebSocketSignalTransport } from '../transport/transport.mjs';
import { createBrowserWebRtcPublisher } from './browser-publisher.mjs';
import { createBrowserHostRuntime } from './browser-host-runtime.mjs';
import { installLanHandoffListener } from './lan-handoff.mjs';
import { listAudioInputDevices } from './audio-input.mjs';
import { createSettingsStore } from '../settings/profile.mjs';
import { normalizeNoiseSuppressionPreference } from '../voice/noise-suppression.mjs';

export function resolveBrowserHostMediaPreferences(settings = {}) {
  const noiseSuppressionEnabled = settings['media.micNoiseSuppression'] !== false;
  return Object.freeze({
    audioInput: ['System default', 'No microphone', 'Ask each time'].includes(
      settings['media.audioInput'],
    )
      ? settings['media.audioInput']
      : 'System default',
    microphoneNoiseSuppression: noiseSuppressionEnabled,
    microphoneNoiseSuppressionProfile: normalizeNoiseSuppressionPreference(
      noiseSuppressionEnabled ? settings['media.micNoiseSuppressionProfile'] : 'off',
    ),
  });
}
export function normalizeBrowserHostConfig(values = {}) {
  const displaySurface = ['monitor', 'window', 'browser'].includes(values.displaySurface)
    ? values.displaySurface
    : 'monitor';
  const framerate = Number(values.framerate);
  return Object.freeze({
    endpoint: String(values.endpoint || '').trim(),
    sessionId: String(values.sessionId || '').trim(),
    ticket: String(values.ticket || '').trim(),
    hostId: String(values.hostId || 'browser-host').trim() || 'browser-host',
    hostName: String(values.hostName || 'Browser Host').trim() || 'Browser Host',
    audio: values.audio === true,
    microphone: values.microphone === true,
    microphoneDeviceId: String(values.microphoneDeviceId || '').trim(),
    microphoneNoiseSuppression: values.microphoneNoiseSuppression !== false,
    microphoneNoiseSuppressionProfile: normalizeNoiseSuppressionPreference(
      values.microphoneNoiseSuppression !== false
        ? values.microphoneNoiseSuppressionProfile
        : 'off',
    ),
    displaySurface,
    framerate:
      Number.isFinite(framerate) && framerate > 0 ? Math.min(240, Math.max(1, framerate)) : 60,
  });
}

if (typeof document !== 'undefined') {
  const endpoint = document.querySelector('[data-endpoint]');
  const sessionId = document.querySelector('[data-session-id]');
  const ticket = document.querySelector('[data-ticket]');
  const hostId = document.querySelector('[data-host-id]');
  const hostName = document.querySelector('[data-host-name]');
  const audio = document.querySelector('[data-audio]');
  const microphone = document.querySelector('[data-microphone]');
  const microphoneDevice = document.querySelector('[data-microphone-device]');
  const microphonePicker = document.querySelector('[data-microphone-picker]');
  const surface = document.querySelector('[data-surface]');
  const framerate = document.querySelector('[data-framerate]');
  const preview = document.querySelector('[data-preview]');
  const status = document.querySelector('[data-status]');
  const state = document.querySelector('[data-state]');
  const log = document.querySelector('[data-log]');
  const captureButton = document.querySelector('[data-capture]');
  const startButton = document.querySelector('[data-start]');
  const stopButton = document.querySelector('[data-stop]');
  const mediaPreferences = resolveBrowserHostMediaPreferences(createSettingsStore().read());
  let publisher = null;
  let runtime = null;
  const messages = [];
  function write(message) {
    messages.push(`${new Date().toLocaleTimeString()} · ${message}`);
    log.textContent = messages.slice(-30).join('\n');
  }
  function setState(value, message) {
    state.textContent = value;
    status.textContent = message;
  }
  async function loadMicrophones() {
    try {
      const devices = await listAudioInputDevices();
      microphoneDevice.innerHTML = `<option value="">System default microphone</option>${devices.map((device) => `<option value="${device.deviceId.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${device.label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</option>`).join('')}`;
      microphoneDevice.disabled = false;
    } catch {
      microphoneDevice.innerHTML = '<option value="">Microphones unavailable</option>';
      microphoneDevice.disabled = true;
    }
  }
  const handoffId = new URLSearchParams(location.search).get('handoff');
  installLanHandoffListener({
    handoffId,
    target: 'host',
    onHandoff: (handoff) => {
      endpoint.value = handoff.endpoint;
      sessionId.value = handoff.sessionId;
      ticket.value = handoff.ticket;
      setState(
        'Handoff loaded',
        'Session details received from the LAN setup tab. Choose a display to continue.',
      );
      write('Host handoff received in memory.');
    },
  });
  function stop() {
    runtime?.close();
    runtime = null;
    publisher?.close();
    publisher = null;
    preview.srcObject = null;
    captureButton.disabled = false;
    startButton.disabled = true;
    stopButton.disabled = true;
    setState('Idle', 'Stopped. Choose a display to begin again.');
    write('Host stopped.');
  }
  if (mediaPreferences.audioInput === 'No microphone') {
    microphone.checked = false;
    microphone.disabled = true;
    microphonePicker.hidden = true;
  }
  captureButton.addEventListener('click', async () => {
    try {
      publisher?.close();
      publisher = createBrowserWebRtcPublisher();
      const capture = normalizeBrowserHostConfig({
        audio: audio.checked,
        microphone: microphone.checked,
        microphoneDeviceId: microphoneDevice.value,
        microphoneNoiseSuppression: mediaPreferences.microphoneNoiseSuppression,
        microphoneNoiseSuppressionProfile: mediaPreferences.microphoneNoiseSuppressionProfile,
        displaySurface: surface.value,
        framerate: framerate.value,
      });
      const stream = await publisher.capture({
        audio: capture.audio,
        microphone: capture.microphone,
        microphoneDeviceId: capture.microphoneDeviceId,
        microphoneNoiseSuppression: capture.microphoneNoiseSuppression,
        microphoneNoiseSuppressionProfile: capture.microphoneNoiseSuppressionProfile,
        displaySurface: capture.displaySurface,
        framerate: capture.framerate,
      });
      preview.srcObject = stream;
      await preview.play().catch(() => {});
      startButton.disabled = false;
      stopButton.disabled = false;
      setState(
        'Captured',
        `${capture.audio ? 'Display and system audio' : 'Display'}${capture.microphone ? ' with microphone' : ''} selected. Paste a host ticket and start the host.`,
      );
      write(
        `Display capture granted by the user${capture.audio ? ' with system-audio request' : ''}${capture.microphone ? ` and microphone permission${capture.microphoneNoiseSuppression ? ' with noise suppression' : ''}` : ''}.`,
      );
    } catch (error) {
      setState('Idle', `Capture unavailable: ${error.message}`);
      write(`Capture failed: ${error.message}`);
      publisher?.close();
      publisher = null;
    }
  });
  microphone.addEventListener('change', () => {
    microphonePicker.hidden = !microphone.checked;
    if (microphone.checked) loadMicrophones();
  });
  startButton.addEventListener('click', async () => {
    try {
      const config = normalizeBrowserHostConfig({
        endpoint: endpoint.value,
        sessionId: sessionId.value,
        ticket: ticket.value,
        hostId: hostId.value,
        hostName: hostName.value,
      });
      if (!config.endpoint || !config.sessionId || !config.ticket)
        throw new Error('Signaling endpoint, session ID, and host ticket are required');
      if (!publisher?.stream) throw new Error('Choose a display before starting the host');
      const signaling = createWebSocketSignalTransport({
        endpoint: config.endpoint,
        join: { sessionId: config.sessionId, role: 'host', ticket: config.ticket },
      });
      runtime = createBrowserHostRuntime({
        signaling,
        publisher,
        sessionId: config.sessionId,
        hostId: config.hostId,
        hostName: config.hostName,
        onInput: (event) => write(`Input event received: ${event.kind || event.type || 'unknown'}`),
        onQuality: (request) => {
          void publisher
            .applyQualityRequest(request)
            .then((result) =>
              write(
                `Quality request ${result.status}: ${result.profile} · ${result.bitrateKbps} kbps · ${result.maxFramerate} fps`,
              ),
            );
        },
      });
      runtime.on('listening', () => {
        setState('Listening', 'Waiting for a compatible client offer.');
        write('Authenticated host signaling connected.');
      });
      runtime.on('connected', () => {
        setState('Connected', 'Remote client negotiated successfully.');
        write('WebRTC session connected.');
      });
      runtime.on('error', (error) => {
        setState('Error', error.message);
        write(`Runtime error: ${error.message}`);
      });
      runtime.on('close', () => write('Signaling connection closed.'));
      await runtime.start();
      startButton.disabled = true;
    } catch (error) {
      setState('Error', error.message);
      write(`Host start failed: ${error.message}`);
      runtime?.close();
      runtime = null;
    }
  });
  stopButton.addEventListener('click', stop);
  window.addEventListener('beforeunload', stop);
}
