const MAX_DEEP_LINK_LENGTH = 2048;
const BACKEND_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Normalize the only deep-link shape the desktop shell is allowed to handle. */
export function normalizeSpartanDeepLink(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_DEEP_LINK_LENGTH) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'spartan:' || url.hostname !== 'launch' || (url.pathname !== '' && url.pathname !== '/') || url.username || url.password || url.port || url.hash) return null;
    const keys = [...url.searchParams.keys()];
    if (keys.some(key => key !== 'backend') || keys.length !== 1) return null;
    const backendId = url.searchParams.get('backend');
    if (!backendId || !BACKEND_ID.test(backendId)) return null;
    return Object.freeze({version: 1, action: 'launch', backendId});
  } catch {
    return null;
  }
}

/** Find the first valid Spartan link in platform-provided process arguments. */
export function findSpartanDeepLink(values = []) {
  if (!Array.isArray(values)) return null;
  for (const value of values) {
    const link = normalizeSpartanDeepLink(value);
    if (link) return link;
  }
  return null;
}

export {MAX_DEEP_LINK_LENGTH};
