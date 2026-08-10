const PLATFORMS = new Set(['win32', 'darwin', 'linux']);
const BACKENDS = new Set(['Automatic', 'Browser Gamepad', 'Linux uinput', 'Windows external driver', 'macOS external driver', 'Disabled']);
const PACKAGE_NAME = /^(?:@?[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*|[A-Za-z0-9_.-]+)$/;

function platform(value) { if (!PLATFORMS.has(value)) throw new TypeError(`unsupported virtual gamepad platform: ${value}`); return value; }
function backend(value) { return BACKENDS.has(value) ? value : 'Automatic'; }
function optionalText(value, name) { if (value === undefined || value === null || value === '') return null; if (typeof value !== 'string' || !value.trim() || value.length > 160 || !PACKAGE_NAME.test(value.trim())) throw new TypeError(`${name} must be a valid package name`); return value.trim(); }

export function normalizeVirtualGamepadConfig({platform: targetPlatform, backend: requestedBackend = 'Automatic', packageName, deviceId} = {}) {
  const selectedPlatform = platform(targetPlatform); const selectedBackend = backend(requestedBackend); const packageValue = optionalText(packageName, 'packageName');
  const deviceValue = deviceId === undefined || deviceId === null || deviceId === '' ? null : (typeof deviceId === 'string' && deviceId.trim().length <= 128 ? deviceId.trim() : (() => { throw new TypeError('deviceId must be a bounded string'); })());
  const expectedBackend = selectedPlatform === 'win32' ? 'Windows external driver' : selectedPlatform === 'darwin' ? 'macOS external driver' : 'Linux uinput';
  const compatible = selectedBackend === 'Automatic' || selectedBackend === 'Disabled' || selectedBackend === 'Browser Gamepad' || selectedBackend === expectedBackend;
  return Object.freeze({version: 1, platform: selectedPlatform, backend: selectedBackend, packageName: packageValue, deviceId: deviceValue, compatible, requires: Object.freeze(selectedBackend === 'Disabled' || selectedBackend === 'Browser Gamepad' ? [] : selectedBackend === 'Linux uinput' ? ['native-linux-package', 'uinput-permission'] : ['native-input-package', 'operator-installed-virtual-gamepad-driver'])});
}

export function describeVirtualGamepadReadiness({config, adapterStatus = 'unconfigured', adapterReason = null} = {}) {
  if (!config || typeof config !== 'object') throw new TypeError('virtual gamepad config is required');
  if (!config.compatible) return Object.freeze({state: 'unavailable', reason: `${config.backend} is not compatible with ${config.platform}`});
  if (config.backend === 'Disabled' || config.backend === 'Browser Gamepad') return Object.freeze({state: 'not-required', reason: null});
  if (adapterStatus === 'available') return Object.freeze({state: 'ready', reason: null});
  return Object.freeze({state: adapterStatus === 'unavailable' ? 'unavailable' : 'unconfigured', reason: adapterReason || (config.packageName ? 'configured driver is not available' : 'select an installed driver package')});
}

export function virtualGamepadConfigFromSettings({platform: targetPlatform, settings = {}} = {}) {
  const selectedPlatform = platform(targetPlatform); const configuredBackend = settings['controllers.virtualGamepadBackend'] || 'Automatic';
  return normalizeVirtualGamepadConfig({platform: selectedPlatform, backend: configuredBackend, packageName: settings['controllers.virtualGamepadPackage'], deviceId: settings['controllers.virtualGamepadDevice']});
}
