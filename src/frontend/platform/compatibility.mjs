const PLATFORM_NAMES = Object.freeze(['windows', 'macos', 'linux', 'chromeos', 'android', 'fire-tv', 'roku', 'television', 'unknown']);

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function touchPointsOf(navigatorRef) { const value = Number(navigatorRef?.maxTouchPoints); return Number.isFinite(value) ? Math.max(0, value) : 0; }

export function detectRuntimePlatform({navigatorRef = globalThis.navigator, userAgent, viewport = {}} = {}) {
  const agent = String(userAgent ?? navigatorRef?.userAgent ?? '');
  const platform = String(navigatorRef?.userAgentData?.platform || navigatorRef?.platform || '').toLowerCase();
  const touchPoints = touchPointsOf(navigatorRef);
  if (/roku/i.test(agent)) return 'roku';
  if (/aft\w+|fire tv|silk/i.test(agent)) return 'fire-tv';
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
  const tvFamily = selected === 'fire-tv' || selected === 'roku' || selected === 'television';
  const enginePolicy = 'chromium-capable';
  const gates = {
    webFrontend: true,
    remoteStreaming: capabilities.transports?.webrtc !== false,
    browserEmulation: capabilities.graphics?.webgl === true || capabilities.graphics?.webgpu === true,
    nativeChromiumShell: !tvFamily,
    nativeHostPackaging: !tvFamily,
    tvRemoteNavigation: tvFamily,
  };
  const limitations = [];
  if (tvFamily) limitations.push('Fire TV and Roku use the shared web/TV surface; native packaging, store certification, and device-specific media APIs require separate adapters.');
  if (tvFamily && capabilities.transports?.webrtc === false) limitations.push('This TV browser does not expose WebRTC, so remote streaming is unavailable in the current session.');
  return Object.freeze({platform: selected, distribution: text(distribution) || 'web', enginePolicy, supportLevel: 'platform-adapted', gates: Object.freeze(gates), limitations: Object.freeze(limitations)});
}
