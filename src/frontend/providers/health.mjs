const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const SAFE_PROTOCOLS = new Set(['https:', 'http:']);

function required(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}
function localHost(hostname) {
  return LOCAL_HOSTS.has(hostname) || hostname.endsWith('.local');
}
function clockMs() {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

export function normalizeProviderHealthTarget(value) {
  const parsed = new URL(required(value, 'provider URL'));
  if (!SAFE_PROTOCOLS.has(parsed.protocol))
    throw new TypeError('provider health checks require HTTP or HTTPS');
  if (parsed.protocol === 'http:' && !localHost(parsed.hostname))
    throw new TypeError('remote provider health checks require HTTPS');
  if (parsed.username || parsed.password)
    throw new TypeError('provider health checks do not accept URL credentials');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function result(values) {
  return Object.freeze({ ...values });
}

export async function openProviderAuthentication({
  url,
  openProvider = globalThis.spartanElectron?.openProvider,
  openExternal = globalThis.spartanElectron?.openExternal,
  windowOpen = globalThis.open,
} = {}) {
  const target = normalizeProviderHealthTarget(url);
  if (typeof openProvider === 'function') {
    await openProvider(target, 'Sign in to provider', { autoLogin: true });
    return Object.freeze({ mode: 'provider', url: target });
  }
  if (typeof openExternal === 'function') {
    await openExternal(target);
    return Object.freeze({ mode: 'electron', url: target });
  }
  if (typeof windowOpen === 'function') {
    const opened = windowOpen(target, '_blank', 'noopener,noreferrer');
    if (!opened) throw new Error('The official sign-in window was blocked');
    return Object.freeze({ mode: 'browser', url: target });
  }
  throw new Error('No supported official sign-in surface is available');
}

export async function checkProviderReachability({
  url,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
  AbortControllerImpl = globalThis.AbortController,
  now = clockMs,
} = {}) {
  const target = normalizeProviderHealthTarget(url);
  if (typeof fetchImpl !== 'function')
    return result({
      status: 'indeterminate',
      url: target,
      reason: 'fetch is unavailable in this browser',
    });
  const timeout = Math.max(250, Math.min(30_000, Number(timeoutMs) || 5000));
  const controller = typeof AbortControllerImpl === 'function' ? new AbortControllerImpl() : null;
  const started = now();
  let timer;
  try {
    timer = setTimeout(() => controller?.abort(), timeout);
    const response = await fetchImpl(target, {
      method: 'GET',
      mode: 'no-cors',
      credentials: 'include',
      redirect: 'follow',
      cache: 'no-store',
      ...(controller ? { signal: controller.signal } : {}),
    });
    const latencyMs = Math.max(0, Math.round(now() - started));
    if (response?.type === 'opaque' || response?.status === 0)
      return result({
        status: 'indeterminate',
        url: target,
        latencyMs,
        reason: 'provider response did not expose a readable status; sign-in may be required',
      });
    const status = Number(response?.status) || 0;
    if (status >= 200 && status < 400)
      return result({
        status: 'reachable',
        url: target,
        httpStatus: status,
        latencyMs,
        reason: 'provider responded without credentials',
      });
    return result({
      status: 'unavailable',
      url: target,
      httpStatus: status,
      latencyMs,
      reason: `provider returned HTTP ${status}`,
    });
  } catch (error) {
    const latencyMs = Math.max(0, Math.round(now() - started));
    if (error?.name === 'AbortError')
      return result({
        status: 'timeout',
        url: target,
        latencyMs,
        reason: `provider did not respond within ${timeout} ms`,
      });
    return result({
      status: 'indeterminate',
      url: target,
      latencyMs,
      reason:
        'provider authentication or CORS prevented a reliable status; sign in through the official service',
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
