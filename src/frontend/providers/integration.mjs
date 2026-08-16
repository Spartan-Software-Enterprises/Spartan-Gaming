const MODE_ORDER = Object.freeze({
  browser: [
    'browser-first',
    'official-launch',
    'official-embed',
    'official-api',
    'user-owned-host',
    'self-hosted',
  ],
  official: [
    'official-launch',
    'official-embed',
    'browser-first',
    'official-api',
    'user-owned-host',
    'self-hosted',
  ],
  native: [
    'native-client',
    'user-owned-host',
    'self-hosted',
    'official-launch',
    'browser-first',
    'official-embed',
    'official-api',
  ],
});
const REGION_LABELS = Object.freeze({
  automatic: 'Automatic',
  'north-america': 'North America',
  europe: 'Europe',
  'asia-pacific': 'Asia Pacific',
  'latin-america': 'Latin America',
});
const EMBED_TARGETS = Object.freeze({
  twitch: /^[A-Za-z0-9_]{1,25}$/,
  'youtube-live': /^[A-Za-z0-9_-]{6,32}$/,
  kick: /^[A-Za-z0-9_]{1,25}$/,
});
const SPECIAL_PROFILES = Object.freeze({
  'xbox-cloud-gaming': {
    controllerProfile: 'Xbox layout',
    quality: 'prefer-latency',
    notes: ['Xbox account, subscription, and supported-region checks remain provider-owned.'],
  },
  'xbox-remote-play': {
    controllerProfile: 'Xbox layout',
    quality: 'prefer-latency',
    notes: ['Remote features and console ownership must be enabled in the official account.'],
  },
  'playstation-plus-cloud': {
    controllerProfile: 'PlayStation layout',
    quality: 'prefer-latency',
    notes: ['PlayStation account, plan, and region eligibility remain provider-owned.'],
  },
  'playstation-remote-play': {
    controllerProfile: 'PlayStation layout',
    quality: 'prefer-latency',
    notes: ['Remote Play must be enabled on the user-owned console.'],
  },
  'nvidia-geforce-now': {
    controllerProfile: 'Auto-detect',
    quality: 'prefer-latency',
    notes: [
      'Membership, game ownership, queue, and supported-region checks remain provider-owned.',
    ],
  },
  'amazon-luna': {
    controllerProfile: 'Auto-detect',
    quality: 'prefer-latency',
    notes: [
      'Amazon account, channel membership, and supported-region checks remain provider-owned.',
    ],
  },
  boosteroid: {
    controllerProfile: 'Auto-detect',
    quality: 'prefer-latency',
    notes: [
      'Subscription, game ownership, queue, and supported-region checks remain provider-owned.',
    ],
  },
  blacknut: {
    controllerProfile: 'Auto-detect',
    quality: 'balanced',
    notes: ['Subscription, catalog, and supported-region checks remain provider-owned.'],
  },
  antstream: {
    controllerProfile: 'Auto-detect',
    quality: 'balanced',
    notes: ['Subscription and catalog availability remain provider-owned.'],
  },
  'shadow-pc': {
    controllerProfile: 'Keyboard and mouse',
    quality: 'balanced',
    notes: [
      'Cloud-PC keyboard, pointer, clipboard, and multi-monitor behavior depends on the official web client.',
    ],
  },
  parsec: {
    controllerProfile: 'Keyboard and mouse',
    quality: 'prefer-latency',
    notes: ['The host must be online and configured by the session owner in the official client.'],
  },
  'sunshine-moonlight': {
    controllerProfile: 'Auto-detect',
    quality: 'prefer-latency',
    notes: [
      'Pairing, host availability, and network access remain user-owned host responsibilities.',
    ],
  },
  'steam-remote-play': {
    controllerProfile: 'Auto-detect',
    quality: 'prefer-latency',
    notes: [
      'The Steam client and user-owned host must be online and authorized by the account owner.',
    ],
  },
  'steam-broadcasting': {
    controllerProfile: null,
    quality: 'prefer-quality',
    notes: ['Broadcast discovery, chat, and social actions use official Steam surfaces only.'],
  },
  kick: {
    controllerProfile: null,
    quality: 'prefer-quality',
    notes: ['Watch, chat, clips, and creator actions use official site/API surfaces only.'],
  },
  discord: {
    controllerProfile: null,
    quality: 'prefer-quality',
    notes: ['Voice, screen share, and account permissions use official Discord surfaces only.'],
  },
  twitch: {
    controllerProfile: null,
    quality: 'prefer-quality',
    notes: ['Watch, chat, clips, and creator actions use official site/API surfaces only.'],
  },
  'youtube-live': {
    controllerProfile: null,
    quality: 'prefer-quality',
    notes: ['Watch and creator actions use official site/API surfaces only.'],
  },
  owncast: {
    controllerProfile: null,
    quality: 'prefer-quality',
    notes: [
      'Custom instances must be supplied by the user; no instance discovery or credential capture is performed.',
    ],
  },
});

function surfaceList(entry) {
  return Object.freeze(
    (entry.capabilities || []).filter((capability) =>
      [
        'video',
        'chat',
        'clips',
        'voice',
        'screen-share',
        'watch-parties',
        'creator-dashboard',
        'broadcast-management',
        'friends',
        'party-links',
        'self-hosting',
      ].includes(capability),
    ),
  );
}

