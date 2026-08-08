function text(value) { return typeof value === 'string' ? value.trim() : ''; }

export function canSelectAudioOutput(video) {
  return Boolean(video && typeof video.setSinkId === 'function');
}

export function normalizeAudioOutputDevice(device, index = 0) {
  if (!device || device.kind !== 'audiooutput') return null;
  const deviceId = text(device.deviceId);
  if (!deviceId) return null;
  return Object.freeze({deviceId, label: text(device.label) || `Audio output ${index + 1}`, kind: 'audiooutput'});
}

export async function listAudioOutputDevices({mediaDevices = globalThis.navigator?.mediaDevices} = {}) {
  if (!mediaDevices || typeof mediaDevices.enumerateDevices !== 'function') return Object.freeze([]);
  const devices = await mediaDevices.enumerateDevices();
  const seen = new Set();
  return Object.freeze(devices.map((device, index) => normalizeAudioOutputDevice(device, index)).filter(device => device && !seen.has(device.deviceId) && seen.add(device.deviceId)).slice(0, 32));
}

export async function selectAudioOutput(video, deviceId = '') {
  if (!canSelectAudioOutput(video)) throw new Error('Audio output selection is unavailable in this browser');
  const normalized = text(deviceId);
  if (normalized.length > 512) throw new TypeError('audio output device ID is too long');
  await video.setSinkId(normalized);
  return normalized;
}
