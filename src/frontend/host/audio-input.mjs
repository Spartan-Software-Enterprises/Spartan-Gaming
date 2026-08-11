function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeAudioInputDevice(device, index = 0) {
  if (!device || device.kind !== 'audioinput') return null;
  const deviceId = text(device.deviceId);
  if (!deviceId) return null;
  return Object.freeze({
    deviceId,
    label: text(device.label) || `Microphone ${index + 1}`,
    kind: 'audioinput',
  });
}

export async function listAudioInputDevices({
  mediaDevices = globalThis.navigator?.mediaDevices,
} = {}) {
  if (!mediaDevices || typeof mediaDevices.enumerateDevices !== 'function')
    return Object.freeze([]);
  const devices = await mediaDevices.enumerateDevices();
  const seen = new Set();
  return Object.freeze(
    devices
      .map((device, index) => normalizeAudioInputDevice(device, index))
      .filter((device) => device && !seen.has(device.deviceId) && seen.add(device.deviceId))
      .slice(0, 32),
  );
}
