const MODE_ORDER = Object.freeze({browser: ['browser-first', 'official-launch', 'official-embed', 'official-api', 'user-owned-host', 'self-hosted'], official: ['official-launch', 'official-embed', 'browser-first', 'official-api', 'user-owned-host', 'self-hosted'], native: ['user-owned-host', 'self-hosted', 'official-launch', 'browser-first', 'official-embed', 'official-api']});
const SPECIAL_PROFILES = Object.freeze({
  'xbox-cloud-gaming': {controllerProfile: 'Xbox layout', quality: 'prefer-latency', notes: ['Xbox account, subscription, and supported-region checks remain provider-owned.']},
  'xbox-remote-play': {controllerProfile: 'Xbox layout', quality: 'prefer-latency', notes: ['Remote features and console ownership must be enabled in the official account.']},
  'playstation-plus-cloud': {controllerProfile: 'PlayStation layout', quality: 'prefer-latency', notes: ['PlayStation account, plan, and region eligibility remain provider-owned.']},
  'playstation-remote-play': {controllerProfile: 'PlayStation layout', quality: 'prefer-latency', notes: ['Remote Play must be enabled on the user-owned console.']},
  'shadow-pc': {controllerProfile: 'Keyboard and mouse', quality: 'balanced', notes: ['Cloud-PC keyboard, pointer, clipboard, and multi-monitor behavior depends on the official web client.']},
  'twitch': {controllerProfile: null, quality: 'prefer-quality', notes: ['Watch, chat, clips, and creator actions use official site/API surfaces only.']},
  'youtube-live': {controllerProfile: null, quality: 'prefer-quality', notes: ['Watch and creator actions use official site/API surfaces only.']},
  'owncast': {controllerProfile: null, quality: 'prefer-quality', notes: ['Custom instances must be supplied by the user; no instance discovery or credential capture is performed.']},
});

function surfaceList(entry) { return Object.freeze((entry.capabilities || []).filter(capability => ['video', 'chat', 'clips', 'voice', 'screen-share', 'watch-parties', 'creator-dashboard', 'broadcast-management', 'friends', 'party-links', 'self-hosting'].includes(capability))); }

export function createProviderIntegration(entry, {profile = {}, report = {}} = {}) {
  if (!entry || entry.backendType !== 'provider') throw new TypeError('A normalized provider entry is required');
  const preset = SPECIAL_PROFILES[entry.id] || {};
  const preferred = MODE_ORDER[profile.launchMode] || MODE_ORDER.browser;
  const mode = preferred.find(candidate => entry.integrationModes?.includes(candidate)) || entry.integrationModes?.[0];
  const missingCapabilities = (entry.capabilities || []).filter(capability => capability === 'gamepad' && report.input?.gamepad === false);
  const requirements = Object.freeze([...(entry.requirements || [])]);
  return Object.freeze({providerId: entry.id, mode, controllerProfile: preset.controllerProfile || (entry.capabilities?.includes('gamepad') ? 'Auto-detect' : null), quality: profile.quality && profile.quality !== 'balanced' ? profile.quality : (preset.quality || 'balanced'), surfaces: surfaceList(entry), requirements, missingCapabilities: Object.freeze(missingCapabilities), health: Object.freeze({strategy: 'reachability-only', url: entry.url, authenticated: false}), notes: Object.freeze([...(preset.notes || []), ...(missingCapabilities.length ? ['Connect a supported controller before starting this service.'] : [])])});
}

export function providerTroubleshooting(integration) {
  const items = [];
  if (integration.missingCapabilities.includes('gamepad')) items.push({severity: 'warning', key: 'gamepad', message: 'Connect or permit a compatible gamepad in Spartan Gaming.'});
  if (integration.requirements.length) items.push({severity: 'info', key: 'configuration', message: `Provider setup required: ${integration.requirements.join(', ')}.`});
  if (!integration.mode) items.push({severity: 'error', key: 'mode', message: 'No supported official integration mode is available in this shell.'});
  return Object.freeze(items.map(item => Object.freeze(item)));
}
