const PLATFORM_NAMES = Object.freeze(['windows', 'macos', 'linux', 'chromeos', 'android', 'ios', 'ipados', 'television', 'unknown']);

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function touchPointsOf(navigatorRef) { const value = Number(navigatorRef?.maxTouchPoints); return Number.isFinite(value) ? Math.max(0, value) : 0; }

export function detectRuntimePlatform({navigatorRef = globalThis.navigator, userAgent, viewport = {}} = {}) {
  const agent = String(userAgent ?? navigatorRef?.userAgent ?? '');
  const platform = String(navigatorRef?.userAgentData?.platform || navigatorRef?.platform || '').toLowerCase();
  const touchPoints = touchPointsOf(navigatorRef);
  if (/iphone|ipod/i.test(agent)) return 'ios';
  if (/ipad/i.test(agent) || (/macintosh/i.test(agent) && touchPoints > 1)) return 'ipados';
  if (/android/i.test(agent)) return 'android';
  if (/cros/i.test(agent)) return 'chromeos';
  if (/win/i.test(agent) || platform.includes('win')) return 'windows';
  if (/mac|darwin/i.test(agent) || platform.includes('mac')) return 'macos';
  if (/linux/i.test(agent) || platform.includes('linux')) return 'linux';
  if (Number(viewport.width) > 0 && touchPoints > 0) return 'android';
  return 'unknown';
}

/** Resolve distribution and engine constraints without claiming native entitlements. */
export function resolvePlatformCompatibility({platform = 'unknown', distribution = 'web', alternativeEngineEntitled = false, capabilities = {}} = {}) {
  const selected = PLATFORM_NAMES.includes(platform) ? platform : 'unknown';
  const iosFamily = selected === 'ios' || selected === 'ipados';
  const entitledAlternativeEngine = iosFamily && alternativeEngineEntitled === true;
  const enginePolicy = iosFamily ? (entitledAlternativeEngine ? 'alternative-engine-entitled' : 'webkit-required') : 'chromium-capable';
  const gates = {
    webFrontend: true,
    remoteStreaming: capabilities.transports?.webrtc !== false,
    browserEmulation: capabilities.graphics?.webgl === true || capabilities.graphics?.webgpu === true,
    nativeChromiumShell: !iosFamily || entitledAlternativeEngine,
    nativeHostPackaging: !iosFamily,
  };
  const limitations = [];
  if (iosFamily && !entitledAlternativeEngine) limitations.push('A native Blink/Chromium shell is unavailable; use the WebKit-compatible frontend or a separately entitled engine build.');
  if (iosFamily && distribution === 'app-store') limitations.push('App Store eligibility, browser entitlements, and streaming-client review must be validated before claiming a native iOS release.');
  if (iosFamily && capabilities.transports?.webrtc === false) limitations.push('This browser does not expose WebRTC, so remote streaming is unavailable in the current session.');
  return Object.freeze({platform: selected, distribution: text(distribution) || 'web', enginePolicy, supportLevel: iosFamily && !entitledAlternativeEngine ? 'web-first' : 'platform-adapted', gates: Object.freeze(gates), limitations: Object.freeze(limitations)});
}
