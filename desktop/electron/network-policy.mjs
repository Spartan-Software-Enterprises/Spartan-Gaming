function cleanHttpsUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return null;
    return url;
  } catch { return null; }
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
export function createApprovedNetworkPolicy({providers = [], games = [], downloadSources = []} = {}) {
  const launchUrls = new Set(); const serviceHosts = new Set(); const downloadOrigins = new Set();
  for (const entry of [...providers, ...games]) addService(entry, launchUrls, serviceHosts);
  for (const provider of providers) {
    addDownload(provider?.nativeApp?.homepage, downloadOrigins);
    addDownload(provider?.nativeApp?.releaseUrl, downloadOrigins);
    addDownload(provider?.nativeApp?.repository, downloadOrigins);
  }
  for (const source of downloadSources) addDownload(source, downloadOrigins);
  function serviceUrl(value) {
    const url = cleanHttpsUrl(value);
    if (!url) return null;
    return [...serviceHosts].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url : null;
  }
  return Object.freeze({
    allowsProviderLaunch(value) { const url = cleanHttpsUrl(value); return Boolean(url && launchUrls.has(url.href)); },
    allowsServiceUrl(value) { return Boolean(serviceUrl(value)); },
    allowsExternalUrl(value) { const url = serviceUrl(value) || cleanHttpsUrl(value); return Boolean(url && (serviceHosts.has(url.hostname) || [...serviceHosts].some(host => url.hostname.endsWith(`.${host}`)) || downloadOrigins.has(url.origin))); },
    get diagnostics() { return Object.freeze({launchUrls: launchUrls.size, serviceHosts: serviceHosts.size, downloadOrigins: downloadOrigins.size}); },
  });
}
