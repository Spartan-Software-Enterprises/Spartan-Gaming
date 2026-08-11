export function isAllowedNavigation(rawUrl, {appOrigin} = {}) {
  try {
    const url = new URL(rawUrl); const expected = new URL(appOrigin);
    return !url.username && !url.password && url.protocol === expected.protocol && url.hostname === expected.hostname && url.port === expected.port;
  } catch { return false; }
}
