export const PROVIDER_AUTH_HOSTS = Object.freeze({
  'nvidia-geforce-now': Object.freeze(['nvidia.com', 'geforce.com']),
  'xbox-cloud-gaming': Object.freeze([
    'live.com',
    'microsoft.com',
    'microsoftonline.com',
    'xboxlive.com',
  ]),
  'xbox-remote-play': Object.freeze([
    'live.com',
    'microsoft.com',
    'microsoftonline.com',
    'xboxlive.com',
  ]),
  'amazon-luna': Object.freeze([
    'amazon.com',
    'amazon.co.uk',
    'amazon.ca',
    'amazon.de',
    'amazon.fr',
    'amazon.co.jp',
  ]),
  'steam-remote-play': Object.freeze(['steampowered.com', 'steamcommunity.com']),
  'steam-broadcasting': Object.freeze(['steampowered.com', 'steamcommunity.com']),
  twitch: Object.freeze(['twitch.tv']),
  'youtube-live': Object.freeze(['youtube.com', 'google.com', 'googleapis.com']),
  'playstation-plus-cloud': Object.freeze([
    'playstation.com',
    'sony.com',
    'sonyentertainmentnetwork.com',
  ]),
  'playstation-remote-play': Object.freeze([
    'playstation.com',
    'sony.com',
    'sonyentertainmentnetwork.com',
  ]),
});

function cleanHttpsUrl(value, { allowHash = false } = {}) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (!allowHash && url.hash))
      return null;
    return url;
  } catch {
    return null;
  }
}

function cleanHost(value) {
  const host = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, '');
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ? host : null;
}

function addService(entry, launchUrls, serviceHosts) {
  const url = cleanHttpsUrl(entry?.url);
  if (!url) return;
  launchUrls.add(url.href);
  serviceHosts.add(url.hostname.replace(/^www\./, ''));
}

function addDownload(value, downloadOrigins) {
  const url = cleanHttpsUrl(value);
  if (url) downloadOrigins.add(url.origin);
}

/** Build the only external destination policy used by the standalone desktop app. */
export function createApprovedNetworkPolicy({
  providers = [],
  games = [],
  downloadSources = [],
} = {}) {
  const launchUrls = new Set();
  const serviceHosts = new Set();
  const downloadOrigins = new Set();
  for (const entry of [...providers, ...games]) addService(entry, launchUrls, serviceHosts);
  for (const provider of providers) {
    for (const host of [
      ...(PROVIDER_AUTH_HOSTS[provider?.id] || []),
      ...(provider?.networkHosts || []),
    ]) {
      const approved = cleanHost(host);
      if (approved) serviceHosts.add(approved);
    }
    addDownload(provider?.nativeApp?.homepage, downloadOrigins);
    addDownload(provider?.nativeApp?.releaseUrl, downloadOrigins);
    addDownload(provider?.nativeApp?.repository, downloadOrigins);
  }
  for (const source of downloadSources) addDownload(source, downloadOrigins);
  function serviceUrl(value) {
    const url = cleanHttpsUrl(value, { allowHash: true });
    if (!url) return null;
    return [...serviceHosts].some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
      ? url
      : null;
  }
  return Object.freeze({
    allowsProviderLaunch(value) {
      const url = cleanHttpsUrl(value);
      return Boolean(url && launchUrls.has(url.href));
    },
    allowsServiceUrl(value) {
      return Boolean(serviceUrl(value));
    },
    allowsExternalUrl(value) {
      const url = serviceUrl(value) || cleanHttpsUrl(value);
      return Boolean(
        url &&
        (serviceHosts.has(url.hostname) ||
          [...serviceHosts].some((host) => url.hostname.endsWith(`.${host}`)) ||
          downloadOrigins.has(url.origin)),
      );
    },
    get diagnostics() {
      return Object.freeze({
        launchUrls: launchUrls.size,
        serviceHosts: serviceHosts.size,
        downloadOrigins: downloadOrigins.size,
      });
    },
  });
}