function createOfficialEmbedUrl(entry, profile = {}) {
  const target = typeof profile.embedTarget === 'string' ? profile.embedTarget.trim() : '';
  const pattern = EMBED_TARGETS[entry.id];
  if (!pattern || !pattern.test(target)) return null;
  if (entry.id === 'twitch') {
    const parent =
      typeof profile.embedParent === 'string' ? profile.embedParent.trim().toLowerCase() : '';
    if (!(
      parent === 'localhost' ||
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(parent) ||
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(parent)
    ))
      return null;
    return `https://player.twitch.tv/?channel=${encodeURIComponent(target)}&parent=${encodeURIComponent(parent)}`;
  }
  if (entry.id === 'youtube-live')
    return `https://www.youtube.com/embed/${encodeURIComponent(target)}`;
  if (entry.id === 'kick') return `https://player.kick.com/${encodeURIComponent(target)}`;
  return null;
}

function nativeClientFor(entry, profile) {
  if (typeof profile.platform !== 'string' || !Array.isArray(entry.nativeClients)) return null;
  const client = entry.nativeClients.find(
    (candidate) =>
      Array.isArray(candidate.platforms) &&
      (candidate.platforms.includes(profile.platform) || candidate.platforms.includes('universal')),
  );
  return client
    ? Object.freeze({ providerId: entry.id, platform: profile.platform, name: client.name })
    : null;
}

export function createProviderIntegration(entry, { profile = {}, report = {} } = {}) {
  if (!entry || entry.backendType !== 'provider')
    throw new TypeError('A normalized provider entry is required');
  const preset = SPECIAL_PROFILES[entry.id] || {};
  const regionHint = Object.prototype.hasOwnProperty.call(REGION_LABELS, profile.region)
    ? profile.region
    : 'automatic';
  const embedUrl = createOfficialEmbedUrl(entry, profile);
  const nativeClient = nativeClientFor(entry, profile);
  const preferred =
    embedUrl && (!profile.launchMode || profile.launchMode === 'browser')
      ? ['official-embed', ...MODE_ORDER.browser]
      : MODE_ORDER[profile.launchMode] || MODE_ORDER.browser;
  const mode =
    preferred.find(
      (candidate) =>
        entry.integrationModes?.includes(candidate) && (candidate !== 'official-embed' || embedUrl),
    ) ||
    entry.integrationModes?.find((candidate) => candidate !== 'official-embed') ||
    (embedUrl ? 'official-embed' : undefined);
  const missingCapabilities = (entry.capabilities || []).filter(
    (capability) => capability === 'gamepad' && report.input?.gamepad === false,
  );
  const requirements = Object.freeze([...(entry.requirements || [])]);
  const notes = [...(preset.notes || [])];
  if (nativeClient)
    notes.push(
      `Launching through the official native ${nativeClient.name} client; the client must be installed and signed in.`,
    );
  if (entry.nativeApp?.platform === 'android')
    notes.push(
      `Android companion: ${entry.nativeApp.packageName}. Installation and permissions remain user-controlled.`,
    );
  if (entry.nativeApp?.license === 'GPL-3.0')
    notes.push(
      'GameNative is a separately distributed GPLv3 application; Spartan Gaming does not embed or redistribute its source.',
    );
  if (regionHint !== 'automatic')
    notes.push(
      `Region hint: ${REGION_LABELS[regionHint]}. The provider decides actual availability.`,
    );
  if (profile.autoFullscreen === true)
    notes.push(
      'Fullscreen is requested after the provider surface is ready when the browser permits it.',
    );
  if (missingCapabilities.length)
    notes.push('Connect a supported controller before starting this service.');
  const controllerProfile =
    profile.controllerProfile && profile.controllerProfile !== 'Auto-detect'
      ? profile.controllerProfile
      : preset.controllerProfile ||
        (entry.capabilities?.includes('gamepad') ? 'Auto-detect' : null);
  return Object.freeze({
    providerId: entry.id,
    mode,
    embedUrl,
    nativeClient,
    controllerProfile,
    quality:
      profile.quality && profile.quality !== 'balanced'
        ? profile.quality
        : preset.quality || 'balanced',
    regionHint,
    regionLabel: REGION_LABELS[regionHint],
    autoFullscreen: profile.autoFullscreen !== false,
    surfaces: surfaceList(entry),
    requirements,
    missingCapabilities: Object.freeze(missingCapabilities),
    health: Object.freeze({ strategy: 'reachability-only', url: entry.url, authenticated: false }),
    notes: Object.freeze(notes),
  });
}

export function providerTroubleshooting(integration) {
  const items = [];
  if (integration.missingCapabilities.includes('gamepad'))
    items.push({
      severity: 'warning',
      key: 'gamepad',
      message: 'Connect or permit a compatible gamepad in Spartan Gaming.',
    });
  if (integration.requirements.length)
    items.push({
      severity: 'info',
      key: 'configuration',
      message: `Provider setup required: ${integration.requirements.join(', ')}.`,
    });
  if (!integration.mode)
    items.push({
      severity: 'error',
      key: 'mode',
      message: 'No supported official integration mode is available in this shell.',
    });
  return Object.freeze(items.map((item) => Object.freeze(item)));
}
