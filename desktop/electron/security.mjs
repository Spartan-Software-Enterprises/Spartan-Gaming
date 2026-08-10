const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isAllowedNavigation(rawUrl, {frontendOrigin} = {}) {
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (frontendOrigin && url.origin === frontendOrigin) return true;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

export function isAllowedProviderUrl(rawUrl) {
  try { return new URL(rawUrl).protocol === 'https:'; } catch { return false; }
}

