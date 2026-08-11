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
      method: 'HEAD',
      mode: 'cors',
      credentials: 'omit',
      redirect: 'manual',
      cache: 'no-store',
      ...(controller ? { signal: controller.signal } : {}),
    });
    const latencyMs = Math.max(0, Math.round(now() - started));
    if (response?.type === 'opaque' || response?.status === 0)
      return result({
        status: 'indeterminate',
        url: target,
        latencyMs,
        reason: 'provider response was opaque; CORS prevented a reliable status',
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
        'provider could not be checked without credentials; verify the official service in a new tab',
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
